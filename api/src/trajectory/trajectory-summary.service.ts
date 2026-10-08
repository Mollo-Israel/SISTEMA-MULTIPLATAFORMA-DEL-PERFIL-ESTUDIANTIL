import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ActivityOrigin,
  ActivityType,
  AffinityLevel,
  AiRunStatus,
  AiTaskType,
  BackingTier,
  CONTACT_CHANNEL_LABEL,
  CV_ITEM_SECTIONS,
  CV_SECTIONS,
  CV_TEMPLATES,
  CvTemplate,
  ConstancyStatus,
  ProjectStatus,
  RegistrationStatus,
  TRAJECTORY_DISCLAIMER,
  TRAJECTORY_LEVEL_LABEL,
  TRAJECTORY_SECTIONS,
  TRAJECTORY_SECTION_LABEL,
  TrajectoryLevel,
  TrajectorySection,
  ValidationResourceType,
} from '@perfil/shared';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { AffinityResult } from '../entities/affinity-result.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { Project } from '../entities/project.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { ProjectFeedback } from '../entities/project-feedback.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { TeamMember } from '../entities/collaboration.entity';
import { ValidationRecord } from '../entities/validation-record.entity';
import { BackedSkillsService } from '../backed-skills/backed-skills.service';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { PDF_THEMES, PdfWriter } from './pdf-writer';
import { StudentBadge } from '../entities/gamification.entity';
import { StudentContactChannel } from '../entities/contact-channel.entity';
import { AiAssistanceRun } from '../entities/ai-assistance-run.entity';
import {
  activityCvEligible,
  certificateCvEligible,
  certificateLevel,
  projectCvEligible,
  projectLevel,
  registrationLevel,
} from './cv-eligibility.rules';

/** Opciones del CV (V2 §61, V3 §43): plantilla, presentación propia e ítems. */
export interface CvOptions {
  template?: CvTemplate;
  /** Presentación escrita por el estudiante o adoptada de una sugerencia. */
  summaryText?: string | null;
  /** Si la presentación vino de la IA, la ejecución que el estudiante aceptó. */
  summaryAiRunId?: string | null;
  userId?: string;
  /**
   * V3 §43.2: ítems concretos por sección, en el orden en que deben salir.
   * Una sección sin lista incluye todos sus ítems elegibles.
   */
  items?: Partial<Record<TrajectorySection, string[]>> | null;
}

const NIVEL: Record<AffinityLevel, string> = {
  [AffinityLevel.HIGH]: 'alto',
  [AffinityLevel.MEDIUM]: 'medio',
  [AffinityLevel.LOW]: 'bajo',
};

/** Un ítem elegible del currículo, tal como se ofrece para marcar (V3 §43.2). */
export interface CvItem {
  id: string;
  title: string;
  detail: string | null;
}

/** Una entrada de «Mi trayectoria» (V3 §42). */
export interface TrajectoryEntry {
  kind: 'project' | 'activity' | 'external_opportunity' | 'constancy' | 'credential' | 'team' | 'feedback';
  id: string;
  title: string;
  date: Date | null;
  level: TrajectoryLevel | null;
  levelLabel: string | null;
  detail: string;
  cvEligible: boolean;
}

/**
 * Trayectoria y currículo (§67; V3 §41 a §45).
 *
 * El currículo se elige en dos niveles: secciones y, dentro de cada una, los
 * ítems concretos (V3 §43). Solo se ofrecen los ítems elegibles —proyectos
 * corroborados o revisados, participaciones confirmadas, credenciales
 * corroboradas— y lo que no lo es sigue visible en «Mi trayectoria», con su
 * nivel explicado en lenguaje natural (§42).
 *
 * La advertencia va en el documento y no solo en la pantalla: el PDF circula
 * solo, y quien lo reciba tiene que poder leer qué es y qué no es.
 */
