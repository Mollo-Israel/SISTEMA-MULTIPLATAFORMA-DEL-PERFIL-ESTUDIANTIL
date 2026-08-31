import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ConstancyStatus, RegistrationStatus } from '@perfil/shared';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { TeacherScopeService } from '../access/teacher-scope.service';
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
    private readonly teacherScope: TeacherScopeService,
    @Inject(AFFINITY_RECALCULATION)
    private readonly affinityRecalculation: AffinityRecalculationPort,
  ) {}

  /**
   * Emision de una constancia interna (RF12).
   *
   * Solo la emite el director de carrera. Requiere que exista la actividad, que
   * el estudiante tenga participacion CONFIRMADA en ella y que no exista ya una
   * constancia para ese par estudiante-actividad.
   *
   * ALCANCE: es una constancia interna del sistema. No sustituye ni equivale a
   * un certificado oficial de la universidad.
   */
  async create(
    authorizer: AuthenticatedUser,
    dto: CreateInternalConstancyDto,
  ): Promise<InternalConstancy> {
    const profile = await this.profiles.findOne({ where: { id: dto.profileId } });
    if (!profile) {
      throw new BadRequestException('El perfil del estudiante no existe.');
    }

    const activity = await this.activities.findOne({ where: { id: dto.activityId } });
    if (!activity) {
      throw new BadRequestException('La actividad indicada no existe.');
    }

    const registration = await this.registrations.findOne({
      where: { activityId: dto.activityId, studentProfileId: dto.profileId },
    });
    if (!registration) {
      throw new BadRequestException(
        'El estudiante no tiene participación registrada en esta actividad.',
      );
    }
    if (registration.status !== RegistrationStatus.CONFIRMED) {
      throw new BadRequestException(
        'Solo se emite constancia cuando la participación del estudiante está confirmada.',
      );
    }

    const duplicate = await this.constancies.findOne({
      where: { studentProfileId: dto.profileId, activityId: dto.activityId },
    });
    if (duplicate) {
      throw new ConflictException(
        'Ya existe una constancia interna para este estudiante en esta actividad.',
      );
    }

    const constancy = this.constancies.create({
      studentProfileId: dto.profileId,
      activityId: dto.activityId,
      // La constancia queda anclada a la participacion concreta que la respalda.
      activityRegistrationId: registration.id,
      description: dto.description,
      status: dto.status ?? ConstancyStatus.AUTHORIZED,
      authorizedById: authorizer.userId,
    });
    const saved = await this.constancies.save(constancy);
    await this.affinityRecalculation.requestRecalculation(dto.profileId);
    return this.findOneOrFail(saved.id);
  }

  /** Candidatos a constancia: participaciones confirmadas sin constancia previa. */
  async findEligible(activityId: string) {
    const activity = await this.activities.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new NotFoundException('Actividad no encontrada.');
    }
    const confirmed = await this.registrations.find({
      where: { activityId, status: RegistrationStatus.CONFIRMED },
      relations: { studentProfile: { user: true } },
      order: { createdAt: 'ASC' },
    });
    const existing = await this.constancies.find({ where: { activityId } });
    const alreadyIssued = new Set(existing.map((c) => c.studentProfileId));

    return confirmed.map((r) => ({
      studentProfileId: r.studentProfileId,
      studentName: r.studentProfile?.user
        ? `${r.studentProfile.user.firstName} ${r.studentProfile.user.lastName}`
        : null,
      semester: r.studentProfile?.semester ?? null,
      registrationId: r.id,
      hasConstancy: alreadyIssued.has(r.studentProfileId),
    }));
  }

  async findMine(userId: string): Promise<InternalConstancy[]> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new BadRequestException('Aún no has creado tu perfil estudiantil.');
    }
    return this.constancies.find({
      where: { studentProfileId: profile.id },
      relations: { activity: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** Constancias de un estudiante, respetando el alcance por semestre. */
  async findByStudent(user: AuthenticatedUser, profileId: string): Promise<InternalConstancy[]> {
    await this.teacherScope.assertCanAccessProfile(user, profileId);
    return this.constancies.find({
      where: { studentProfileId: profileId },
      relations: { activity: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** Constancias emitidas para una actividad. */
  async findByActivity(activityId: string): Promise<InternalConstancy[]> {
    return this.constancies.find({
      where: { activityId },
      relations: { studentProfile: { user: true }, activity: true },
      order: { createdAt: 'DESC' },
    });
  }

  private async findOneOrFail(id: string): Promise<InternalConstancy> {
    const constancy = await this.constancies.findOne({
      where: { id },
      relations: { activity: true, studentProfile: { user: true } },
    });
    if (!constancy) {
      throw new NotFoundException('Constancia no encontrada.');
    }
    return constancy;
  }

  /** Constancias sin actividad asociada (no forman parte del flujo de RF12). */
  async findOrphans(): Promise<InternalConstancy[]> {
    return this.constancies.find({ where: { activityId: IsNull() } });
  }
}
