import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  ActivityStatus,
  ActivityType,
  ConstancyStatus,
  RegistrationStatus,
  RolNombre,
} from '@perfil/shared';
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

/** Actor institucional responsable de cada tipo de actividad. */
const OWNER_ROLE_BY_TYPE: Record<ActivityType, RolNombre> = {
  [ActivityType.ACADEMICA]: RolNombre.CAREER_DIRECTOR,
  [ActivityType.EXTRACURRICULAR]: RolNombre.SCIENTIFIC_SOCIETY,
};

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

    const activity = await this.activities.findOne({
      where: { id: dto.activityId },
      relations: { creator: { role: true } },
    });
    if (!activity) {
      throw new BadRequestException('La actividad indicada no existe.');
    }
    this.assertActivityAuthorized(activity);

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

  /**
   * "Actividad autorizada por la carrera" (RN-11, Tabla 2.21, Figura 2.24).
   *
   * El documento exige que la constancia solo se emita sobre una actividad
   * autorizada, pero no define un tramite de autorizacion aparte ni un actor que
   * la conceda. Para este proyecto una actividad esta autorizada cuando:
   *
   *   1. fue publicada, es decir salio de borrador y no esta cancelada; y
   *   2. la gestiona el actor institucional que corresponde a su tipo:
   *      academica -> director de carrera, extracurricular -> sociedad
   *      cientifica, o el administrador como soporte.
   *
   * Es una condicion derivada de datos que ya existen, no un modulo nuevo:
   * publicar una actividad siendo el responsable de su tipo ES el acto de
   * autorizacion dentro del alcance del sistema.
   */
  private assertActivityAuthorized(activity: Activity): void {
    if (activity.status === ActivityStatus.DRAFT) {
      throw new BadRequestException(
        'La actividad está en borrador: no está autorizada para emitir constancias.',
      );
    }
    if (activity.status === ActivityStatus.CANCELLED) {
      throw new BadRequestException(
        'La actividad fue cancelada: no está autorizada para emitir constancias.',
      );
    }

    const creatorRole = activity.creator?.role?.name;
    if (!creatorRole) {
      throw new BadRequestException(
        'No se pudo determinar el responsable de la actividad; no está autorizada.',
      );
    }
    const expected = OWNER_ROLE_BY_TYPE[activity.type];
    if (creatorRole !== expected && creatorRole !== RolNombre.ADMIN) {
      const quien =
        expected === RolNombre.CAREER_DIRECTOR
          ? 'el director de carrera'
          : 'la sociedad científica';
      throw new BadRequestException(
        `La actividad no sigue el flujo institucional que le corresponde: las actividades ${
          activity.type === ActivityType.ACADEMICA ? 'académicas' : 'extracurriculares'
        } las gestiona ${quien}.`,
      );
    }
  }

  /** Candidatos a constancia: participaciones confirmadas sin constancia previa. */
  async findEligible(activityId: string) {
    const activity = await this.activities.findOne({
      where: { id: activityId },
      relations: { creator: { role: true } },
    });
    if (!activity) {
      throw new NotFoundException('Actividad no encontrada.');
    }
    // Si la actividad no esta autorizada, no se ofrecen candidatos: la interfaz
    // recibe el motivo en lugar de una lista que luego seria rechazada.
    this.assertActivityAuthorized(activity);
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