@Injectable()
export class TrajectorySummaryService {
  constructor(
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(AffinityResult) private readonly affinities: Repository<AffinityResult>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember) private readonly members: Repository<ProjectMember>,
    @InjectRepository(ActivityRegistration)
    private readonly registrations: Repository<ActivityRegistration>,
    @InjectRepository(ExternalCertificate)
    private readonly certificates: Repository<ExternalCertificate>,
    @InjectRepository(InternalConstancy)
    private readonly constancies: Repository<InternalConstancy>,
    @InjectRepository(ProjectEvidence) private readonly evidences: Repository<ProjectEvidence>,
    @InjectRepository(StudentBadge) private readonly badges: Repository<StudentBadge>,
    @InjectRepository(StudentContactChannel)
    private readonly channels: Repository<StudentContactChannel>,
    @InjectRepository(AiAssistanceRun) private readonly aiRuns: Repository<AiAssistanceRun>,
    @InjectRepository(ValidationRecord) private readonly validations: Repository<ValidationRecord>,
    @InjectRepository(ProjectFeedback) private readonly feedback: Repository<ProjectFeedback>,
    @InjectRepository(TeamMember) private readonly teamMembers: Repository<TeamMember>,
    private readonly backedSkills: BackedSkillsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * V2 §61.3: un texto generado se exporta solo si su autor lo aprobó. Si la
   * presentación viene de una sugerencia, esa sugerencia tiene que ser suya,
   * de redacción del CV y aceptada.
   */
  private async assertTextoAprobado(opts: CvOptions): Promise<void> {
    if (!opts.summaryAiRunId) return;
    const run = await this.aiRuns.findOne({ where: { id: opts.summaryAiRunId } });
    if (
      !run
      || run.requestedById !== opts.userId
      || run.taskType !== AiTaskType.CV_TEXT_ASSIST
      || run.status !== AiRunStatus.COMPLETED
      || !run.acceptedAt
    ) {
      throw new ConflictException({
        code: 'CV_TEXT_NOT_APPROVED',
        message: 'Acepta la sugerencia antes de usarla en tu CV.',
      });
    }
  }

  /** Las secciones disponibles, para que la pantalla no las invente. */
  sections() {
    return {
      sections: TRAJECTORY_SECTIONS.map((s) => ({
        key: s,
        label: TRAJECTORY_SECTION_LABEL[s],
      })),
      /** V3 §43.1: el paso 1 del currículo, en su orden. */
      cvSections: CV_SECTIONS.map((s) => ({ ...s, hasItems: CV_ITEM_SECTIONS.includes(s.key) })),
      disclaimer: TRAJECTORY_DISCLAIMER,
      templates: CV_TEMPLATES,
    };
  }

  // =========================================================================
  // V3 §43.2 / §43.3 · Ítems elegibles
  // =========================================================================

  /** Todo lo que la trayectoria tiene y lo que de ello puede ir al currículo. */
  private async fuentes(studentProfileId: string) {
    const perfil = await this.profiles.findOne({ where: { id: studentProfileId }, relations: { user: true } });
    if (!perfil) throw new NotFoundException('Perfil no encontrado.');

    const [propios, pertenencias, inscripciones, certs, constancias] = await Promise.all([
      this.projects.find({ where: { createdByProfileId: studentProfileId }, order: { createdAt: 'DESC' } }),
      this.members.find({ where: { userId: perfil.userId }, relations: { project: true, memberSkills: { skill: true } } }),
      this.registrations.find({ where: { studentProfileId }, relations: { activity: true } }),
      this.certificates.find({ where: { studentProfileId }, order: { issueDate: 'DESC' } }),
      this.constancies.find({ where: { studentProfileId, status: ConstancyStatus.AUTHORIZED }, relations: { activity: true } }),
    ]);
    const validaciones = certs.length
      ? await this.validations.find({
          where: { resourceType: ValidationResourceType.EXTERNAL_CERTIFICATE, resourceId: In(certs.map((c) => c.id)) },
        })
      : [];
    const validacionDe = new Map(validaciones.map((v) => [v.resourceId, v]));
    // §28: una credencial duplicada no vuelve a respaldar.
    const tierDe = (id: string): BackingTier | null => {
      const v = validacionDe.get(id);
      if (!v) return null;
      return v.duplicateOfId ? BackingTier.DECLARED : v.backingTier;
    };

    // Proyectos: propios y aquellos donde su contribución está confirmada.
    const vistos = new Set<string>();
    const proyectos: { project: Project; role: string; contribution: string | null; skills: string[] }[] = [];
    for (const p of propios) {
      vistos.add(p.id);
      proyectos.push({ project: p, role: 'Responsable', contribution: null, skills: p.technologies ?? [] });
    }
    for (const m of pertenencias) {
      if (!m.project || vistos.has(m.project.id) || !m.contributionConfirmedAt) continue;
      vistos.add(m.project.id);
      proyectos.push({
        project: m.project,
        role: m.role ?? 'Integrante',
        contribution: m.contribution,
        skills: (m.memberSkills ?? []).map((s) => s.skill?.name).filter((n): n is string => !!n),
      });
    }

    return { perfil, proyectos, inscripciones, certs, constancias, tierDe, validacionDe };
  }

