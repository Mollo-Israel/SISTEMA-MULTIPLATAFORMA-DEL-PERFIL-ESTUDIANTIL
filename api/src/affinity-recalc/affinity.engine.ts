import { AuditEventType, AuditService } from '../audit/audit.service';
import { createHash } from 'crypto';
import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  AFFINITY_CAPS,
  AFFINITY_ENGINE_VERSION,
  AFFINITY_EXCLUDED_REASON,
  AFFINITY_MAX_RAW,
  AFFINITY_POINTS_V4,
  AffinityCalculationStatus,
  AffinityLevel,
  AffinityMatchType,
  AffinitySignalFamily,
  AffinitySignalType,
  AffinitySourceEntityType,
  AffinityWeightCode,
  BackingTier,
  ConstancyStatus,
  DIMINISHING,
  INDEPENDENT_SUPPORT_FAMILIES,
  LEVEL_THRESHOLDS,
  ProjectBackingTier,
  RegistrationStatus,
  SUPPORT_CAPS,
  SUPPORT_POINTS,
  ValidationResourceType,
  diminishingFactor,
  ProjectStatus,
  ProjectSkillEvidenceStatus,
} from '@perfil/shared';
import { StudentProfile } from '../entities/student-profile.entity';
import { StudentInterest } from '../entities/student-interest.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ProjectFeedback } from '../entities/project-feedback.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { ValidationRecord } from '../entities/validation-record.entity';
import { AffinityResult } from '../entities/affinity-result.entity';
import { AffinityWeight } from '../entities/affinity-weight.entity';
import { AffinityContribution } from '../entities/affinity-contribution.entity';
import { AffinitySnapshot } from '../entities/affinity-snapshot.entity';
import { AffinitySnapshotItem } from '../entities/affinity-snapshot-item.entity';
import { ProjectSkill } from '../entities/project-area.entity';
import { ActivitySkill } from '../entities/activity-skill.entity';
import { ExternalCertificateSkill } from '../entities/external-certificate.entity';

interface AreaInfo {
  id: string;
  /** Nombre normalizado en minusculas, para las coincidencias de texto. */
  name: string;
  /** Nombre tal cual se muestra al estudiante. */
  displayName: string;
  tags: string[];
}

/** Cubetas de tope de afinidad (§51). */
type AffinityBucket = 'interest' | 'skill' | 'activity' | 'project' | 'certificate';

/** Cubetas de tope de respaldo (§53). */
type SupportBucket = 'activity' | 'project' | 'certificate' | 'other';

/**
 * Una senal candidata, antes de aplicar rendimientos y topes.
 *
 * El motor trabaja en dos tiempos: primero reune TODO lo que podria puntuar y
 * despues puntua. Ese orden no es cosmetico. Los rendimientos decrecientes de
 * §51 dependen de cuantas senales hay en el area y en que orden quedan, y los
 * topes dependen del total: ninguna de las dos cosas se puede decidir mirando
 * una senal aislada.
 */
interface Senal {
  areaId: string;
  family: AffinitySignalFamily;
  signalType: AffinitySignalType;
  weightCode: AffinityWeightCode;
  matchType: AffinityMatchType;
  sourceEntityType: AffinitySourceEntityType | null;
  sourceId: string | null;
  /** Puntos de afinidad que dicta la regla, antes de rendimientos (§56). */
  base: number;
  /** Puntos de respaldo que dicta la regla (§53). */
  supportBase: number;
  /** Cubeta de tope de afinidad, o null si la senal no suma afinidad. */
  affinityBucket: AffinityBucket | null;
  /** Cubeta de tope de respaldo, o null si no aporta respaldo. */
  supportBucket: SupportBucket | null;
  /** Escala de rendimientos decrecientes que le corresponde (§51). */
  scale: readonly number[] | null;
  /** Explicacion legible: el `reason` de §56. */
  reason: string;
}

/** Una senal ya puntuada: lo que se persiste y lo que ve el estudiante. */
interface Contribution extends Senal {
  multiplier: number;
  points: number;
  supportPoints: number;
}

/**
 * Puntos base por codigo de ponderacion (§51).
 *
 * El motor los lee de `affinity_weights`, que es donde §51 pide que se
 * almacenen y versionen. Estas constantes solo actuan si una fila falta: es
 * preferible calcular con el valor conocido que devolver una afinidad
 * silenciosamente incompleta.
 */
const DEFAULT_WEIGHTS: Record<AffinityWeightCode, number> = {
  // ------------------------------------------- V3 §45.1 · lo declarado: 0
  // Intereses, habilidades declaradas y áreas de mejora se registran para
  // poder explicar que se tuvieron en cuenta, pero no suman afinidad.
  [AffinityWeightCode.INTEREST_PRIORITY_1]: 0,
  [AffinityWeightCode.INTEREST_PRIORITY_2]: 0,
  [AffinityWeightCode.INTEREST_PRIORITY_3]: 0,
  [AffinityWeightCode.INTEREST_PRIORITY_4]: 0,
  [AffinityWeightCode.INTEREST_PRIORITY_5]: 0,
  [AffinityWeightCode.INTEREST]: 0,
  [AffinityWeightCode.SKILL_BASIC]: 0,
  [AffinityWeightCode.SKILL_INTERMEDIATE]: 0,
  [AffinityWeightCode.SKILL_ADVANCED]: 0,
  [AffinityWeightCode.IMPROVEMENT_AREA]: 0,
  // ------------------------------------------------ V3 §47.1 · actividades
  [AffinityWeightCode.ACTIVITY_INTERESTED]: 0,
  [AffinityWeightCode.ACTIVITY_REGISTERED]: 0,
  [AffinityWeightCode.ACTIVITY_CONFIRMED]: AFFINITY_POINTS_V4.ACTIVITY_CONFIRMED,
  // -------------------------------------------------- V3 §47.2 · proyectos
  [AffinityWeightCode.PROJECT_DECLARED]: AFFINITY_POINTS_V4.PROJECT_DECLARED,
  [AffinityWeightCode.PROJECT_SUPPORTED]: AFFINITY_POINTS_V4.PROJECT_SUPPORTED,
  [AffinityWeightCode.PROJECT_CORROBORATED]: AFFINITY_POINTS_V4.PROJECT_CORROBORATED,
  [AffinityWeightCode.PROJECT_REVIEWED]: AFFINITY_POINTS_V4.PROJECT_REVIEWED,
  [AffinityWeightCode.PROJECT_FLAGGED]: AFFINITY_POINTS_V4.PROJECT_FLAGGED,
  [AffinityWeightCode.PROJECT_OWNED]: 0,
  [AffinityWeightCode.PROJECT_MEMBER]: 0,
  // ----------------------------------------------- V3 §47.3 · certificados
  [AffinityWeightCode.CERTIFICATE_DECLARED]: AFFINITY_POINTS_V4.CERTIFICATE_DECLARED,
  [AffinityWeightCode.CERTIFICATE_SUPPORTED]: AFFINITY_POINTS_V4.CERTIFICATE_SUPPORTED,
  [AffinityWeightCode.CERTIFICATE_CORROBORATED]: AFFINITY_POINTS_V4.CERTIFICATE_CORROBORATED,
  [AffinityWeightCode.CERTIFICATE]: 0,
  // ------------------------------------------------------------ §46, §50
  // La evidencia mejora el respaldo del proyecto y la constancia el de la
  // participación; ninguna crea un evento de afinidad.
  [AffinityWeightCode.EVIDENCE]: 0,
  [AffinityWeightCode.CONSTANCY]: 0,
};

