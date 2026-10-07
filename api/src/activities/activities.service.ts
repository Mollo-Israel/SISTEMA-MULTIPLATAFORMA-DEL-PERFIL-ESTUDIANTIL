import { NOTIFICATION_EMITTER, NotificationEmitter } from '../notifications/notification.port';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import {
  ACTIVITY_STATUS_LABEL,
  ActivityOrigin,
  ActivityOutcomePolicy,
  ConstancyStatus,
  ActivityReviewStatus,
  ActivityStatus,
  ActivityType,
  canTransition,
  GamificationTrigger,
  OCCUPYING_STATUSES,
  PUBLISHABLE_REVIEW_STATUSES,
  REGISTRABLE_ACTIVITY_STATUSES,
  RegistrationMode,
  RegistrationStatus,
  RolNombre,
  TERMINAL_ACTIVITY_STATUSES,
} from '@perfil/shared';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { ActivityCategory } from '../entities/activity-category.entity';
import { ActivitySkill } from '../entities/activity-skill.entity';
import { ActivityArea } from '../entities/activity-area.entity';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { ExternalOpportunityValidationReference } from '../entities/external-opportunity-validation-reference.entity';
import { CREDENTIAL_PATTERN_CHARS } from './credential-pattern';
import { FILES_ROUTE } from '../storage/local-storage.driver';
import { UploadsService } from '../storage/uploads.service';
import { CredentialEligibilityService } from './credential-eligibility.service';
import { SaveValidationReferenceDto } from './dto/validation-reference.dto';
import { User } from '../entities/user.entity';
import { assertSkillsBelongToAreas } from '../catalogs/area-skill.guard';
import { Skill } from '../entities/skill.entity';
import { ActivityGamificationRule, ActivityReview } from '../entities/activity-review.entity';
import { GamificationCriterion } from '../entities/gamification-criterion.entity';
import { ConfigService } from '@nestjs/config';
import { ActivityGamificationRuleDto } from './dto/create-activity.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { TeacherScopeService } from '../access/teacher-scope.service';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { QueryActivitiesDto } from './dto/query-activities.dto';
import {
  TRAJECTORY_RECALCULATION,
  TrajectoryRecalculationPort,
} from '../trajectory/trajectory-recalculation.port';

/** Estados en los que un estudiante puede manifestar interes o inscribirse. */
const REGISTRABLE_STATUSES = REGISTRABLE_ACTIVITY_STATUSES;

/**
 * Quien responde por cada tipo de actividad a nivel de carrera (§22):
 *   - Academica       -> Director de carrera
 *   - Extracurricular -> Sociedad cientifica
 *
 * El docente tambien gestiona academicas, pero no por rol sino por
 * alcance: solo las que caen dentro de sus semestres habilitados. Esa
 * distincion vive en `canManage`, porque depende de la actividad concreta
 * y no puede resolverse con una tabla.
 */
const OWNER_ROLE_BY_TYPE: Record<ActivityType, RolNombre> = {
  [ActivityType.ACADEMICA]: RolNombre.CAREER_DIRECTOR,
  [ActivityType.EXTRACURRICULAR]: RolNombre.SCIENTIFIC_SOCIETY,
};

/**
 * Convierte el valor del filtro a una fecha local.
 *
 * Ojo: JavaScript parsea "2026-09-12" como medianoche UTC, no local. En una
 * zona con desfase negativo eso cae en el dia anterior y el rango se corre un
 * dia. Por eso una fecha sin hora se construye componente a componente.
 */
const toLocalDate = (value: string): Date => {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(value);
};

