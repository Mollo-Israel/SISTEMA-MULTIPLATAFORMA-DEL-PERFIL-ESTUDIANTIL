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
  DeepPartial,
  EntityManager,
  FindOptionsWhere,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import {
  ACTIVITY_STATUS_LABEL,
  ActivityModality,
  ActivityOrigin,
  ActivityOutcomePolicy,
  ConstancyStatus,
  ActivityReviewStatus,
  ActivityStatus,
  ActivityType,
  canTransition,
  GamificationTrigger,
  ACTIVITY_START_TOLERANCE_MINUTES_DEFAULT,
  ATTENDANCE_STATUSES,
  ATTENDANCE_WINDOW_DAYS_DEFAULT,
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
import { admisionAutomatica, admitidoParaAsistencia, bloqueoAsistencia, inicioYaPaso, yaEmpezo } from './registration.rules';
import { SaveValidationReferenceDto } from './dto/validation-reference.dto';
import { User } from '../entities/user.entity';
import { ActivityResponsible } from '../entities/activity-responsible.entity';
import { ActivityContact } from '../entities/activity-contact.entity';
import { StoredFileRecord } from '../entities/stored-file.entity';
import { ActivityImage } from '../entities/activity-image.entity';
import { GamificationEvent, StudentPoints } from '../entities/gamification.entity';
import { effectiveSemesters } from '../access/teacher-scope.service';
import { assertSkillsBelongToAreas, resolveSkillContexts, SkillContext } from '../catalogs/area-skill.guard';
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
  myRegistration?: { id: string; status: RegistrationStatus; evidenceEligible?: boolean; decisionReason?: string | null } | null;
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
    // V3.2 §29: una externa no tiene selector: su resultado es siempre la
    // credencial del proveedor que el estudiante acreditará.
    if (origen === ActivityOrigin.EXTERNAL) return ActivityOutcomePolicy.EXTERNAL_CREDENTIAL_EXPECTED;
    // V5 §1.2, §7: Afinia ya no emite constancias. Una actividad que ya la
    // tenía conserva el dato histórico; elegirla de nuevo no se permite.
    if (politica === ActivityOutcomePolicy.INTERNAL_CONSTANCY && actual !== ActivityOutcomePolicy.INTERNAL_CONSTANCY) {
      const msg = 'Afinia ya no emite constancias: elige «Solo participación» (la asistencia queda en la trayectoria) '
        + 'o «Certificado emitido por la institución» si la institución entrega un documento propio.';
      throw new BadRequestException({ code: 'CONSTANCY_ISSUANCE_DISABLED', message: msg, fields: { outcomePolicy: [msg] } });
    }
    if (politica === ActivityOutcomePolicy.OTHER_AUTHORIZED_RESOURCE && dto.outcomePolicy !== undefined) {
      const msg = 'Esa opción ya no se ofrece: elige una de las cinco de V3.2 §28.';
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
   * Constancia de una participación (V3 §14.1, ajustado por V5 §1.2 y §7).
   *
   * Afinia ya no emite constancias: la asistencia confirmada es el registro.
   * Lo que se conserva es la historia de las que ya existían: si se corrige
   * la asistencia, la constancia queda revocada (no se borra); si se vuelve a
   * confirmar, esa misma constancia vuelve a estar vigente. Nunca se crea una
   * nueva.
   */
  private async sincronizarConstancia(
    activity: Activity,
    registration: ActivityRegistration,
    confirmerId: string,
  ): Promise<void> {
    const existente = await this.constancies.findOne({
      where: { studentProfileId: registration.studentProfileId, activityId: activity.id },
    });
    if (!existente) return;
    if (registration.status !== RegistrationStatus.CONFIRMED) {
      if (existente.status === ConstancyStatus.AUTHORIZED) {
        existente.status = ConstancyStatus.REJECTED;
        await this.constancies.save(existente);
      }
      return;
    }
    // Como antes: solo vuelve a estar vigente la constancia de una actividad
    // que la emitía; un certificado institucional revocado lo decide su emisor.
    const vigente = activity.outcomePolicy === ActivityOutcomePolicy.INTERNAL_CONSTANCY
      && activity.status !== ActivityStatus.DRAFT
      && activity.status !== ActivityStatus.CANCELLED
      && PUBLISHABLE_REVIEW_STATUSES.includes(activity.reviewStatus as ActivityReviewStatus);
    if (vigente && existente.status !== ConstancyStatus.AUTHORIZED) {
      existente.status = ConstancyStatus.AUTHORIZED;
      existente.issuedById = confirmerId;
      await this.constancies.save(existente);
    }
  }

  /** Áreas pedidas: `areaIds` (V3) o el `areaId` de siempre. */
  private areasPedidas(dto: { areaIds?: string[]; areaId?: string | null }): string[] | undefined {
    if (dto.areaIds !== undefined) return [...new Set(dto.areaIds)];
    if (dto.areaId !== undefined) return dto.areaId ? [dto.areaId] : [];
    return undefined;
  }

  // =========================================================================
  //  V3.2 §16–§18 · Responsables, contactos, modalidad e imagen
  // =========================================================================

  /** Roles que pueden ser responsables según quién asigna y el tipo (§17). */
  private rolesResponsables(asigna: RolNombre, type: ActivityType): RolNombre[] {
    if (asigna === RolNombre.CAREER_DIRECTOR) {
      return [RolNombre.TEACHER, RolNombre.SCIENTIFIC_SOCIETY, RolNombre.CAREER_DIRECTOR];
    }
    if (asigna === RolNombre.SCIENTIFIC_SOCIETY) return [RolNombre.SCIENTIFIC_SOCIETY];
    if (asigna === RolNombre.ADMIN) {
      return type === ActivityType.ACADEMICA
        ? [RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR]
        : [RolNombre.SCIENTIFIC_SOCIETY, RolNombre.CAREER_DIRECTOR];
    }
    return [];
  }

  /**
   * Responsables de una actividad (V3.2 §17). El primero es el principal y
   * queda también en `responsible_user_id`.
   *
   * - Docente: él mismo; suma contactos, no responsables.
   * - Sociedad: él mismo o integrantes activos de Sociedad.
   * - Dirección: docentes, Sociedad o Dirección (él mismo por omisión).
   * - Administración: tiene que indicarlo, según el tipo.
   */
  private async resolverResponsables(
    user: AuthenticatedUser,
    type: ActivityType,
    dto: { responsibleUserIds?: string[]; responsibleUserId?: string },
    borrador = false,
  ): Promise<string[]> {
    const pedidos = dto.responsibleUserIds ?? (dto.responsibleUserId ? [dto.responsibleUserId] : undefined);
    const campo = dto.responsibleUserIds !== undefined ? 'responsibleUserIds' : 'responsibleUserId';
    // V4.1 A41-007 (§4.2, A.4): un borrador de Administración puede guardarse
    // todavía sin responsable; se exige al publicar.
    if (user.role === RolNombre.ADMIN && !pedidos?.length && borrador) return [];
    if (user.role === RolNombre.ADMIN && !pedidos?.length) {
      const msg = 'Como Administración, indica quién es el responsable académico de esta oportunidad.';
      throw new BadRequestException({ message: msg, fields: { [campo]: [msg] } });
    }
    if (!pedidos?.length) return [user.userId];
    const unicos = [...new Set(pedidos)];
    if (user.role === RolNombre.TEACHER) {
      if (unicos.length === 1 && unicos[0] === user.userId) return unicos;
      const msg = 'El docente es el responsable de lo que crea. Para sumar a alguien, agrégalo como contacto.';
      throw new BadRequestException({ message: msg, fields: { [campo]: [msg] } });
    }
    const permitidos = this.rolesResponsables(user.role as RolNombre, type);
    const usuarios = await this.activities.manager.getRepository(User).find({
      where: { id: In(unicos) },
      relations: { role: true },
    });
    const malo = unicos.find((id) => {
      if (id === user.userId && user.role !== RolNombre.ADMIN) return false;
      const u = usuarios.find((x) => x.id === id);
      return !u || u.status !== 'active' || !permitidos.includes(u.role?.name as RolNombre);
    });
    if (malo) {
      const msg = user.role === RolNombre.SCIENTIFIC_SOCIETY
        ? 'Los responsables tienen que ser integrantes activos de la Sociedad científica.'
        : type === ActivityType.ACADEMICA || user.role === RolNombre.CAREER_DIRECTOR
          ? 'El responsable debe ser un docente, la Sociedad o la Dirección, con la cuenta activa.'
          : 'El responsable de una oportunidad extracurricular debe ser la Sociedad científica o la Dirección, con la cuenta activa.';
      const exacto = user.role === RolNombre.ADMIN && type === ActivityType.ACADEMICA
        ? 'El responsable de una oportunidad académica debe ser un docente o la Dirección, con la cuenta activa.'
        : msg;
      throw new BadRequestException({ message: exacto, fields: { [campo]: [exacto] } });
    }
    return unicos;
  }

  /**
   * Contactos visibles para el estudiante (V3.2 §16). Personal activo de la
   * carrera; un estudiante solo si lo asigna un docente y está en su alcance.
   * Ese estudiante es solo un contacto: no gestiona nada.
   */
  private async resolverContactos(user: AuthenticatedUser, ids: string[] | undefined): Promise<string[] | undefined> {
    if (ids === undefined) return undefined;
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return [];
    const usuarios = await this.activities.manager.getRepository(User).find({
      where: { id: In(unicos) },
      relations: { role: true },
    });
    const staff = [RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.SCIENTIFIC_SOCIETY];
    const alcance = user.role === RolNombre.TEACHER ? await this.teacherScope.allowedSemesters(user.userId) : [];
    for (const id of unicos) {
      const u = usuarios.find((x) => x.id === id);
      const rol = u?.role?.name as RolNombre | undefined;
      let valido = !!u && u.status === 'active' && !!rol && staff.includes(rol);
      if (!valido && u && u.status === 'active' && rol === RolNombre.STUDENT && user.role === RolNombre.TEACHER) {
        const perfil = await this.profiles.findOne({ where: { userId: u.id } });
        valido = !!perfil && effectiveSemesters(perfil).some((s) => alcance.includes(s));
      }
      if (!valido) {
        const msg = user.role === RolNombre.TEACHER
          ? 'Cada contacto debe ser personal activo de la carrera o un estudiante de tus semestres.'
          : 'Cada contacto debe ser personal activo de la carrera (docente, Sociedad o Dirección).';
        throw new BadRequestException({ message: msg, fields: { contactUserIds: [msg] } });
      }
    }
    return unicos;
  }

  private async replaceResponsables(activityId: string, ids: string[], m: EntityManager): Promise<void> {
    const repo = m.getRepository(ActivityResponsible);
    await repo.delete({ activityId });
    if (ids.length) await repo.insert(ids.map((userId) => ({ activityId, userId })));
  }

  private async replaceContactos(activityId: string, ids: string[], m: EntityManager): Promise<void> {
    const repo = m.getRepository(ActivityContact);
    await repo.delete({ activityId });
    if (ids.length) await repo.insert(ids.map((userId) => ({ activityId, userId })));
  }

  /** ¿Es uno de los responsables de la actividad? (V3.2 §16) */
  private async esResponsable(activityId: string, userId: string): Promise<boolean> {
    return this.activities.manager.getRepository(ActivityResponsible).exists({ where: { activityId, userId } });
  }

  /**
   * V3.2 §20: términos de búsqueda derivados de áreas (nombre y etiquetas) y
   * habilidades (nombre y alias). Se recalculan al guardar; nadie los escribe.
   */
  private async derivarPalabrasClave(activityId: string, m: EntityManager): Promise<void> {
    await m.query(
      `UPDATE "activities" a SET "search_keywords" = COALESCE((
         SELECT array_agg(DISTINCT lower(t)) FROM (
           SELECT ar."name" AS t FROM "activity_areas" aa JOIN "academic_areas" ar ON ar."id" = aa."academic_area_id" WHERE aa."activity_id" = a."id"
           UNION ALL
           SELECT unnest(ar."tags") FROM "activity_areas" aa JOIN "academic_areas" ar ON ar."id" = aa."academic_area_id" WHERE aa."activity_id" = a."id"
           UNION ALL
           SELECT s."name" FROM "activity_skills" acs JOIN "skills" s ON s."id" = acs."skill_id" WHERE acs."activity_id" = a."id"
           UNION ALL
           SELECT unnest(s."aliases") FROM "activity_skills" acs JOIN "skills" s ON s."id" = acs."skill_id" WHERE acs."activity_id" = a."id"
         ) terminos WHERE t IS NOT NULL AND t <> ''
       ), '{}')
       WHERE a."id" = $1`,
      [activityId],
    );
  }

  /** V3.2 §18.1: virtual no muestra aula; presencial no lleva enlace de reunión. */
  private normalizarModalidad(activity: Activity): void {
    if (activity.modality === ActivityModality.VIRTUAL) activity.location = null;
    if (activity.modality === ActivityModality.PRESENCIAL) activity.meetingUrl = null;
  }

  /** V3.2 §18.3: la imagen es un archivo de imagen que subió quien la pone. */
  private async assertImagen(
    user: AuthenticatedUser,
    imageFileId: string | null | undefined,
    campo: 'imageFileId' | 'imageFileIds' = 'imageFileId',
  ): Promise<void> {
    if (!imageFileId) return;
    const archivo = await this.activities.manager.getRepository(StoredFileRecord).findOne({ where: { id: imageFileId } });
    const esImagen = !!archivo && /^image\/(png|jpeg|webp)$/.test(archivo.mimeTypeDetected ?? '');
    if (!archivo || !esImagen || (archivo.uploadedByUserId !== user.userId && user.role !== RolNombre.ADMIN)) {
      const msg = 'La imagen tiene que ser un PNG, JPG o WEBP que hayas subido tú.';
      throw new BadRequestException({ message: msg, fields: { [campo]: [msg] } });
    }
  }

  /**
   * V4.1 A41-006 (A.5): la lista final de imágenes, en orden (la primera es la
   * portada). Solo se validan las que se agregan: quien edita una actividad
   * ajena conserva las imágenes que subió otra persona. Un cliente anterior
   * que solo conoce `imageFileId` cambia o quita la portada sin perder el resto.
   * `undefined` si el pedido no toca las imágenes.
   */
  private async resolverImagenes(
    user: AuthenticatedUser,
    dto: { imageFileIds?: string[]; imageFileId?: string | null },
    actuales: string[],
    portadaActual: string | null,
  ): Promise<string[] | undefined> {
    let ids: string[] | undefined;
    if (dto.imageFileIds !== undefined) {
      ids = [...new Set(dto.imageFileIds)];
    } else if (dto.imageFileId !== undefined) {
      const resto = actuales.filter((x) => x !== portadaActual && x !== dto.imageFileId);
      ids = dto.imageFileId ? [dto.imageFileId, ...resto] : resto;
    }
    if (ids === undefined) return undefined;
    if (ids.length > 5) {
      const msg = 'Puedes agregar hasta 5 imágenes.';
      throw new BadRequestException({ message: msg, fields: { imageFileIds: [msg] } });
    }
    const campo = dto.imageFileIds !== undefined ? 'imageFileIds' : 'imageFileId';
    for (const id of ids) {
      if (!actuales.includes(id)) await this.assertImagen(user, id, campo);
    }
    return ids;
  }

  private async imagenesDe(activityId: string): Promise<string[]> {
    const filas = await this.activities.manager.getRepository(ActivityImage).find({
      where: { activityId }, order: { position: 'ASC', createdAt: 'ASC' },
    });
    return filas.map((f) => f.storedFileId);
  }

  private async replaceImagenes(activityId: string, ids: string[], m: EntityManager): Promise<void> {
    const repo = m.getRepository(ActivityImage);
    await repo.delete({ activityId });
    if (ids.length) await repo.insert(ids.map((storedFileId, position) => ({ activityId, storedFileId, position })));
  }

  /** V4.1 A41-008/009 (§4.2–§4.4): ¿la creó una autoridad (Dirección o Administración)? */
  private async creadaPorAutoridad(activity: Activity): Promise<boolean> {
    let rol: RolNombre | undefined = activity.creator?.role?.name;
    if (!rol && activity.creatorId) {
      const creador = await this.activities.manager.getRepository(User).findOne({
        where: { id: activity.creatorId }, relations: { role: true },
      });
      rol = creador?.role?.name;
    }
    return rol === RolNombre.CAREER_DIRECTOR || rol === RolNombre.ADMIN;
  }

  /**
   * V4.1 A41-009 (§4.4, §20): quien fue asignado responsable por una
   * autoridad opera la actividad (abrir o cerrar inscripciones, finalizar,
   * gestionar participantes y asistencia) pero no cambia su contenido, no la
   * cancela ni la devuelve a borrador. El contenido lo ajusta quien la creó o
   * Dirección.
   */
  private async assertSoloOperacion(user: AuthenticatedUser, activity: Activity, dto: UpdateActivityDto): Promise<void> {
    if (activity.creatorId === user.userId) return;
    if (user.role === RolNombre.ADMIN || user.role === RolNombre.CAREER_DIRECTOR) return;
    if (!(await this.creadaPorAutoridad(activity))) return;
    const tocados = Object.entries(dto).filter(([, v]) => v !== undefined).map(([k]) => k);
    const materiales = tocados.filter((k) => k !== 'status');
    const estadoNoOperativo = dto.status === ActivityStatus.CANCELLED || dto.status === ActivityStatus.DRAFT;
    if (materiales.length > 0 || estadoNoOperativo) {
      throw new ForbiddenException({
        message: 'Como responsable asignado gestionas la operación (inscripciones, asistencia, abrir o cerrar). '
          + 'El contenido, la cancelación o volver a borrador los decide quien la creó o Dirección.',
        code: 'ACTIVITY_RESPONSIBLE_OPERATION_ONLY',
      });
    }
  }

  /** V5 §5.5: tolerancia, en minutos, al comparar el inicio con «ahora». */
  private toleranciaInicioMin(): number {
    const v = Number(this.config.get<string>('ACTIVITY_START_TOLERANCE_MINUTES'));
    return Number.isFinite(v) && v >= 0 && v <= 10 ? v : ACTIVITY_START_TOLERANCE_MINUTES_DEFAULT;
  }

  /** V5 ND-06: días después del fin para regularizar la asistencia. */
  private ventanaAsistenciaDias(): number {
    const v = Number(this.config.get<string>('ATTENDANCE_WINDOW_DAYS'));
    return Number.isFinite(v) && v >= 0 && v <= 60 ? v : ATTENDANCE_WINDOW_DAYS_DEFAULT;
  }

  /**
   * V4.1 A41-010 (§4.6, 23.5): una actividad nueva no se publica con un inicio
   * que ya pasó. V5 §5.5 (B04): se compara al minuto con tolerancia acotada,
   * porque la interfaz elige la hora al minuto y el servidor mide milisegundos.
   */
  private assertInicioFuturo(activity: Activity): void {
    if (inicioYaPaso(activity.eventDate, new Date(), this.toleranciaInicioMin())) {
      const msg = 'La fecha de inicio ya pasó: elige este momento o una fecha futura para publicarla.';
      throw new BadRequestException({ message: msg, code: 'ACTIVITY_START_IN_PAST', fields: { activityDate: [msg] } });
    }
  }

  /**
   * V4.1 A41-009 (§4.5, B13): si los responsables de una actividad creada por
   * una autoridad son solo docentes, sus semestres tienen que estar cubiertos
   * por la unión de los alcances de esos docentes. La unión no amplía el
   * alcance de ninguno: cada docente sigue operando solo a sus estudiantes.
   * Con un responsable de Dirección o de la Sociedad no hay límite (cubren
   * toda la carrera). Se valida al publicar, no al guardar el borrador.
   */
  private async assertCobertura(user: AuthenticatedUser, activity: Activity, responsables: string[]): Promise<void> {
    if (user.role !== RolNombre.ADMIN && user.role !== RolNombre.CAREER_DIRECTOR) return;
    if (activity.type !== ActivityType.ACADEMICA || responsables.length === 0) return;
    const usuarios = await this.activities.manager.getRepository(User).find({
      where: { id: In(responsables) }, relations: { role: true },
    });
    if (usuarios.length === 0 || usuarios.some((u) => u.role?.name !== RolNombre.TEACHER)) return;
    const union = new Set<number>();
    for (const u of usuarios) for (const s of await this.teacherScope.allowedSemesters(u.id)) union.add(s);
    const cubiertos = [...union].sort((a, b) => a - b);
    const alcance = activity.semesterScope ?? [];
    const fuera = alcance.length === 0 ? null : alcance.filter((s) => !union.has(s));
    if (alcance.length === 0 || (fuera && fuera.length > 0)) {
      const lista = cubiertos.length ? cubiertos.map((s) => `${s}.º`).join(', ') : 'ninguno';
      const msg = alcance.length === 0
        ? `Los docentes responsables cubren los semestres ${lista}: elige esos semestres o suma un responsable que cubra toda la carrera.`
        : `Los semestres ${fuera!.map((s) => `${s}.º`).join(', ')} no los cubre ningún docente responsable (cubren ${lista}).`;
      throw new BadRequestException({ message: msg, code: 'ACTIVITY_SCOPE_NOT_COVERED', fields: { semesterScope: [msg] } });
    }
  }

  /**
   * V4.1 A41-010 (§4.6, B16): repetir una actividad es duplicarla. La copia es
   * un borrador nuevo de quien duplica, sin fechas, inscripciones, asistencia
   * ni constancias de la original. Las imágenes no se copian (son archivos de
   * quien las subió).
   */
  /**
   * V5-06 (§5.6, B07): borrar un borrador. Solo un DRAFT que nunca se envió
   * ni se publicó, de quien lo creó (o Administración, auditado), y sin
   * historia: inscripciones, revisiones, constancias, credenciales,
   * evidencias o necesidades de equipo. Se va con su propia configuración
   * (áreas, tecnologías, responsables, contactos, imágenes y reglas). Lo
   * publicado nunca se borra: se cancela con motivo.
   */
  async deleteDraft(user: AuthenticatedUser, id: string): Promise<void> {
    const activity = await this.findOne(id);
    if (activity.creatorId !== user.userId && user.role !== RolNombre.ADMIN) {
      throw new ForbiddenException('Solo quien creó el borrador puede borrarlo.');
    }
    if (activity.status !== ActivityStatus.DRAFT || activity.submittedAt) {
      throw new ConflictException({
        code: 'ACTIVITY_NOT_DELETABLE',
        message: 'Solo se borra un borrador que nunca se envió ni se publicó. Una actividad publicada se cancela con un motivo.',
      });
    }
    const referencias = await this.activities.manager.query(`
      SELECT (SELECT count(*) FROM activity_registrations WHERE activity_id = $1)
           + (SELECT count(*) FROM activity_reviews WHERE activity_id = $1)
           + (SELECT count(*) FROM internal_constancies WHERE activity_id = $1)
           + (SELECT count(*) FROM external_certificates WHERE activity_id = $1)
           + (SELECT count(*) FROM project_evidences WHERE activity_id = $1)
           + (SELECT count(*) FROM team_needs WHERE activity_id = $1) AS n`, [id]);
    if (Number(referencias[0]?.n ?? 0) > 0) {
      throw new ConflictException({
        code: 'ACTIVITY_HAS_HISTORY',
        message: 'Este borrador ya tiene historia (inscripciones, revisiones o documentos): no se borra. Puedes dejarlo como está o cancelarlo.',
      });
    }
    await this.activities.manager.transaction(async (m) => {
      await m.getRepository(Activity).delete({ id });
      await this.audit.record({
        actorUserId: user.userId,
        eventType: AuditEventType.ACTIVITY_DRAFT_DELETED,
        entityType: 'activity',
        entityId: id,
        metadata: { title: activity.title, creatorId: activity.creatorId, comoSoporte: activity.creatorId !== user.userId },
      }, m);
    });
  }

  async duplicate(user: AuthenticatedUser, id: string): Promise<Activity> {
    const origen = await this.findOne(id);
    await this.assertCanManage(user, origen);
    const contextos = (origen.activitySkills ?? []).map((s) => ({ skillId: s.skillId, areaId: s.academicAreaId ?? undefined }));
    const copia = await this.create(user, {
      title: `${origen.title} (copia)`.slice(0, 200),
      description: origen.description ?? undefined,
      type: origen.type,
      categoryId: origen.categoryId,
      modality: origen.modality,
      areaIds: (origen.activityAreas ?? []).map((a) => a.academicAreaId),
      skillIds: contextos.map((c) => c.skillId),
      skillContexts: contextos.filter((c) => c.areaId) as { skillId: string; areaId: string }[],
      originType: origen.originType,
      provider: origen.provider ?? undefined,
      externalUrl: origen.externalUrl ?? undefined,
      expectedIssuerDomains: origen.expectedIssuerDomains ?? [],
      expectedKeywords: origen.expectedKeywords ?? [],
      location: origen.location ?? undefined,
      meetingUrl: origen.meetingUrl ?? undefined,
      resourceLinks: origen.resourceLinks ?? [],
      capacity: origen.capacity ?? undefined,
      semesterScope: origen.semesterScope ?? undefined,
      registrationMode: origen.registrationMode,
      requirements: origen.requirements ?? undefined,
      // V5 §7: una copia ya no emite constancias; la asistencia queda registrada.
      outcomePolicy: origen.outcomePolicy === ActivityOutcomePolicy.INTERNAL_CONSTANCY
        ? ActivityOutcomePolicy.PARTICIPATION_ONLY
        : origen.outcomePolicy ?? undefined,
      certificateIssuer: origen.certificateIssuer ?? undefined,
      status: ActivityStatus.DRAFT,
    } as unknown as CreateActivityDto);
    await this.audit.record({
      actorUserId: user.userId,
      eventType: AuditEventType.ACTIVITY_DUPLICATED,
      entityType: 'activity',
      entityId: copia.id,
      metadata: { duplicatedFrom: origen.id },
    });
    return copia;
  }

  /**
   * V3.2 §18, §19, §21.1: un borrador puede estar incompleto; lo que se
   * publica o se envía a revisión, no. Errores por campo (§6.4).
   */
  private assertCompleta(activity: Activity, areaIds: string[], _skillIds: string[], responsables?: number): void {
    const errores: Record<string, string[]> = {};
    const poner = (campo: string, msg: string) => { errores[campo] = [msg]; };
    if (!activity.eventDate) poner('activityDate', 'Indica la fecha y hora de inicio.');
    if (!activity.endAt) poner('endAt', 'Indica la fecha y hora de fin.');
    if (activity.eventDate && activity.endAt && activity.endAt.getTime() <= activity.eventDate.getTime()) {
      poner('endAt', 'La fecha final debe ser posterior a la fecha inicial.');
    }
    // V5-11 (§5.4): la modalidad se valida igual en internas y externas. En una
    // externa virtual, el enlace oficial del proveedor sirve de enlace de acceso
    // (un curso asíncrono no tiene «reunión»), pero alguno tiene que haber.
    const externa = activity.originType === ActivityOrigin.EXTERNAL;
    const presencial = activity.modality === ActivityModality.PRESENCIAL || activity.modality === ActivityModality.HIBRIDA;
    const virtual = activity.modality === ActivityModality.VIRTUAL || activity.modality === ActivityModality.HIBRIDA;
    if (presencial && !activity.location?.trim()) poner('location', 'Indica el aula o el lugar.');
    if (virtual && !activity.meetingUrl && !(externa && activity.externalUrl)) {
      poner('meetingUrl', externa
        ? 'Indica el enlace de acceso: el de la reunión o el oficial del proveedor.'
        : 'Indica el enlace de la reunión.');
    }
    if (activity.outcomePolicy === ActivityOutcomePolicy.INSTITUTION_ISSUED_CERTIFICATE && !activity.certificateIssuer?.trim()) {
      poner('certificateIssuer', 'Indica quién emite el certificado: Afinia no se atribuye su autoría.');
    }
    if (areaIds.length === 0) poner('areaIds', 'Selecciona al menos un área.');
    // V4.1 V41-01 (§3.1, 23.1): una charla general puede trabajar un área sin
    // una tecnología concreta; no se obliga a inventar una habilidad. Si se
    // eligen habilidades, igual tienen que pertenecer a las áreas (arriba).
    // V4.1 A41-007: el responsable se exige aquí, al publicar, no al guardar.
    if (responsables === 0) poner('responsibleUserIds', 'Indica quién es el responsable antes de publicar.');
    if (Object.keys(errores).length > 0) {
      throw new BadRequestException({
        message: 'Completa estos datos antes de publicar o enviar a revisión.',
        fields: errores,
      });
    }
  }

  /**
   * V3.2 §21.4–§21.5: cierre y fin automáticos. Lo que ya empezó deja de
   * aceptar inscripciones (CLOSED); lo que ya terminó queda FINISHED, y si
   * espera una credencial se avisa a quienes pueden acreditarla. Lo llama el
   * trabajador de ciclo de vida.
   */
  async avanzarCicloDeVida(): Promise<{ cerradas: number; finalizadas: number }> {
    const finales: { id: string; status: ActivityStatus }[] = await this.activities.query(
      `SELECT "id", "status" FROM "activities"
        WHERE "status" IN ('published', 'open', 'closed') AND "end_at" IS NOT NULL AND "end_at" <= now()
        LIMIT 200`,
    );
    for (const f of finales) {
      const activity = await this.findOne(f.id);
      activity.status = ActivityStatus.FINISHED;
      await this.activities.manager.transaction(async (m) => {
        await m.getRepository(Activity).update({ id: f.id }, { status: ActivityStatus.FINISHED });
        await this.audit.record({
          actorUserId: null,
          eventType: AuditEventType.ACTIVITY_STATUS_CHANGED,
          entityType: 'activity',
          entityId: f.id,
          metadata: { de: f.status, a: ActivityStatus.FINISHED, automatico: 'end_at' },
        }, m);
      });
      if (CredentialEligibilityService.esperaCredencial(activity)) {
        const habilitadas = await this.registrations.find({
          where: { activityId: f.id, status: CredentialEligibilityService.estadoQueHabilita(activity) },
          relations: { studentProfile: true },
        });
        await this.eligibility.announce(activity, habilitadas, activity.responsibleUserId ?? activity.creatorId);
      }
    }
    const cerradas: { id: string; status: ActivityStatus }[] = await this.activities.query(
      `UPDATE "activities" SET "status" = 'closed', "updated_at" = now()
        WHERE "status" IN ('published', 'open') AND "event_date" IS NOT NULL AND "event_date" <= now()
          AND ("end_at" IS NULL OR "end_at" > now())
        RETURNING "id", 'open' AS "status"`,
    ).then((r: unknown) => (Array.isArray(r) && Array.isArray(r[0]) ? r[0] : (r as { id: string; status: ActivityStatus }[])));
    for (const c of cerradas) {
      await this.audit.record({
        actorUserId: null,
        eventType: AuditEventType.ACTIVITY_STATUS_CHANGED,
        entityType: 'activity',
        entityId: c.id,
        metadata: { a: ActivityStatus.CLOSED, automatico: 'start_at' },
      });
    }
    return { cerradas: cerradas.length, finalizadas: finales.length };
  }

  /**
   * V3.2 §6.3, §17: candidatos para los combobox de responsables y contactos,
   * con búsqueda y acotados (20). Solo lo que quien pregunta podría asignar.
   */
  async candidatos(
    user: AuthenticatedUser,
    tipo: 'responsible' | 'contact',
    type: ActivityType,
    q?: string,
  ): Promise<{ id: string; firstName: string; lastName: string; role: string; email: string; semesters?: number[] }[]> {
    const roles = tipo === 'responsible'
      ? this.rolesResponsables(user.role as RolNombre, type)
      : [RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.SCIENTIFIC_SOCIETY,
        ...(user.role === RolNombre.TEACHER ? [RolNombre.STUDENT] : [])];
    if (roles.length === 0) return [];
    const qb = this.activities.manager.getRepository(User).createQueryBuilder('u')
      .innerJoinAndSelect('u.role', 'r')
      .where('u.status = :activo', { activo: 'active' })
      .andWhere('r.name IN (:...roles)', { roles })
      .orderBy('u.lastName', 'ASC')
      .addOrderBy('u.firstName', 'ASC')
      .take(20);
    const texto = q?.trim();
    if (texto) {
      qb.andWhere(
        "(u.firstName ILIKE :t OR u.lastName ILIKE :t OR u.email ILIKE :t OR CONCAT(u.firstName, ' ', u.lastName) ILIKE :t)",
        { t: `%${texto.replace(/[%_\\]/g, (c) => `\\${c}`)}%` },
      );
    }
    if (user.role === RolNombre.TEACHER && roles.includes(RolNombre.STUDENT)) {
      // Estudiantes solo de sus semestres (actuales o de arrastre).
      const suyos = await this.teacherScope.allowedSemesters(user.userId);
      qb.leftJoin(StudentProfile, 'p', 'p.user_id = u.id')
        .andWhere(
          '(r.name <> :est OR p.semester IN (:...s) OR p.academic_scope_semesters && ARRAY[:...s]::smallint[])',
          { est: RolNombre.STUDENT, s: suyos.length ? suyos : [0] },
        );
    }
    const filas = await qb.getMany();
    // V4.1 A41-009 (§4.5): los semestres de cada docente, para mostrar qué cubre
    // la combinación de responsables antes de publicar.
    const semestres = new Map<string, number[]>();
    for (const u of filas) {
      if (u.role?.name === RolNombre.TEACHER) semestres.set(u.id, await this.teacherScope.allowedSemesters(u.id));
    }
    return filas.map((u) => ({
      id: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role?.name ?? '', email: u.email,
      ...(semestres.has(u.id) ? { semesters: semestres.get(u.id) } : {}),
    }));
  }

  /** Reemplaza las áreas de una oportunidad; la primera es la principal. */
  private async replaceAreas(activityId: string, areaIds: string[], m: EntityManager = this.activities.manager): Promise<void> {
    const repo = m.getRepository(ActivityArea);
    await repo.delete({ activityId });
    if (areaIds.length > 0) {
      await repo.insert(areaIds.map((academicAreaId) => ({ activityId, academicAreaId })));
    }
  }

  /**
   * V3.2 C6: al guardar la actividad, las relaciones que trajo `findOne`
   * (áreas, habilidades, categoría…) no deben viajar con ella. Si viajan,
   * TypeORM intenta «sincronizar» la lista vieja con lo recién reemplazado y
   * termina escribiendo `activity_id = NULL`. Se guarda solo la fila.
   *
   * Las relaciones se quitan **antes** de `create`: si llegan, `create` toma el
   * id de la relación cargada (la vieja) y pisa `academicAreaId` o
   * `categoryId` recién cambiados.
   */
  private soloFila(activity: Activity): Activity {
    const plano = { ...activity } as Record<string, unknown>;
    for (const rel of ['activityAreas', 'activitySkills', 'academicArea', 'creator', 'category', 'responsible', 'gamificationRules']) {
      delete plano[rel];
    }
    return this.activities.create(plano as DeepPartial<Activity>);
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
   * Campos que cambian QUÉ es la actividad. Lo que Dirección aprobó no puede
   * cambiar después sin que lo vuelva a ver. Fechas, lugar o cupo son
   * operación, no contenido.
   */
  private cambiaContenido(dto: UpdateActivityDto): boolean {
    return [
      dto.title, dto.description, dto.type, dto.categoryId, dto.areaId, dto.areaIds, dto.skillIds, dto.skillContexts,
      dto.originType, dto.provider, dto.credentialExpected, dto.expectedIssuerDomains, dto.expectedKeywords,
      dto.outcomePolicy,
      dto.semesterScope, dto.internalConstancyEnabled, dto.gamificationRules, dto.evidenceRequired,
    ].some((v) => v !== undefined);
  }

  /** Envía a Dirección una actividad en borrador (§27.3). */
  async submitForReview(user: AuthenticatedUser, id: string, comment?: string): Promise<Activity> {
    const activity = await this.findOne(id);
    await this.assertCanManage(user, activity);
    // V3.2 §21.1: lo que va a Dirección tiene que estar completo.
    this.assertCompleta(
      activity,
      (activity.activityAreas ?? []).map((a) => a.academicAreaId),
      (activity.activitySkills ?? []).map((s) => s.skillId),
    );
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
    // V3.2 §47: Dirección se entera de lo que llega a su bandeja.
    const directores = await this.activities.manager.getRepository(User).find({
      where: { status: 'active' as never, role: { name: RolNombre.CAREER_DIRECTOR } },
      relations: { role: true },
    });
    for (const d of directores) {
      await this.avisar(d.id, 'ACTIVITY_REVIEW_SUBMITTED', 'Actividad para revisar',
        `«${activity.title}» espera tu revisión.`, '/director/approvals', activity.id, `review-submitted:${activity.id}:${activity.submittedAt?.getTime()}`);
    }
    return this.findOne(id);
  }

  /** Aviso sin efecto sobre la operación si la notificación falla. */
  private async avisar(
    userId: string, kind: string, title: string, body: string, link: string, activityId: string, dedupeKey: string,
  ): Promise<void> {
    try {
      await this.notifications.emit({ userId, kind, title, body, link, entityType: 'activity', entityId: activityId, dedupeKey });
    } catch {
      // un aviso no frena la revisión
    }
  }

  /**
   * V3.2 §23.1: «Cancelar envío». Mientras Dirección no decidió, quien la
   * propuso la retira para corregirla: vuelve a borrador sin revisión.
   */
  async cancelSubmission(user: AuthenticatedUser, id: string): Promise<Activity> {
    const activity = await this.findOne(id);
    const propia = activity.creatorId === user.userId
      || activity.responsibleUserId === user.userId
      || await this.esResponsable(activity.id, user.userId);
    if (!propia) throw new ForbiddenException('Solo quien la propuso puede retirar el envío.');
    if (activity.reviewStatus !== ActivityReviewStatus.PENDING) {
      throw new ConflictException('Solo se retira un envío que Dirección todavía no decidió.');
    }
    await this.activities.manager.transaction(async (m) => {
      await m.getRepository(Activity).update({ id: activity.id }, {
        reviewStatus: null, submittedAt: null, updatedById: user.userId,
      });
      await m.getRepository(ActivityReview).save(m.getRepository(ActivityReview).create({
        activityId: activity.id, actorUserId: user.userId, action: 'cancelled', comment: null,
      }));
      await this.audit.record({
        actorUserId: user.userId,
        eventType: AuditEventType.ACTIVITY_SUBMISSION_CANCELLED,
        entityType: 'activity',
        entityId: activity.id,
      }, m);
    });
    return this.findOne(id);
  }

  /**
   * V3.2 §24: un borrador es privado. Lo ven quien lo creó y sus
   * responsables; Dirección y Administración solo desde que se envía a
   * revisión. Ningún otro docente, nunca un estudiante.
   */
  private async veBorrador(user: AuthenticatedUser, activity: Activity, responsableDe?: Set<string>): Promise<boolean> {
    if (activity.status !== ActivityStatus.DRAFT) return true;
    if (activity.creatorId === user.userId) return true;
    const esResponsable = activity.responsibleUserId === user.userId
      || (responsableDe ? responsableDe.has(activity.id) : await this.esResponsable(activity.id, user.userId));
    // V4.1 A41-008 (§4.3, 23.3): el borrador de una autoridad (Dirección o
    // Administración) es solo de quien lo crea; el docente asignado lo ve
    // cuando se publica. El de la Sociedad sí lo ven sus responsables.
    if (esResponsable) return !(await this.creadaPorAutoridad(activity));
    const enviada = activity.requiresReview && activity.reviewStatus !== null && activity.reviewStatus !== undefined;
    return enviada && (user.role === RolNombre.CAREER_DIRECTOR || user.role === RolNombre.ADMIN);
  }

  /** Detalle para el personal: un borrador ajeno no existe para quien no puede verlo (§24). */
  async findOneForStaff(user: AuthenticatedUser, id: string): Promise<Activity> {
    const activity = await this.findOne(id);
    if (!(await this.veBorrador(user, activity))) throw new NotFoundException('Actividad no encontrada.');
    return activity;
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
    // V3.2 §47: quien la propuso se entera de la decisión.
    const avisos = {
      // V3.2 §47: el nombre de la especificación.
      approve: ['ACTIVITY_APPROVED', 'Actividad aprobada', `Dirección aprobó «${activity.title}». Ya puedes publicarla.`],
      observe: ['ACTIVITY_REVIEW_OBSERVED', 'Actividad observada', `Dirección observó «${activity.title}»: corrígela y vuelve a enviarla.`],
      reject: ['ACTIVITY_REVIEW_REJECTED', 'Actividad rechazada', `Dirección rechazó «${activity.title}».`],
    } as const;
    const [tipoAviso, tituloAviso, cuerpoAviso] = avisos[decision];
    const destinatarios = new Set([activity.creatorId, activity.responsibleUserId].filter((x): x is string => !!x));
    for (const uid of destinatarios) {
      await this.avisar(uid, tipoAviso, tituloAviso, cuerpoAviso,
        activity.type === ActivityType.EXTRACURRICULAR ? '/society/activities' : '/teacher/my-activities', activity.id,
        `review-${decision}:${activity.id}:${Date.now()}`);
    }
    return this.findOne(id);
  }

  /** Lo que espera la decisión de Dirección. */
  async pendingReviews(user: AuthenticatedUser) {
    if (user.role !== RolNombre.CAREER_DIRECTOR) {
      throw new ForbiddenException('Las aprobaciones son de la Dirección de carrera.');
    }
    const lista = await this.activities.find({
      where: { reviewStatus: ActivityReviewStatus.PENDING },
      relations: { academicArea: true, creator: { role: true }, category: true, activitySkills: { skill: true }, activityAreas: { academicArea: true } },
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
  private async replaceRules(
    activityId: string,
    userId: string,
    reglas: ActivityGamificationRuleDto[],
    m: EntityManager = this.activities.manager,
  ) {
    const rulesRepo = m.getRepository(ActivityGamificationRule);
    const max = Number(this.config.get<string>('GAMIFICATION_ACTIVITY_MAX_POINTS') ?? 50) || 50;
    for (const r of reglas) {
      if (r.trigger !== GamificationTrigger.PARTICIPACION_CONFIRMADA) {
        throw new BadRequestException({
          message: 'En una actividad solo se premia la participación confirmada.',
          fields: { gamificationRules: ['En una actividad solo se premia la participación confirmada.'] },
        });
      }
    }
    // V4.1 A41-016 (§9.2, A.10): sin puntos libres. La regla nombra un criterio
    // vigente de participación (no un extra de temporada) y toma sus puntos.
    const resueltas: { r: ActivityGamificationRuleDto; criterio: GamificationCriterion }[] = [];
    for (const r of reglas) {
      const criterio = r.criterionId
        ? await this.criteria.findOne({ where: { id: r.criterionId } })
        : null;
      if (!criterio || !criterio.isActive || criterio.isBonus || criterio.trigger !== r.trigger) {
        const msg = 'Elige un criterio de puntos configurado por Dirección o Administración (no se admiten puntos libres).';
        throw new BadRequestException({ message: msg, fields: { gamificationRules: [msg] } });
      }
      if (r.points !== undefined && r.points !== criterio.points) {
        const msg = `Ese criterio da ${criterio.points} puntos; los puntos los fija el criterio.`;
        throw new BadRequestException({ message: msg, fields: { gamificationRules: [msg] } });
      }
      if (criterio.points > max) {
        throw new BadRequestException({
          message: `Una actividad puede dar como máximo ${max} puntos por participación.`,
          fields: { gamificationRules: [`Como máximo ${max} puntos.`] },
        });
      }
      resueltas.push({ r, criterio });
    }
    const unicos = new Map(resueltas.map((x) => [x.r.trigger, x]));
    await rulesRepo.delete({ activityId });
    for (const { r, criterio } of unicos.values()) {
      await rulesRepo.save(rulesRepo.create({
        activityId,
        trigger: r.trigger,
        points: criterio.points,
        badgeId: r.badgeId ?? null,
        description: r.description ?? null,
        criterionId: criterio.id,
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
    // V3.2 §11.4: en qué área se trabaja cada habilidad.
    const contextos = await resolveSkillContexts(this.activities.manager, dto.skillIds ?? [], areas, dto.skillContexts);
    await this.assertCategoryUsable(dto.categoryId, dto.type);
    const origen = dto.originType ?? ActivityOrigin.INTERNAL;
    this.assertExterna(origen, dto.provider, dto.externalUrl);
    const responsables = await this.resolverResponsables(user, dto.type, dto, (dto.status ?? ActivityStatus.DRAFT) === ActivityStatus.DRAFT);
    const responsable = responsables[0] ?? null;
    const contactos = (await this.resolverContactos(user, dto.contactUserIds)) ?? [];
    const imagenes = (await this.resolverImagenes(user, dto, [], null)) ?? [];

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
      meetingUrl: dto.meetingUrl ?? null,
      certificateIssuer: dto.certificateIssuer?.trim() || null,
      resourceLinks: dto.resourceLinks ?? [],
      imageFileId: imagenes[0] ?? null,
      updatedById: user.userId,
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
    this.normalizarModalidad(activity);
    // V3.2 §21.1–§22: guardar un borrador no publica; publicar exige lo mínimo.
    if (estadoInicial === ActivityStatus.PUBLISHED || estadoInicial === ActivityStatus.OPEN) {
      this.assertCompleta(activity, areas, contextos.map((c) => c.skillId), responsables.length);
      this.assertInicioFuturo(activity);
      await this.assertCobertura(user, activity, responsables);
    }
    // V3.2 C6: la actividad, sus áreas, habilidades y reglas se escriben juntas
    // o no se escribe nada.
    const saved = await this.activities.manager.transaction(async (m) => {
      const fila = await m.getRepository(Activity).save(activity);
      await this.replaceAreas(fila.id, areas, m);
      if (contextos.length) await this.replaceSkills(fila.id, contextos, m);
      await this.replaceResponsables(fila.id, responsables, m);
      await this.replaceContactos(fila.id, contactos, m);
      if (imagenes.length) await this.replaceImagenes(fila.id, imagenes, m);
      await this.derivarPalabrasClave(fila.id, m);
      if (dto.gamificationRules?.length) await this.replaceRules(fila.id, user.userId, dto.gamificationRules, m);
      await this.audit.record({
        actorUserId: user.userId,
        eventType: AuditEventType.ACTIVITY_CREATED,
        entityType: 'activity',
        entityId: fila.id,
        metadata: {
          type: dto.type,
          origin: origen,
          status: fila.status,
          semesterScope,
          responsibleUserId: responsable,
          responsibleUserIds: responsables,
          contactUserIds: contactos,
          viaAdmin: user.role === RolNombre.ADMIN,
        },
      }, m);
      return fila;
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
    return this.listar(user, filters);
  }

  /**
   * V3 BATCH 23: una página del listado del estudiante. Lo próximo primero
   * (fecha futura más cercana), luego lo pasado y lo que no tiene fecha. Los
   * filtros son los mismos del listado completo, más texto y «las mías».
   */
  async findPage(user: AuthenticatedUser, filters: QueryActivitiesDto) {
    const limit = filters.limit ?? 30;
    const offset = filters.offset ?? 0;
    const qb = this.activities.createQueryBuilder('a').select('a.id', 'id');
    if (user.role === RolNombre.STUDENT) qb.andWhere('a.status <> :borrador', { borrador: ActivityStatus.DRAFT });
    if (filters.type) qb.andWhere('a.type = :type', { type: filters.type });
    if (filters.categoryId) qb.andWhere('a.category_id = :cat', { cat: filters.categoryId });
    if (filters.status) qb.andWhere('a.status = :status', { status: filters.status });
    if (filters.modality) qb.andWhere('a.modality = :modality', { modality: filters.modality });
    if (filters.originType) qb.andWhere('a.origin_type = :origin', { origin: filters.originType });
    if (filters.areaId) {
      qb.andWhere('a.id IN (SELECT aa.activity_id FROM activity_areas aa WHERE aa.academic_area_id = :area)', { area: filters.areaId });
    }
    if (filters.fromDate) qb.andWhere('a.event_date >= :desde', { desde: startOfDay(filters.fromDate) });
    if (filters.toDate) qb.andWhere('a.event_date <= :hasta', { hasta: endOfDay(filters.toDate) });
    if (filters.q) {
      // Los comodines que escriba la persona se buscan como texto.
      const texto = `%${filters.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      qb.andWhere('(a.title ILIKE :texto OR a.description ILIKE :texto OR a.location ILIKE :texto)', { texto });
    }
    if (filters.mine) {
      const perfil = await this.profiles.findOne({ where: { userId: user.userId }, select: { id: true } });
      const estados = filters.mine === 'interested'
        ? [RegistrationStatus.INTERESTED]
        : [RegistrationStatus.REGISTERED, RegistrationStatus.ACCEPTED, RegistrationStatus.CONFIRMED];
      qb.andWhere(
        'a.id IN (SELECT r.activity_id FROM activity_registrations r WHERE r.student_profile_id = :perfil AND r.status IN (:...estados))',
        { perfil: perfil?.id ?? '00000000-0000-4000-8000-000000000000', estados },
      );
    }
    const total = await qb.getCount();
    const filas: { id: string }[] = await qb
      .orderBy('CASE WHEN a.event_date >= now() THEN 0 WHEN a.event_date IS NULL THEN 2 ELSE 1 END', 'ASC')
      .addOrderBy('CASE WHEN a.event_date >= now() THEN a.event_date END', 'ASC')
      .addOrderBy('a.event_date', 'DESC')
      .addOrderBy('a.created_at', 'DESC')
      .offset(offset)
      .limit(limit)
      .getRawMany();
    const ids = filas.map((f) => f.id);
    const items = ids.length ? await this.listar(user, filters, ids) : [];
    const orden = new Map(ids.map((id, i) => [id, i]));
    items.sort((x, y) => (orden.get((x as { id: string }).id) ?? 0) - (orden.get((y as { id: string }).id) ?? 0));
    return { items, total, limit, offset };
  }

  /** Lista completa o, con `soloIds`, solo esas actividades (para una página). */
  private async listar(
    user: AuthenticatedUser,
    filters: QueryActivitiesDto,
    soloIds?: string[],
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

    if (soloIds) {
      // La página ya aplicó los filtros; aquí solo se cargan sus filas.
      for (const k of Object.keys(where)) delete (where as Record<string, unknown>)[k];
      where.id = In(soloIds);
    }
    const activities = await this.activities.find({
      where,
      // V3.2 §37: la tarjeta resume áreas y habilidades.
      relations: {
        academicArea: true, creator: { role: true }, category: true,
        activityAreas: { academicArea: true }, activitySkills: { skill: true },
      },
      order: { eventDate: 'DESC', createdAt: 'DESC' },
      // Pruebas de rendimiento (k6, 22/10/2026): para UNA PÁGINA (≤ 30 ids),
      // el JOIN de las cinco relaciones tardaba ~1,7 s y por consultas
      // separadas ~26 ms. Para la lista completa (miles de filas) es al revés:
      // las consultas separadas obligan a TypeORM a unir en memoria y la API
      // se bloquea (regresión, 22/10/2026). Por eso solo se usa con página.
      ...(soloIds ? { relationLoadStrategy: 'query' as const } : {}),
    });

    // El estudiante nunca ve borradores. El resto ve los suyos, y como
    // «los suyos» depende ahora del alcance, hay que resolverlo por fila.
    const visible = user.role === RolNombre.STUDENT
      ? activities.filter((a) => a.status !== ActivityStatus.DRAFT)
      : await this.filtrarGestionables(user, activities, { incluirPublicadas: true });

    // V3.2 §37: imagen, responsables y contactos para la tarjeta y su detalle.
    await this.adjuntarPersonas(visible);
    const conConteos = await this.attachCounts(visible);
    return user.role === RolNombre.STUDENT
      ? (await this.attachMyRegistration(user.userId, conConteos)).map(vistaEstudiante)
      : conConteos;
  }

  /** Actividades cuyo responsable es el usuario (panel de gestion). */
  async findManagedBy(user: AuthenticatedUser): Promise<ActivityWithCounts[]> {
    const activities = await this.activities.find({
      // V4.1 A41-005: el formulario de edición se hidrata desde esta fila;
      // sin las habilidades abría vacío y guardar podía borrarlas.
      relations: {
        academicArea: true, creator: { role: true }, category: true, activityAreas: { academicArea: true }, activitySkills: { skill: true },
      },
      order: { createdAt: 'DESC' },
    });
    const propias = await this.filtrarGestionables(user, activities, { incluirPublicadas: false });
    await this.adjuntarPersonas(propias);
    return this.attachCounts(propias);
  }

  async findOne(id: string): Promise<Activity> {
    const activity = await this.activities.findOne({
      where: { id },
      relations: {
        academicArea: true,
        creator: { role: true },
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
    await this.adjuntarPersonas([activity]);
    return activity;
  }

  /**
   * V3.2 §16: responsables y contactos, con lo justo para mostrarlos (nombre,
   * rol y, de los contactos, el correo para escribirles). Una consulta por
   * tipo para todo el lote.
   */
  async adjuntarPersonas(lista: Activity[]): Promise<void> {
    if (lista.length === 0) return;
    const ids = lista.map((a) => a.id);
    const resumen = (u: User) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role?.name ?? null });
    const [resp, cont] = await Promise.all([
      this.activities.manager.getRepository(ActivityResponsible).find({
        where: { activityId: In(ids) }, relations: { user: { role: true } }, order: { createdAt: 'ASC' },
      }),
      this.activities.manager.getRepository(ActivityContact).find({
        where: { activityId: In(ids) }, relations: { user: { role: true } }, order: { createdAt: 'ASC' },
      }),
    ]);
    // V4.1 A41-006: todas las imágenes en orden; la portada sigue en `imageUrl`.
    const filasImagen = ids.length
      ? await this.activities.manager.getRepository(ActivityImage).find({
        where: { activityId: In(ids) }, order: { position: 'ASC', createdAt: 'ASC' },
      })
      : [];
    const imagenes = [...new Set([
      ...lista.map((a) => a.imageFileId).filter((x): x is string => !!x),
      ...filasImagen.map((f) => f.storedFileId),
    ])];
    const archivos = imagenes.length
      ? await this.activities.manager.getRepository(StoredFileRecord).find({ where: { id: In(imagenes) }, select: { id: true, storageKey: true } })
      : [];
    const claveDe = new Map(archivos.map((f) => [f.id, f.storageKey]));
    for (const a of lista) {
      const extra = a as Activity & {
        responsibles?: unknown[]; contacts?: unknown[]; imageUrl?: string | null;
        images?: { fileId: string; url: string }[];
      };
      const propios = resp.filter((r) => r.activityId === a.id && r.user);
      // El principal primero, aunque se haya agregado después.
      propios.sort((x, y) => Number(y.userId === a.responsibleUserId) - Number(x.userId === a.responsibleUserId));
      extra.responsibles = propios.map((r) => resumen(r.user));
      extra.contacts = cont.filter((c) => c.activityId === a.id && c.user)
        .map((c) => ({ ...resumen(c.user), email: c.user.email }));
      // Pasa por /api/files, que autoriza: la imagen de un borrador no se sirve a cualquiera.
      const clave = a.imageFileId ? claveDe.get(a.imageFileId) : null;
      extra.imageUrl = clave ? `${FILES_ROUTE}/${clave}` : null;
      const propias = filasImagen.filter((f) => f.activityId === a.id).map((f) => f.storedFileId);
      const orden = propias.length ? propias : a.imageFileId ? [a.imageFileId] : [];
      extra.images = orden
        .map((fileId) => ({ fileId, clave: claveDe.get(fileId) }))
        .filter((x): x is { fileId: string; clave: string } => !!x.clave)
        .map((x) => ({ fileId: x.fileId, url: `${FILES_ROUTE}/${x.clave}` }));
    }
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
          decisionReason: registration.decisionReason,
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
    await this.assertSoloOperacion(user, activity, dto);

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
        // V3.2 §23.3 (C10): aprobada, quien la propuso ya no cambia su
        // contenido (esté publicada o no). Sigue gestionando la participación.
        if (activity.reviewStatus === ActivityReviewStatus.APPROVED && user.role !== RolNombre.ADMIN) {
          throw new ConflictException({
            message: 'Ya fue aprobada por Dirección: el contenido ya no lo cambia quien la propuso. Pide a Dirección los ajustes.',
            code: 'ACTIVITY_APPROVED_LOCKED',
          });
        }
      }
    }

    if (dto.type && dto.type !== activity.type) {
      // Cambiar el tipo cambia el responsable: se valida con el tipo destino.
      this.assertCanPublish(user.role, dto.type);
      activity.type = dto.type;
    }
    const areasNuevas = this.areasPedidas(dto);
    // V3.2 C6/C7: primero se valida todo; después, en una transacción, se
    // escriben la actividad, sus áreas y sus habilidades con su contexto.
    let contextos: SkillContext[] | undefined;
    if (areasNuevas !== undefined || dto.skillIds !== undefined || dto.skillContexts !== undefined) {
      const areasFinales = areasNuevas ?? (await this.activityAreas.find({ where: { activityId: activity.id } })).map((a) => a.academicAreaId);
      const skillsFinales = dto.skillIds ?? (activity.activitySkills ?? []).map((s) => s.skillId);
      if (areasNuevas !== undefined) {
        for (const areaId of areasNuevas) await this.assertAreaExists(areaId);
      }
      await assertSkillsBelongToAreas(this.activities.manager, skillsFinales, areasFinales, 'skillIds');
      // Sin contexto nuevo, se conserva el que ya tenían si sigue siendo válido.
      const previos = (activity.activitySkills ?? [])
        .filter((s) => s.academicAreaId && areasFinales.includes(s.academicAreaId))
        .map((s) => ({ skillId: s.skillId, areaId: s.academicAreaId as string }));
      contextos = await resolveSkillContexts(
        this.activities.manager, skillsFinales, areasFinales, dto.skillContexts ?? previos,
      );
      if (areasNuevas !== undefined) activity.academicAreaId = areasNuevas[0] ?? null;
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
    // V3.2 §17: reasignan responsables Administración, Dirección y Sociedad
    // (en lo suyo); el docente no: suma contactos.
    let responsablesNuevos: string[] | undefined;
    if (dto.responsibleUserId !== undefined || dto.responsibleUserIds !== undefined) {
      if (user.role === RolNombre.TEACHER || user.role === RolNombre.STUDENT) {
        throw new ForbiddenException('Los responsables los reasignan Dirección o Administración.');
      }
      responsablesNuevos = await this.resolverResponsables(
        user, activity.type, dto, (dto.status ?? activity.status) === ActivityStatus.DRAFT,
      );
      activity.responsibleUserId = responsablesNuevos[0] ?? null;
    }
    const contactosNuevos = await this.resolverContactos(user, dto.contactUserIds);
    const imagenesNuevas = (dto.imageFileIds !== undefined || dto.imageFileId !== undefined)
      ? await this.resolverImagenes(user, dto, await this.imagenesDe(activity.id), activity.imageFileId)
      : undefined;
    if (imagenesNuevas !== undefined) activity.imageFileId = imagenesNuevas[0] ?? null;
    if (dto.meetingUrl !== undefined) activity.meetingUrl = dto.meetingUrl ?? null;
    if (dto.certificateIssuer !== undefined) activity.certificateIssuer = dto.certificateIssuer?.trim() || null;
    if (dto.resourceLinks !== undefined) activity.resourceLinks = dto.resourceLinks ?? [];
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
    // V3.2 §21.6: cancelar exige motivo, que el estudiante verá.
    if (dto.status === ActivityStatus.CANCELLED && estadoAnterior !== ActivityStatus.CANCELLED) {
      if (!dto.cancellationReason) {
        const msg = 'Indica el motivo de la cancelación: el estudiante lo verá.';
        throw new BadRequestException({ message: msg, fields: { cancellationReason: [msg] } });
      }
      activity.cancellationReason = dto.cancellationReason;
      activity.cancelledAt = new Date();
    }
    this.normalizarModalidad(activity);
    activity.updatedById = user.userId;
    // V3.2 §21.1: lo que se publica (o sigue publicado y cambia) tiene que estar completo.
    const publica = (dto.status === ActivityStatus.PUBLISHED || dto.status === ActivityStatus.OPEN)
      && estadoAnterior === ActivityStatus.DRAFT;
    const cambiaLoMinimo = [
      dto.activityDate, dto.endAt, dto.modality, dto.location, dto.meetingUrl, dto.areaIds, dto.areaId, dto.skillIds,
      dto.outcomePolicy, dto.certificateIssuer,
    ].some((v) => v !== undefined);
    const visible = [ActivityStatus.PUBLISHED, ActivityStatus.OPEN, ActivityStatus.CLOSED].includes(activity.status);
    if (publica || (visible && cambiaLoMinimo)) {
      const areasFinales = areasNuevas ?? (await this.activityAreas.find({ where: { activityId: activity.id } })).map((a) => a.academicAreaId);
      const skillsFinales = contextos?.map((c) => c.skillId) ?? (activity.activitySkills ?? []).map((s) => s.skillId);
      const responsablesFinales = responsablesNuevos?.length
        ?? await this.activities.manager.getRepository(ActivityResponsible).count({ where: { activityId: activity.id } });
      this.assertCompleta(activity, areasFinales, skillsFinales, responsablesFinales);
      if (publica) {
        this.assertInicioFuturo(activity);
        const ids = responsablesNuevos
          ?? (await this.activities.manager.getRepository(ActivityResponsible).find({ where: { activityId: activity.id } })).map((r) => r.userId);
        await this.assertCobertura(user, activity, ids);
      }
    }

    await this.activities.manager.transaction(async (m) => {
      await m.getRepository(Activity).save(this.soloFila(activity));
      if (areasNuevas !== undefined) await this.replaceAreas(activity.id, areasNuevas, m);
      if (contextos !== undefined) await this.replaceSkills(activity.id, contextos, m);
      if (responsablesNuevos !== undefined) await this.replaceResponsables(activity.id, responsablesNuevos, m);
      if (contactosNuevos !== undefined) await this.replaceContactos(activity.id, contactosNuevos, m);
      if (imagenesNuevas !== undefined) await this.replaceImagenes(activity.id, imagenesNuevas, m);
      if (areasNuevas !== undefined || contextos !== undefined) await this.derivarPalabrasClave(activity.id, m);
      if (dto.gamificationRules !== undefined) {
        await this.replaceRules(activity.id, user.userId, dto.gamificationRules ?? [], m);
      }
      if (dto.status !== undefined && dto.status !== estadoAnterior) {
        await this.audit.record({
          actorUserId: user.userId,
          eventType: AuditEventType.ACTIVITY_STATUS_CHANGED,
          entityType: 'activity',
          entityId: activity.id,
          metadata: {
            de: estadoAnterior,
            a: dto.status,
            ...(dto.status === ActivityStatus.CANCELLED ? { motivo: activity.cancellationReason } : {}),
          },
        }, m);
      }
    });

    if (dto.status !== undefined && dto.status !== estadoAnterior) {
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
    // V5 §6: en una interna, retirarse de una plaza admitida la libera; en una
    // externa, la aceptación la registró el responsable por el proveedor.
    const activity = await this.activities.findOne({ where: { id: activityId } });
    if (registration.status === RegistrationStatus.ACCEPTED && activity?.originType === ActivityOrigin.EXTERNAL) {
      throw new BadRequestException(
        'El responsable ya registró que el proveedor te aceptó. Si hubo un error, avísale.',
      );
    }
    if (registration.status === RegistrationStatus.ACCEPTED && activity?.eventDate
      && activity.eventDate.getTime() <= Date.now()) {
      throw new BadRequestException('La actividad ya empezó: avisa al responsable si no pudiste asistir.');
    }
    if (registration.status === RegistrationStatus.REJECTED) {
      throw new BadRequestException('Tu solicitud no fue admitida: no hay inscripción que cancelar.');
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
    reason?: string,
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
    // carrera—; se registra que el proveedor lo aceptó.
    const externa = activity.originType === ActivityOrigin.EXTERNAL;
    if (externa && status === RegistrationStatus.CONFIRMED) {
      const m = 'En una oportunidad externa se registra la aceptación del proveedor; '
        + 'la credencial la adjunta el estudiante cuando termine.';
      throw new BadRequestException({ code: 'EXTERNAL_USES_ACCEPTANCE', message: m, fields: { status: [m] } });
    }
    if (activity.status === ActivityStatus.CANCELLED && status !== RegistrationStatus.REJECTED) {
      const m = 'La actividad está cancelada: no se admite ni se registra asistencia.';
      throw new ConflictException({ code: 'ACTIVITY_CANCELLED', message: m });
    }

    const anterior = registration.status;
    const asistencia = ATTENDANCE_STATUSES.includes(status);
    const yaAsistencia = ATTENDANCE_STATUSES.includes(anterior);

    if (asistencia) {
      // V5 §6.1 / §5.7 / ND-06: asistir solo se registra con el evento empezado,
      // dentro de la ventana de regularización y con el acta abierta.
      const bloqueo = bloqueoAsistencia(activity, new Date(), this.toleranciaInicioMin(), this.ventanaAsistenciaDias());
      if (bloqueo) throw new ConflictException(bloqueo);
      if (!admitidoParaAsistencia(activity, anterior)) {
        const m = 'Primero admite la solicitud: la asistencia se registra a quien tiene un lugar.';
        throw new ConflictException({ code: 'ATTENDANCE_REQUIRES_ADMISSION', message: m, fields: { status: [m] } });
      }
      // V4.1 A41-011: una participación consolidada (la actividad terminó o
      // hay constancia emitida) no se retira libremente.
      if (anterior === RegistrationStatus.CONFIRMED && status !== RegistrationStatus.CONFIRMED
        && await this.participacionConsolidada(activity, registration)) {
        const m = 'Esta participación ya está consolidada (la actividad terminó o tiene constancia). '
          + 'Si hay un error, la corrige Dirección con un motivo.';
        throw new ConflictException({ code: 'PARTICIPATION_CONSOLIDATED', message: m });
      }
    } else {
      // Admitir o rechazar es una decisión sobre la solicitud, no sobre la
      // asistencia: no se toma después de registrarla, ni con el acta cerrada.
      if (activity.attendanceStatus === 'locked') {
        const m = 'La asistencia ya está cerrada. Si hay un error, la corrige Dirección con un motivo.';
        throw new ConflictException({ code: 'ATTENDANCE_LOCKED', message: m });
      }
      if (yaAsistencia) {
        const m = 'Ya se registró su asistencia: la admisión no se cambia. Si hay un error, la corrige Dirección con un motivo.';
        throw new ConflictException({ code: 'ADMISSION_AFTER_ATTENDANCE', message: m });
      }
      if (anterior === RegistrationStatus.INTERESTED || anterior === RegistrationStatus.CANCELLED) {
        const m = 'El estudiante no tiene una solicitud de inscripción vigente.';
        throw new ConflictException({ code: 'NO_PENDING_REQUEST', message: m });
      }
      if (status === RegistrationStatus.REJECTED && !reason?.trim()) {
        const m = 'Explica el motivo: el estudiante lo verá.';
        throw new BadRequestException({ code: 'REJECTION_REASON_REQUIRED', message: m, fields: { reason: [m] } });
      }
    }

    // V5 §6.1 (C05): ocupar plaza es atómico. La fila de la actividad se
    // bloquea y el cupo se cuenta dentro de la misma transacción, así dos
    // decisiones simultáneas no superan el cupo.
    const ocupa = OCCUPYING_STATUSES.includes(status) && !OCCUPYING_STATUSES.includes(anterior);
    registration.status = status;
    registration.confirmedById = confirmer.userId;
    if (status === RegistrationStatus.ACCEPTED) {
      registration.acceptedAt = anterior === RegistrationStatus.ACCEPTED ? registration.acceptedAt : new Date();
      registration.decisionReason = null;
    } else if (status === RegistrationStatus.REJECTED) {
      registration.acceptedAt = null;
      registration.decisionReason = reason!.trim().slice(0, 300);
    }
    const saved = await this.activities.manager.transaction(async (m) => {
      if (ocupa && activity.capacity) {
        await m.getRepository(Activity).createQueryBuilder('a')
          .setLock('pessimistic_write').where('a.id = :id', { id: activity.id }).getOne();
        const ocupados = await m.getRepository(ActivityRegistration).count({
          where: { activityId: activity.id, status: In([...OCCUPYING_STATUSES]) },
        });
        if (ocupados >= activity.capacity) {
          const msg = `La actividad alcanzó su cupo de ${activity.capacity} lugares.`;
          throw new ConflictException({ code: 'ACTIVITY_FULL', message: msg });
        }
      }
      return m.getRepository(ActivityRegistration).save(registration);
    });

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
        ? (externa ? AuditEventType.EXTERNAL_OPPORTUNITY_ACCEPTED : AuditEventType.REGISTRATION_ADMITTED)
        : status === RegistrationStatus.REJECTED
          ? AuditEventType.REGISTRATION_REJECTED
          : AuditEventType.PARTICIPATION_CONFIRMED,
      entityType: 'activity_registration',
      entityId: saved.id,
      metadata: {
        activityId: activity.id,
        studentProfileId,
        de: anterior,
        a: status,
        ...(status === RegistrationStatus.REJECTED ? { motivo: saved.decisionReason } : {}),
      },
    });

    // Si la oportunidad ya terminó, desde ahora puede adjuntar su credencial.
    if (status !== anterior) {
      await this.eligibility.announce(activity, [saved], confirmer.userId);
      // V3 §33 y V5 §6: cada aviso dice lo que pasó. Admitir no es asistir.
      const aviso: Record<string, { kind: string; title: string; body: string } | undefined> = {
        [RegistrationStatus.CONFIRMED]: {
          kind: 'PARTICIPATION_CONFIRMED',
          title: 'Asistencia registrada',
          body: `El responsable registró tu asistencia a «${activity.title}». Ya cuenta en tu trayectoria.`,
        },
        [RegistrationStatus.ACCEPTED]: {
          kind: 'ACTIVITY_REGISTRATION_ACCEPTED',
          title: externa ? 'Te aceptaron' : 'Inscripción admitida',
          body: externa
            ? `El proveedor te aceptó en «${activity.title}». Al terminar podrás adjuntar tu credencial.`
            : `Tienes un lugar en «${activity.title}». La asistencia la registra el responsable el día del evento.`,
        },
        [RegistrationStatus.REJECTED]: {
          kind: 'ACTIVITY_REGISTRATION_REJECTED',
          title: 'Inscripción no admitida',
          body: `Tu solicitud para «${activity.title}» no fue admitida: ${saved.decisionReason}`,
        },
      };
      const a = aviso[status];
      if (a) {
        try {
          await this.notifications.emit({
            userId: profile.userId,
            ...a,
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

  /** V4.1 A41-011: terminó el evento o ya hay una constancia autorizada. */
  private async participacionConsolidada(activity: Activity, registration: ActivityRegistration): Promise<boolean> {
    if (activity.status === ActivityStatus.FINISHED) return true;
    const constancia = await this.constancies.findOne({
      where: { studentProfileId: registration.studentProfileId, activityId: activity.id, status: ConstancyStatus.AUTHORIZED },
    });
    return !!constancia;
  }

  /**
   * V4.1 A41-011 (§5, B19): «Cerrar asistencia». Solo cuando el evento ya
   * terminó; después, el responsable no edita filas. El cierre no es automático.
   */
  async closeAttendance(user: AuthenticatedUser, activityId: string): Promise<Activity> {
    const activity = await this.findOne(activityId);
    if (user.role === RolNombre.ADMIN) {
      throw new ForbiddenException('La asistencia la cierra el responsable de la actividad.');
    }
    await this.assertCanManage(user, activity, 'Solo el responsable de la actividad cierra su asistencia.');
    if (activity.status !== ActivityStatus.FINISHED) {
      throw new ConflictException({
        code: 'ATTENDANCE_NOT_FINISHED',
        message: 'La asistencia se cierra cuando la actividad terminó. Antes, puedes seguir registrándola.',
      });
    }
    if (activity.attendanceStatus === 'locked') return activity;
    activity.attendanceStatus = 'locked';
    activity.attendanceClosedAt = new Date();
    activity.attendanceClosedById = user.userId;
    await this.activities.save(this.soloFila(activity));
    await this.audit.record({
      actorUserId: user.userId,
      eventType: AuditEventType.ATTENDANCE_CLOSED,
      entityType: 'activity',
      entityId: activity.id,
      metadata: { activityId: activity.id },
    });
    return this.findOne(activity.id);
  }

  /**
   * V4.1 A41-011 (§5, B18, 23.5): corrección excepcional de una participación,
   * solo Dirección o Administración, con motivo. Vale con el acta cerrada o la
   * participación consolidada, y reconcilia lo que dependía de ella: la
   * constancia, la trayectoria y la afinidad (recálculo) y los puntos (un
   * reverso o una restitución auditables en el historial; nada se borra).
   */
  async correctParticipation(
    user: AuthenticatedUser,
    activityId: string,
    studentProfileId: string,
    status: RegistrationStatus,
    reason: string,
  ): Promise<ActivityRegistration> {
    if (user.role !== RolNombre.ADMIN && user.role !== RolNombre.CAREER_DIRECTOR) {
      throw new ForbiddenException('Una corrección excepcional la hacen Dirección o Administración.');
    }
    const motivo = (reason ?? '').trim();
    if (motivo.length < 10) {
      const m = 'Explica el motivo de la corrección (al menos 10 caracteres): queda en la auditoría.';
      throw new BadRequestException({ message: m, fields: { reason: [m] } });
    }
    const permitidos = [RegistrationStatus.CONFIRMED, RegistrationStatus.ABSENT, RegistrationStatus.REGISTERED];
    if (!permitidos.includes(status)) {
      const m = 'La corrección deja la participación como confirmada, ausente o inscrita.';
      throw new BadRequestException({ message: m, fields: { status: [m] } });
    }
    const activity = await this.findOne(activityId);
    if (activity.originType === ActivityOrigin.EXTERNAL) {
      throw new BadRequestException('En una oportunidad externa no se confirma asistencia.');
    }
    if (activity.status === ActivityStatus.CANCELLED && status === RegistrationStatus.CONFIRMED) {
      throw new ConflictException({ code: 'ACTIVITY_CANCELLED', message: 'La actividad está cancelada: no se registra asistencia.' });
    }
    // V5 §6: ni una corrección registra asistencia a algo que no empezó.
    if (status !== RegistrationStatus.REGISTERED && !yaEmpezo(activity.eventDate, new Date(), this.toleranciaInicioMin())) {
      throw new ConflictException({
        code: 'ATTENDANCE_BEFORE_START',
        message: 'La actividad todavía no empezó: no hay asistencia que corregir.',
      });
    }
    const registration = await this.registrations.findOne({ where: { activityId, studentProfileId } });
    if (!registration) throw new NotFoundException('El estudiante no está inscrito en esta actividad.');
    const anterior = registration.status;
    if (anterior === status) return registration;
    if (status === RegistrationStatus.CONFIRMED && !OCCUPYING_STATUSES.includes(anterior)) {
      await this.assertConfirmCapacity(activity);
    }
    // Primero el movimiento de puntos: si fallara, no queda una corrección a medias.
    await this.ajustarPuntosParticipacion(registration, status === RegistrationStatus.CONFIRMED, motivo);
    registration.status = status;
    registration.confirmedById = user.userId;
    const saved = await this.registrations.save(registration);

    await this.sincronizarConstancia(activity, saved, user.userId);
    if (status === RegistrationStatus.CONFIRMED || anterior === RegistrationStatus.CONFIRMED) {
      await this.trajectory.requestRecalculation(studentProfileId);
    }
    await this.audit.record({
      actorUserId: user.userId,
      eventType: AuditEventType.PARTICIPATION_CORRECTED,
      entityType: 'activity_registration',
      entityId: saved.id,
      metadata: { activityId, studentProfileId, de: anterior, a: status, motivo, actaCerrada: activity.attendanceStatus === 'locked' },
    });
    const perfil = await this.profiles.findOne({ where: { id: studentProfileId } });
    if (perfil) {
      try {
        await this.notifications.emit({
          userId: perfil.userId,
          kind: 'PARTICIPATION_CONFIRMED',
          title: 'Se corrigió tu participación',
          body: `Dirección corrigió tu participación en «${activity.title}». Motivo: ${motivo}`,
          link: '/student/activities',
          entityType: 'activity_registration',
          entityId: saved.id,
          dedupeKey: `participation-correction:${saved.id}:${Date.now()}`,
        });
      } catch {
        // sin efecto sobre la operación
      }
    }
    return saved;
  }

  /**
   * Puntos de una participación corregida: si deja de estar confirmada y su
   * saldo neto es positivo, se agrega un reverso; si vuelve a confirmarse y
   * ya había sido revertida, una restitución. Cada movimiento queda en el
   * historial (`gamification_events`) con su motivo; nada se borra.
   */
  private async ajustarPuntosParticipacion(reg: ActivityRegistration, confirmada: boolean, motivo: string): Promise<void> {
    const repo = this.activities.manager.getRepository(GamificationEvent);
    const eventos = await repo.find({ where: { sourceEntityType: 'activity_registration', sourceEntityId: reg.id } });
    const original = eventos.find((e) => e.dedupeKey === `participacion:${reg.id}`);
    if (!original) return;
    const neto = eventos.reduce((s, e) => s + e.points, 0);
    let ajuste = 0;
    let clave = '';
    if (!confirmada && neto > 0) { ajuste = -neto; clave = `reverso:participacion:${reg.id}:${Date.now()}`; }
    if (confirmada && neto <= 0) { ajuste = original.points; clave = `restitucion:participacion:${reg.id}:${Date.now()}`; }
    if (ajuste === 0) return;
    await this.activities.manager.transaction(async (m) => {
      await m.getRepository(GamificationEvent).insert({
        studentProfileId: reg.studentProfileId,
        trigger: original.trigger,
        dedupeKey: clave.slice(0, 120),
        points: ajuste,
        reason: `${ajuste < 0 ? 'Reverso' : 'Restitución'} por corrección de participación: ${motivo}`.slice(0, 300),
        sourceEntityType: 'activity_registration',
        sourceEntityId: reg.id,
      });
      const fila = await m.getRepository(GamificationEvent)
        .createQueryBuilder('e')
        .select('COALESCE(SUM(e.points), 0)', 'total')
        .addSelect('COUNT(*)', 'cantidad')
        .where('e.student_profile_id = :p', { p: reg.studentProfileId })
        .getRawOne<{ total: string; cantidad: string }>();
      await m.getRepository(StudentPoints).upsert(
        { studentProfileId: reg.studentProfileId, totalPoints: Number(fila?.total ?? 0), eventsCount: Number(fila?.cantidad ?? 0) },
        ['studentProfileId'],
      );
    });
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
      decisionReason: r.decisionReason,
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

    // V3.2 §36: «Me interesa» es un favorito o recordatorio personal. Se puede
    // guardar aunque la actividad ya cerró o terminó; inscribirse, no.
    const soloGuardar = target === RegistrationStatus.INTERESTED
      && (activity.status === ActivityStatus.CLOSED || activity.status === ActivityStatus.FINISHED
        || (activity.eventDate !== null && activity.eventDate.getTime() < Date.now()));
    const blocked = soloGuardar ? null : this.registrationBlockReason(activity);
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

    if (registration && registration.status === RegistrationStatus.REJECTED) {
      throw new BadRequestException(
        `Tu solicitud no fue admitida${registration.decisionReason ? `: ${registration.decisionReason}` : '.'} `
        + 'Si crees que es un error, escribe al responsable.',
      );
    }
    if (
      registration && (registration.status === RegistrationStatus.CONFIRMED
        || registration.status === RegistrationStatus.ABSENT
        || (registration.status === RegistrationStatus.ACCEPTED && target === RegistrationStatus.INTERESTED))
    ) {
      throw new BadRequestException(
        'Su participación ya fue registrada por el responsable de la actividad.',
      );
    }
    if (registration && (registration.status === target
      || (target === RegistrationStatus.REGISTERED && registration.status === RegistrationStatus.ACCEPTED))) {
      throw new BadRequestException(
        target === RegistrationStatus.REGISTERED
          ? 'Ya está inscrito en esta actividad.'
          : 'Ya marcó interés en esta actividad.',
      );
    }

    // V5 §6.1: una interna abierta y sin cupo admite sola. No es asistencia:
    // la asistencia la registra el responsable cuando el evento ya empezó.
    const admitida = target === RegistrationStatus.REGISTERED && admisionAutomatica(activity);
    const estado = admitida ? RegistrationStatus.ACCEPTED : target;
    if (!registration) {
      registration = this.registrations.create({
        activityId: activity.id,
        studentProfileId: profile.id,
        status: estado,
      });
    } else {
      registration.status = estado;
    }
    registration.acceptedAt = admitida ? new Date() : null;
    registration.decisionReason = null;
    const guardada = await this.registrations.save(registration);
    if (target === RegistrationStatus.REGISTERED) {
      await this.audit.record({
        actorUserId: userId,
        eventType: AuditEventType.ACTIVITY_REGISTERED,
        entityType: 'activity_registration',
        entityId: guardada.id,
        metadata: { activityId: activity.id, studentProfileId: profile.id, admisionAutomatica: admitida },
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

    // V4.1 A41-010 (§4.6, B14/B15): reabrir inscripciones dice por qué no se puede.
    if (activity.status === ActivityStatus.CLOSED && next === ActivityStatus.OPEN) {
      if (activity.eventDate && activity.eventDate.getTime() <= Date.now()) {
        const msg = 'La actividad ya empezó: para reabrir inscripciones cambia antes la fecha de inicio a una futura.';
        throw new BadRequestException({ message: msg, code: 'ACTIVITY_REOPEN_STARTED', fields: { status: [msg] } });
      }
      if (activity.capacity) {
        const ocupados = await this.registrations.count({
          where: { activityId: activity.id, status: In([...OCCUPYING_STATUSES]) },
        });
        if (ocupados >= activity.capacity) {
          const msg = 'El cupo está completo: amplía el cupo o libera lugares antes de reabrir inscripciones.';
          throw new BadRequestException({ message: msg, code: 'ACTIVITY_REOPEN_FULL', fields: { status: [msg] } });
        }
      }
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
    // V3.2 §24 (C9): un borrador ajeno no se gestiona ni se ve.
    if (!(await this.veBorrador(user, activity))) return false;
    if (user.role === RolNombre.ADMIN) return true;
    if (activity.creatorId === user.userId) return true;
    if (activity.responsibleUserId === user.userId) return true;
    // V3.2 §16: cualquiera de sus responsables la gestiona.
    if (await this.esResponsable(activity.id, user.userId)) return true;
    // V3.2 §26: Dirección ajusta y da seguimiento a las de la carrera.
    if (user.role === RolNombre.CAREER_DIRECTOR) return true;
    // V3.2 §25: el docente gestiona lo que creó o lo que le asignaron; lo
    // demás de su semestre lo consulta en «Actividades de la carrera».
    if (user.role === RolNombre.TEACHER) return false;
    return activity.status !== ActivityStatus.DRAFT && OWNER_ROLE_BY_TYPE[activity.type] === user.role;
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
            decisionReason: propia.decisionReason,
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
    const responsableDe = new Set(
      (await this.activities.manager.getRepository(ActivityResponsible).find({ where: { userId: user.userId } }))
        .map((r) => r.activityId),
    );
    // V3.2 §25: «Mis actividades» = lo que creó o le asignaron.
    const propia = (a: Activity) =>
      a.creatorId === user.userId || a.responsibleUserId === user.userId || responsableDe.has(a.id);
    const gestiona = (a: Activity): boolean => {
      if (propia(a)) return true;
      // V4.1 A41-008 (§4.3): lo que otro envió a revisión está en la bandeja de
      // Dirección, no en su gestión, hasta que se aprueba; no es «suyo».
      if (user.role === RolNombre.ADMIN || user.role === RolNombre.CAREER_DIRECTOR) {
        return !a.requiresReview || a.reviewStatus === ActivityReviewStatus.APPROVED;
      }
      if (user.role === RolNombre.TEACHER) return false;
      return a.status !== ActivityStatus.DRAFT && OWNER_ROLE_BY_TYPE[a.type] === user.role;
    };
    const visibles: Activity[] = [];
    for (const a of activities) {
      // V3.2 §24 (C9): el borrador de otro no aparece en ninguna lista.
      if (!(await this.veBorrador(user, a, responsableDe))) continue;
      if (incluirPublicadas ? (a.status !== ActivityStatus.DRAFT || gestiona(a)) : gestiona(a)) visibles.push(a);
    }
    return visibles;
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
    // V3.2 §38: end_at > start_at, con el error en su campo (§6.4).
    if (new Date(fin).getTime() <= new Date(inicio).getTime()) {
      const msg = 'La fecha final debe ser posterior a la fecha inicial.';
      throw new BadRequestException({ message: msg, fields: { endAt: [msg] } });
    }
  }

  /**
   * Reemplaza las habilidades declaradas de una actividad (§73.3), cada una
   * con el área en que se trabaja (V3.2 §11.4).
   */
  private async replaceSkills(activityId: string, contextos: SkillContext[], m: EntityManager = this.activities.manager): Promise<void> {
    const unicas = [...new Map(contextos.map((c) => [c.skillId, c])).values()];
    if (unicas.length > 0) {
      const existen = await m.getRepository(Skill).count({ where: { id: In(unicas.map((c) => c.skillId)) } });
      if (existen !== unicas.length) {
        throw new BadRequestException('Alguna de las habilidades indicadas no existe.');
      }
    }
    const repo = m.getRepository(ActivitySkill);
    await repo.delete({ activityId });
    if (unicas.length > 0) {
      await repo.insert(unicas.map((c) => ({ activityId, skillId: c.skillId, academicAreaId: c.areaId })));
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