/** Familia de senal a la que pertenece cada ponderacion. */
const SIGNAL_OF: Record<AffinityWeightCode, AffinitySignalType> = {
  [AffinityWeightCode.INTEREST]: AffinitySignalType.INTEREST,
  [AffinityWeightCode.INTEREST_PRIORITY_1]: AffinitySignalType.INTEREST,
  [AffinityWeightCode.INTEREST_PRIORITY_2]: AffinitySignalType.INTEREST,
  [AffinityWeightCode.INTEREST_PRIORITY_3]: AffinitySignalType.INTEREST,
  [AffinityWeightCode.INTEREST_PRIORITY_4]: AffinitySignalType.INTEREST,
  [AffinityWeightCode.INTEREST_PRIORITY_5]: AffinitySignalType.INTEREST,
  [AffinityWeightCode.IMPROVEMENT_AREA]: AffinitySignalType.IMPROVEMENT_AREA,
  [AffinityWeightCode.SKILL_BASIC]: AffinitySignalType.SKILL,
  [AffinityWeightCode.SKILL_INTERMEDIATE]: AffinitySignalType.SKILL,
  [AffinityWeightCode.SKILL_ADVANCED]: AffinitySignalType.SKILL,
  [AffinityWeightCode.ACTIVITY_INTERESTED]: AffinitySignalType.ACTIVITY,
  [AffinityWeightCode.ACTIVITY_REGISTERED]: AffinitySignalType.ACTIVITY,
  [AffinityWeightCode.ACTIVITY_CONFIRMED]: AffinitySignalType.ACTIVITY,
  [AffinityWeightCode.PROJECT_OWNED]: AffinitySignalType.PROJECT,
  [AffinityWeightCode.PROJECT_MEMBER]: AffinitySignalType.PROJECT,
  [AffinityWeightCode.PROJECT_DECLARED]: AffinitySignalType.PROJECT,
  [AffinityWeightCode.PROJECT_SUPPORTED]: AffinitySignalType.PROJECT,
  [AffinityWeightCode.PROJECT_CORROBORATED]: AffinitySignalType.PROJECT,
  [AffinityWeightCode.PROJECT_REVIEWED]: AffinitySignalType.PROJECT,
  [AffinityWeightCode.PROJECT_FLAGGED]: AffinitySignalType.PROJECT,
  [AffinityWeightCode.EVIDENCE]: AffinitySignalType.EVIDENCE,
  [AffinityWeightCode.CERTIFICATE]: AffinitySignalType.CERTIFICATE,
  [AffinityWeightCode.CERTIFICATE_DECLARED]: AffinitySignalType.CERTIFICATE,
  [AffinityWeightCode.CERTIFICATE_SUPPORTED]: AffinitySignalType.CERTIFICATE,
  [AffinityWeightCode.CERTIFICATE_CORROBORATED]: AffinitySignalType.CERTIFICATE,
  [AffinityWeightCode.CONSTANCY]: AffinitySignalType.CONSTANCY,
};

/** Codigo de ponderacion de un proyecto segun su nivel de respaldo (§51.3). */
const PROJECT_CODE: Record<ProjectBackingTier, AffinityWeightCode> = {
  [ProjectBackingTier.DECLARED]: AffinityWeightCode.PROJECT_DECLARED,
  [ProjectBackingTier.SUPPORTED]: AffinityWeightCode.PROJECT_SUPPORTED,
  [ProjectBackingTier.CORROBORATED]: AffinityWeightCode.PROJECT_CORROBORATED,
  [ProjectBackingTier.REVIEWED]: AffinityWeightCode.PROJECT_REVIEWED,
  [ProjectBackingTier.FLAGGED]: AffinityWeightCode.PROJECT_FLAGGED,
};

/** Puntos de respaldo de un proyecto segun su nivel (§53.2). */
const PROJECT_SUPPORT: Record<ProjectBackingTier, number> = {
  [ProjectBackingTier.DECLARED]: SUPPORT_POINTS.PROJECT_DECLARED,
  [ProjectBackingTier.SUPPORTED]: SUPPORT_POINTS.PROJECT_SUPPORTED,
  [ProjectBackingTier.CORROBORATED]: SUPPORT_POINTS.PROJECT_CORROBORATED,
  [ProjectBackingTier.REVIEWED]: SUPPORT_POINTS.PROJECT_REVIEWED,
  [ProjectBackingTier.FLAGGED]: SUPPORT_POINTS.PROJECT_FLAGGED,
};

const PROJECT_TIER_LABEL: Record<ProjectBackingTier, string> = {
  [ProjectBackingTier.DECLARED]: 'declarado',
  [ProjectBackingTier.SUPPORTED]: 'respaldado',
  [ProjectBackingTier.CORROBORATED]: 'corroborado',
  [ProjectBackingTier.REVIEWED]: 'revisado por un docente',
  [ProjectBackingTier.FLAGGED]: 'marcado por inconsistencia',
};

/** Codigo de ponderacion de un certificado segun lo corroborado (§51.4). */
const CERTIFICATE_CODE: Record<BackingTier, AffinityWeightCode> = {
  [BackingTier.DECLARED]: AffinityWeightCode.CERTIFICATE_DECLARED,
  [BackingTier.SUPPORTED]: AffinityWeightCode.CERTIFICATE_SUPPORTED,
  [BackingTier.CORROBORATED]: AffinityWeightCode.CERTIFICATE_CORROBORATED,
  // V3 §19/§35: señalada por una contradicción, no suma mientras siga así.
  [BackingTier.FLAGGED]: AffinityWeightCode.CERTIFICATE_DECLARED,
};

/** Puntos de respaldo de un certificado segun su nivel (§53.3). */
const CERTIFICATE_SUPPORT: Record<BackingTier, number> = {
  [BackingTier.DECLARED]: SUPPORT_POINTS.CERTIFICATE_DECLARED,
  [BackingTier.SUPPORTED]: SUPPORT_POINTS.CERTIFICATE_SUPPORTED,
  [BackingTier.CORROBORATED]: SUPPORT_POINTS.CERTIFICATE_CORROBORATED,
  [BackingTier.FLAGGED]: 0,
};

const CERTIFICATE_TIER_LABEL: Record<BackingTier, string> = {
  [BackingTier.DECLARED]: 'declarado',
  [BackingTier.SUPPORTED]: 'respaldado',
  [BackingTier.CORROBORATED]: 'corroborado',
  [BackingTier.FLAGGED]: 'con inconsistencias (no suma mientras siga así)',
};

/** Topes de afinidad por cubeta (§51). */
const AFFINITY_BUCKET_CAP: Record<AffinityBucket, number> = {
  interest: AFFINITY_CAPS.INTEREST,
  skill: AFFINITY_CAPS.SKILL,
  activity: AFFINITY_CAPS.ACTIVITY,
  project: AFFINITY_CAPS.PROJECT,
  certificate: AFFINITY_CAPS.CERTIFICATE,
};

/**
 * Familia que acredita una senal segun la cubeta a la que aporta (§54).
 *
 * La familia **se deriva**, no se declara. Si se declarara, una constancia
 * interna podria marcarse como ACADEMIC_REVIEW y a la vez reforzar la familia
 * de actividades: la misma participacion acreditaria dos familias
 * independientes y abriria la puerta a un respaldo HIGH construido con una
 * sola realidad. §53.1 manda la constancia a la cubeta de actividades, y por
 * tanto lo que acredita es ACTIVITY.
 *
 * `other` no tiene entrada fija: ahi caen las senales de §53.4, que son por
 * definicion las que **no** estaban contadas en otra familia, asi que
 * acreditan la suya propia.
 */
const FAMILY_OF_BUCKET: Record<Exclude<SupportBucket, 'other'>, AffinitySignalFamily> = {
  activity: AffinitySignalFamily.ACTIVITY,
  project: AffinitySignalFamily.PROJECT,
  certificate: AffinitySignalFamily.EXTERNAL_CERTIFICATE,
};

/** Topes de respaldo por cubeta (§53). */
const SUPPORT_BUCKET_CAP: Record<SupportBucket, number> = {
  activity: SUPPORT_CAPS.ACTIVITY,
  project: SUPPORT_CAPS.PROJECT,
  certificate: SUPPORT_CAPS.CERTIFICATE,
  other: SUPPORT_CAPS.OTHER,
};

/** Cuantas instantaneas se conservan por estudiante. */
const SNAPSHOT_RETENTION = 30;

/** Limite de la columna `source_label`. */
const LABEL_MAX = 300;

/** Puntaje por area, ya calculado. */
interface AreaScore {
  academicAreaId: string;
  rawPoints: number;
  score: number;
  level: AffinityLevel;
  supportScore: number;
  supportLevel: AffinityLevel;
  supportFamilies: AffinitySignalFamily[];
}