/** Inicio del dia local de una fecha ISO o yyyy-mm-dd. */
const startOfDay = (value: string): Date => {
  const d = toLocalDate(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Fin del dia local, para que el limite "hasta" incluya toda la jornada. */
const endOfDay = (value: string): Date => {
  const d = toLocalDate(value);
  d.setHours(23, 59, 59, 999);
  return d;
};

export interface ActivityWithCounts extends Activity {
  registrationCount: number;
  confirmedCount: number;
  seatsLeft: number | null;
  registrationBlockReason: string | null;
  /**
   * Situacion del estudiante que consulta, si la hay.
   *
   * Solo se rellena para el rol estudiante: a un docente no le sirve de
   * nada y consultarlo seria trabajo tirado.
   */
  myRegistration?: { id: string; status: RegistrationStatus; evidenceEligible?: boolean } | null;
}

/**
 * Lo que un estudiante recibe de una actividad (V2 §80, minimización).
 *
 * El listado completo arrastraba la entidad del creador —con su correo, rol y
 * estado— y los datos internos de la revisión de Dirección (comentario, quién
 * y cuándo). Nada de eso le sirve para inscribirse y no es suyo de ver; además
 * duplicaba el peso de la respuesta.
 */
function vistaEstudiante<T extends object>(actividad: T) {
  const {
    creator, category, academicArea,
    reviewComment, reviewedById, reviewedAt, submittedAt, requiresReview, reviewStatus,
    ...resto
  } = actividad as T & {
    creator?: { id: string; firstName: string; lastName: string } | null;
    category?: { id: string; code: string; name: string; appliesTo?: string } | null;
    academicArea?: { id: string; name: string } | null;
    reviewComment?: unknown; reviewedById?: unknown; reviewedAt?: unknown;
    submittedAt?: unknown; requiresReview?: unknown; reviewStatus?: unknown;
  };
  void reviewComment; void reviewedById; void reviewedAt; void submittedAt; void requiresReview; void reviewStatus;
  return {
    ...resto,
    creator: creator ? { id: creator.id, firstName: creator.firstName, lastName: creator.lastName } : null,
    category: category ? { id: category.id, code: category.code, name: category.name, appliesTo: category.appliesTo } : null,
    academicArea: academicArea ? { id: academicArea.id, name: academicArea.name } : null,
  };
}

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(ActivityRegistration)
    private readonly registrations: Repository<ActivityRegistration>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    @InjectRepository(ActivityCategory)
    private readonly categories: Repository<ActivityCategory>,
    @InjectRepository(ActivitySkill)
    private readonly activitySkills: Repository<ActivitySkill>,
    @InjectRepository(ActivityArea)
    private readonly activityAreas: Repository<ActivityArea>,
    @InjectRepository(InternalConstancy)
    private readonly constancies: Repository<InternalConstancy>,
    @InjectRepository(Skill) private readonly skills: Repository<Skill>,
    @Inject(TRAJECTORY_RECALCULATION)
    private readonly trajectory: TrajectoryRecalculationPort,
    private readonly teacherScope: TeacherScopeService,
    private readonly audit: AuditService,
    @InjectRepository(ActivityReview) private readonly reviews: Repository<ActivityReview>,
    @InjectRepository(ActivityGamificationRule)
    private readonly rules: Repository<ActivityGamificationRule>,
    @InjectRepository(GamificationCriterion)
    private readonly criteria: Repository<GamificationCriterion>,
    private readonly config: ConfigService,
    @InjectRepository(ExternalOpportunityValidationReference)
    private readonly references: Repository<ExternalOpportunityValidationReference>,
    private readonly eligibility: CredentialEligibilityService,
    private readonly uploads: UploadsService,
    @Inject(NOTIFICATION_EMITTER) private readonly notifications: NotificationEmitter,
  ) {}

  // =========================================================================
  //  V2 §27 · Revisión de Dirección
  // =========================================================================

  /** Docente, Sociedad (y Administración) proponen; Dirección decide (§27.3–§27.5). */
  private requiereRevision(role: RolNombre): boolean {
    // V3 §12.2: Dirección y Administración publican sin revisión
    // (NOT_REQUIRED); Docente y Sociedad proponen y Dirección decide.
    return role !== RolNombre.CAREER_DIRECTOR && role !== RolNombre.ADMIN;
  }

  /**
   * Política de resultado (V3 §14). Acepta `outcomePolicy` o, por
   * compatibilidad, `internalConstancyEnabled` / `credentialExpected`.
   * Una externa no emite constancia interna: su resultado es la credencial del
   * proveedor.
   */
  private politicaResultado(
    dto: { outcomePolicy?: ActivityOutcomePolicy; internalConstancyEnabled?: boolean; credentialExpected?: boolean },
    origen: ActivityOrigin,
    actual: ActivityOutcomePolicy = ActivityOutcomePolicy.NONE,
  ): ActivityOutcomePolicy {
    let politica = actual;
    if (dto.outcomePolicy !== undefined) politica = dto.outcomePolicy;
    else if (dto.internalConstancyEnabled === true) politica = ActivityOutcomePolicy.INTERNAL_CONSTANCY;
    else if (dto.credentialExpected === true) politica = ActivityOutcomePolicy.EXTERNAL_CREDENTIAL_EXPECTED;
    else if (dto.internalConstancyEnabled === false && politica === ActivityOutcomePolicy.INTERNAL_CONSTANCY) {
      politica = ActivityOutcomePolicy.NONE;
    } else if (dto.credentialExpected === false && politica === ActivityOutcomePolicy.EXTERNAL_CREDENTIAL_EXPECTED) {
      politica = ActivityOutcomePolicy.NONE;
    }
    if (origen === ActivityOrigin.EXTERNAL && politica === ActivityOutcomePolicy.INTERNAL_CONSTANCY) {
      const msg = 'Una oportunidad externa no emite constancia interna: su resultado es la credencial del proveedor.';
      throw new BadRequestException({ message: msg, fields: { outcomePolicy: [msg] } });
    }
    return politica;
  }

  /** Lleva la política a las columnas que la reflejan. */
  private aplicarPolitica(activity: Activity, politica: ActivityOutcomePolicy): void {
    activity.outcomePolicy = politica;
    activity.internalConstancyEnabled = politica === ActivityOutcomePolicy.INTERNAL_CONSTANCY;
    activity.credentialExpected = politica === ActivityOutcomePolicy.EXTERNAL_CREDENTIAL_EXPECTED;
  }

  /** Datos de proveedor: los lleva una externa o una interna que conduce a una credencial (§14.2). */
  private llevaDatosDeProveedor(activity: Activity): boolean {
    return activity.originType === ActivityOrigin.EXTERNAL
      || activity.outcomePolicy === ActivityOutcomePolicy.EXTERNAL_CREDENTIAL_EXPECTED;
  }

  /**
   * Constancia automática (V3 §14.1): al confirmar la participación en una
   * actividad con constancia, el sistema la emite a nombre de quien confirmó
   * (el responsable) y la adjunta a la trayectoria. El estudiante no sube nada.
   * Si después se corrige la confirmación, la constancia queda rechazada (no
   * se borra: es historia).
   */
  private async sincronizarConstancia(
    activity: Activity,
    registration: ActivityRegistration,
    confirmerId: string,
  ): Promise<void> {
    const existente = await this.constancies.findOne({
      where: { studentProfileId: registration.studentProfileId, activityId: activity.id },
    });
    if (registration.status !== RegistrationStatus.CONFIRMED) {
      if (existente && existente.status === ConstancyStatus.AUTHORIZED) {
        existente.status = ConstancyStatus.REJECTED;
        await this.constancies.save(existente);
      }
      return;
    }
    const autorizada = activity.outcomePolicy === ActivityOutcomePolicy.INTERNAL_CONSTANCY
      && activity.status !== ActivityStatus.DRAFT
      && activity.status !== ActivityStatus.CANCELLED
      && PUBLISHABLE_REVIEW_STATUSES.includes(activity.reviewStatus as ActivityReviewStatus);
    if (!autorizada) return;
    if (existente) {
      if (existente.status !== ConstancyStatus.AUTHORIZED) {
        existente.status = ConstancyStatus.AUTHORIZED;
        existente.issuedById = confirmerId;
        await this.constancies.save(existente);
      }
      return;
    }
    const constancia = await this.constancies.save(
      this.constancies.create({
        studentProfileId: registration.studentProfileId,
        activityId: activity.id,
        activityRegistrationId: registration.id,
        description: `Participación confirmada en «${activity.title}».`.slice(0, 300),
        status: ConstancyStatus.AUTHORIZED,
        // §6.5: emite quien responde y confirmó; autoriza quien aprobó la
        // actividad (o quien la publicó sin revisión, si fue Dirección).
        issuedById: confirmerId,
        authorizedById: activity.reviewedById ?? (activity.requiresReview ? null : activity.creatorId),
      }),
    );
    await this.audit.record({
      actorUserId: confirmerId,
      eventType: AuditEventType.CONSTANCY_ISSUED,
      entityType: 'internal_constancy',
      entityId: constancia.id,
      metadata: { activityId: activity.id, studentProfileId: registration.studentProfileId, automatica: true },
    });
  }

  /** Áreas pedidas: `areaIds` (V3) o el `areaId` de siempre. */
  private areasPedidas(dto: { areaIds?: string[]; areaId?: string | null }): string[] | undefined {
    if (dto.areaIds !== undefined) return [...new Set(dto.areaIds)];
    if (dto.areaId !== undefined) return dto.areaId ? [dto.areaId] : [];
    return undefined;
  }

  /** Reemplaza las áreas de una oportunidad; la primera es la principal. */
  private async replaceAreas(activityId: string, areaIds: string[]): Promise<void> {
    await this.activityAreas.delete({ activityId });
    if (areaIds.length > 0) {
      await this.activityAreas.save(areaIds.map((academicAreaId) => this.activityAreas.create({ activityId, academicAreaId })));
    }
  }

  /**
   * Una externa nombra a su proveedor y su enlace (V3 §12.1); una interna no
   * lleva datos de proveedor.
   */
  private assertExterna(origen: ActivityOrigin, provider: string | null | undefined, url: string | null | undefined): void {
    if (origen !== ActivityOrigin.EXTERNAL) return;
    const fields: Record<string, string[]> = {};
    if (!provider?.trim()) fields.provider = ['Indica el proveedor de la oportunidad externa.'];
    if (!url?.trim()) fields.externalUrl = ['Indica el enlace oficial de la oportunidad externa.'];
    if (Object.keys(fields).length) {
      throw new BadRequestException({ message: 'Faltan datos de la oportunidad externa.', fields });
    }
  }

  /**
   * Responsable (V3 §6.5, §12.2). Quien crea responde por lo suyo; cuando crea
   * Administración —autoridad técnica, no emisor académico— debe nombrar a un
   * responsable real del rol que gestiona ese tipo de oportunidad.
   */
  private async resolverResponsable(
    user: AuthenticatedUser,
    type: ActivityType,
    responsibleUserId: string | undefined,
  ): Promise<string> {
    if (user.role !== RolNombre.ADMIN) return user.userId;
    if (!responsibleUserId) {
      const msg = 'Como Administración, indica quién es el responsable académico de esta oportunidad.';
      throw new BadRequestException({ message: msg, fields: { responsibleUserId: [msg] } });
    }
    const responsable = await this.activities.manager.getRepository(User).findOne({
      where: { id: responsibleUserId },
      relations: { role: true },
    });
    const permitidos = type === ActivityType.ACADEMICA
      ? [RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR]
      : [RolNombre.SCIENTIFIC_SOCIETY, RolNombre.CAREER_DIRECTOR];
    if (!responsable || responsable.status !== 'active' || !permitidos.includes(responsable.role?.name as RolNombre)) {
      const msg = type === ActivityType.ACADEMICA
        ? 'El responsable de una oportunidad académica debe ser un docente o la Dirección, con la cuenta activa.'
        : 'El responsable de una oportunidad extracurricular debe ser la Sociedad científica o la Dirección, con la cuenta activa.';
      throw new BadRequestException({ message: msg, fields: { responsibleUserId: [msg] } });
    }
    return responsable.id;
  }

  /**
   * Campos que cambian QUÉ es la actividad. Lo que Dirección aprobó no puede
   * cambiar después sin que lo vuelva a ver. Fechas, lugar o cupo son
   * operación, no contenido.
   */
  private cambiaContenido(dto: UpdateActivityDto): boolean {
    return [
      dto.title, dto.description, dto.type, dto.categoryId, dto.areaId, dto.areaIds, dto.skillIds,
      dto.originType, dto.provider, dto.credentialExpected, dto.expectedIssuerDomains, dto.expectedKeywords,
      dto.outcomePolicy,
      dto.semesterScope, dto.internalConstancyEnabled, dto.gamificationRules, dto.evidenceRequired,
    ].some((v) => v !== undefined);
  }

  /** Envía a Dirección una actividad en borrador (§27.3). */
  async submitForReview(user: AuthenticatedUser, id: string, comment?: string): Promise<Activity> {
    const activity = await this.findOne(id);
    await this.assertCanManage(user, activity);
    if (!activity.requiresReview) {
      throw new BadRequestException('Esta actividad no necesita revisión: la gestiona Dirección.');
    }
    if (activity.status !== ActivityStatus.DRAFT) {
      throw new BadRequestException('Solo se envía a revisión una actividad en borrador.');
    }
    if (activity.reviewStatus === ActivityReviewStatus.PENDING) {
      throw new ConflictException('Ya está en revisión.');
    }
    if (activity.reviewStatus === ActivityReviewStatus.APPROVED) {
      throw new ConflictException('Ya está aprobada: puedes publicarla.');
    }
    if (activity.reviewStatus === ActivityReviewStatus.REJECTED) {
      throw new ConflictException('Fue rechazada. No se reutiliza: crea una actividad nueva.');
    }
    activity.reviewStatus = ActivityReviewStatus.PENDING;
    activity.submittedAt = new Date();
    await this.activities.save(activity);
    await this.reviews.save(this.reviews.create({
      activityId: activity.id, actorUserId: user.userId, action: 'submitted', comment: comment ?? null,
    }));
    await this.audit.record({
      actorUserId: user.userId,
      eventType: AuditEventType.ACTIVITY_SUBMITTED,
      entityType: 'activity',
      entityId: activity.id,
      metadata: { reenvio: !!activity.reviewComment },
    });
    return this.findOne(id);
  }

  /** Dirección aprueba, observa o rechaza (§27.3). Queda en la historia (§88.12). */
  async review(
    user: AuthenticatedUser,
    id: string,
    decision: 'approve' | 'observe' | 'reject',
    comment?: string,
  ): Promise<Activity> {
    if (user.role !== RolNombre.CAREER_DIRECTOR) {
      throw new ForbiddenException('Las actividades las aprueba la Dirección de carrera.');
    }
    const activity = await this.findOne(id);
    if (activity.reviewStatus !== ActivityReviewStatus.PENDING) {
      throw new ConflictException('Solo se decide sobre una actividad enviada a revisión.');
    }
    if (decision !== 'approve' && !comment?.trim()) {
      throw new BadRequestException({
        message: 'Escribe la observación para quien la propuso.',
        fields: { comment: ['Escribe la observación para quien la propuso.'] },
      });
    }
    const destino = {
      approve: ActivityReviewStatus.APPROVED,
      observe: ActivityReviewStatus.OBSERVED,
      reject: ActivityReviewStatus.REJECTED,
    }[decision];
    activity.reviewStatus = destino;
    activity.reviewedAt = new Date();
    activity.reviewedById = user.userId;
    activity.reviewComment = comment?.trim() || null;
    await this.activities.save(activity);
    const accion = ({ approve: 'approved', observe: 'observed', reject: 'rejected' } as const)[decision];
    await this.reviews.save(this.reviews.create({
      activityId: activity.id, actorUserId: user.userId, action: accion, comment: comment?.trim() || null,
    }));
    await this.audit.record({
      actorUserId: user.userId,
      eventType: {
        approve: AuditEventType.ACTIVITY_APPROVED,
        observe: AuditEventType.ACTIVITY_OBSERVED,
        reject: AuditEventType.ACTIVITY_REJECTED,
      }[decision],
      entityType: 'activity',
      entityId: activity.id,
      metadata: { comentario: comment?.trim() ?? null },
    });
    return this.findOne(id);
  }

  /** Lo que espera la decisión de Dirección. */
  async pendingReviews(user: AuthenticatedUser) {
    if (user.role !== RolNombre.CAREER_DIRECTOR) {
      throw new ForbiddenException('Las aprobaciones son de la Dirección de carrera.');
    }
    const lista = await this.activities.find({
      where: { reviewStatus: ActivityReviewStatus.PENDING },
      relations: { academicArea: true, creator: true, category: true, activitySkills: { skill: true }, activityAreas: { academicArea: true } },
      order: { submittedAt: 'ASC' },
    });
    const reglas = lista.length
      ? await this.rules.find({ where: { activityId: In(lista.map((a) => a.id)) } })
      : [];
    return lista.map((a) => ({ ...a, gamificationRules: reglas.filter((r) => r.activityId === a.id) }));
  }

  /** Historia de la revisión de una actividad. */
  async reviewHistory(user: AuthenticatedUser, id: string) {
    const activity = await this.findOne(id);
    if (user.role !== RolNombre.CAREER_DIRECTOR) await this.assertCanManage(user, activity);
    return this.reviews.find({
      where: { activityId: id },
      relations: { actor: true },
      order: { createdAt: 'ASC' },
    }).then((filas) => filas.map((r) => ({
      id: r.id,
      action: r.action,
      comment: r.comment,
      at: r.createdAt,
      by: r.actor ? `${r.actor.firstName} ${r.actor.lastName}` : null,
    })));
  }

  /** Reglas de puntos de la actividad (§31.2): hechos permitidos y rango. */
  private async replaceRules(activityId: string, userId: string, reglas: ActivityGamificationRuleDto[]) {
    const max = Number(this.config.get<string>('GAMIFICATION_ACTIVITY_MAX_POINTS') ?? 50) || 50;
    for (const r of reglas) {
      if (r.trigger !== GamificationTrigger.PARTICIPACION_CONFIRMADA) {
        throw new BadRequestException({
          message: 'En una actividad solo se premia la participación confirmada.',
          fields: { gamificationRules: ['En una actividad solo se premia la participación confirmada.'] },
        });
      }
      if (r.points > max) {
        throw new BadRequestException({
          message: `Una actividad puede dar como máximo ${max} puntos por participación.`,
          fields: { gamificationRules: [`Como máximo ${max} puntos.`] },
        });
      }
    }
    const unicos = new Map(reglas.map((r) => [r.trigger, r]));
    await this.rules.delete({ activityId });
    for (const r of unicos.values()) {
      const criterio = await this.criteria.findOne({ where: { code: r.trigger } });
      await this.rules.save(this.rules.create({
        activityId,
        trigger: r.trigger,
        points: r.points,
        badgeId: r.badgeId ?? null,
        description: r.description ?? null,
        criterionId: criterio?.id ?? null,
        createdById: userId,
      }));
    }
  }

  /** Semestres habilitados del docente: los únicos que puede elegir (§28). */
  async myScope(user: AuthenticatedUser): Promise<{ semesters: number[] }> {
    return { semesters: await this.teacherScope.allowedSemesters(user.userId) };
  }

  async rulesOf(activityId: string) {
    return this.rules.find({ where: { activityId } });
  }

  async create(user: AuthenticatedUser, dto: CreateActivityDto): Promise<Activity> {
    this.assertCanPublish(user.role, dto.type);
    const areas = this.areasPedidas(dto) ?? [];
    // V3 §4: las habilidades pertenecen a las áreas elegidas (y las áreas existen).
    await assertSkillsBelongToAreas(this.activities.manager, dto.skillIds, areas, 'skillIds');
    for (const areaId of areas) await this.assertAreaExists(areaId);
    await this.assertCategoryUsable(dto.categoryId, dto.type);
    const origen = dto.originType ?? ActivityOrigin.INTERNAL;
    this.assertExterna(origen, dto.provider, dto.externalUrl);
    const responsable = await this.resolverResponsable(user, dto.type, dto.responsibleUserId);

    // §22: un docente solo alcanza a sus semestres habilitados, y eso
    // incluye lo que declara al crear. Sin esto bastaria con publicar una
    // actividad para todo el 1.o al 8.o y quedar como su gestor.
    const semesterScope = await this.resolveSemesterScope(user, dto.semesterScope);
    this.assertDateWindow(dto.activityDate, dto.endAt);

    // V2 §27: lo que proponen Docente y Sociedad pasa por Dirección antes de
    // publicarse; lo que crea Dirección, no.
    const requiresReview = this.requiereRevision(user.role);
    const estadoInicial = dto.status ?? ActivityStatus.DRAFT;
    if (requiresReview && estadoInicial !== ActivityStatus.DRAFT) {
      throw new ConflictException({
        message: 'Se crea como borrador y se envía a revisión de Dirección antes de publicarse.',
        fields: { status: ['Se crea como borrador y se envía a revisión de Dirección.'] },
      });
    }

    const activity = this.activities.create({
      title: dto.title,
      description: dto.description ?? null,
      type: dto.type,
      categoryId: dto.categoryId,
      modality: dto.modality,
      academicAreaId: areas[0] ?? null,
      creatorId: user.userId,
      responsibleUserId: responsable,
      originType: origen,
      // Se limpian abajo si la oportunidad no lleva datos de proveedor.
      provider: dto.provider?.trim() || null,
      credentialExpected: false,
      expectedIssuerDomains: dto.expectedIssuerDomains ?? [],
      expectedKeywords: dto.expectedKeywords ?? [],
      eventDate: dto.activityDate ? new Date(dto.activityDate) : null,
      endAt: dto.endAt ? new Date(dto.endAt) : null,
      semesterScope,
      registrationMode: dto.registrationMode ?? RegistrationMode.OPEN,
      requirements: dto.requirements ?? null,
      location: dto.location ?? null,
      capacity: dto.capacity ?? null,
      tags: dto.tags ?? null,
      externalUrl: dto.externalUrl ?? null,
      // V3 §13.1: nunca se pide al estudiante evidencia de asistencia.
      evidenceRequired: false,
      status: estadoInicial,
      requiresReview,
      reviewStatus: requiresReview ? null : ActivityReviewStatus.NOT_REQUIRED,
      internalConstancyEnabled: false,
    });
    this.aplicarPolitica(activity, this.politicaResultado(dto, origen));
    if (!this.llevaDatosDeProveedor(activity)) {
      activity.provider = null;
      activity.expectedIssuerDomains = [];
      activity.expectedKeywords = [];
    }
    const saved = await this.activities.save(activity);

    await this.replaceAreas(saved.id, areas);
    if (dto.skillIds?.length) {
      await this.replaceSkills(saved.id, dto.skillIds);
    }
    if (dto.gamificationRules?.length) {
      await this.replaceRules(saved.id, user.userId, dto.gamificationRules);
    }

    await this.audit.record({
      actorUserId: user.userId,
      eventType: AuditEventType.ACTIVITY_CREATED,
      entityType: 'activity',
      entityId: saved.id,
      metadata: {
        type: dto.type,
        origin: origen,
        status: saved.status,
        semesterScope,
        responsibleUserId: responsable,
        viaAdmin: user.role === RolNombre.ADMIN,
      },
    });

    return this.findOne(saved.id);
  }

  /**
   * Listado de actividades.
   * El estudiante nunca ve borradores. Los responsables ven, ademas de las
   * publicadas, sus propios borradores para poder terminarlos.
   */
  async findAll(
    user: AuthenticatedUser,
    filters: QueryActivitiesDto,
  ): Promise<Array<ActivityWithCounts | ReturnType<typeof vistaEstudiante>>> {
    const where: FindOptionsWhere<Activity> = {};
    if (filters.type) where.type = filters.type;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.status) where.status = filters.status;
    if (filters.modality) where.modality = filters.modality;
    if (filters.originType) where.originType = filters.originType;
    if (filters.areaId) {
      // V3 §12.1: una oportunidad entra si **cualquiera** de sus áreas coincide.
      const ids = (await this.activityAreas.find({ where: { academicAreaId: filters.areaId } })).map((a) => a.activityId);
      where.id = In(ids.length ? ids : ['00000000-0000-4000-8000-000000000000']);
    }

    // Rango de fechas (RF8). Una actividad sin fecha declarada queda fuera
    // cuando se filtra por fecha: no hay forma de ubicarla en el rango.
    const { fromDate, toDate } = filters;
    if (fromDate && toDate) {
      where.eventDate = Between(startOfDay(fromDate), endOfDay(toDate));
    } else if (fromDate) {
      where.eventDate = MoreThanOrEqual(startOfDay(fromDate));
    } else if (toDate) {
      where.eventDate = LessThanOrEqual(endOfDay(toDate));
    }

    const activities = await this.activities.find({
      where,
      relations: { academicArea: true, creator: true, category: true, activityAreas: { academicArea: true } },
      order: { eventDate: 'DESC', createdAt: 'DESC' },
    });

    // El estudiante nunca ve borradores. El resto ve los suyos, y como
    // «los suyos» depende ahora del alcance, hay que resolverlo por fila.
    const visible = user.role === RolNombre.STUDENT
      ? activities.filter((a) => a.status !== ActivityStatus.DRAFT)
      : await this.filtrarGestionables(user, activities, { incluirPublicadas: true });

    const conConteos = await this.attachCounts(visible);
    return user.role === RolNombre.STUDENT
      ? (await this.attachMyRegistration(user.userId, conConteos)).map(vistaEstudiante)
      : conConteos;
  }

  /** Actividades cuyo responsable es el usuario (panel de gestion). */
  async findManagedBy(user: AuthenticatedUser): Promise<ActivityWithCounts[]> {
    const activities = await this.activities.find({
      relations: { academicArea: true, creator: true, category: true, activityAreas: { academicArea: true } },
      order: { createdAt: 'DESC' },
    });
    return this.attachCounts(
      await this.filtrarGestionables(user, activities, { incluirPublicadas: false }),
    );
  }

  async findOne(id: string): Promise<Activity> {
    const activity = await this.activities.findOne({
      where: { id },
      relations: {
        academicArea: true,
        creator: true,
        category: true,
        // §73.3: quien mira la actividad debe poder ver que trabaja, no
        // solo en que area cae.
        activitySkills: { skill: true },
        activityAreas: { academicArea: true },
      },
    });
    if (!activity) {
      throw new NotFoundException('Actividad no encontrada.');
    }
    // Sus reglas de puntos viajan con ella: son parte de lo que se revisa.
    (activity as Activity & { gamificationRules?: ActivityGamificationRule[] }).gamificationRules =
      await this.rules.find({ where: { activityId: activity.id } });
    return activity;
  }

  /** Detalle para el estudiante, con su propio estado de inscripcion. */
  async findOneForStudent(user: AuthenticatedUser, id: string) {
    const activity = await this.findOne(id);
    if (activity.status === ActivityStatus.DRAFT) {
      throw new NotFoundException('Actividad no encontrada.');
    }
    const profile = await this.profiles.findOne({ where: { userId: user.userId } });
    const registration = profile
      ? await this.registrations.findOne({
          where: { activityId: activity.id, studentProfileId: profile.id },
        })
      : null;

    const confirmed = await this.registrations.count({
      where: { activityId: activity.id, status: In([...OCCUPYING_STATUSES]) },
    });

    return {
      ...vistaEstudiante(activity),
      myRegistration: registration
        ? {
          id: registration.id,
          status: registration.status,
          evidenceEligible: CredentialEligibilityService.elegible(activity, registration.status),
        }
        : null,
      confirmedCount: confirmed,
      seatsLeft: activity.capacity ? Math.max(activity.capacity - confirmed, 0) : null,
      isOpenForRegistration: this.registrationBlockReason(activity) === null,
      registrationBlockReason: this.registrationBlockReason(activity),
    };
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateActivityDto): Promise<Activity> {
    const activity = await this.findOne(id);
    await this.assertCanManage(user, activity);

    // V2 §27: lo que Dirección revisa no cambia a sus espaldas.
    const esDireccion = user.role === RolNombre.CAREER_DIRECTOR;
    let reiniciarRevision = false;
    if (activity.requiresReview && !esDireccion) {
      if (activity.reviewStatus === ActivityReviewStatus.REJECTED
        && !(Object.keys(dto).length === 1 && dto.status === ActivityStatus.CANCELLED)) {
        throw new ConflictException('Fue rechazada por Dirección: no se reutiliza. Puedes cancelarla o crear una nueva.');
      }
      if (this.cambiaContenido(dto)) {
        if (activity.reviewStatus === ActivityReviewStatus.PENDING) {
          throw new ConflictException('Está en revisión: espera la decisión de Dirección para cambiar su contenido.');
        }
        if (activity.reviewStatus === ActivityReviewStatus.APPROVED) {
          if (activity.status !== ActivityStatus.DRAFT) {
            throw new ConflictException(
              'Ya fue aprobada y publicada: los cambios de contenido los decide Dirección.',
            );
          }
          // Aprobada pero sin publicar: el cambio pide una nueva revisión.
          reiniciarRevision = true;
        }
      }
    }

    if (dto.type && dto.type !== activity.type) {
      // Cambiar el tipo cambia el responsable: se valida con el tipo destino.
      this.assertCanPublish(user.role, dto.type);
      activity.type = dto.type;
    }
    const areasNuevas = this.areasPedidas(dto);
    if (areasNuevas !== undefined || dto.skillIds !== undefined) {
      const areasFinales = areasNuevas ?? (await this.activityAreas.find({ where: { activityId: activity.id } })).map((a) => a.academicAreaId);
      const skillsFinales = dto.skillIds ?? (activity.activitySkills ?? []).map((s) => s.skillId);
      await assertSkillsBelongToAreas(this.activities.manager, skillsFinales, areasFinales, 'skillIds');
      if (areasNuevas !== undefined) {
        for (const areaId of areasNuevas) await this.assertAreaExists(areaId);
        activity.academicAreaId = areasNuevas[0] ?? null;
        await this.replaceAreas(activity.id, areasNuevas);
      }
    }
    if (dto.originType !== undefined) activity.originType = dto.originType;
    if (dto.provider !== undefined) activity.provider = dto.provider?.trim() || null;
    if (dto.expectedIssuerDomains !== undefined) activity.expectedIssuerDomains = dto.expectedIssuerDomains;
    if (dto.expectedKeywords !== undefined) activity.expectedKeywords = dto.expectedKeywords;
    if (dto.externalUrl !== undefined) activity.externalUrl = dto.externalUrl;
    this.assertExterna(activity.originType, activity.provider, activity.externalUrl);
    if (dto.outcomePolicy !== undefined || dto.internalConstancyEnabled !== undefined
      || dto.credentialExpected !== undefined || dto.originType !== undefined) {
      this.aplicarPolitica(activity, this.politicaResultado(dto, activity.originType, activity.outcomePolicy));
    }
    if (!this.llevaDatosDeProveedor(activity)) {
      activity.provider = null;
      activity.expectedIssuerDomains = [];
      activity.expectedKeywords = [];
    }
    if (dto.responsibleUserId !== undefined) {
      if (user.role !== RolNombre.ADMIN) {
        throw new ForbiddenException('Solo Administración reasigna el responsable de una oportunidad.');
      }
      activity.responsibleUserId = await this.resolverResponsable(user, activity.type, dto.responsibleUserId);
    }
    if (dto.categoryId !== undefined) {
      await this.assertCategoryUsable(dto.categoryId, dto.type ?? activity.type);
      activity.categoryId = dto.categoryId;
    }
    if (dto.title !== undefined) activity.title = dto.title;
    if (dto.description !== undefined) activity.description = dto.description;
    if (dto.modality !== undefined) activity.modality = dto.modality;
    if (dto.activityDate !== undefined) {
      activity.eventDate = dto.activityDate ? new Date(dto.activityDate) : null;
    }
    if (dto.location !== undefined) activity.location = dto.location;
    if (dto.capacity !== undefined) activity.capacity = dto.capacity;
    if (dto.tags !== undefined) activity.tags = dto.tags;
    // V3 §13.1: la evidencia de asistencia ya no se pide; el flag histórico se apaga.
    if (dto.evidenceRequired !== undefined) activity.evidenceRequired = false;
    if (reiniciarRevision) {
      activity.reviewStatus = null;
      activity.reviewComment = 'La actividad cambió después de aprobada: envíala de nuevo a revisión.';
    }
    if (dto.requirements !== undefined) activity.requirements = dto.requirements ?? null;
    if (dto.registrationMode !== undefined) activity.registrationMode = dto.registrationMode;
    if (dto.endAt !== undefined) activity.endAt = dto.endAt ? new Date(dto.endAt) : null;

    this.assertDateWindow(
      dto.activityDate ?? activity.eventDate?.toISOString() ?? null,
      dto.endAt ?? activity.endAt?.toISOString() ?? null,
    );

    if (dto.semesterScope !== undefined) {
      // Se revalida contra el alcance de quien edita: un docente no puede
      // ampliar el alcance de una actividad hasta abarcar semestres ajenos.
      activity.semesterScope = await this.resolveSemesterScope(user, dto.semesterScope);
    }

    const estadoAnterior = activity.status;
    if (dto.status !== undefined) {
      await this.assertStatusTransition(activity, dto.status);
      activity.status = dto.status;
    }

    await this.activities.save(activity);

    if (dto.skillIds !== undefined) {
      await this.replaceSkills(activity.id, dto.skillIds ?? []);
    }
    if (dto.gamificationRules !== undefined) {
      await this.replaceRules(activity.id, user.userId, dto.gamificationRules ?? []);
    }

    if (dto.status !== undefined && dto.status !== estadoAnterior) {
      await this.audit.record({
        actorUserId: user.userId,
        eventType: AuditEventType.ACTIVITY_STATUS_CHANGED,
        entityType: 'activity',
        entityId: activity.id,
        metadata: { de: estadoAnterior, a: dto.status },
      });
      // §15: al darla por finalizada, quienes fueron aceptados (o
      // confirmados, si es interna con credencial de un tercero) ya pueden
      // adjuntar su credencial.
      if (dto.status === ActivityStatus.FINISHED && CredentialEligibilityService.esperaCredencial(activity)) {
        const habilitadas = await this.registrations.find({
          where: { activityId: activity.id, status: CredentialEligibilityService.estadoQueHabilita(activity) },
          relations: { studentProfile: true },
        });
        await this.eligibility.announce(activity, habilitadas, user.userId);
      }
    }

    return this.findOne(id);
  }

  registerInterest(userId: string, activityId: string): Promise<ActivityRegistration> {
    return this.upsertRegistration(userId, activityId, RegistrationStatus.INTERESTED);
  }

  register(userId: string, activityId: string): Promise<ActivityRegistration> {
    return this.upsertRegistration(userId, activityId, RegistrationStatus.REGISTERED);
  }

  /**
   * El estudiante se da de baja de una actividad (§23, CANCELLED).
   *
   * Solo antes de que se le confirme la participación: una vez confirmada
   * ya es experiencia registrada, y esa no se borra por decisión propia.
   * Quien se equivocó al confirmar es el responsable, y es él quien lo
   * corrige marcando ausencia.
   */
  async cancelRegistration(userId: string, activityId: string): Promise<ActivityRegistration> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new BadRequestException('Debe crear su perfil estudiantil antes de inscribirse.');
    }
    const registration = await this.registrations.findOne({
      where: { activityId, studentProfileId: profile.id },
    });
    if (!registration) {
      throw new NotFoundException('No está inscrito ni manifestó interés en esta actividad.');
    }
    if (registration.status === RegistrationStatus.ACCEPTED) {
      throw new BadRequestException(
        'El responsable ya registró que el proveedor te aceptó. Si hubo un error, avísale.',
      );
    }
    if (registration.status === RegistrationStatus.CONFIRMED) {
      throw new BadRequestException(
        'Su participación ya fue confirmada: no puede darse de baja. '
        + 'Si hubo un error, avise al responsable de la actividad.',
      );
    }
    if (registration.status === RegistrationStatus.ABSENT) {
      throw new BadRequestException('El responsable ya registró su ausencia.');
    }

    registration.status = RegistrationStatus.CANCELLED;
    return this.registrations.save(registration);
  }

  /**
   * Registro de asistencia / participacion (RF10).
   * Solo el responsable de la actividad puede hacerlo, y nunca sobre si mismo.
   */
  async confirmParticipation(
    confirmer: AuthenticatedUser,
    activityId: string,
    studentProfileId: string,
    status: RegistrationStatus,
  ): Promise<ActivityRegistration> {
    const activity = await this.findOne(activityId);
    // V2 §6.5: la administración es técnica; confirmar participación no es
    // una operación suya. La confirma quien responde por la actividad.
    if (confirmer.role === RolNombre.ADMIN) {
      throw new ForbiddenException('La participación la confirma el responsable de la actividad, no la administración.');
    }
    await this.assertCanManage(
      confirmer,
      activity,
      'Su rol no puede registrar participación en esta actividad.',
    );

    const profile = await this.profiles.findOne({ where: { id: studentProfileId } });
    if (!profile) {
      throw new BadRequestException('El perfil del estudiante no existe.');
    }
    if (profile.userId === confirmer.userId) {
      throw new ForbiddenException('No puede confirmar su propia participación.');
    }

    const registration = await this.registrations.findOne({
      where: { activityId: activity.id, studentProfileId },
    });
    if (!registration) {
      throw new NotFoundException(
        'El estudiante no manifestó interés ni se inscribió en esta actividad.',
      );
    }

    // V3 §15: en una externa no se confirma asistencia —no ocurre en la
    // carrera—; se registra que el proveedor lo aceptó. Y al revés, una
    // interna no tiene «aceptación del proveedor».
    const externa = activity.originType === ActivityOrigin.EXTERNAL;
    if (externa && status === RegistrationStatus.CONFIRMED) {
      const m = 'En una oportunidad externa se registra la aceptación del proveedor; '
        + 'la credencial la adjunta el estudiante cuando termine.';
      throw new BadRequestException({ code: 'EXTERNAL_USES_ACCEPTANCE', message: m, fields: { status: [m] } });
    }
    if (!externa && status === RegistrationStatus.ACCEPTED) {
      const m = 'La aceptación del proveedor solo existe en oportunidades externas.';
      throw new BadRequestException({ code: 'ACCEPTANCE_ONLY_EXTERNAL', message: m, fields: { status: [m] } });
    }

    // El cupo se controla al aprobar: solo los confirmados (o aceptados) ocupan lugar.
    if (OCCUPYING_STATUSES.includes(status) && !OCCUPYING_STATUSES.includes(registration.status)) {
      await this.assertConfirmCapacity(activity);
    }

    const anterior = registration.status;
    registration.status = status;
    registration.confirmedById = confirmer.userId;
    registration.acceptedAt = status === RegistrationStatus.ACCEPTED
      ? (anterior === RegistrationStatus.ACCEPTED ? registration.acceptedAt : new Date())
      : null;
    const saved = await this.registrations.save(registration);

    // §23: confirmar dispara trayectoria, afinidad, recomendaciones,
    // gamificación y auditoría. Las tres primeras cuelgan del recálculo;
    // la auditoría se registra aquí porque es la decisión de una persona
    // sobre otra y debe quedar constancia de quién la tomó.
    await this.sincronizarConstancia(activity, saved, confirmer.userId);
    if (status === RegistrationStatus.CONFIRMED || anterior === RegistrationStatus.CONFIRMED) {
      await this.trajectory.requestRecalculation(studentProfileId);
    }

    await this.audit.record({
      actorUserId: confirmer.userId,
      eventType: status === RegistrationStatus.ACCEPTED
        ? AuditEventType.EXTERNAL_OPPORTUNITY_ACCEPTED
        : AuditEventType.PARTICIPATION_CONFIRMED,
      entityType: 'activity_registration',
      entityId: saved.id,
      metadata: {
        activityId: activity.id,
        studentProfileId,
        de: anterior,
        a: status,
      },
    });

    // Si la oportunidad ya terminó, desde ahora puede adjuntar su credencial.
    if (status !== anterior) {
      await this.eligibility.announce(activity, [saved], confirmer.userId);
      // V3 §33: PARTICIPATION_CONFIRMED / ACTIVITY_REGISTRATION_ACCEPTED.
      if (status === RegistrationStatus.CONFIRMED || status === RegistrationStatus.ACCEPTED) {
        try {
          await this.notifications.emit({
            userId: profile.userId,
            kind: status === RegistrationStatus.CONFIRMED ? 'PARTICIPATION_CONFIRMED' : 'ACTIVITY_REGISTRATION_ACCEPTED',
            title: status === RegistrationStatus.CONFIRMED ? 'Participación confirmada' : 'Te aceptaron',
            body: status === RegistrationStatus.CONFIRMED
              ? `El responsable confirmó tu participación en «${activity.title}». Ya cuenta en tu trayectoria.`
              : `El proveedor te aceptó en «${activity.title}». Al terminar podrás adjuntar tu credencial.`,
            link: '/student/activities',
            entityType: 'activity_registration',
            entityId: saved.id,
            dedupeKey: `registration-${status}:${saved.id}`,
          });
        } catch {
          // sin efecto sobre la operación
        }
      }
    }

    return saved;
  }

  async getParticipants(user: AuthenticatedUser, activityId: string) {
    const activity = await this.findOne(activityId);
    await this.assertCanManage(
      user,
      activity,
      'Solo el responsable de la actividad puede ver sus participantes.',
    );
    const rows = await this.registrations.find({
      where: { activityId },
      relations: { studentProfile: { user: true } },
      order: { createdAt: 'ASC' },
    });
    return rows.map((r) => ({
      id: r.id,
      studentProfileId: r.studentProfileId,
      status: r.status,
      acceptedAt: r.acceptedAt,
      evidenceEligible: CredentialEligibilityService.elegible(activity, r.status),
      studentName: r.studentProfile?.user
        ? `${r.studentProfile.user.firstName} ${r.studentProfile.user.lastName}`
        : null,
      semester: r.studentProfile?.semester ?? null,
      createdAt: r.createdAt,
    }));
  }

  /** Actividades del estudiante con su estado de participacion. */
  async findMyRegistrations(userId: string) {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new BadRequestException('Debe crear su perfil estudiantil antes de ver sus actividades.');
    }
    const rows = await this.registrations.find({
      where: { studentProfileId: profile.id },
      relations: { activity: { academicArea: true } },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => ({
      registrationId: r.id,
      status: r.status,
      activity: r.activity,
    }));
  }

  // ------------------------------------------------------------------
  // V3 §17 · Referencia de validación de una oportunidad externa
  // ------------------------------------------------------------------

  async getValidationReference(user: AuthenticatedUser, activityId: string) {
    const activity = await this.findOne(activityId);
    await this.assertCanManage(user, activity, 'Solo el responsable de la oportunidad puede ver su referencia de validación.');
    this.assertEsperaCredencial(activity);
    return this.vistaReferencia(activity, await this.references.findOne({
      where: { activityId },
      relations: { sampleStoredFile: true },
    }));
  }

  async saveValidationReference(user: AuthenticatedUser, activityId: string, dto: SaveValidationReferenceDto) {
    const activity = await this.findOne(activityId);
    await this.assertCanManage(user, activity, 'Solo el responsable de la oportunidad puede registrar su referencia de validación.');
    this.assertEsperaCredencial(activity);

    if (dto.credentialIdPattern && !CREDENTIAL_PATTERN_CHARS.test(dto.credentialIdPattern)) {
      const m = 'El patrón solo admite letras, números, punto, guion, barra, espacio y los comodines # @ *.';
      throw new BadRequestException({ message: m, fields: { credentialIdPattern: [m] } });
    }

    let ref = await this.references.findOne({ where: { activityId } });
    if (!ref) ref = this.references.create({ activityId });

    if (dto.sampleStoredFileId !== undefined) {
      // §27: solo un archivo propio. Si no cambia, no se vuelve a exigir:
      // otro responsable puede editar el resto sin ser dueño del ejemplo.
      if (dto.sampleStoredFileId && dto.sampleStoredFileId !== ref.sampleStoredFileId) {
        await this.uploads.requireOwned(user.userId, dto.sampleStoredFileId);
      }
      ref.sampleStoredFileId = dto.sampleStoredFileId ?? null;
    }
    if (dto.expectedCourseName !== undefined) ref.expectedCourseName = dto.expectedCourseName || null;
    if (dto.credentialIdPattern !== undefined) ref.credentialIdPattern = dto.credentialIdPattern || null;
    if (dto.notes !== undefined) ref.notes = dto.notes || null;
    ref.updatedById = user.userId;
    const saved = await this.references.save(ref);

    await this.audit.record({
      actorUserId: user.userId,
      eventType: AuditEventType.VALIDATION_REFERENCE_UPDATED,
      entityType: 'activity',
      entityId: activity.id,
      metadata: {
        expectedCourseName: saved.expectedCourseName,
        credentialIdPattern: saved.credentialIdPattern,
        conEjemplo: !!saved.sampleStoredFileId,
      },
    });

    return this.vistaReferencia(activity, await this.references.findOne({
      where: { id: saved.id },
      relations: { sampleStoredFile: true },
    }));
  }

  private assertEsperaCredencial(activity: Activity): void {
    if (!CredentialEligibilityService.esperaCredencial(activity)) {
      throw new BadRequestException({
        code: 'NO_CREDENTIAL_EXPECTED',
        message: 'Solo una oportunidad externa, o una interna que conduce a una credencial de un tercero, lleva referencia de validación.',
      });
    }
  }

  private vistaReferencia(activity: Activity, ref: ExternalOpportunityValidationReference | null) {
    const archivo = ref?.sampleStoredFile ?? null;
    return {
      activityId: activity.id,
      expectedCourseName: ref?.expectedCourseName ?? null,
      credentialIdPattern: ref?.credentialIdPattern ?? null,
      sampleStoredFileId: ref?.sampleStoredFileId ?? null,
      sampleFileName: archivo?.originalFilename ?? null,
      sampleFileUrl: archivo ? `${FILES_ROUTE}/${archivo.storageKey}` : null,
      notes: ref?.notes ?? null,
      // Lo que ya declara la oportunidad (§12): se muestra junto, no se duplica.
      provider: activity.provider,
      expectedIssuerDomains: activity.expectedIssuerDomains ?? [],
      expectedKeywords: activity.expectedKeywords ?? [],
      updatedAt: ref?.updatedAt ?? null,
    };
  }

  // ------------------------------------------------------------------
  // Reglas internas
  // ------------------------------------------------------------------

  private async upsertRegistration(
    userId: string,
    activityId: string,
    target: RegistrationStatus,
  ): Promise<ActivityRegistration> {
    const activity = await this.findOne(activityId);

    const blocked = this.registrationBlockReason(activity);
    if (blocked) {
      throw new BadRequestException(blocked);
    }

    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new BadRequestException('Debe crear su perfil estudiantil antes de registrarse.');
    }

    let registration = await this.registrations.findOne({
      where: { activityId: activity.id, studentProfileId: profile.id },
    });

    if (!registration) {
      registration = this.registrations.create({
        activityId: activity.id,
        studentProfileId: profile.id,
        status: target,
      });
    } else if (
      registration.status === RegistrationStatus.CONFIRMED ||
      registration.status === RegistrationStatus.ACCEPTED ||
      registration.status === RegistrationStatus.ABSENT
    ) {
      throw new BadRequestException(
        'Su participación ya fue registrada por el responsable de la actividad.',
      );
    } else if (registration.status === target) {
      throw new BadRequestException(
        target === RegistrationStatus.REGISTERED
          ? 'Ya está inscrito en esta actividad.'
          : 'Ya marcó interés en esta actividad.',
      );
    } else {
      registration.status = target;
    }
    const guardada = await this.registrations.save(registration);
    if (target === RegistrationStatus.REGISTERED) {
      await this.audit.record({
        actorUserId: userId,
        eventType: AuditEventType.ACTIVITY_REGISTERED,
        entityType: 'activity_registration',
        entityId: guardada.id,
        metadata: { activityId: activity.id, studentProfileId: profile.id },
      });
    }
    return guardada;
  }

  /**
   * Motivo por el que una actividad no admite inscripciones, o null si si.
   * Se expone tambien en el detalle para que la interfaz pueda deshabilitar el
   * boton y explicar el porque en lugar de dejar fallar la peticion.
   */
  private registrationBlockReason(activity: Activity): string | null {
    if (activity.status === ActivityStatus.DRAFT) {
      return 'La actividad todavía es un borrador.';
    }
    if (activity.status === ActivityStatus.CANCELLED) {
      return 'La actividad fue cancelada.';
    }
    if (activity.status === ActivityStatus.CLOSED) {
      return 'Las inscripciones para esta actividad están cerradas.';
    }
    if (activity.status === ActivityStatus.FINISHED) {
      return 'La actividad ya finalizó.';
    }
    if (!REGISTRABLE_STATUSES.includes(activity.status)) {
      return 'La actividad no está abierta para registro.';
    }
    if (activity.eventDate && activity.eventDate.getTime() < Date.now()) {
      return 'La fecha de la actividad ya pasó.';
    }
    return null;
  }

  private async assertConfirmCapacity(activity: Activity): Promise<void> {
    if (!activity.capacity) return;
    const confirmed = await this.registrations.count({
      where: { activityId: activity.id, status: In([...OCCUPYING_STATUSES]) },
    });
    if (confirmed >= activity.capacity) {
      throw new BadRequestException(
        `La actividad alcanzó su cupo máximo de ${activity.capacity} participantes confirmados.`,
      );
    }
  }

  /**
   * Máquina de estados de la actividad (§22).
   *
   * La tabla de transiciones vive en `shared` para que web y móvil puedan
   * ofrecer solo los cambios posibles en vez de mostrar seis botones y
   * dejar que el servidor rechace cinco.
   *
   * Aquí se añade la condición que la tabla no puede expresar: volver a
   * borrador exige que nadie tenga aún participación confirmada, porque esa
   * participación ya alimentó perfiles de estudiantes.
   */
  private async assertStatusTransition(activity: Activity, next: ActivityStatus): Promise<void> {
    if (activity.status === next) return;

    // V2 §27.6: solo se publica o abre lo que no necesita revisión o ya la pasó.
    if ((next === ActivityStatus.PUBLISHED || next === ActivityStatus.OPEN)
      && !PUBLISHABLE_REVIEW_STATUSES.includes(activity.reviewStatus as ActivityReviewStatus)) {
      throw new ConflictException({
        message: activity.reviewStatus === ActivityReviewStatus.PENDING
          ? 'Está en revisión: se podrá publicar cuando Dirección la apruebe.'
          : 'Necesita la aprobación de Dirección antes de publicarse: envíala a revisión.',
        fields: { status: ['Necesita la aprobación de Dirección antes de publicarse.'] },
      });
    }

    if (TERMINAL_ACTIVITY_STATUSES.includes(activity.status)) {
      throw new BadRequestException(
        `Una actividad ${ACTIVITY_STATUS_LABEL[activity.status].toLowerCase()} ya no cambia de estado.`,
      );
    }
    if (!canTransition(activity.status, next)) {
      throw new BadRequestException(
        `No se puede pasar de «${ACTIVITY_STATUS_LABEL[activity.status]}» a `
        + `«${ACTIVITY_STATUS_LABEL[next]}».`,
      );
    }

    if (next === ActivityStatus.DRAFT) {
      const confirmed = await this.registrations.count({
        where: { activityId: activity.id, status: In([...OCCUPYING_STATUSES]) },
      });
      if (confirmed > 0) {
        throw new BadRequestException(
          'La actividad ya tiene participación confirmada: no puede volver a borrador.',
        );
      }
    }
  }

  /**
   * Quién puede crear cada tipo de actividad (§22).
   *
   * El docente vuelve a poder crear actividades académicas, que es lo que
   * pide §22. No es una vuelta atrás respecto del Objetivo 3: entonces se
   * le quitó porque no había forma de acotar su alcance, y ahora la hay.
   * Lo que crea queda limitado a sus semestres habilitados.
   */
  private assertCanPublish(role: RolNombre, type: ActivityType): void {
    if (role === RolNombre.ADMIN) return;
    if (OWNER_ROLE_BY_TYPE[type] === role) return;
    if (role === RolNombre.TEACHER && type === ActivityType.ACADEMICA) return;

    const quien =
      type === ActivityType.ACADEMICA
        ? 'la dirección de carrera o un docente dentro de su alcance'
        : 'el representante de la sociedad científica';
    throw new ForbiddenException(
      `Las actividades ${type === ActivityType.ACADEMICA ? 'académicas' : 'extracurriculares'} las gestiona ${quien}.`,
    );
  }

  /**
   * Quien puede gestionar una actividad (§22).
   *
   * Cuatro caminos, y el cuarto es el que introduce este batch:
   *
   *   1. el administrador;
   *   2. quien la creo;
   *   3. quien responde por ella —que puede no ser su creador, porque la
   *      persona que la publico puede dejar el cargo—;
   *   4. el rol responsable de ese tipo a nivel de carrera.
   *
   * El docente NO entra por ninguno de los cuatro: entra por alcance, y
   * eso exige consultar sus semestres. Por eso `canManage` es asincrono
   * ahora; comprobar un alcance no se puede hacer sin ir a la base.
   */
  private async canManage(user: AuthenticatedUser, activity: Activity): Promise<boolean> {
    if (user.role === RolNombre.ADMIN) return true;
    if (activity.creatorId === user.userId) return true;
    if (activity.responsibleUserId === user.userId) return true;

    if (user.role === RolNombre.TEACHER) {
      return this.teacherReaches(user, activity);
    }
    return OWNER_ROLE_BY_TYPE[activity.type] === user.role;
  }

  /**
   * ¿Alcanza este docente a esta actividad? (§22)
   *
   * Solo las academicas, y solo si el alcance de la actividad se cruza con
   * sus semestres habilitados.
   *
   * Una actividad **sin** alcance declarado es de toda la carrera, y esas
   * no las gestiona un docente: son del director. Tratar «sin alcance» como
   * «alcanza a todos» convertiria el olvido de un campo en una via para
   * gestionar actividades de cualquier semestre.
   */
  private async teacherReaches(user: AuthenticatedUser, activity: Activity): Promise<boolean> {
    if (activity.type !== ActivityType.ACADEMICA) return false;
    const alcanceActividad = activity.semesterScope ?? [];
    if (alcanceActividad.length === 0) return false;

    const suyos = await this.teacherScope.allowedSemesters(user.userId);
    if (suyos.length === 0) return false;
    return alcanceActividad.some((s) => suyos.includes(s));
  }

  /**
   * Añade al listado la inscripción propia del estudiante.
   *
   * Se resuelve con una sola consulta para todas las actividades, no una
   * por fila: el listado las trae todas y consultar por cada una
   * multiplicaría las idas a la base sin motivo.
   */
  private async attachMyRegistration(
    userId: string,
    activities: ActivityWithCounts[],
  ): Promise<ActivityWithCounts[]> {
    if (activities.length === 0) return activities;
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) return activities;

    const propias = await this.registrations.find({
      where: {
        studentProfileId: profile.id,
        activityId: In(activities.map((a) => a.id)),
      },
    });
    const porActividad = new Map(propias.map((r) => [r.activityId, r]));

    return activities.map((a) => {
      const propia = porActividad.get(a.id);
      return {
        ...a,
        myRegistration: propia
          ? {
            id: propia.id,
            status: propia.status,
            evidenceEligible: CredentialEligibilityService.elegible(a, propia.status),
          }
          : null,
      };
    });
  }

  /**
   * Filtra las actividades que este usuario puede gestionar.
   *
   * Se resuelve el alcance del docente **una vez** y se reutiliza: hacerlo
   * por fila significaria una consulta por actividad, y el listado las trae
   * todas.
   */
  private async filtrarGestionables(
    user: AuthenticatedUser,
    activities: Activity[],
    { incluirPublicadas }: { incluirPublicadas: boolean },
  ): Promise<Activity[]> {
    const suyos = user.role === RolNombre.TEACHER
      ? await this.teacherScope.allowedSemesters(user.userId)
      : [];

    const gestiona = (a: Activity): boolean => {
      if (user.role === RolNombre.ADMIN) return true;
      if (a.creatorId === user.userId) return true;
      if (a.responsibleUserId === user.userId) return true;
      if (user.role === RolNombre.TEACHER) {
        if (a.type !== ActivityType.ACADEMICA) return false;
        const alcance = a.semesterScope ?? [];
        return alcance.length > 0 && alcance.some((s) => suyos.includes(s));
      }
      return OWNER_ROLE_BY_TYPE[a.type] === user.role;
    };

    return activities.filter((a) =>
      (a.status === ActivityStatus.DRAFT
        ? gestiona(a)
        : incluirPublicadas || gestiona(a)));
  }

  private async assertCanManage(
    user: AuthenticatedUser,
    activity: Activity,
    message?: string,
  ): Promise<void> {
    if (!(await this.canManage(user, activity))) {
      throw new ForbiddenException(
        message ??
          'Solo el responsable de esta actividad o un administrador puede gestionarla.',
      );
    }
  }

  /**
   * Alcance por semestre que puede declarar quien crea o edita (§22).
   *
   * Un docente no puede declarar semestres fuera de los suyos, ni dejarlo
   * vacio —que significaria «toda la carrera»—. Director, sociedad y
   * administrador declaran lo que corresponda.
   */
  private async resolveSemesterScope(
    user: AuthenticatedUser,
    pedido: number[] | undefined,
  ): Promise<number[] | null> {
    const limpio = pedido?.length ? [...new Set(pedido)].sort((a, b) => a - b) : null;

    if (user.role !== RolNombre.TEACHER) return limpio;

    const suyos = await this.teacherScope.allowedSemesters(user.userId);
    if (suyos.length === 0) {
      throw new ForbiddenException(
        'No tiene semestres habilitados: no puede gestionar actividades. '
        + 'Solicite el alcance a la administración.',
      );
    }
    if (!limpio) {
      // Sin declararlo, se asume el alcance completo del docente. Es lo que
      // quiso decir, y evita que el olvido produzca una actividad de
      // carrera creada por alguien que no tiene ese alcance.
      return suyos;
    }
    const fuera = limpio.filter((s) => !suyos.includes(s));
    if (fuera.length > 0) {
      throw new ForbiddenException(
        `No puede dirigir una actividad a semestres fuera de su alcance: ${fuera.join(', ')}. `
        + `Sus semestres habilitados son: ${suyos.join(', ')}.`,
      );
    }
    return limpio;
  }

  /** El fin no puede ser anterior al inicio (§22). */
  private assertDateWindow(inicio?: string | null, fin?: string | null): void {
    if (!inicio || !fin) return;
    if (new Date(fin).getTime() < new Date(inicio).getTime()) {
      throw new BadRequestException('La fecha de fin no puede ser anterior a la de inicio.');
    }
  }

  /** Reemplaza las habilidades declaradas de una actividad (§73.3). */
  private async replaceSkills(activityId: string, skillIds: string[]): Promise<void> {
    const unicas = [...new Set(skillIds)];
    if (unicas.length > 0) {
      const existen = await this.skills.count({ where: { id: In(unicas) } });
      if (existen !== unicas.length) {
        throw new BadRequestException('Alguna de las habilidades indicadas no existe.');
      }
    }
    await this.activitySkills.delete({ activityId });
    if (unicas.length > 0) {
      await this.activitySkills.save(
        unicas.map((skillId) => this.activitySkills.create({ activityId, skillId })),
      );
    }
  }

  /**
   * Conteo de solicitudes y confirmados para un conjunto de actividades.
   * Se resuelve con una sola consulta agrupada, no una por fila.
   */
  private async attachCounts(activities: Activity[]): Promise<ActivityWithCounts[]> {
    if (activities.length === 0) return [];
    const rows = await this.registrations
      .createQueryBuilder('r')
      .select('r.activity_id', 'activityId')
      .addSelect('r.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .where('r.activity_id IN (:...ids)', { ids: activities.map((a) => a.id) })
      .groupBy('r.activity_id')
      .addGroupBy('r.status')
      .getRawMany<{ activityId: string; status: RegistrationStatus; total: string }>();

    const byActivity = new Map<string, { registered: number; confirmed: number }>();
    for (const row of rows) {
      const entry = byActivity.get(row.activityId) ?? { registered: 0, confirmed: 0 };
      const total = Number(row.total);
      if (OCCUPYING_STATUSES.includes(row.status)) entry.confirmed += total;
      if (row.status !== RegistrationStatus.ABSENT) entry.registered += total;
      byActivity.set(row.activityId, entry);
    }

    return activities.map((a) => {
      const counts = byActivity.get(a.id) ?? { registered: 0, confirmed: 0 };
      return {
        ...a,
        registrationCount: counts.registered,
        confirmedCount: counts.confirmed,
        seatsLeft: a.capacity ? Math.max(a.capacity - counts.confirmed, 0) : null,
        registrationBlockReason: this.registrationBlockReason(a),
      };
    });
  }

  /**
   * La categoria debe existir, estar vigente y admitir el tipo de actividad.
   * Una categoria con applies_to nulo sirve para ambos tipos.
   */
  private async assertCategoryUsable(categoryId: string, type: ActivityType): Promise<void> {
    const category = await this.categories.findOne({ where: { id: categoryId } });
    if (!category) {
      throw new BadRequestException('La categoría indicada no existe.');
    }
    if (!category.isActive) {
      throw new BadRequestException(`La categoría "${category.name}" está dada de baja.`);
    }
    if (category.appliesTo && category.appliesTo !== type) {
      const destino =
        category.appliesTo === ActivityType.ACADEMICA ? 'académicas' : 'extracurriculares';
      throw new BadRequestException(
        `La categoría "${category.name}" solo aplica a actividades ${destino}.`,
      );
    }
  }

  private async assertAreaExists(areaId: string): Promise<void> {
    const exists = await this.areas.exists({ where: { id: areaId } });
    if (!exists) {
      throw new BadRequestException('El área académica no existe.');
    }
  }
}
