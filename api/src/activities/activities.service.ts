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

const REGISTRABLE_STATUSES = [ActivityStatus.PUBLISHED, ActivityStatus.OPEN];
const CONFIRMER_ROLES = [
  RolNombre.TEACHER,
  RolNombre.SCIENTIFIC_SOCIETY,
  RolNombre.ADMIN,
];

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
    return this.activities.save(activity);
  }

  async findAll(user: AuthenticatedUser, filters: FindOptionsWhere<Activity>): Promise<Activity[]> {
    const where: FindOptionsWhere<Activity> = { ...filters };
    const activities = await this.activities.find({
      where,
      relations: { academicArea: true },
      order: { createdAt: 'DESC' },
    });
    if (user.role === RolNombre.STUDENT) {
      return activities.filter((a) => a.status !== ActivityStatus.DRAFT);
    }
    return activities;
  }

  async findOne(id: string): Promise<Activity> {
    const activity = await this.activities.findOne({
      where: { id },
      relations: { academicArea: true },
    });
    if (!activity) {
      throw new NotFoundException('Actividad no encontrada.');
    }
    return activity;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateActivityDto): Promise<Activity> {
    const activity = await this.findOne(id);
    if (activity.creatorId !== user.userId && user.role !== RolNombre.ADMIN) {
      throw new ForbiddenException('Solo el creador o un administrador puede modificar la actividad.');
    }
    if (dto.type) {
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
    if (dto.status !== undefined) activity.status = dto.status;

    return this.activities.save(activity);
  }

  registerInterest(userId: string, activityId: string): Promise<ActivityRegistration> {
    return this.upsertRegistration(userId, activityId, RegistrationStatus.INTERESTED);
  }

  register(userId: string, activityId: string): Promise<ActivityRegistration> {
    return this.upsertRegistration(userId, activityId, RegistrationStatus.REGISTERED);
  }

  async confirmParticipation(
    confirmer: AuthenticatedUser,
    activityId: string,
    studentProfileId: string,
    status: RegistrationStatus,
  ): Promise<ActivityRegistration> {
    if (!CONFIRMER_ROLES.includes(confirmer.role)) {
      throw new ForbiddenException('Su rol no puede confirmar participación.');
    }
    const activity = await this.findOne(activityId);
    const profile = await this.profiles.findOne({ where: { id: studentProfileId } });
    if (profile && profile.userId === confirmer.userId) {
      throw new ForbiddenException('No puede confirmar su propia participación.');
    }
    const registration = await this.registrations.findOne({
      where: { activityId: activity.id, studentProfileId },
    });
    if (!registration) {
      throw new NotFoundException('El estudiante no tiene una solicitud en esta actividad.');
    }

    // Al aprobar (confirmar) se valida el cupo: solo cuentan los confirmados.
    if (status === RegistrationStatus.CONFIRMED && registration.status !== RegistrationStatus.CONFIRMED) {
      await this.assertConfirmCapacity(activity);
    }

    registration.status = status;
    registration.confirmedById = confirmer.userId;
    const saved = await this.registrations.save(registration);

    if (status === RegistrationStatus.CONFIRMED) {
      await this.affinityRecalculation.requestRecalculation(studentProfileId);
    }
    return saved;
  }

  async getParticipants(activityId: string): Promise<ActivityRegistration[]> {
    await this.findOne(activityId);
    return this.registrations.find({
      where: { activityId },
      relations: { studentProfile: { user: true } },
      order: { createdAt: 'ASC' },
    });
  }

  private async upsertRegistration(
    userId: string,
    activityId: string,
    target: RegistrationStatus,
  ): Promise<ActivityRegistration> {
    const activity = await this.findOne(activityId);
    if (!REGISTRABLE_STATUSES.includes(activity.status)) {
      throw new BadRequestException('La actividad no está abierta para registro.');
    }
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new BadRequestException('Debe crear su perfil estudiantil antes de registrarse.');
    }

    let registration = await this.registrations.findOne({
      where: { activityId: activity.id, studentProfileId: profile.id },
    });

    // Inscribirse (REGISTERED) solo crea una SOLICITUD pendiente; el cupo se
    // controla al aprobar (confirmar). No se bloquea por cupo al solicitar.

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
      throw new BadRequestException('La participación ya fue gestionada por un responsable.');
    } else {
      registration.status = target;
    }
    return this.registrations.save(registration);
  }

  // El cupo se controla por participantes CONFIRMADOS (aprobados).
  private async assertConfirmCapacity(activity: Activity): Promise<void> {
    if (!activity.capacity) return;
    const confirmed = await this.registrations.count({
      where: { activityId: activity.id, status: RegistrationStatus.CONFIRMED },
    });
    if (confirmed >= activity.capacity) {
      throw new BadRequestException('La actividad alcanzó su cupo máximo de confirmados.');
    }
  }

  private assertCanPublish(role: RolNombre, type: ActivityType): void {
    const allowed =
      type === ActivityType.ACADEMICA
        ? [RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN]
        : [RolNombre.SCIENTIFIC_SOCIETY, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN];
    if (!allowed.includes(role)) {
      throw new ForbiddenException(
        `Su rol no puede publicar actividades de tipo ${type}.`,
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
