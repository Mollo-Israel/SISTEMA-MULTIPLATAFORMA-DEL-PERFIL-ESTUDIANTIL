import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateInternalConstancyDto } from './dto/create-internal-constancy.dto';
import {
  AFFINITY_RECALCULATION,
  AffinityRecalculationPort,
} from '../affinity-recalc/affinity-recalculation.port';

@Injectable()
export class ConstanciesService {
  constructor(
    @InjectRepository(InternalConstancy)
    private readonly constancies: Repository<InternalConstancy>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(ActivityRegistration)
    private readonly registrations: Repository<ActivityRegistration>,
    @Inject(AFFINITY_RECALCULATION)
    private readonly affinityRecalculation: AffinityRecalculationPort,
  ) {}

  async create(
    authorizer: AuthenticatedUser,
    dto: CreateInternalConstancyDto,
  ): Promise<InternalConstancy> {
    const profile = await this.profiles.findOne({ where: { id: dto.profileId } });
    if (!profile) {
      throw new BadRequestException('El perfil del estudiante no existe.');
    }
    if (dto.activityId) {
      const exists = await this.activities.exists({ where: { id: dto.activityId } });
      if (!exists) {
        throw new BadRequestException('La actividad indicada no existe.');
      }
    }
    if (dto.activityRegistrationId) {
      const registration = await this.registrations.findOne({
        where: { id: dto.activityRegistrationId },
      });
      if (!registration) {
        throw new BadRequestException('El registro de participación no existe.');
      }
      if (registration.studentProfileId !== dto.profileId) {
        throw new BadRequestException(
          'El registro de participación no pertenece a este estudiante.',
        );
      }
    }

    const constancy = this.constancies.create({
      studentProfileId: dto.profileId,
      activityId: dto.activityId ?? null,
      activityRegistrationId: dto.activityRegistrationId ?? null,
      description: dto.description,
      status: dto.status,
      authorizedById: authorizer.userId,
    });
    const saved = await this.constancies.save(constancy);
    await this.affinityRecalculation.requestRecalculation(dto.profileId);
    return saved;
  }

  async findMine(userId: string): Promise<InternalConstancy[]> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new BadRequestException('Aún no has creado tu perfil estudiantil.');
    }
    return this.constancies.find({
      where: { studentProfileId: profile.id },
      order: { createdAt: 'DESC' },
    });
  }

  async findByStudent(profileId: string): Promise<InternalConstancy[]> {
    const exists = await this.profiles.exists({ where: { id: profileId } });
    if (!exists) {
      throw new NotFoundException('Perfil no encontrado.');
    }
    return this.constancies.find({
      where: { studentProfileId: profileId },
      order: { createdAt: 'DESC' },
    });
  }
}