  /** V3 §43.2: por sección, los ítems que se pueden marcar y cuántos quedan fuera y por qué. */
  async eligibleItems(studentProfileId: string) {
    const f = await this.fuentes(studentProfileId);
    const conConstancia = new Set(f.constancias.map((c) => c.activityId).filter((x): x is string => !!x));

    const proyectos = f.proyectos.filter((p) => projectCvEligible(p.project.status, p.project.backingTier));
    const confirmadas = f.inscripciones.filter((r) => activityCvEligible(r.status, r.activity?.originType));
    const academicas = confirmadas.filter((r) => r.activity?.type !== ActivityType.EXTRACURRICULAR);
    const extra = confirmadas.filter((r) => r.activity?.type === ActivityType.EXTRACURRICULAR);
    const pendientesInternas = f.inscripciones.filter((r) =>
      (r.activity?.originType ?? ActivityOrigin.INTERNAL) === ActivityOrigin.INTERNAL
      && [RegistrationStatus.REGISTERED, RegistrationStatus.INTERESTED].includes(r.status));
    const certs = f.certs.filter((c) => certificateCvEligible(f.tierDe(c.id)));
    const skills = await this.backedSkills.forProfile(studentProfileId);
    const insignias = await this.badges.find({ where: { studentProfileId }, relations: { badge: true }, order: { awardedAt: 'ASC' } });

    const actividad = (r: ActivityRegistration): CvItem => ({
      id: r.activityId,
      title: r.activity?.title ?? 'Actividad',
      detail: [
        r.activity?.eventDate ? this.fecha(r.activity.eventDate) : null,
        conConstancia.has(r.activityId) ? 'Constancia interna disponible' : null,
      ].filter(Boolean).join(' · ') || null,
    });

    const seccion = (key: TrajectorySection, items: CvItem[], excluded = 0, reason: string | null = null) => ({
      key,
      label: CV_SECTIONS.find((s) => s.key === key)?.label ?? TRAJECTORY_SECTION_LABEL[key],
      items,
      excluded: excluded > 0 ? { count: excluded, reason } : null,
    });

    return {
      sections: [
        seccion(
          TrajectorySection.PROJECTS,
          proyectos.map((p) => ({
            id: p.project.id,
            title: p.project.title,
            detail: `${p.role} · ${TRAJECTORY_LEVEL_LABEL[projectLevel(p.project.status, p.project.backingTier)].label}`,
          })),
          f.proyectos.length - proyectos.length,
          'Solo entran proyectos activos y corroborados o revisados por un docente. Los demás siguen en tu trayectoria.',
        ),
        seccion(TrajectorySection.ACADEMIC_ACTIVITIES, academicas.map(actividad),
          pendientesInternas.length, 'Una actividad entra cuando el responsable confirma tu participación.'),
        seccion(TrajectorySection.EXTRACURRICULAR_ACTIVITIES, extra.map(actividad)),
        seccion(
          TrajectorySection.CERTIFICATES,
          certs.map((c) => ({ id: c.id, title: c.certificateName, detail: [c.issuer, c.issueDate ? this.fecha(c.issueDate) : null].filter(Boolean).join(' · ') })),
          f.certs.length - certs.length,
          'Solo entran credenciales corroboradas: una inscripción o una credencial sin corroborar no prueba que terminaste el curso.',
        ),
        seccion(
          TrajectorySection.CONSTANCIES,
          f.constancias.map((c) => ({ id: c.id, title: c.description, detail: c.activity?.title ?? null })),
        ),
        seccion(
          TrajectorySection.TECHNOLOGIES,
          skills.map((s) => ({ id: s.skillId, title: s.name, detail: `${s.evidenceCount} respaldo(s)` })),
        ),
        seccion(
          TrajectorySection.BADGES,
          insignias.map((b) => ({ id: b.id, title: b.badge?.name ?? 'Insignia', detail: this.fecha(b.awardedAt) })),
        ),
      ],
    };
  }

