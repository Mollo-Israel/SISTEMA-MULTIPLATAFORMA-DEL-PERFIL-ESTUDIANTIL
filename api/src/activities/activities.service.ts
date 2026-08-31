import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  ActivityStatus,
  ActivityType,
  RegistrationStatus,
  RolNombre,
} from '@perfil/shared';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import {
  AFFINITY_RECALCULATION,
  AffinityRecalculationPort,
} from '../affinity-recalc/affinity-recalculation.port';

/** Estados en los que un estudiante puede manifestar interes o inscribirse. */
const REGISTRABLE_STATUSES = [ActivityStatus.PUBLISHED, ActivityStatus.OPEN];

/**
 * Responsable de cada tipo de actividad segun el documento vigente:
 *   - Actividad academica      -> Director de carrera
 *   - Actividad extracurricular-> Representante de sociedad cientifica
 * El administrador conserva funciones de soporte sobre ambos tipos.
 */
const OWNER_ROLE_BY_TYPE: Record<ActivityType, RolNombre> = {
  [ActivityType.ACADEMICA]: RolNombre.CAREER_DIRECTOR,
  [ActivityType.EXTRACURRICULAR]: RolNombre.SCIENTIFIC_SOCIETY,
};

export interface ActivityWithCounts extends Activity {
  registrationCount: number;
  confirmedCount: number;
  seatsLeft: number | null;
  registrationBlockReason: string | null;
}

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(ActivityRegistration)
    private readonly registrations: Repository<ActivityRegistration>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    @Inject(AFFINITY_RECALCULATION)
    private readonly affinityRecalculation: AffinityRecalculationPort,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateActivityDto): Promise<Activity> {
    this.assertCanPublish(user.role, dto.type);
    if (dto.areaId) {
      await this.assertAreaExists(dto.areaId);
    }
    const activity = this.activities.create({
      title: dto.title,
      description: dto.description ?? null,
      type: dto.type,
      category: dto.category,
      modality: dto.modality,
      academicAreaId: dto.areaId ?? null,
      creatorId: user.userId,
      eventDate: dto.activityDate ? new Date(dto.activityDate) : null,
      location: dto.location ?? null,
      capacity: dto.capacity ?? null,
      tags: dto.tags ?? null,
      externalUrl: dto.externalUrl ?? null,
      evidenceRequired: dto.evidenceRequired ?? false,
      status: dto.status ?? ActivityStatus.DRAFT,
    });
    const saved = await this.activities.save(activity);
    return this.findOne(saved.id);
  }

  /**
   * Listado de actividades.
   * El estudiante nunca ve borradores. Los responsables ven, ademas de las
   * publicadas, sus propios borradores para poder terminarlos.
   */
  async findAll(
    user: AuthenticatedUser,
    filters: FindOptionsWhere<Activity>,
  ): Promise<ActivityWithCounts[]> {
    const activities = await this.activities.find({
      where: { ...filters },
      relations: { academicArea: true, creator: true },
      order: { eventDate: 'DESC', createdAt: 'DESC' },
    });

    const visible =
      user.role === RolNombre.STUDENT || user.role === RolNombre.TEACHER
        ? activities.filter((a) => a.status !== ActivityStatus.DRAFT)
        : activities.filter(
            (a) => a.status !== ActivityStatus.DRAFT || this.canManage(user, a),
          );

    return this.attachCounts(visible);
  }

  /** Actividades cuyo responsable es el usuario (panel de gestion). */
  async findManagedBy(user: AuthenticatedUser): Promise<ActivityWithCounts[]> {
    const activities = await this.activities.find({
      relations: { academicArea: true, creator: true },
      order: { createdAt: 'DESC' },
    });
    return this.attachCounts(activities.filter((a) => this.canManage(user, a)));
  }

  async findOne(id: string): Promise<Activity> {
    const activity = await this.activities.findOne({
      where: { id },
      relations: { academicArea: true, creator: true },
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
    this.assertCanManage(user, activity);

    if (dto.type && dto.type !== activity.type) {
      // Cambiar el tipo cambia el responsable: se valida con el tipo destino.
      this.assertCanPublish(user.role, dto.type);
      activity.type = dto.type;
    }
    if (dto.areaId !== undefined) {
      if (dto.areaId) await this.assertAreaExists(dto.areaId);
      activity.academicAreaId = dto.areaId ?? null;
    }
    if (dto.title !== undefined) activity.title = dto.title;
    if (dto.description !== undefined) activity.description = dto.description;
    if (dto.category !== undefined) activity.category = dto.category;
    if (dto.modality !== undefined) activity.modality = dto.modality;
    if (dto.activityDate !== undefined) {
      activity.eventDate = dto.activityDate ? new Date(dto.activityDate) : null;
    }
    if (dto.location !== undefined) activity.location = dto.location;
    if (dto.capacity !== undefined) activity.capacity = dto.capacity;
    if (dto.tags !== undefined) activity.tags = dto.tags;
    if (dto.externalUrl !== undefined) activity.externalUrl = dto.externalUrl;
    if (dto.evidenceRequired !== undefined) activity.evidenceRequired = dto.evidenceRequired;
    if (dto.status !== undefined) {
      await this.assertStatusTransition(activity, dto.status);
      activity.status = dto.status;
    }

    await this.activities.save(activity);
    return this.findOne(id);
  }

  registerInterest(userId: string, activityId: string): Promise<ActivityRegistration> {
    return this.upsertRegistration(userId, activityId, RegistrationStatus.INTERESTED);
  }

  register(userId: string, activityId: string): Promise<ActivityRegistration> {
    return this.upsertRegistration(userId, activityId, RegistrationStatus.REGISTERED);
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
    this.assertCanManage(
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

    registration.status = status;
    registration.confirmedById = confirmer.userId;
    const saved = await this.registrations.save(registration);

    // La participacion confirmada alimenta el perfil dinamico y la afinidad.
    if (status === RegistrationStatus.CONFIRMED) {
      await this.affinityRecalculation.requestRecalculation(studentProfileId);
    }
    return saved;
  }

  async getParticipants(user: AuthenticatedUser, activityId: string) {
    const activity = await this.findOne(activityId);
    this.assertCanManage(
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

  /** Una actividad con participantes confirmados no vuelve a borrador. */
  private async assertStatusTransition(activity: Activity, next: ActivityStatus): Promise<void> {
    if (next !== ActivityStatus.DRAFT || activity.status === ActivityStatus.DRAFT) return;
    const confirmed = await this.registrations.count({
      where: { activityId: activity.id, status: RegistrationStatus.CONFIRMED },
    });
    if (confirmed > 0) {
      throw new BadRequestException(
        'La actividad ya tiene participación confirmada: no puede volver a borrador.',
      );
    }
  }

  /**
   * Quien publica cada tipo de actividad (Objetivo 3).
   * El docente ya no publica actividades: su rol es de consulta y acompanamiento.
   */
  private assertCanPublish(role: RolNombre, type: ActivityType): void {
    if (role === RolNombre.ADMIN) return;
    if (OWNER_ROLE_BY_TYPE[type] !== role) {
      const quien =
        type === ActivityType.ACADEMICA
          ? 'el director de carrera'
          : 'el representante de la sociedad científica';
      throw new ForbiddenException(
        `Las actividades ${type === ActivityType.ACADEMICA ? 'académicas' : 'extracurriculares'} las gestiona ${quien}.`,
      );
    }
  }

  /**
   * Gestiona una actividad quien la creo, el administrador, o el rol
   * responsable de ese tipo de actividad (para que la gestion no dependa de
   * que siga en el cargo la misma persona que la publico).
   */
  private canManage(user: AuthenticatedUser, activity: Activity): boolean {
    if (user.role === RolNombre.ADMIN) return true;
    if (activity.creatorId === user.userId) return true;
    return OWNER_ROLE_BY_TYPE[activity.type] === user.role;
  }

  private assertCanManage(user: AuthenticatedUser, activity: Activity, message?: string): void {
    if (!this.canManage(user, activity)) {
      throw new ForbiddenException(
        message ??
          'Solo el responsable de este tipo de actividad o un administrador puede gestionarla.',
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

  private async assertAreaExists(areaId: string): Promise<void> {
    const exists = await this.areas.exists({ where: { id: areaId } });
    if (!exists) {
      throw new BadRequestException('El área académica no existe.');
    }
  }
}
