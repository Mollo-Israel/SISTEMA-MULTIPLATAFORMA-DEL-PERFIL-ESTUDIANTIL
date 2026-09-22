import {
  BadRequestException,
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
  ActivityStatus,
  ActivityType,
  canTransition,
  OCCUPYING_STATUSES,
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
import { Skill } from '../entities/skill.entity';
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
  myRegistration?: { id: string; status: RegistrationStatus } | null;
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
    @InjectRepository(Skill) private readonly skills: Repository<Skill>,
    @Inject(TRAJECTORY_RECALCULATION)
    private readonly trajectory: TrajectoryRecalculationPort,
    private readonly teacherScope: TeacherScopeService,
    private readonly audit: AuditService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateActivityDto): Promise<Activity> {
    this.assertCanPublish(user.role, dto.type);
    if (dto.areaId) {
      await this.assertAreaExists(dto.areaId);
    }
    await this.assertCategoryUsable(dto.categoryId, dto.type);

    // §22: un docente solo alcanza a sus semestres habilitados, y eso
    // incluye lo que declara al crear. Sin esto bastaria con publicar una
    // actividad para todo el 1.o al 8.o y quedar como su gestor.
    const semesterScope = await this.resolveSemesterScope(user, dto.semesterScope);
    this.assertDateWindow(dto.activityDate, dto.endAt);

    const activity = this.activities.create({
      title: dto.title,
      description: dto.description ?? null,
      type: dto.type,
      categoryId: dto.categoryId,
      modality: dto.modality,
      academicAreaId: dto.areaId ?? null,
      creatorId: user.userId,
      responsibleUserId: user.userId,
      eventDate: dto.activityDate ? new Date(dto.activityDate) : null,
      endAt: dto.endAt ? new Date(dto.endAt) : null,
      semesterScope,
      registrationMode: dto.registrationMode ?? RegistrationMode.OPEN,
      requirements: dto.requirements ?? null,
      location: dto.location ?? null,
      capacity: dto.capacity ?? null,
      tags: dto.tags ?? null,
      externalUrl: dto.externalUrl ?? null,
      evidenceRequired: dto.evidenceRequired ?? false,
      status: dto.status ?? ActivityStatus.DRAFT,
    });
    const saved = await this.activities.save(activity);

    if (dto.skillIds?.length) {
      await this.replaceSkills(saved.id, dto.skillIds);
    }

    await this.audit.record({
      actorUserId: user.userId,
      eventType: AuditEventType.ACTIVITY_CREATED,
      entityType: 'activity',
      entityId: saved.id,
      metadata: { type: dto.type, status: saved.status, semesterScope },
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
  ): Promise<ActivityWithCounts[]> {
    const where: FindOptionsWhere<Activity> = {};
    if (filters.type) where.type = filters.type;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.status) where.status = filters.status;
    if (filters.modality) where.modality = filters.modality;
    if (filters.areaId) where.academicAreaId = filters.areaId;

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
      relations: { academicArea: true, creator: true, category: true },
      order: { eventDate: 'DESC', createdAt: 'DESC' },
    });

    // El estudiante nunca ve borradores. El resto ve los suyos, y como
    // «los suyos» depende ahora del alcance, hay que resolverlo por fila.
    const visible = user.role === RolNombre.STUDENT
      ? activities.filter((a) => a.status !== ActivityStatus.DRAFT)
      : await this.filtrarGestionables(user, activities, { incluirPublicadas: true });

    const conConteos = await this.attachCounts(visible);
    return user.role === RolNombre.STUDENT
      ? this.attachMyRegistration(user.userId, conConteos)
      : conConteos;
  }

  /** Actividades cuyo responsable es el usuario (panel de gestion). */
  async findManagedBy(user: AuthenticatedUser): Promise<ActivityWithCounts[]> {
    const activities = await this.activities.find({
      relations: { academicArea: true, creator: true, category: true },
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
      },
    });
    if (!activity) {
      throw new NotFoundException('Actividad no encontrada.');
    }
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
      where: { activityId: activity.id, status: RegistrationStatus.CONFIRMED },
    });

    return {
      ...activity,
      myRegistration: registration
        ? { id: registration.id, status: registration.status }
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

    if (dto.type && dto.type !== activity.type) {
      // Cambiar el tipo cambia el responsable: se valida con el tipo destino.
      this.assertCanPublish(user.role, dto.type);
      activity.type = dto.type;
    }
    if (dto.areaId !== undefined) {
      if (dto.areaId) await this.assertAreaExists(dto.areaId);
      activity.academicAreaId = dto.areaId ?? null;
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
    if (dto.externalUrl !== undefined) activity.externalUrl = dto.externalUrl;
    if (dto.evidenceRequired !== undefined) activity.evidenceRequired = dto.evidenceRequired;
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

    if (dto.status !== undefined && dto.status !== estadoAnterior) {
      await this.audit.record({
        actorUserId: user.userId,
        eventType: AuditEventType.ACTIVITY_STATUS_CHANGED,
        entityType: 'activity',
        entityId: activity.id,
        metadata: { de: estadoAnterior, a: dto.status },
      });
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

    // El cupo se controla al aprobar: solo los confirmados ocupan lugar.
    if (
      status === RegistrationStatus.CONFIRMED &&
      registration.status !== RegistrationStatus.CONFIRMED
    ) {
      await this.assertConfirmCapacity(activity);
    }

    const anterior = registration.status;
    registration.status = status;
    registration.confirmedById = confirmer.userId;
    const saved = await this.registrations.save(registration);

    // §23: confirmar dispara trayectoria, afinidad, recomendaciones,
    // gamificación y auditoría. Las tres primeras cuelgan del recálculo;
    // la auditoría se registra aquí porque es la decisión de una persona
    // sobre otra y debe quedar constancia de quién la tomó.
    if (status === RegistrationStatus.CONFIRMED) {
      await this.trajectory.requestRecalculation(studentProfileId);
    }

    await this.audit.record({
      actorUserId: confirmer.userId,
      eventType: AuditEventType.PARTICIPATION_CONFIRMED,
      entityType: 'activity_registration',
      entityId: saved.id,
      metadata: {
        activityId: activity.id,
        studentProfileId,
        de: anterior,
        a: status,
      },
    });

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
    return this.registrations.save(registration);
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
      where: { activityId: activity.id, status: RegistrationStatus.CONFIRMED },
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
        where: { activityId: activity.id, status: RegistrationStatus.CONFIRMED },
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
        myRegistration: propia ? { id: propia.id, status: propia.status } : null,
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
      if (row.status === RegistrationStatus.CONFIRMED) entry.confirmed += total;
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