  /**
   * Aplica la selección de un nivel (V3 §43.2): sin lista, todos los elegibles;
   * con lista, solo esos y en ese orden. Un id que no es elegible no se cuela
   * en silencio: se rechaza, porque el currículo no afirma lo que no puede.
   */
  private elegir<T>(seccion: TrajectorySection, items: T[], idDe: (t: T) => string, opts: CvOptions): T[] {
    const pedidos = opts.items?.[seccion];
    if (!pedidos) return items;
    const porId = new Map(items.map((i) => [idDe(i), i]));
    const ajenos = pedidos.filter((id) => !porId.has(id));
    if (ajenos.length) {
      throw new BadRequestException({
        code: 'CV_ITEM_NOT_ELIGIBLE',
        message: 'Uno de los ítems elegidos no puede ir al currículo: no existe, no es tuyo o todavía no está respaldado.',
        details: { section: seccion, ids: ajenos },
      });
    }
    return [...new Set(pedidos)].map((id) => porId.get(id)!);
  }

  private validarItems(opts: CvOptions) {
    const items = opts.items;
    if (!items) return;
    if (typeof items !== 'object' || Array.isArray(items)) {
      throw new BadRequestException({ code: 'CV_ITEMS_INVALID', message: 'La selección de ítems no es válida.' });
    }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const [k, v] of Object.entries(items)) {
      if (!CV_ITEM_SECTIONS.includes(k as TrajectorySection) || !Array.isArray(v) || v.length > 100
        || !v.every((x) => typeof x === 'string' && uuid.test(x))) {
        throw new BadRequestException({
          code: 'CV_ITEMS_INVALID',
          message: 'La selección de ítems no es válida.',
          details: { section: k },
        });
      }
    }
  }

  /**
   * Arma el resumen con las secciones y los ítems pedidos.
   *
   * Sin secciones, se incluyen los datos básicos y nada más: un documento vacío
   * confundiría más que ayudaría, y quien no eligió nada probablemente aún no
   * sabe qué puede elegir.
   */
  async build(studentProfileId: string, pedidas: TrajectorySection[], opts: CvOptions = {}) {
    await this.assertTextoAprobado(opts);
    this.validarItems(opts);
    const f = await this.fuentes(studentProfileId);
    const perfil = f.perfil;

    const incluye = new Set(
      pedidas.length > 0 ? pedidas : [TrajectorySection.BASIC],
    );
    incluye.add(TrajectorySection.BASIC);

    const salida: Record<string, unknown> = {
      generatedAt: new Date(),
      disclaimer: TRAJECTORY_DISCLAIMER,
      template: opts.template ?? CvTemplate.CLASSIC,
      sections: [...incluye],
      student: {
        name: perfil.user ? `${perfil.user.firstName} ${perfil.user.lastName}` : 'Estudiante',
        semester: perfil.semester,
        career: 'Ingeniería en Sistemas Informáticos',
      },
    };

    // La presentación propia reemplaza a la biografía del perfil, que es otra
    // cosa (§60): el perfil dinámico no tiene por qué ser el texto del CV.
    const propia = (opts.summaryText ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim();
    if (incluye.has(TrajectorySection.BIO)) salida.bio = propia || perfil.bio;

    const necesitaAfinidad =
      incluye.has(TrajectorySection.AREAS)
      || incluye.has(TrajectorySection.AFFINITY)
      || incluye.has(TrajectorySection.SUPPORT);

    if (necesitaAfinidad) {
      const filas = await this.affinities.find({
        where: { studentProfileId },
        relations: { academicArea: true },
        order: { score: 'DESC' },
        take: 8,
      });
      salida.areas = filas.map((r) => ({
        area: r.academicArea?.name ?? null,
        ...(incluye.has(TrajectorySection.AFFINITY) ? { score: Number(r.score) } : {}),
        ...(incluye.has(TrajectorySection.SUPPORT)
          ? {
              supportScore: r.supportScore,
              supportLevel: r.supportLevel ?? AffinityLevel.LOW,
            }
          : {}),
      }));
    }

    if (incluye.has(TrajectorySection.PROJECTS) || incluye.has(TrajectorySection.CONTRIBUTIONS)) {
      // V3 §43.3: solo proyectos activos y corroborados o revisados, y solo
      // las contribuciones que su dueño confirmó (§33).
      const elegibles = f.proyectos.filter((p) => projectCvEligible(p.project.status, p.project.backingTier));
      salida.projects = this.elegir(TrajectorySection.PROJECTS, elegibles, (p) => p.project.id, opts).map((p) => ({
        id: p.project.id,
        title: p.project.title,
        description: p.project.description,
        role: p.role,
        contribution: incluye.has(TrajectorySection.CONTRIBUTIONS) ? p.contribution : null,
        technologies: incluye.has(TrajectorySection.TECHNOLOGIES) ? p.skills : [],
        backingTier: p.project.backingTier,
        level: TRAJECTORY_LEVEL_LABEL[projectLevel(p.project.status, p.project.backingTier)].label,
      }));
    }

    if (incluye.has(TrajectorySection.TECHNOLOGIES)) {
      // «Tecnologías respaldadas» (V2 §61.1): las que la trayectoria
      // respalda, nunca una autoevaluación. El CV no inventa (§61.3).
      const todas = await this.backedSkills.forProfile(studentProfileId);
      salida.skills = this.elegir(TrajectorySection.TECHNOLOGIES, todas, (s) => s.skillId, opts).map((s) => ({
        id: s.skillId,
        name: s.name,
        sources: s.sources,
        evidenceCount: s.evidenceCount,
      }));
    }

    // V3 §44: una participación confirmada es una experiencia institucional;
    // si además tiene constancia, se dice en la misma línea y no se duplica.
    const conConstancia = new Set(f.constancias.map((c) => c.activityId).filter((x): x is string => !!x));
    const confirmadas = f.inscripciones.filter((r) => activityCvEligible(r.status, r.activity?.originType));
    const vistaActividad = (r: ActivityRegistration) => ({
      id: r.activityId,
      title: r.activity?.title ?? 'Actividad',
      type: r.activity?.type ?? null,
      date: r.activity?.eventDate ?? null,
      constancy: conConstancia.has(r.activityId),
    });
    const actividadesIncluidas = new Set<string>();
    const tomar = (seccion: TrajectorySection, lista: ActivityRegistration[]) => {
      const elegidas = this.elegir(seccion, lista, (r) => r.activityId, opts).map(vistaActividad);
      elegidas.forEach((a) => actividadesIncluidas.add(a.id));
      return elegidas;
    };
    if (incluye.has(TrajectorySection.ACTIVITIES)) {
      salida.activities = tomar(TrajectorySection.ACTIVITIES, confirmadas);
    }
    if (incluye.has(TrajectorySection.ACADEMIC_ACTIVITIES)) {
      salida.academicActivities = tomar(TrajectorySection.ACADEMIC_ACTIVITIES,
        confirmadas.filter((r) => r.activity?.type !== ActivityType.EXTRACURRICULAR));
    }
    if (incluye.has(TrajectorySection.EXTRACURRICULAR_ACTIVITIES)) {
      salida.extracurricularActivities = tomar(TrajectorySection.EXTRACURRICULAR_ACTIVITIES,
        confirmadas.filter((r) => r.activity?.type === ActivityType.EXTRACURRICULAR));
    }

    if (incluye.has(TrajectorySection.CERTIFICATES)) {
      // V3 §45: completar un curso externo se afirma solo con la credencial
      // corroborada. §105: metadata seleccionada, nunca el archivo.
      const elegibles = f.certs.filter((c) => certificateCvEligible(f.tierDe(c.id)));
      salida.certificates = this.elegir(TrajectorySection.CERTIFICATES, elegibles, (c) => c.id, opts).map((c) => ({
        id: c.id,
        name: c.certificateName,
        issuer: c.issuer,
        issueDate: c.issueDate,
      }));
    }

    if (incluye.has(TrajectorySection.CONSTANCIES)) {
      // §44: la constancia de una actividad ya incluida va en esa línea.
      const elegidas = this.elegir(TrajectorySection.CONSTANCIES, f.constancias, (c) => c.id, opts);
      salida.constancies = elegidas
        .filter((c) => !c.activityId || !actividadesIncluidas.has(c.activityId))
        .map((c) => ({ id: c.id, description: c.description, issuedAt: c.createdAt }));
    }

    if (incluye.has(TrajectorySection.EVIDENCES)) {
      const filas = await this.evidences.find({
        where: { studentProfileId },
        relations: { activity: true },
        order: { createdAt: 'DESC' },
        take: 20,
      });
      salida.evidences = filas.map((e) => ({
        description: e.description,
        type: e.evidenceType,
        context: e.activity?.title ?? null,
      }));
    }

    if (incluye.has(TrajectorySection.BADGES)) {
      const filas = await this.badges.find({
        where: { studentProfileId },
        relations: { badge: true },
        order: { awardedAt: 'ASC' },
      });
      // Reconocimientos internos de Afinia, sin valor académico (§31).
      salida.badges = this.elegir(TrajectorySection.BADGES, filas, (b) => b.id, opts).map((b) => ({
        id: b.id,
        name: b.badge?.name ?? 'Insignia',
        description: b.badge?.description ?? null,
        awardedAt: b.awardedAt,
      }));
    }

    if (incluye.has(TrajectorySection.CONTACT)) {
      // «Contacto autorizado» (§61.1): solo los canales que el estudiante ya
      // decidió compartir. El correo institucional no entra por omisión.
      const filas = await this.channels.find({ where: { studentProfileId }, order: { channel: 'ASC' } });
      salida.contact = filas.map((c) => ({ label: CONTACT_CHANNEL_LABEL[c.channel] ?? c.channel, value: c.value }));
    }

    return salida;
  }

  // =========================================================================
  // V3 §42 · Mi trayectoria
  // =========================================================================

  /**
   * El histórico completo, con el nivel de cada cosa en lenguaje natural:
   * declarado, con respaldo, corroborado, revisado o inconcluso. Incluye lo
   * que no entra al currículo, para que el estudiante sepa qué le falta.
   */
  async history(studentProfileId: string) {
    const f = await this.fuentes(studentProfileId);
    const entradas: TrajectoryEntry[] = [];
    const nivel = (l: TrajectoryLevel | null) => (l ? TRAJECTORY_LEVEL_LABEL[l].label : null);

    for (const p of f.proyectos) {
      const l = projectLevel(p.project.status, p.project.backingTier);
      const archivado = p.project.status === ProjectStatus.ARCHIVED ? ' Archivado.' : '';
      entradas.push({
        kind: 'project',
        id: p.project.id,
        title: p.project.title,
        date: p.project.createdAt,
        level: l,
        levelLabel: nivel(l),
        detail: `${p.role}. ${TRAJECTORY_LEVEL_LABEL[l].explain}${archivado}`,
        cvEligible: projectCvEligible(p.project.status, p.project.backingTier),
      });
    }

    for (const r of f.inscripciones) {
      const l = registrationLevel(r.status);
      if (!l) continue;
      const externa = r.activity?.originType === ActivityOrigin.EXTERNAL;
      const detalle: Record<string, string> = {
        [RegistrationStatus.CONFIRMED]: 'El responsable confirmó tu participación.',
        [RegistrationStatus.REGISTERED]: 'Inscrito: falta que el responsable confirme tu participación.',
        [RegistrationStatus.ACCEPTED]: 'El proveedor te aceptó: al terminar podrás adjuntar tu credencial.',
        [RegistrationStatus.INTERESTED]: 'Te interesa: todavía no te inscribiste.',
      };
      entradas.push({
        kind: externa ? 'external_opportunity' : 'activity',
        id: r.activityId,
        title: r.activity?.title ?? 'Actividad',
        date: r.activity?.eventDate ?? r.createdAt,
        // §45: en una oportunidad externa, lo que prueba haberla terminado es la credencial.
        level: externa && l === TrajectoryLevel.CORROBORATED ? TrajectoryLevel.SUPPORTED : l,
        levelLabel: nivel(externa && l === TrajectoryLevel.CORROBORATED ? TrajectoryLevel.SUPPORTED : l),
        detail: externa && r.status === RegistrationStatus.CONFIRMED
          ? 'Participación registrada. Para afirmar que completaste el curso, adjunta tu credencial.'
          : detalle[r.status] ?? '',
        cvEligible: activityCvEligible(r.status, r.activity?.originType),
      });
    }

    for (const c of f.constancias) {
      entradas.push({
        kind: 'constancy',
        id: c.id,
        title: c.description,
        date: c.createdAt,
        level: TrajectoryLevel.CORROBORATED,
        levelLabel: nivel(TrajectoryLevel.CORROBORATED),
        detail: c.activity?.title ? `Constancia interna de «${c.activity.title}».` : 'Constancia interna emitida.',
        cvEligible: true,
      });
    }

    for (const c of f.certs) {
      const v = f.validacionDe.get(c.id);
      const l = certificateLevel(f.tierDe(c.id), v?.manualReviewStatus ?? null);
      entradas.push({
        kind: 'credential',
        id: c.id,
        title: c.certificateName,
        date: c.issueDate ? new Date(c.issueDate) : c.createdAt,
        level: l,
        levelLabel: nivel(l),
        detail: `${c.issuer}. ${TRAJECTORY_LEVEL_LABEL[l].explain}`,
        cvEligible: certificateCvEligible(f.tierDe(c.id)),
      });
    }

    const equipos = await this.teamMembers.find({ where: { studentProfileId }, relations: { team: true } });
    for (const m of equipos) {
      if (!m.team) continue;
      entradas.push({
        kind: 'team',
        id: m.team.id,
        title: m.team.name,
        date: m.joinedAt,
        level: null,
        levelLabel: null,
        detail: m.role ? `Integrante · ${m.role}.` : 'Integrante.',
        cvEligible: false,
      });
    }

    const ids = f.proyectos.map((p) => p.project.id);
    const comentarios = ids.length
      ? await this.feedback.find({ where: { projectId: In(ids) }, relations: { project: true }, order: { createdAt: 'DESC' } })
      : [];
    for (const fb of comentarios) {
      entradas.push({
        kind: 'feedback',
        id: fb.id,
        title: `Retroalimentación docente en «${fb.project?.title ?? 'proyecto'}»`,
        date: fb.createdAt,
        level: TrajectoryLevel.REVIEWED,
        levelLabel: nivel(TrajectoryLevel.REVIEWED),
        detail: 'Orientación de un docente; no es una nota.',
        cvEligible: false,
      });
    }

    entradas.sort((a, b) => (b.date ? new Date(b.date).getTime() : 0) - (a.date ? new Date(a.date).getTime() : 0));

    // Evolución: afinidad y respaldo actuales por área (el historial está en «Afinidad»).
    const areas = await this.affinities.find({
      where: { studentProfileId },
      relations: { academicArea: true },
      order: { score: 'DESC' },
      take: 6,
    });

    const conteo = Object.fromEntries(
      Object.values(TrajectoryLevel).map((l) => [l, entradas.filter((e) => e.level === l).length]),
    ) as Record<TrajectoryLevel, number>;

    return {
      levels: Object.values(TrajectoryLevel).map((l) => ({ key: l, ...TRAJECTORY_LEVEL_LABEL[l], count: conteo[l] })),
      entries: entradas,
      evolution: areas.map((a) => ({
        area: a.academicArea?.name ?? null,
        score: Number(a.score),
        supportScore: a.supportScore === null || a.supportScore === undefined ? null : Number(a.supportScore),
        supportLevel: a.supportLevel ?? null,
      })),
    };
  }

  /**
   * El mismo resumen, en PDF (§67).
   *
   * Se construye desde el mismo objeto que devuelve la vista en pantalla: si
   * fueran dos caminos, tarde o temprano el papel diría algo distinto de lo que
   * el estudiante vio antes de descargarlo.
   */
  async buildPdf(
    studentProfileId: string,
    pedidas: TrajectorySection[],
    opts: CvOptions = {},
  ): Promise<{ filename: string; buffer: Buffer }> {
    const datos = (await this.build(studentProfileId, pedidas, opts)) as any;
    const pdf = new PdfWriter(
      'Resumen de Trayectoria Académica Complementaria',
      PDF_THEMES[(opts.template ?? CvTemplate.CLASSIC) as CvTemplate] ?? PDF_THEMES.classic,
    );

    pdf.title('Resumen de Trayectoria Académica Complementaria');
    pdf.subtitle(
      `${datos.student.name}`
      + (datos.student.semester ? ` · ${datos.student.semester}.º semestre` : '')
      + ` · ${datos.student.career}`,
    );

    if (datos.bio) {
      pdf.section('Presentación');
      pdf.paragraph(datos.bio);
    }

    if (Array.isArray(datos.areas) && datos.areas.length > 0) {
      pdf.section('Áreas principales');
      for (const a of datos.areas) {
        const partes: string[] = [a.area ?? 'Área'];
        if (a.score !== undefined) partes.push(`afinidad ${a.score}/100`);
        if (a.supportLevel !== undefined) {
          partes.push(`respaldo ${NIVEL[a.supportLevel as AffinityLevel]} (${a.supportScore}/100)`);
        }
        pdf.bullet(partes.join(' · '));
      }
    }

    if (Array.isArray(datos.projects) && datos.projects.length > 0) {
      pdf.section('Proyectos');
      for (const p of datos.projects) {
        pdf.bullet(`${p.title} — ${p.role}${p.level ? ` (${p.level.toLowerCase()})` : ''}`);
        if (p.description) pdf.paragraph(`     ${p.description}`);
        if (p.contribution) pdf.paragraph(`     Contribución: ${p.contribution}`);
        if ((p.technologies ?? []).length > 0) {
          pdf.paragraph(`     Tecnologías: ${p.technologies.join(', ')}`);
        }
      }
    }

    if (Array.isArray(datos.skills) && datos.skills.length > 0) {
      pdf.section('Habilidades respaldadas');
      pdf.paragraph(datos.skills.map((s: any) => s.name).join(' · '));
    }

    const actividades = (titulo: string, lista: any[] | undefined) => {
      if (!Array.isArray(lista) || lista.length === 0) return;
      pdf.section(titulo);
      for (const a of lista) {
        const fecha = a.date ? ` (${this.fecha(a.date)})` : '';
        pdf.bullet(`Participación confirmada en ${a.title}${fecha}${a.constancy ? ' · Constancia interna disponible' : ''}`);
      }
    };
    actividades('Actividades con participación confirmada', datos.activities);
    actividades('Actividades académicas internas', datos.academicActivities);
    actividades('Actividades extracurriculares internas', datos.extracurricularActivities);

    if (Array.isArray(datos.certificates) && datos.certificates.length > 0) {
      pdf.section('Credenciales y cursos externos');
      for (const c of datos.certificates) {
        pdf.bullet(`${c.name} — ${c.issuer}${c.issueDate ? ` (${this.fecha(c.issueDate)})` : ''}`);
      }
    }

    if (Array.isArray(datos.constancies) && datos.constancies.length > 0) {
      pdf.section('Constancias internas');
      for (const c of datos.constancies) pdf.bullet(c.description);
    }

    if (Array.isArray(datos.evidences) && datos.evidences.length > 0) {
      pdf.section('Evidencias');
      for (const e of datos.evidences) {
        pdf.bullet(e.context ? `${e.description ?? 'Evidencia'} — ${e.context}` : e.description);
      }
    }

    if (Array.isArray(datos.badges) && datos.badges.length > 0) {
      pdf.section('Insignias de Afinia');
      for (const b of datos.badges) pdf.bullet(`${b.name} (${this.fecha(b.awardedAt)})`);
      pdf.paragraph('Reconocimientos internos de participación; no tienen valor académico.');
    }

    if (Array.isArray(datos.contact) && datos.contact.length > 0) {
      pdf.section('Contacto');
      for (const c of datos.contact) pdf.bullet(`${c.label}: ${c.value}`);
    }

    pdf.note(`Generado el ${this.fecha(datos.generatedAt)}.`);
    pdf.note(TRAJECTORY_DISCLAIMER);

    // V3 §65: qué se exportó, sin el contenido.
    await this.audit.record({
      actorUserId: opts.userId ?? null,
      eventType: AuditEventType.CURRICULUM_EXPORTED,
      entityType: 'student_profile',
      entityId: studentProfileId,
      metadata: {
        plantilla: datos.template,
        secciones: datos.sections,
        items: Object.fromEntries(Object.entries(opts.items ?? {}).map(([k, v]) => [k, (v ?? []).length])),
      },
    });

    const limpio = String(datos.student.name)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return {
      filename: `resumen-trayectoria-${limpio || 'estudiante'}.pdf`,
      buffer: pdf.build(),
    };
  }

  private fecha(valor: string | Date): string {
    const d = valor instanceof Date ? valor : new Date(valor);
    return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
