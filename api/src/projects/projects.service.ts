import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EvidenceType, RolNombre } from '@perfil/shared';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { User } from '../entities/user.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { AddEvidenceDto } from './dto/add-evidence.dto';
import {
  AFFINITY_RECALCULATION,
  AffinityRecalculationPort,
} from '../affinity-recalc/affinity-recalculation.port';

const VIEWER_ROLES = [RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN];

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember) private readonly members: Repository<ProjectMember>,
    @InjectRepository(ProjectEvidence) private readonly evidences: Repository<ProjectEvidence>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(AFFINITY_RECALCULATION)
    private readonly affinityRecalculation: AffinityRecalculationPort,
  ) {}

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    const profile = await this.requireProfile(userId);
    if (dto.areaId) {
      await this.assertAreaExists(dto.areaId);
    }
    const project = this.projects.create({
      title: dto.title,
      description: dto.description ?? null,
      academicAreaId: dto.areaId ?? null,
      technologies: dto.technologies ?? null,
      status: dto.status,
      repositoryUrl: dto.repositoryUrl ?? null,
      demoUrl: dto.demoUrl ?? null,
      createdByProfileId: profile.id,
    });
    const saved = await this.projects.save(project);
    await this.affinityRecalculation.requestRecalculation(profile.id);
    return this.findOneOrFail(saved.id);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOneOrFail(id);
    await this.assertIsOwner(user, project);
    if (dto.areaId !== undefined) {
      if (dto.areaId) await this.assertAreaExists(dto.areaId);
      project.academicAreaId = dto.areaId ?? null;
    }
    if (dto.title !== undefined) project.title = dto.title;
    if (dto.description !== undefined) project.description = dto.description;
    if (dto.technologies !== undefined) project.technologies = dto.technologies;
    if (dto.status !== undefined) project.status = dto.status;
    if (dto.repositoryUrl !== undefined) project.repositoryUrl = dto.repositoryUrl;
    if (dto.demoUrl !== undefined) project.demoUrl = dto.demoUrl;

    await this.projects.save(project);
    await this.affinityRecalculation.requestRecalculation(project.createdByProfileId);
    return this.findOneOrFail(id);
  }

  async findMine(userId: string): Promise<Project[]> {
    const profile = await this.requireProfile(userId);
    const memberships = await this.members.find({ where: { userId } });
    const memberProjectIds = memberships.map((m) => m.projectId);

    const owned = await this.projects.find({
      where: { createdByProfileId: profile.id },
      relations: { academicArea: true, members: true, evidences: true },
      order: { createdAt: 'DESC' },
    });
    const ownedIds = new Set(owned.map((p) => p.id));
    const extraIds = memberProjectIds.filter((pid) => !ownedIds.has(pid));
    const memberProjects = extraIds.length
      ? await this.projects.find({
          where: { id: In(extraIds) },
          relations: { academicArea: true, members: true, evidences: true },
        })
      : [];
    return [...owned, ...memberProjects];
  }

  async findOneForUser(user: AuthenticatedUser, id: string): Promise<Project> {
    const project = await this.findOneOrFail(id);
    if (VIEWER_ROLES.includes(user.role)) {
      return project;
    }
    const isOwner = project.createdByProfile?.userId === user.userId;
    const isMember = project.members?.some((m) => m.userId === user.userId);
    if (!isOwner && !isMember) {
      throw new ForbiddenException('No tiene acceso a este proyecto.');
    }
    return project;
  }

  async addMember(user: AuthenticatedUser, id: string, dto: AddMemberDto): Promise<ProjectMember> {
    const project = await this.findOneOrFail(id);
    await this.assertIsOwner(user, project);

    const exists = await this.users.exists({ where: { id: dto.userId } });
    if (!exists) {
      throw new BadRequestException('El usuario integrante no existe.');
    }
    let member = await this.members.findOne({
      where: { projectId: project.id, userId: dto.userId },
    });
    if (member) {
      member.role = dto.role ?? member.role;
      member.contribution = dto.contribution ?? member.contribution;
    } else {
      member = this.members.create({
        projectId: project.id,
        userId: dto.userId,
        role: dto.role ?? null,
        contribution: dto.contribution ?? null,
      });
    }
    const saved = await this.members.save(member);
    await this.affinityRecalculation.requestRecalculation(project.createdByProfileId);
    return saved;
  }

  async addEvidence(user: AuthenticatedUser, id: string, dto: AddEvidenceDto): Promise<ProjectEvidence> {
    const project = await this.findOneOrFail(id);
    await this.assertOwnerOrMember(user, project);

    if (dto.evidenceType === EvidenceType.FILE && !dto.fileUrl) {
      throw new BadRequestException('Debe indicar fileUrl para una evidencia de tipo file.');
    }
    if (dto.evidenceType === EvidenceType.LINK && !dto.externalUrl) {
      throw new BadRequestException('Debe indicar externalUrl para una evidencia de tipo link.');
    }
    const evidence = this.evidences.create({
      projectId: project.id,
      evidenceType: dto.evidenceType,
      description: dto.description ?? null,
      fileUrl: dto.fileUrl ?? null,
      externalUrl: dto.externalUrl ?? null,
    });
    const saved = await this.evidences.save(evidence);
    await this.affinityRecalculation.requestRecalculation(project.createdByProfileId);
    return saved;
  }

  async removeEvidence(user: AuthenticatedUser, id: string, evidenceId: string): Promise<void> {
    const project = await this.findOneOrFail(id);
    await this.assertIsOwner(user, project);
    const evidence = await this.evidences.findOne({
      where: { id: evidenceId, projectId: project.id },
    });
    if (!evidence) {
      throw new NotFoundException('Evidencia no encontrada en este proyecto.');
    }
    await this.evidences.delete(evidence.id);
    await this.affinityRecalculation.requestRecalculation(project.createdByProfileId);
  }

  private async findOneOrFail(id: string): Promise<Project> {
    const project = await this.projects.findOne({
      where: { id },
      relations: { academicArea: true, members: true, evidences: true, createdByProfile: true },
    });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }
    return project;
  }

  private async requireProfile(userId: string): Promise<StudentProfile> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new BadRequestException('Debe crear su perfil estudiantil antes de registrar proyectos.');
    }
    return profile;
  }

  private async assertIsOwner(user: AuthenticatedUser, project: Project): Promise<void> {
    if (user.role === RolNombre.ADMIN) return;
    if (project.createdByProfile?.userId !== user.userId) {
      throw new ForbiddenException('Solo el creador del proyecto puede realizar esta acción.');
    }
  }

  private async assertOwnerOrMember(user: AuthenticatedUser, project: Project): Promise<void> {
    if (user.role === RolNombre.ADMIN) return;
    const isOwner = project.createdByProfile?.userId === user.userId;
    const isMember = project.members?.some((m) => m.userId === user.userId);
    if (!isOwner && !isMember) {
      throw new ForbiddenException('Solo el creador o un integrante puede realizar esta acción.');
    }
  }

  private async assertAreaExists(areaId: string): Promise<void> {
    const exists = await this.areas.exists({ where: { id: areaId } });
    if (!exists) {
      throw new BadRequestException('El área académica no existe.');
    }
  }
}