@Injectable()
export class AffinityEngineService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @Optional() private readonly audit: AuditService,
    @InjectRepository(StudentInterest) private readonly interests: Repository<StudentInterest>,
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    @InjectRepository(ActivityRegistration)
    private readonly registrations: Repository<ActivityRegistration>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly projectMembers: Repository<ProjectMember>,
    @InjectRepository(ProjectEvidence) private readonly evidences: Repository<ProjectEvidence>,
    @InjectRepository(ProjectFeedback) private readonly feedback: Repository<ProjectFeedback>,
    @InjectRepository(ExternalCertificate)
    private readonly certificates: Repository<ExternalCertificate>,
    @InjectRepository(InternalConstancy)
    private readonly constancies: Repository<InternalConstancy>,
    @InjectRepository(ValidationRecord)
    private readonly validations: Repository<ValidationRecord>,
    @InjectRepository(AffinityResult) private readonly results: Repository<AffinityResult>,
    @InjectRepository(AffinityWeight) private readonly weights: Repository<AffinityWeight>,
    @InjectRepository(AffinityContribution)
    private readonly contributions: Repository<AffinityContribution>,
    @InjectRepository(AffinitySnapshot)
    private readonly snapshots: Repository<AffinitySnapshot>,
    @InjectRepository(ProjectSkill) private readonly projectSkills: Repository<ProjectSkill>,
    @InjectRepository(ActivitySkill) private readonly activitySkills: Repository<ActivitySkill>,
    @InjectRepository(ExternalCertificateSkill)
    private readonly certificateSkills: Repository<ExternalCertificateSkill>,
  ) {}

  async requestRecalculation(studentProfileId: string): Promise<void> {
    await this.recalculate(studentProfileId);
  }

  /**
   * Recalcula la afinidad y el respaldo de un estudiante (§48 a §56).
   *
   * Es determinista: los mismos datos producen siempre el mismo resultado. No
   * hay aprendizaje automatico ni nada que dependa del momento en que se
   * ejecute, porque §48 lo prohibe y porque un numero que nadie puede
   * reproducir no se puede defender.
   */
  async recalculate(studentProfileId: string): Promise<AffinityResult[]> {
    const profile = await this.profiles.findOne({ where: { id: studentProfileId } });
    if (!profile) {
      throw new NotFoundException('Perfil no encontrado.');
    }

    const areaList = await this.areas.find();
    const areas: AreaInfo[] = areaList.map((a) => ({
      id: a.id,
      name: a.name.toLowerCase(),
      displayName: a.name,
      tags: (a.tags ?? []).map((t) => t.toLowerCase()),
    }));
    const areaName = new Map(areas.map((a) => [a.id, a.displayName]));

    const { points: weightOf, version: rulesVersion } = await this.loadWeights();

    const senales: Senal[] = [];
    const add = (senal: Partial<Senal> & { areaId?: string | null }) => {
      if (!senal.areaId) return;
      senales.push({
        areaId: senal.areaId,
        family: senal.family ?? AffinitySignalFamily.OTHER,
        signalType: senal.signalType ?? SIGNAL_OF[senal.weightCode as AffinityWeightCode],
        weightCode: senal.weightCode as AffinityWeightCode,
        matchType: senal.matchType ?? AffinityMatchType.DECLARED,
        sourceEntityType: senal.sourceEntityType ?? null,
        sourceId: senal.sourceId ?? null,
        base: senal.base ?? 0,
        supportBase: senal.supportBase ?? 0,
        affinityBucket: senal.affinityBucket ?? null,
        supportBucket: senal.supportBucket ?? null,
        scale: senal.scale ?? null,
        reason: (senal.reason ?? '').slice(0, LABEL_MAX),
      });
    };

    // =================================================== §51.1 · Preferencias
    const interests = await this.interests.find({ where: { studentProfileId } });
    interests.forEach((i) => {
      const code = this.interestWeightCode(i.priority);
      add({
        areaId: i.academicAreaId,
        family: AffinitySignalFamily.PREFERENCE,
        weightCode: code,
        matchType: AffinityMatchType.DECLARED,
        sourceEntityType: AffinitySourceEntityType.STUDENT_INTEREST,
        sourceId: i.id,
        // V3 §45.1: el interés orienta recomendaciones; no suma afinidad.
        base: 0,
        reason: `${areaName.get(i.academicAreaId) ?? 'Área'}: ${AFFINITY_EXCLUDED_REASON.interest}`,
      });
    });

    // V2 §22: la autoevaluación de nivel (`student_skills`) ya no alimenta la
    // afinidad. La tabla se conserva como histórico; aquí no se lee.

    // §20: se registra para poder decir que se tuvo en cuenta y no sumo.
    (profile.improvementAreaIds ?? []).forEach((id) =>
      add({
        areaId: id,
        family: AffinitySignalFamily.PREFERENCE,
        weightCode: AffinityWeightCode.IMPROVEMENT_AREA,
        matchType: AffinityMatchType.DECLARED,
        sourceEntityType: AffinitySourceEntityType.IMPROVEMENT_AREA,
        base: 0,
        reason: AFFINITY_EXCLUDED_REASON.improvement_area,
      }),
    );

    // ==================================================== §51.2 · Actividades
    const registrations = await this.registrations.find({
      where: { studentProfileId },
      relations: { activity: { activityAreas: true } },
    });
    /** Areas con participacion confirmada: la constancia refuerza estas (§55). */
    const areasConParticipacion = new Set<string>();
    const registrationByActivity = new Map<string, ActivityRegistration>();

    registrations.forEach((r) => {
      // V4 §35.2: las áreas configuradas en la actividad (todas), no solo
      // la principal.
      const areasDeActividad = [...new Set([
        ...(r.activity?.activityAreas ?? []).map((x) => x.academicAreaId),
        ...(r.activity?.academicAreaId ? [r.activity.academicAreaId] : []),
      ])];
      if (!areasDeActividad.length) return;
      if (r.activity?.id) registrationByActivity.set(r.activity.id, r);
      for (const areaId of areasDeActividad) {

      if (r.status !== RegistrationStatus.CONFIRMED) {
        const code = this.activityWeightCode(r.status);
        if (!code) continue;
        add({
          areaId,
          family: AffinitySignalFamily.ACTIVITY,
          weightCode: code,
          matchType: AffinityMatchType.INHERITED,
          sourceEntityType: AffinitySourceEntityType.ACTIVITY_REGISTRATION,
          sourceId: r.id,
          base: 0,
          reason:
            `${r.activity?.title ?? 'Actividad'}: `
            + `${AFFINITY_EXCLUDED_REASON[code] ?? 'no suma afinidad'}`,
        });
        continue;
      }

      areasConParticipacion.add(areaId);
      add({
        areaId,
        family: AffinitySignalFamily.ACTIVITY,
        weightCode: AffinityWeightCode.ACTIVITY_CONFIRMED,
        matchType: AffinityMatchType.INHERITED,
        sourceEntityType: AffinitySourceEntityType.ACTIVITY_REGISTRATION,
        sourceId: r.id,
        base: weightOf.get(AffinityWeightCode.ACTIVITY_CONFIRMED) ?? 0,
        supportBase: SUPPORT_POINTS.ACTIVITY_CONFIRMED,
        affinityBucket: 'activity',
        supportBucket: 'activity',
        scale: DIMINISHING.ACTIVITY,
        reason: `Participacion confirmada: ${r.activity?.title ?? 'actividad'}`,
      });
      }
    });

    // ====================================================== §51.3 · Proyectos
    const owned = await this.projects.find({ where: { createdByProfileId: studentProfileId } });
    const memberships = await this.projectMembers.find({
      where: { userId: profile.userId },
      relations: { memberSkills: { skill: true } },
    });
    const ownedIds = new Set(owned.map((p) => p.id));
    const collaborativeIds = memberships
      .map((m) => m.projectId)
      .filter((id) => !ownedIds.has(id));
    const collaborative = collaborativeIds.length
      ? await this.projects.find({ where: { id: In(collaborativeIds) } })
      : [];
    const membershipByProject = new Map(memberships.map((m) => [m.projectId, m]));
    // V4 §35.3: tecnologías del proyecto corroboradas (repositorio o docente).
    const todosLosProyectos = [...owned, ...collaborative].map((p) => p.id);
    const corroboradasPorProyecto = new Map<string, Set<string>>();
    if (todosLosProyectos.length) {
      const filas = await this.projectSkills.find({ where: { projectId: In(todosLosProyectos) } });
      for (const f of filas) {
        if (f.evidenceStatus === ProjectSkillEvidenceStatus.DECLARED) continue;
        const set = corroboradasPorProyecto.get(f.projectId) ?? new Set<string>();
        set.add(f.skillId);
        corroboradasPorProyecto.set(f.projectId, set);
      }
    }

    const areasByProject = new Map<string, string[]>();
    const proyectosContados: Project[] = [];

    for (const project of [...owned, ...collaborative]) {
      const isOwned = ownedIds.has(project.id);
      const membership = membershipByProject.get(project.id);

      // §33: mientras el integrante no confirme su contribucion, lo que figura
      // en ella lo escribio otra persona.
      if (!isOwned && (!membership || !membership.contributionConfirmedAt)) {
        continue;
      }
      // V4 §35.1: un borrador no es trayectoria respaldada.
      if (project.status === ProjectStatus.DRAFT) continue;

      // V3 §48: el proyecto pertenece, para este estudiante, a las áreas de
      // las tecnologías que ÉL confirmó haber usado (`skills_used`). Ni las
      // tecnologías generales del proyecto ni su área principal atribuyen
      // experiencia a nadie.
      // V4 §35.3: solo las tecnologías que ÉL confirmó y que además están
      // corroboradas en el proyecto. Nunca todas las del proyecto para todos.
      const corroboradas = corroboradasPorProyecto.get(project.id) ?? new Set<string>();
      const confirmadas = (membership?.memberSkills ?? []).filter((s) => s.skill);
      const habilidades = confirmadas.filter((s) => corroboradas.has(s.skillId));
      const tierBase = project.backingTier ?? ProjectBackingTier.DECLARED;
      const puntua = tierBase === ProjectBackingTier.CORROBORATED || tierBase === ProjectBackingTier.REVIEWED;
      const areasPropias = puntua ? [

        ...new Set(
          habilidades.map((s) => s.skill!.academicAreaId).filter((a): a is string => !!a),
        ),
      ] : [];
      const tier = project.backingTier ?? ProjectBackingTier.DECLARED;
      const code = PROJECT_CODE[tier];
      const rol = isOwned ? 'propio' : 'como integrante';
      proyectosContados.push(project);

      if (areasPropias.length > 0) {
        areasByProject.set(project.id, areasPropias);
        for (const areaId of areasPropias) {
          const nombres = habilidades
            .filter((s) => s.skill!.academicAreaId === areaId)
            .map((s) => s.skill!.name)
            .slice(0, 4)
            .join(', ');
          add({
            areaId,
            family: AffinitySignalFamily.PROJECT,
            weightCode: code,
            matchType: AffinityMatchType.DECLARED,
            sourceEntityType: AffinitySourceEntityType.PROJECT,
            sourceId: project.id,
            base: weightOf.get(code) ?? 0,
            supportBase: PROJECT_SUPPORT[tier],
            affinityBucket: 'project',
            supportBucket: 'project',
            scale: DIMINISHING.PROJECT,
            reason: `Proyecto ${rol} ${PROJECT_TIER_LABEL[tier]}: ${project.title} (${nombres})`,
          });
        }
        continue;
      }

      // Sin tecnologías propias confirmadas no hay afinidad (§48), pero el
      // respaldo del proyecto sigue contando en su área principal: la
      // trayectoria existe aunque falte decir con qué se hizo.
      const areasDeConfirmadas = [...new Set(confirmadas.map((s) => s.skill!.academicAreaId).filter((a): a is string => !!a))];
      const fallback = areasDeConfirmadas.length
        ? areasDeConfirmadas
        : project.academicAreaId
          ? [project.academicAreaId]
          : this.inferAreasByTech(project.technologies, areas);
      const motivoV4 = !puntua
        ? `V4 §35.3: un proyecto ${PROJECT_TIER_LABEL[tier]} no suma afinidad; solo CORROBORATED o REVIEWED. Su respaldo sí cuenta.`
        : confirmadas.length
          ? 'V4 §35.3: las tecnologías que confirmaste no están corroboradas en el proyecto (repositorio o docente). Su respaldo sí cuenta.'
          : AFFINITY_EXCLUDED_REASON.project_without_skills;
      areasByProject.set(project.id, fallback);
      fallback.forEach((areaId) =>
        add({
          areaId,
          family: AffinitySignalFamily.PROJECT,
          weightCode: code,
          matchType: project.academicAreaId ? AffinityMatchType.DECLARED : AffinityMatchType.TAG,
          sourceEntityType: AffinitySourceEntityType.PROJECT,
          sourceId: project.id,
          base: 0,
          supportBase: PROJECT_SUPPORT[tier],
          supportBucket: 'project',
          scale: DIMINISHING.PROJECT,
          reason: `Proyecto ${rol} ${PROJECT_TIER_LABEL[tier]}: ${project.title}. ${motivoV4}`,
        }),
      );
    }

    // ============================================== §50, §55 · Evidencias
    // Una evidencia no crea un proyecto mas: mejora el respaldo del que ya
    // existe. Se registra con cero para que el desglose lo diga.
    const evidences = await this.evidences.find({
      where: { studentProfileId },
      relations: { activity: true },
    });
    const evidenceTiers = await this.backingTiersOf(
      ValidationResourceType.PROJECT_EVIDENCE,
      evidences.map((e) => e.id),
    );

    for (const evidence of evidences) {
      const label = evidence.description ?? 'sin descripcion';
      const esDeActividad = !!evidence.activityId;
      const tier = evidenceTiers.get(evidence.id) ?? BackingTier.DECLARED;

      const destinos = evidence.academicAreaId
        ? [evidence.academicAreaId]
        : evidence.activity?.academicAreaId
          ? [evidence.activity.academicAreaId]
          : (evidence.projectId ? areasByProject.get(evidence.projectId) ?? [] : []);

      destinos.forEach((areaId) => {
        // §53.4: una evidencia de actividad corroborada es trazabilidad que no
        // esta contada en ningun otro sitio. La de proyecto si lo esta: ya
        // elevo el nivel de respaldo del proyecto (§36).
        const aportaRespaldo = esDeActividad && tier !== BackingTier.DECLARED;
        add({
          areaId,
          family: AffinitySignalFamily.OTHER,
          signalType: AffinitySignalType.EVIDENCE,
          weightCode: AffinityWeightCode.EVIDENCE,
          matchType: evidence.academicAreaId
            ? AffinityMatchType.DECLARED
            : AffinityMatchType.INHERITED,
          sourceEntityType: esDeActividad
            ? AffinitySourceEntityType.ACTIVITY_EVIDENCE
            : AffinitySourceEntityType.PROJECT_EVIDENCE,
          sourceId: evidence.id,
          base: 0,
          supportBase: aportaRespaldo ? SUPPORT_POINTS.ACTIVITY_EVIDENCE : 0,
          supportBucket: aportaRespaldo ? 'other' : null,
          reason: aportaRespaldo
            ? `Evidencia de actividad ${CERTIFICATE_TIER_LABEL[tier]}: ${label}`
            : `Evidencia: ${label}. ${AFFINITY_EXCLUDED_REASON.evidence}`,
        });
      });
    }

    // =================================================== §51.4 · Certificados
    const certs = await this.certificates.find({ where: { studentProfileId } });
    const certTiers = await this.backingTiersOf(
      ValidationResourceType.EXTERNAL_CERTIFICATE,
      certs.map((c) => c.id),
      true,
    );

    certs.forEach((c) => {
      const { tier, duplicado } = certTiers.get(c.id)
        ?? { tier: BackingTier.DECLARED, duplicado: false };
      const code = CERTIFICATE_CODE[tier];
      const destinos = c.academicAreaId
        ? [c.academicAreaId]
        : this.matchAreasByText(`${c.certificateName} ${c.issuer}`, areas);

      destinos.forEach((areaId) =>
        add({
          areaId,
          family: AffinitySignalFamily.EXTERNAL_CERTIFICATE,
          weightCode: code,
          matchType: c.academicAreaId ? AffinityMatchType.DECLARED : AffinityMatchType.TEXT,
          sourceEntityType: AffinitySourceEntityType.EXTERNAL_CERTIFICATE,
          sourceId: c.id,
          base: tier === BackingTier.FLAGGED ? 0 : (weightOf.get(code) ?? 0),
          supportBase: CERTIFICATE_SUPPORT[tier],
          affinityBucket: 'certificate',
          supportBucket: 'certificate',
          scale: DIMINISHING.PROJECT,
          reason:
            `Certificado externo ${CERTIFICATE_TIER_LABEL[tier]}: ${c.certificateName}`
            + (duplicado ? ' · contenido repetido, no vuelve a respaldar (§28)' : ''),
        }),
      );
    });

    // ================================================ §53.1, §53.4 · Constancias
    const constancies = await this.constancies.find({
      where: { studentProfileId, status: ConstancyStatus.AUTHORIZED },
      relations: { activity: true },
    });
    constancies.forEach((c) => {
      const areaDeActividad = c.activity?.academicAreaId ?? null;
      const destinos = areaDeActividad
        ? [areaDeActividad]
        : this.matchAreasByText(c.description, areas);

      destinos.forEach((areaId) => {
        // §53.1: si respalda una participacion ya contada, suma respaldo en la
        // familia de actividades. Si no hay tal participacion, es una senal
        // suelta y cae en «otros respaldos» (§53.4). En ningun caso crea un
        // segundo evento de afinidad (§55).
        const refuerzaParticipacion = areasConParticipacion.has(areaId);
        add({
          areaId,
          family: AffinitySignalFamily.ACADEMIC_REVIEW,
          signalType: AffinitySignalType.CONSTANCY,
          weightCode: AffinityWeightCode.CONSTANCY,
          matchType: areaDeActividad ? AffinityMatchType.INHERITED : AffinityMatchType.TEXT,
          sourceEntityType: AffinitySourceEntityType.INTERNAL_CONSTANCY,
          sourceId: c.id,
          base: 0,
          supportBase: refuerzaParticipacion
            ? SUPPORT_POINTS.CONSTANCY
            : SUPPORT_POINTS.STANDALONE_CONSTANCY,
          supportBucket: refuerzaParticipacion ? 'activity' : 'other',
          reason:
            `Constancia interna: ${c.description}. `
            + AFFINITY_EXCLUDED_REASON.constancy,
        });
      });
    });

    // ============================================ §53.4, §54 · Revision docente
    const proyectoIds = proyectosContados.map((p) => p.id);
    const comentarios = proyectoIds.length
      ? await this.feedback.find({ where: { projectId: In(proyectoIds) } })
      : [];
    const tierByProject = new Map(
      proyectosContados.map((p) => [p.id, p.backingTier ?? ProjectBackingTier.DECLARED]),
    );

    comentarios.forEach((f) => {
      const tier = tierByProject.get(f.projectId) ?? ProjectBackingTier.DECLARED;
      // §55: si la revision ya elevo el proyecto a REVIEWED, sus puntos estan
      // contados en la familia de proyectos. Volver a sumarlos aqui seria
      // contar la misma realidad dos veces. Lo que si conserva es su valor
      // para la regla de diversidad (§54): es un actor academico distinto del
      // estudiante quien dejo constancia.
      const yaContada = tier === ProjectBackingTier.REVIEWED;
      (areasByProject.get(f.projectId) ?? []).forEach((areaId) =>
        add({
          areaId,
          family: AffinitySignalFamily.ACADEMIC_REVIEW,
          signalType: AffinitySignalType.PROJECT,
          weightCode: AffinityWeightCode.PROJECT_REVIEWED,
          matchType: AffinityMatchType.INHERITED,
          sourceEntityType: AffinitySourceEntityType.PROJECT_FEEDBACK,
          sourceId: f.id,
          base: 0,
          supportBase: yaContada ? 0 : SUPPORT_POINTS.ACADEMIC_REVIEW,
          supportBucket: yaContada ? null : 'other',
          reason: yaContada
            ? 'Retroalimentacion docente: ya contada en el respaldo del proyecto (§55).'
            : 'Retroalimentacion docente sobre un proyecto sin respaldo tecnico.',
        }),
      );
    });

    const resultado = await this.persist(studentProfileId, senales, rulesVersion);
    // V3 §65: queda constancia de cada recálculo (sin puntajes: solo cuántas áreas).
    await this.audit?.record({
      actorUserId: null,
      eventType: AuditEventType.AFFINITY_RECALCULATED,
      entityType: 'student_profile',
      entityId: studentProfileId,
      metadata: { areas: resultado.length, reglas: rulesVersion },
    });
    return resultado;
  }

  // =========================================================================
  //  Calculo
  // =========================================================================

  /**
   * Aplica rendimientos decrecientes y topes, area por area (§51 a §54).
   *
   * El recorrido es el mismo para afinidad y para respaldo, solo cambian la
   * escala y el tope. Por eso hay una sola funcion: si fueran dos, tarde o
   * temprano divergirian.
   */
  private puntuar(senales: Senal[]): { contributions: Contribution[]; areas: AreaScore[] } {
    const contributions: Contribution[] = senales.map((s) => ({
      ...s,
      multiplier: 1,
      points: 0,
      supportPoints: 0,
    }));

    const porArea = new Map<string, number[]>();
    contributions.forEach((c, index) => {
      const lista = porArea.get(c.areaId) ?? [];
      lista.push(index);
      porArea.set(c.areaId, lista);
    });

    const areas: AreaScore[] = [];

    for (const [areaId, indices] of porArea) {
      // ------------------------------------------------------- afinidad
      let rawPoints = 0;
      // V3 §47: tres familias con tope propio (25 / 50 / 25).
      const buckets: AffinityBucket[] = ['activity', 'project', 'certificate'];
      for (const bucket of buckets) {
        const propios = this.ordenar(indices, contributions, (c) =>
          c.affinityBucket === bucket ? c.base : null);
        let acumulado = 0;
        propios.forEach((index, posicion) => {
          const c = contributions[index];
          const factor = c.scale ? diminishingFactor(c.scale, posicion) : 1;
          const bruto = this.redondear(c.base * factor);
          const espacio = Math.max(0, AFFINITY_BUCKET_CAP[bucket] - acumulado);
          const final = Math.min(bruto, espacio);
          c.multiplier = factor;
          c.points = final;
          if (final < bruto) {
            c.reason = this.anotar(c.reason, 'tope del area alcanzado');
          }
          acumulado = this.redondear(acumulado + final);
        });
        rawPoints = this.redondear(rawPoints + acumulado);
      }

      // V3 §47.4: nunca más de 100.
      rawPoints = Math.min(rawPoints, AFFINITY_MAX_RAW);

      // -------------------------------------------------------- respaldo
      let supportScore = 0;
      const supportBuckets: SupportBucket[] = ['activity', 'project', 'certificate', 'other'];
      for (const bucket of supportBuckets) {
        const propios = this.ordenar(indices, contributions, (c) =>
          c.supportBucket === bucket ? c.supportBase : null);
        let acumulado = 0;
        propios.forEach((index, posicion) => {
          const c = contributions[index];
          // §53.3 no pide rendimientos decrecientes para certificados y §53.1
          // y §53.2 si. Se sigue la letra: donde la especificacion los pide,
          // se aplican; donde calla, solo actua el tope.
          const factor = c.scale && bucket !== 'certificate' && bucket !== 'other'
            ? diminishingFactor(c.scale, posicion)
            : 1;
          const bruto = this.redondear(c.supportBase * factor);
          const espacio = Math.max(0, SUPPORT_BUCKET_CAP[bucket] - acumulado);
          c.supportPoints = Math.min(bruto, espacio);
          acumulado = this.redondear(acumulado + c.supportPoints);
        });
        supportScore = this.redondear(supportScore + acumulado);
      }
      supportScore = Math.round(Math.min(100, supportScore));

      // ------------------------------------------------------ diversidad
      // §54 habla de «señales», no de puntos: una senal cuenta aunque el tope
      // de su familia ya estuviera lleno. Lo contrario seria perverso -la
      // cuarta actividad haria desaparecer una familia- y ademas premiaria
      // tener menos evidencia.
      const familias = new Set<AffinitySignalFamily>();
      indices.forEach((index) => {
        const c = contributions[index];
        if (!c.supportBucket || c.supportBase <= 0) return;
        const familia = c.supportBucket === 'other'
          ? c.family
          : FAMILY_OF_BUCKET[c.supportBucket];
        if (INDEPENDENT_SUPPORT_FAMILIES.includes(familia)) familias.add(familia);
      });

      // V3 §47.4: escala directa, sin normalizar contra nada.
      const score = Math.round(Math.min(100, rawPoints));
      areas.push({
        academicAreaId: areaId,
        rawPoints,
        score,
        level: this.classify(score),
        supportScore,
        supportLevel: this.classifySupport(supportScore, familias),
        supportFamilies: [...familias].sort((a, b) => a.localeCompare(b)),
      });
    }

    areas.sort((a, b) => b.score - a.score || b.supportScore - a.supportScore);
    return { contributions, areas };
  }

  /**
   * Ordena las senales de una cubeta de mayor a menor peso.
   *
   * El orden decide a quien le toca el 100 % de los rendimientos decrecientes,
   * asi que no puede depender de como salieron las filas de la base. El
   * desempate por `sourceId` hace el resultado reproducible: dos estudiantes
   * con exactamente los mismos datos obtienen exactamente el mismo puntaje.
   */
  private ordenar(
    indices: number[],
    contributions: Contribution[],
    pesoDe: (c: Contribution) => number | null,
  ): number[] {
    return indices
      .filter((i) => pesoDe(contributions[i]) !== null)
      .sort((a, b) => {
        const diff = (pesoDe(contributions[b]) ?? 0) - (pesoDe(contributions[a]) ?? 0);
        if (diff !== 0) return diff;
        return (contributions[a].sourceId ?? '').localeCompare(contributions[b].sourceId ?? '');
      });
  }

  /** Dos decimales. Evita que 0.1 + 0.2 se convierta en un puntaje raro. */
  private redondear(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private anotar(reason: string, nota: string): string {
    return `${reason} · ${nota}`.slice(0, LABEL_MAX);
  }

  // =========================================================================
  //  Lectura
  // =========================================================================

  async getForProfile(studentProfileId: string): Promise<AffinityResult[]> {
    return this.results.find({
      where: { studentProfileId },
      relations: { academicArea: true },
      order: { score: 'DESC' },
    });
  }

  async resolveProfileIdByUser(userId: string): Promise<string> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Aún no has creado tu perfil estudiantil.');
    }
    return profile.id;
  }

  async assertProfileExists(studentProfileId: string): Promise<void> {
    const exists = await this.profiles.exists({ where: { id: studentProfileId } });
    if (!exists) {
      throw new NotFoundException('Perfil no encontrado.');
    }
  }

  /**
   * Vista completa de la afinidad de un estudiante (RF17, §49, §91).
   *
   * Devuelve los dos puntajes que §49 exige y los devuelve por separado,
   * porque responden preguntas distintas: cuanto se inclina el estudiante
   * hacia un area, y cuanta informacion trazable sostiene esa inclinacion.
   */
  async getSummary(studentProfileId: string) {
    const [results, snapshot, respaldadas] = await Promise.all([
      this.getForProfile(studentProfileId),
      this.snapshots.findOne({
        where: { studentProfileId },
        order: { calculatedAt: 'DESC' },
      }),
      this.backedSkills(studentProfileId),
    ]);

    const status =
      results.length > 0
        ? AffinityCalculationStatus.CALCULATED
        : AffinityCalculationStatus.INSUFFICIENT_DATA;

    return {
      status,
      message:
        status === AffinityCalculationStatus.CALCULATED
          ? 'Afinidades calculadas a partir de la informacion de tu perfil.'
          : 'Todavía no hay trayectoria respaldada. La afinidad crece cuando se confirma tu ' +
            'participación en actividades, cuando tus proyectos tienen respaldo y confirmas las ' +
            'tecnologías que usaste, o con certificados con respaldo.',
      calculatedAt: snapshot?.calculatedAt ?? null,
      rulesVersion: snapshot?.rulesVersion ?? null,
      engineVersion: snapshot?.engineVersion ?? AFFINITY_ENGINE_VERSION,
      signalsCount: snapshot?.signalsCount ?? 0,
      maxRawPoints: AFFINITY_MAX_RAW,
      totalScore: Number(results.reduce((sum, r) => sum + Number(r.score), 0).toFixed(2)),
      areas: results.map((r, index) => ({
        academicAreaId: r.academicAreaId,
        area: r.academicArea?.name ?? null,
        score: Number(r.score),
        rawPoints: Number(r.rawPoints),
        level: r.level,
        supportScore: r.supportScore,
        supportLevel: r.supportLevel,
        supportFamilies: r.supportFamilies ?? [],
        backedSkills: respaldadas.get(r.academicAreaId) ?? [],
        rank: index + 1,
      })),
    };
  }

  /**
   * Habilidades respaldadas por área (V3 §36), sin porcentaje de dominio.
   *
   * Cada tecnología lista de dónde sale: proyectos CORROBORATED/REVIEWED en
   * los que el estudiante la confirmó y está corroborada, credenciales
   * CORROBORATED que la acreditan y actividades confirmadas que la trabajan.
   */
  async backedSkills(studentProfileId: string): Promise<Map<string, { skillId: string; name: string; sources: { type: string; title: string }[] }[]>> {
    const profile = await this.profiles.findOne({ where: { id: studentProfileId } });
    const salida = new Map<string, Map<string, { skillId: string; name: string; sources: { type: string; title: string }[] }>>();
    if (!profile) return new Map();
    const sumar = (areaId: string | null | undefined, skillId: string, name: string, type: string, title: string) => {
      if (!areaId) return;
      const area = salida.get(areaId) ?? new Map();
      const e = area.get(skillId) ?? { skillId, name, sources: [] };
      if (!e.sources.some((x: { type: string; title: string }) => x.type === type && x.title === title)) e.sources.push({ type, title });
      area.set(skillId, e);
      salida.set(areaId, area);
    };

    // Proyectos
    const memberships = await this.projectMembers.find({
      where: { userId: profile.userId },
      relations: { memberSkills: { skill: true }, project: true },
    });
    const validos = memberships.filter((m) => m.project
      && m.project.status !== ProjectStatus.DRAFT
      && (m.isOwner || m.contributionConfirmedAt)
      && (m.project.backingTier === ProjectBackingTier.CORROBORATED || m.project.backingTier === ProjectBackingTier.REVIEWED));
    if (validos.length) {
      const filas = await this.projectSkills.find({ where: { projectId: In(validos.map((m) => m.projectId)) } });
      const corroboradas = new Set(filas.filter((f) => f.evidenceStatus !== ProjectSkillEvidenceStatus.DECLARED).map((f) => `${f.projectId}:${f.skillId}`));
      for (const m of validos) {
        for (const ms of m.memberSkills ?? []) {
          if (ms.skill && corroboradas.has(`${m.projectId}:${ms.skillId}`)) {
            sumar(ms.skill.academicAreaId, ms.skillId, ms.skill.name, 'project', m.project.title);
          }
        }
      }
    }

    // Credenciales CORROBORATED
    const certs = await this.certificates.find({ where: { studentProfileId } });
    const tiers = await this.backingTiersOf(ValidationResourceType.EXTERNAL_CERTIFICATE, certs.map((c) => c.id), true);
    const corroborados = certs.filter((c) => tiers.get(c.id)?.tier === BackingTier.CORROBORATED && !tiers.get(c.id)?.duplicado);
    if (corroborados.length) {
      const filas = await this.certificateSkills.find({ where: { certificateId: In(corroborados.map((c) => c.id)) }, relations: { skill: true } });
      const nombre = new Map(corroborados.map((c) => [c.id, c.certificateName]));
      for (const f of filas) if (f.skill) sumar(f.skill.academicAreaId, f.skillId, f.skill.name, 'credential', nombre.get(f.certificateId) ?? '');
    }

    // Actividades confirmadas
    const regs = await this.registrations.find({ where: { studentProfileId, status: RegistrationStatus.CONFIRMED }, relations: { activity: true } });
    if (regs.length) {
      const filas = await this.activitySkills.find({ where: { activityId: In(regs.map((r) => r.activityId)) }, relations: { skill: true } });
      const titulo = new Map(regs.map((r) => [r.activityId, r.activity?.title ?? '']));
      for (const f of filas) if (f.skill) sumar(f.skill.academicAreaId, f.skillId, f.skill.name, 'activity', titulo.get(f.activityId) ?? '');
    }

    return new Map([...salida].map(([areaId, m]) => [areaId, [...m.values()].sort((a, b) => b.sources.length - a.sources.length)]));
  }

  /**
   * Desglose de un area concreta: por que el estudiante tiene ese puntaje.
   *
   * §91 pide dos listas, no una: lo que contribuye y lo que **no**. La segunda
   * suele ser la que responde la pregunta real del estudiante, que casi nunca
   * es «por que tengo 60» sino «por que no tengo mas».
   */
  async getBreakdown(studentProfileId: string, academicAreaId: string) {
    const [area, result, rows] = await Promise.all([
      this.areas.findOne({ where: { id: academicAreaId } }),
      this.results.findOne({ where: { studentProfileId, academicAreaId } }),
      this.contributions.find({
        where: { studentProfileId, academicAreaId },
        order: { points: 'DESC', supportPoints: 'DESC', createdAt: 'ASC' },
      }),
    ]);

    if (!area) {
      throw new NotFoundException('Area academica no encontrada.');
    }

    const mapear = (c: AffinityContribution) => ({
      signalFamily: c.signalFamily,
      signalType: c.signalType,
      weightCode: c.weightCode,
      matchType: c.matchType,
      sourceEntityType: c.sourceEntityType,
      rawPoints: Number(c.rawPoints),
      multiplier: Number(c.multiplier),
      points: Number(c.points),
      supportPoints: Number(c.supportPoints),
      reason: c.sourceLabel,
      sourceLabel: c.sourceLabel,
      sourceId: c.sourceId,
    });

    const suma = rows.filter((c) => Number(c.points) > 0 || Number(c.supportPoints) > 0);
    const noSuma = rows.filter((c) => Number(c.points) === 0 && Number(c.supportPoints) === 0);

    return {
      academicAreaId,
      area: area.name,
      score: result ? Number(result.score) : 0,
      rawPoints: result ? Number(result.rawPoints) : 0,
      maxRawPoints: AFFINITY_MAX_RAW,
      level: result?.level ?? null,
      supportScore: result?.supportScore ?? 0,
      supportLevel: result?.supportLevel ?? null,
      supportFamilies: result?.supportFamilies ?? [],
      engineVersion: result?.engineVersion ?? AFFINITY_ENGINE_VERSION,
      contributions: rows.map(mapear),
      contributing: suma.map(mapear),
      notContributing: noSuma.map(mapear),
    };
  }

  /**
   * Historial de calculos, del mas reciente al mas antiguo (RF17).
   *
   * Cada fila lleva su `engineVersion` porque la escala cambio: comparar un
   * puntaje V1 con uno V2 sin mirarla haria ver una caida donde solo hubo un
   * cambio de unidad.
   */
  async getHistory(studentProfileId: string, limit = 10) {
    const rows = await this.snapshots.find({
      where: { studentProfileId },
      relations: { items: { academicArea: true } },
      order: { calculatedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), SNAPSHOT_RETENTION),
    });

    return rows.map((snapshot) => ({
      id: snapshot.id,
      calculatedAt: snapshot.calculatedAt,
      status: snapshot.status,
      totalScore: Number(snapshot.totalScore),
      areasCount: snapshot.areasCount,
      signalsCount: snapshot.signalsCount,
      rulesVersion: snapshot.rulesVersion,
      engineVersion: snapshot.engineVersion,
      averageSupport: snapshot.averageSupport,
      areas: [...(snapshot.items ?? [])]
        .sort((a, b) => a.rank - b.rank)
        .map((item) => ({
          academicAreaId: item.academicAreaId,
          area: item.academicArea?.name ?? null,
          score: Number(item.score),
          rawPoints: Number(item.rawPoints),
          level: item.level,
          supportScore: item.supportScore,
          supportLevel: item.supportLevel,
          rank: item.rank,
        })),
    }));
  }

  /**
   * Las reglas vigentes, para que la explicacion sea completa (§51).
   *
   * Devuelve las dos mitades: los puntos base que viven en la base de datos y
   * la estructura versionada en codigo. Exponer solo la primera daria una
   * imagen incompleta -los topes y los rendimientos cambian el resultado tanto
   * como los pesos- y un tribunal tiene derecho a ver la regla entera.
   */
  async getWeights() {
    const rows = await this.weights.find({
      where: { isActive: true },
      order: { signalType: 'ASC', points: 'DESC' },
    });
    return {
      engineVersion: AFFINITY_ENGINE_VERSION,
      maxRawPoints: AFFINITY_MAX_RAW,
      caps: AFFINITY_CAPS,
      supportCaps: SUPPORT_CAPS,
      supportPoints: SUPPORT_POINTS,
      diminishing: DIMINISHING,
      levelThresholds: LEVEL_THRESHOLDS,
      independentFamilies: INDEPENDENT_SUPPORT_FAMILIES,
      weights: rows.map((w) => ({
        code: w.code,
        signalType: w.signalType,
        points: Number(w.points),
        label: w.label,
        description: w.description,
      })),
    };
  }

  /**
   * Mapa agregado de afinidad por area.
   *
   * `semesters` lo usa el docente para no recibir datos de estudiantes fuera
   * de su alcance (§68). Sin argumento, agrega toda la carrera, que es lo que
   * corresponde a Direccion.
   */
  async basicMap(semesters?: number[]) {
    const qb = this.results
      .createQueryBuilder('result')
      .innerJoin('result.academicArea', 'area');

    if (semesters) {
      qb.innerJoin('result.studentProfile', 'profile')
        .andWhere('profile.semester IN (:...semesters)', { semesters });
    }

    const rows = await qb
      .select('result.academic_area_id', 'areaId')
      .addSelect('area.name', 'area')
      .addSelect('COUNT(*)::int', 'students')
      .addSelect('COALESCE(AVG(result.score), 0)', 'averageScore')
      .addSelect('COALESCE(AVG(result.support_score), 0)', 'averageSupport')
      .addSelect(`COUNT(*) FILTER (WHERE result.level = 'low')::int`, 'low')
      .addSelect(`COUNT(*) FILTER (WHERE result.level = 'medium')::int`, 'medium')
      .addSelect(`COUNT(*) FILTER (WHERE result.level = 'high')::int`, 'high')
      .groupBy('result.academic_area_id')
      .addGroupBy('area.name')
      .orderBy('students', 'DESC')
      .getRawMany<{
        areaId: string;
        area: string;
        students: number;
        averageScore: string;
        averageSupport: string;
        low: number;
        medium: number;
        high: number;
      }>();

    return rows.map((r) => ({
      areaId: r.areaId,
      area: r.area,
      students: r.students,
      averageScore: Number(Number(r.averageScore).toFixed(2)),
      averageSupport: Number(Number(r.averageSupport).toFixed(2)),
      byLevel: { low: r.low, medium: r.medium, high: r.high },
    }));
  }

  // =========================================================================
  //  Infraestructura
  // =========================================================================

  /**
   * Niveles de respaldo de un conjunto de recursos validados (§30).
   *
   * Un recurso sin registro de validacion vale `DECLARED`: no significa que
   * sea falso, significa que todavia no se pudo comprobar nada.
   */
  private async backingTiersOf(
    resourceType: ValidationResourceType,
    ids: string[],
  ): Promise<Map<string, BackingTier>>;
  private async backingTiersOf(
    resourceType: ValidationResourceType,
    ids: string[],
    conDuplicados: true,
  ): Promise<Map<string, { tier: BackingTier; duplicado: boolean }>>;
  private async backingTiersOf(
    resourceType: ValidationResourceType,
    ids: string[],
    conDuplicados = false,
  ): Promise<Map<string, any>> {
    const salida = new Map<string, any>();
    if (ids.length === 0) return salida;

    const rows = await this.validations.find({
      where: { resourceType, resourceId: In(ids) },
    });
    rows.forEach((r) => {
      // §28 y §55: contenido repetido no vuelve a respaldar. Se degrada a
      // DECLARED en lugar de descartarse, para que siga apareciendo en el
      // desglose con su motivo.
      const duplicado = !!r.duplicateOfId;
      const tier = duplicado ? BackingTier.DECLARED : r.backingTier;
      salida.set(r.resourceId, conDuplicados ? { tier, duplicado } : tier);
    });
    return salida;
  }

  /**
   * Carga las ponderaciones vigentes y calcula su huella.
   *
   * La huella incluye la estructura del motor, no solo los pesos: si cambian
   * los topes o los rendimientos, el puntaje de un area se mueve sin que el
   * estudiante haya hecho nada, y el historial debe permitir distinguir los
   * dos casos.
   */
  private async loadWeights(): Promise<{
    points: Map<AffinityWeightCode, number>;
    version: string;
  }> {
    const rows = await this.weights.find({ where: { isActive: true } });
    const points = new Map<AffinityWeightCode, number>();
    rows.forEach((r) => points.set(r.code, Number(r.points)));

    (Object.keys(DEFAULT_WEIGHTS) as AffinityWeightCode[]).forEach((code) => {
      if (!points.has(code)) points.set(code, DEFAULT_WEIGHTS[code]);
    });

    const fingerprint = [
      `engine=${AFFINITY_ENGINE_VERSION}`,
      ...[...points.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, value]) => `${code}=${value}`),
      `caps=${JSON.stringify(AFFINITY_CAPS)}`,
      `support=${JSON.stringify(SUPPORT_CAPS)}${JSON.stringify(SUPPORT_POINTS)}`,
      `dim=${JSON.stringify(DIMINISHING)}`,
      `levels=${JSON.stringify(LEVEL_THRESHOLDS)}`,
      `max=${AFFINITY_MAX_RAW}`,
    ].join('|');

    return {
      points,
      version: createHash('sha256').update(fingerprint).digest('hex').slice(0, 16),
    };
  }

  /**
   * Escribe resultados, desglose e instantanea en una sola transaccion.
   *
   * O se aplica todo, o no cambia nada: sin transaccion, un fallo entre el
   * borrado y la insercion dejaria al estudiante sin ninguna afinidad.
   */
  private async persist(
    studentProfileId: string,
    senales: Senal[],
    rulesVersion: string,
  ): Promise<AffinityResult[]> {
    const { contributions, areas } = this.puntuar(senales);

    // Un area entra en el resultado si tiene afinidad **o** respaldo. Puede
    // tener lo segundo sin lo primero -una constancia suelta, por ejemplo- y
    // esconderla dejaria al estudiante sin ver una senal que el sistema si
    // registro.
    const ranked = areas.filter((a) => a.rawPoints > 0 || a.supportScore > 0);

    /*
     * El desglose se guarda entero, incluidas las areas que quedaron en cero.
     *
     * Antes solo se guardaba el de las areas con puntaje, y eso dejaba mudo
     * justo el caso en que el estudiante mas pregunta: un proyecto marcado por
     * inconsistencia vale 0 (§51.3), su area no entra en el ranking, y con el
     * criterio anterior la explicacion desaparecia con ella. El estudiante
     * veia que su proyecto no contaba y no habia forma de saber por que.
     *
     * §91 pide dos listas, y la segunda -«no contribuye»- no puede existir si
     * las senales de cero se descartan antes de escribirlas.
     */
    const persistibles = contributions;

    const averageSupport = ranked.length
      ? Math.round(ranked.reduce((s, a) => s + a.supportScore, 0) / ranked.length)
      : 0;

    await this.dataSource.transaction(async (manager) => {
      /*
       * Un perfil se recalcula de uno en uno.
       *
       * §57 obliga a recalcular ante muchas senales distintas, y varias
       * ocurren casi a la vez: adjuntar un certificado recalcula, y el
       * veredicto del validador sobre ese mismo certificado vuelve a hacerlo
       * segundos despues. Como persistir es «borrar y volver a insertar», dos
       * recalculos solapados del mismo perfil se pisan: ambos borran, ambos
       * insertan, y el segundo choca contra `uq_affinity_result`.
       *
       * El cerrojo es de transaccion, asi que se libera solo al terminar, y
       * esta en la base y no en memoria porque dos instancias de la API se
       * pisarian igual. Solo serializa el mismo perfil: dos estudiantes
       * distintos siguen recalculandose en paralelo.
       */
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [
        `affinity:${studentProfileId}`,
      ]);

      await manager.delete(AffinityResult, { studentProfileId });
      await manager.delete(AffinityContribution, { studentProfileId });

      if (ranked.length > 0) {
        await manager.insert(
          AffinityResult,
          ranked.map((r) => ({
            studentProfileId,
            academicAreaId: r.academicAreaId,
            score: r.score,
            rawPoints: r.rawPoints,
            level: r.level,
            supportScore: r.supportScore,
            supportLevel: r.supportLevel,
            supportFamilies: r.supportFamilies,
            engineVersion: AFFINITY_ENGINE_VERSION,
          })),
        );
      }

      if (persistibles.length > 0) {
        await manager.insert(
          AffinityContribution,
          persistibles.map((c) => ({
            studentProfileId,
            academicAreaId: c.areaId,
            signalFamily: c.family,
            signalType: c.signalType,
            weightCode: c.weightCode,
            matchType: c.matchType,
            sourceEntityType: c.sourceEntityType,
            rawPoints: c.base,
            multiplier: c.multiplier,
            points: c.points,
            supportPoints: c.supportPoints,
            sourceLabel: c.reason,
            sourceId: c.sourceId,
            engineVersion: AFFINITY_ENGINE_VERSION,
          })),
        );
      }

      const snapshot = await manager.save(
        manager.create(AffinitySnapshot, {
          studentProfileId,
          status: ranked.length
            ? AffinityCalculationStatus.CALCULATED
            : AffinityCalculationStatus.INSUFFICIENT_DATA,
          totalScore: Number(ranked.reduce((sum, r) => sum + r.score, 0).toFixed(2)),
          areasCount: ranked.length,
          signalsCount: persistibles.length,
          rulesVersion,
          engineVersion: AFFINITY_ENGINE_VERSION,
          averageSupport,
        }),
      );

      if (ranked.length > 0) {
        await manager.insert(
          AffinitySnapshotItem,
          ranked.map((r, index) => ({
            snapshotId: snapshot.id,
            academicAreaId: r.academicAreaId,
            score: r.score,
            rawPoints: r.rawPoints,
            level: r.level,
            supportScore: r.supportScore,
            supportLevel: r.supportLevel,
            rank: index + 1,
          })),
        );
      }

      await this.pruneSnapshots(manager, studentProfileId);
    });

    return ranked.length ? this.getForProfile(studentProfileId) : [];
  }

  /**
   * Conserva solo las ultimas instantaneas de cada estudiante.
   *
   * El historial debe permitir ver evolucion, no crecer sin limite: cada
   * accion del estudiante dispara un recalculo.
   */
  private async pruneSnapshots(
    manager: DataSource['manager'],
    studentProfileId: string,
  ): Promise<void> {
    // V2 §81: las instantáneas de versiones anteriores del motor son historia
    // y no se podan; la retención solo actúa sobre las de la versión actual.
    const obsolete = await manager
      .createQueryBuilder(AffinitySnapshot, 'snapshot')
      .select('snapshot.id', 'id')
      .where('snapshot.student_profile_id = :studentProfileId', { studentProfileId })
      .andWhere('snapshot.engine_version = :version', { version: AFFINITY_ENGINE_VERSION })
      .orderBy('snapshot.calculated_at', 'DESC')
      .addOrderBy('snapshot.id', 'DESC')
      .offset(SNAPSHOT_RETENTION)
      .limit(500)
      .getRawMany<{ id: string }>();

    if (obsolete.length > 0) {
      await manager.delete(
        AffinitySnapshot,
        obsolete.map((row) => row.id),
      );
    }
  }

  /** Codigo de ponderacion segun la prioridad declarada (§51.1). */
  private interestWeightCode(priority: number): AffinityWeightCode {
    const tabla = [
      AffinityWeightCode.INTEREST_PRIORITY_1,
      AffinityWeightCode.INTEREST_PRIORITY_2,
      AffinityWeightCode.INTEREST_PRIORITY_3,
      AffinityWeightCode.INTEREST_PRIORITY_4,
      AffinityWeightCode.INTEREST_PRIORITY_5,
    ];
    const indice = Math.min(Math.max(Math.trunc(priority) || 1, 1), 5) - 1;
    return tabla[indice];
  }



  private activityWeightCode(status: RegistrationStatus): AffinityWeightCode | null {
    if (status === RegistrationStatus.INTERESTED) return AffinityWeightCode.ACTIVITY_INTERESTED;
    if (status === RegistrationStatus.REGISTERED) return AffinityWeightCode.ACTIVITY_REGISTERED;
    if (status === RegistrationStatus.CONFIRMED) return AffinityWeightCode.ACTIVITY_CONFIRMED;
    return null;
  }

  /**
   * Nivel de un puntaje de 0 a 100 (§54).
   *
   * El nivel de afinidad era relativo al area mas fuerte del propio
   * estudiante. Ya no puede serlo: §52 exige que el puntaje se compare en el
   * tiempo, y un nivel cuyo divisor cambia con el perfil no es comparable con
   * nada, ni siquiera consigo mismo el mes pasado.
   */
  private classify(score: number): AffinityLevel {
    if (score > LEVEL_THRESHOLDS.MEDIUM_MAX) return AffinityLevel.HIGH;
    if (score > LEVEL_THRESHOLDS.LOW_MAX) return AffinityLevel.MEDIUM;
    return AffinityLevel.LOW;
  }

  /**
   * Nivel de respaldo, con la regla de diversidad de §54.
   *
   * Un respaldo de 80 construido con un solo tipo de prueba no es un respaldo
   * alto: es mucha cantidad de lo mismo. §54 lo dice sin ambiguedad y el tope
   * en MEDIUM es lo que impide que acumular certificados del mismo curso
   * parezca una trayectoria.
   */
  private classifySupport(
    supportScore: number,
    familias: Set<AffinitySignalFamily>,
  ): AffinityLevel {
    const bruto = this.classify(supportScore);
    if (bruto === AffinityLevel.HIGH && familias.size < 2) {
      return AffinityLevel.MEDIUM;
    }
    return bruto;
  }

  private inferAreasByTech(technologies: string[] | null, areas: AreaInfo[]): string[] {
    if (!technologies || technologies.length === 0) return [];
    const techs = technologies.map((t) => t.toLowerCase());
    const matched = new Set<string>();
    for (const area of areas) {
      const hit = techs.some((tech) =>
        area.tags.some((tag) => tech.includes(tag) || tag.includes(tech)),
      );
      if (hit) matched.add(area.id);
    }
    return [...matched];
  }

  private matchAreasByText(text: string, areas: AreaInfo[]): string[] {
    const normalized = text.toLowerCase();
    const matched = new Set<string>();
    for (const area of areas) {
      const hit =
        normalized.includes(area.name) || area.tags.some((tag) => normalized.includes(tag));
      if (hit) matched.add(area.id);
    }
    return [...matched];
  }
}
