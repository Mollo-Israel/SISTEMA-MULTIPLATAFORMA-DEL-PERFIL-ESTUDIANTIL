import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EvidenceType, RolNombre, ValidationResourceType } from '@perfil/shared';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { FILES_ROUTE } from '../storage/local-storage.driver';
import { UploadsService } from '../storage/uploads.service';
import { ValidationService } from '../validation/validation.service';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import {
  AFFINITY_RECALCULATION,
  AffinityRecalculationPort,
} from '../affinity-recalc/affinity-recalculation.port';

@Injectable()
export class EvidencesService {
  constructor(
    @InjectRepository(ProjectEvidence) private readonly evidences: Repository<ProjectEvidence>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember) private readonly members: Repository<ProjectMember>,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(ActivityRegistration)
    private readonly registrations: Repository<ActivityRegistration>,
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    private readonly uploads: UploadsService,
    private readonly validation: ValidationService,
    @Inject(AFFINITY_RECALCULATION)
    private readonly affinityRecalculation: AffinityRecalculationPort,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateEvidenceDto): Promise<ProjectEvidence> {
    const profile = await this.requireProfile(user.userId);
    this.assertPayloadMatchesType(dto);

    if (dto.projectId) await this.assertProjectAccess(user, dto.projectId);
    if (dto.activityId) await this.assertActivityParticipation(profile.id, dto.activityId);
    if (dto.academicAreaId) await this.assertAreaExists(dto.academicAreaId);

    // §27: los metadatos del archivo los pone el servidor a partir del
    // registro, no el cliente. Y solo si el archivo es de quien lo adjunta.
    const archivo = dto.evidenceType === EvidenceType.FILE && dto.storedFileId
      ? await this.uploads.requireOwned(user.userId, dto.storedFileId)
      : null;

    const evidence = this.evidences.create({
      studentProfileId: profile.id,
      projectId: dto.projectId ?? null,
      activityId: dto.activityId ?? null,
      academicAreaId: dto.academicAreaId ?? null,
      evidenceType: dto.evidenceType,
      description: dto.description ?? null,
      externalUrl: dto.evidenceType === EvidenceType.LINK ? (dto.externalUrl ?? null) : null,
      storedFileId: archivo?.id ?? null,
      fileUrl: archivo ? `${FILES_ROUTE}/${archivo.storageKey}` : null,
      fileName: archivo?.originalFilename ?? null,
      mimeType: archivo?.mimeTypeDetected ?? null,
      fileSize: archivo?.sizeBytes ?? null,
    });

    const saved = await this.evidences.save(evidence);

    // §26: la validacion va aparte y puede tardar. Encolar no bloquea al
    // estudiante ni condiciona que la evidencia exista.
    await this.validation.enqueue({
      resourceType: ValidationResourceType.PROJECT_EVIDENCE,
      resourceId: saved.id,
    });

    await this.affinityRecalculation.requestRecalculation(profile.id);
    return this.findOneOrFail(saved.id);
  }

  async findMine(userId: string): Promise<ProjectEvidence[]> {
    const profile = await this.requireProfile(userId);
    return this.evidences.find({
      where: { studentProfileId: profile.id },
      relations: { project: true, activity: true, academicArea: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Elimina la evidencia y, si era un archivo subido, tambien el archivo del
   * almacenamiento: no se dejan huerfanos en disco.
   */
  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const evidence = await this.requireOwned(user, id);
    const storedFileId = evidence.storedFileId;
    const profileId = evidence.studentProfileId;

    await this.evidences.delete(evidence.id);
    if (storedFileId) {
      await this.uploads.remove(storedFileId);
    }
    await this.affinityRecalculation.requestRecalculation(profileId);
  }

  private assertPayloadMatchesType(dto: CreateEvidenceDto): void {
    if (dto.evidenceType === EvidenceType.LINK && !dto.externalUrl) {
      throw new BadRequestException('Una evidencia de tipo enlace requiere externalUrl.');
    }
    if (dto.evidenceType === EvidenceType.FILE && !dto.storedFileId) {
      throw new BadRequestException(
        'Una evidencia de tipo archivo requiere storedFileId. '
        + 'Suba primero el archivo en POST /uploads y use el id que devuelve.',
      );
    }
  }

  private async findOneOrFail(id: string): Promise<ProjectEvidence> {
    const evidence = await this.evidences.findOne({
      where: { id },
      relations: { project: true, activity: true, academicArea: true },
    });
    if (!evidence) {
      throw new NotFoundException('Evidencia no encontrada.');
    }
    return evidence;
  }

  private async requireOwned(user: AuthenticatedUser, id: string): Promise<ProjectEvidence> {
    const evidence = await this.evidences.findOne({
      where: { id },
      relations: { studentProfile: true },
    });
    if (!evidence) {
      throw new NotFoundException('Evidencia no encontrada.');
    }
    if (user.role === RolNombre.ADMIN) return evidence;
    if (evidence.studentProfile?.userId !== user.userId) {
      throw new ForbiddenException('Solo el propietario puede gestionar esta evidencia.');
    }
    return evidence;
  }

  private async requireProfile(userId: string): Promise<StudentProfile> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new BadRequestException(
        'Debe crear su perfil estudiantil antes de registrar evidencias.',
      );
    }
    return profile;
  }

  /** Solo el creador o un integrante puede adjuntar evidencia a un proyecto. */
  private async assertProjectAccess(user: AuthenticatedUser, projectId: string): Promise<void> {
    const project = await this.projects.findOne({
      where: { id: projectId },
      relations: { createdByProfile: true },
    });
    if (!project) {
      throw new BadRequestException('El proyecto indicado no existe.');
    }
    if (user.role === RolNombre.ADMIN) return;
    if (project.createdByProfile?.userId === user.userId) return;
    const isMember = await this.members.exists({
      where: { projectId, userId: user.userId },
    });
    if (!isMember) {
      throw new ForbiddenException(
        'Solo el creador o un integrante del proyecto puede adjuntar evidencias.',
      );
    }
  }

  /**
   * Solo se adjunta evidencia a una actividad en la que el estudiante participa:
   * de lo contrario cualquiera podria respaldar actividades ajenas.
   */
  private async assertActivityParticipation(
    studentProfileId: string,
    activityId: string,
  ): Promise<void> {
    const exists = await this.activities.exists({ where: { id: activityId } });
    if (!exists) {
      throw new BadRequestException('La actividad indicada no existe.');
    }
    const registration = await this.registrations.exists({
      where: { activityId, studentProfileId },
    });
    if (!registration) {
      throw new BadRequestException(
        'Solo puede adjuntar evidencia de actividades en las que se inscribió.',
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
