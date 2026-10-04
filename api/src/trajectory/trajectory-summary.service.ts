import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AffinityLevel,
  AiRunStatus,
  AiTaskType,
  CONTACT_CHANNEL_LABEL,
  CV_TEMPLATES,
  CvTemplate,
  ConstancyStatus,
  RegistrationStatus,
  TRAJECTORY_DISCLAIMER,
  TRAJECTORY_SECTIONS,
  TRAJECTORY_SECTION_LABEL,
  TrajectorySection,
} from '@perfil/shared';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { AffinityResult } from '../entities/affinity-result.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { Project } from '../entities/project.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { BackedSkillsService } from '../backed-skills/backed-skills.service';
import { PDF_THEMES, PdfWriter } from './pdf-writer';
import { StudentBadge } from '../entities/gamification.entity';
import { StudentContactChannel } from '../entities/contact-channel.entity';
import { AiAssistanceRun } from '../entities/ai-assistance-run.entity';

/** Opciones del CV (V2 §61): plantilla y presentación propia. */
export interface CvOptions {
  template?: CvTemplate;
  /** Presentación escrita por el estudiante o adoptada de una sugerencia. */
  summaryText?: string | null;
  /** Si la presentación vino de la IA, la ejecución que el estudiante aceptó. */
  summaryAiRunId?: string | null;
  userId?: string;
}

const NIVEL: Record<AffinityLevel, string> = {
  [AffinityLevel.HIGH]: 'alto',
  [AffinityLevel.MEDIUM]: 'medio',
  [AffinityLevel.LOW]: 'bajo',
};

/**
 * Resumen de Trayectoria Académica Complementaria (§67).
 *
 * §67 usa la palabra **seleccionablemente**: el estudiante decide qué entra.
 * Por eso no hay un «resumen completo» que el sistema arme por su cuenta; hay
 * una lista de secciones y lo que él marque.
 *
 * La advertencia de §67 va en el documento y no en la pantalla desde la que se
 * descarga: el PDF circula solo, y quien lo reciba tiene que poder leer qué es
 * y qué no es sin haber visto nunca el sistema. Por eso no es opcional.
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
    private readonly backedSkills: BackedSkillsService,
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
      disclaimer: TRAJECTORY_DISCLAIMER,
      templates: CV_TEMPLATES,
    };
  }

  /**
   * Arma el resumen con las secciones pedidas.
   *
   * Sin secciones, se incluyen los datos básicos y nada más: un documento vacío
   * confundiría más que ayudaría, y quien no eligió nada probablemente aún no
   * sabe qué puede elegir.
   */
  async build(studentProfileId: string, pedidas: TrajectorySection[], opts: CvOptions = {}) {
    await this.assertTextoAprobado(opts);
    const perfil = await this.profiles.findOne({
      where: { id: studentProfileId },
      relations: { user: true },
    });
    if (!perfil) throw new NotFoundException('Perfil no encontrado.');

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

    const necesitaProyectos =
      incluye.has(TrajectorySection.PROJECTS)
      || incluye.has(TrajectorySection.CONTRIBUTIONS)
      || incluye.has(TrajectorySection.TECHNOLOGIES);

    if (necesitaProyectos) {
      const propios = await this.projects.find({
        where: { createdByProfileId: studentProfileId },
        order: { createdAt: 'DESC' },
      });
      // Solo las contribuciones confirmadas por su dueño (§33): el resumen no
      // puede afirmar lo que el propio estudiante no confirmó.
      const pertenencias = await this.members.find({
        where: { userId: perfil.userId },
        relations: { project: true, memberSkills: { skill: true } },
      });
      const confirmadas = pertenencias.filter((m) => m.contributionConfirmedAt && m.project);

      salida.projects = [
        ...propios.map((p) => ({
          title: p.title,
          description: p.description,
          role: 'Responsable',
          contribution: null as string | null,
          technologies: incluye.has(TrajectorySection.TECHNOLOGIES) ? p.technologies ?? [] : [],
          backingTier: p.backingTier,
        })),
        ...confirmadas
          .filter((m) => m.project!.createdByProfileId !== studentProfileId)
          .map((m) => ({
            title: m.project!.title,
            description: m.project!.description,
            role: m.role ?? 'Integrante',
            contribution: incluye.has(TrajectorySection.CONTRIBUTIONS) ? m.contribution : null,
            technologies: incluye.has(TrajectorySection.TECHNOLOGIES)
              ? (m.memberSkills ?? []).map((s) => s.skill?.name).filter((n): n is string => !!n)
              : [],
            backingTier: m.project!.backingTier,
          })),
      ];
    }

    if (incluye.has(TrajectorySection.TECHNOLOGIES)) {
      // «Tecnologías respaldadas» (V2 §61.1): las que la trayectoria
      // respalda, nunca una autoevaluación. El CV no inventa (§61.3).
      salida.skills = (await this.backedSkills.forProfile(studentProfileId)).map((s) => ({
        name: s.name,
        sources: s.sources,
        evidenceCount: s.evidenceCount,
      }));
    }

    if (incluye.has(TrajectorySection.ACTIVITIES)) {
      // §67 dice «actividades confirmadas»: una inscripción sin participación
      // confirmada no es una actividad realizada, y el resumen no la afirma.
      const filas = await this.registrations.find({
        where: { studentProfileId, status: RegistrationStatus.CONFIRMED },
        relations: { activity: true },
      });
      salida.activities = filas.map((r) => ({
        title: r.activity?.title ?? 'Actividad',
        type: r.activity?.type ?? null,
        date: r.activity?.eventDate ?? null,
      }));
    }

    if (incluye.has(TrajectorySection.CERTIFICATES)) {
      const filas = await this.certificates.find({ where: { studentProfileId } });
      // §105: metadata seleccionada, nunca el archivo. El PDF del certificado
      // es privado y no viaja dentro de un resumen que circula.
      salida.certificates = filas.map((c) => ({
        name: c.certificateName,
        issuer: c.issuer,
        issueDate: c.issueDate,
      }));
    }

    if (incluye.has(TrajectorySection.CONSTANCIES)) {
      const filas = await this.constancies.find({
        where: { studentProfileId, status: ConstancyStatus.AUTHORIZED },
      });
      salida.constancies = filas.map((c) => ({
        description: c.description,
        issuedAt: c.createdAt,
      }));
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
      salida.badges = filas.map((b) => ({
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
        pdf.bullet(`${p.title} — ${p.role}`);
        if (p.description) pdf.paragraph(`     ${p.description}`);
        if (p.contribution) pdf.paragraph(`     Contribución: ${p.contribution}`);
        if ((p.technologies ?? []).length > 0) {
          pdf.paragraph(`     Tecnologías: ${p.technologies.join(', ')}`);
        }
      }
    }

    if (Array.isArray(datos.skills) && datos.skills.length > 0) {
      pdf.section('Tecnologías y habilidades');
      pdf.paragraph(datos.skills.map((s: any) => s.name).join(' · '));
    }

    if (Array.isArray(datos.activities) && datos.activities.length > 0) {
      pdf.section('Actividades con participación confirmada');
      for (const a of datos.activities) {
        pdf.bullet(a.date ? `${a.title} (${this.fecha(a.date)})` : a.title);
      }
    }

    if (Array.isArray(datos.certificates) && datos.certificates.length > 0) {
      pdf.section('Certificados externos');
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
