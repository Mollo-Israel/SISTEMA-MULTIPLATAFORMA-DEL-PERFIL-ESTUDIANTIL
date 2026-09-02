import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EvidenceType, ProjectVisibility, RolNombre } from '@perfil/shared';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { User } from '../entities/user.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddEvidenceDto } from './dto/add-evidence.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { TeacherScopeService } from '../access/teacher-scope.service';
import {
  AFFINITY_RECALCULATION,
  AffinityRecalculationPort,
} from '../affinity-recalc/affinity-recalculation.port';


@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember) private readonly members: Repository<ProjectMember>,
    @InjectRepository(ProjectEvidence) private readonly evidences: Repository<ProjectEvidence>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly teacherScope: TeacherScopeService,
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
      visibility: dto.visibility ?? ProjectVisibility.PROFILE,
      createdByProfileId: profile.id,
    });
    const saved = await this.projects.save(project);
    await this.affinityRecalculation.requestRecalculation(profile.id);
    return this.findOneOrFail(saved.id);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateProjectDto): Promise<Project> {
    // Se carga SIN la relacion academicArea a proposito: si la relacion viene
    // cargada, TypeORM la prioriza sobre la clave foranea al guardar y el
    // cambio de area se pierde en silencio. Solo se necesita createdByProfile
    // para verificar la propiedad.
    const project = await this.projects.findOne({
      where: { id },
      relations: { createdByProfile: true },
    });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }
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
    if (dto.visibility !== undefined) project.visibility = dto.visibility;

    await this.projects.save(project);
    await this.affinityRecalculation.requestRecalculation(project.createdByProfileId);
    return this.findOneOrFail(id);
  }

  async findMine(userId: string) {
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
          order: { createdAt: 'DESC' },
        })
      : [];

    // La interfaz necesita distinguir de que proyectos es responsable y en
    // cuales participa como integrante aceptado (RF15).
    const roleOf = (projectId: string) =>
      memberships.find((m) => m.projectId === projectId)?.role ?? null;

    return [
      ...owned.map((p) => ({ ...p, isOwner: true, myRole: null as string | null })),
      ...memberProjects.map((p) => ({ ...p, isOwner: false, myRole: roleOf(p.id) })),
    ];
  }

  async findOneForUser(user: AuthenticatedUser, id: string): Promise<Project> {
    const project = await this.findOneOrFail(id);
    await this.assertCanView(user, project);
    return project;
  }

  /**
   * Quien puede ver un proyecto (RF15, Tabla 2.24).
   *
   *  - Estudiante: solo si es el responsable o un integrante aceptado.
   *  - Docente: solo si el proyecto esta habilitado para consulta docente Y el
   *    estudiante responsable pertenece a un semestre de su alcance (RF3).
   *  - Administrador: acceso de soporte, como en el resto del sistema.
   *
   * El director de carrera no accede al detalle individual: ningun RF se lo
   * concede. Sus reportes agregados siguen disponibles en /reports/director.
   */
  private async assertCanView(user: AuthenticatedUser, project: Project): Promise<void> {
    if (user.role === RolNombre.ADMIN) return;

    if (user.role === RolNombre.STUDENT) {
      const isOwner = project.createdByProfile?.userId === user.userId;
      const isMember = project.members?.some((m) => m.userId === user.userId);
      if (!isOwner && !isMember) {
        throw new ForbiddenException('No tiene acceso a este proyecto.');
      }
      return;
    }

    if (user.role === RolNombre.TEACHER) {
      if (project.visibility !== ProjectVisibility.TEACHERS) {
        throw new ForbiddenException(
          'El estudiante no habilitó este proyecto para consulta docente.',
        );
      }
      // Una sola fuente de verdad para el alcance academico del docente.
      await this.teacherScope.assertCanAccessProfile(user, project.createdByProfileId);
      return;
    }

    throw new ForbiddenException('Su rol no puede consultar proyectos estudiantiles.');
  }

  /** true si el usuario puede ver el proyecto, sin lanzar excepcion. */
  async canView(user: AuthenticatedUser, project: Project): Promise<boolean> {
    try {
      await this.assertCanView(user, project);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Portafolio institucional que consulta el docente (RF15).
   * Solo proyectos habilitados para docentes y de estudiantes dentro de su
   * alcance; nunca la totalidad de los proyectos del sistema.
   */
  async findForTeacher(user: AuthenticatedUser, filters: QueryProjectsDto) {
    const scope = await this.teacherScope.scopeFor(user);
    const restricted = scope !== null;

    if (restricted && scope.length === 0) {
      return { scope: { restricted: true, semesters: [] as number[] }, projects: [] };
    }

    const qb = this.projects
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.academicArea', 'area')
      .leftJoinAndSelect('p.createdByProfile', 'prof')
      .leftJoinAndSelect('prof.user', 'u')
      .where('p.visibility = :visibility', { visibility: ProjectVisibility.TEACHERS })
      .orderBy('p.updated_at', 'DESC');

    if (restricted) {
      qb.andWhere('prof.semester IN (:...semesters)', { semesters: scope });
    }
    if (filters.semester) {
      qb.andWhere('prof.semester = :semester', { semester: filters.semester });
    }
    if (filters.status) {
      qb.andWhere('p.status = :status', { status: filters.status });
    }
    if (filters.areaId) {
      qb.andWhere('p.academic_area_id = :areaId', { areaId: filters.areaId });
    }
    if (filters.technology) {
      // Coincidencia sin distinguir mayusculas dentro del arreglo de tecnologias.
      qb.andWhere(
        'EXISTS (SELECT 1 FROM unnest(p.technologies) AS t WHERE t ILIKE :tech)',
        { tech: '%' + filters.technology + '%' },
      );
    }
    if (filters.search) {
      qb.andWhere(
        "(p.title ILIKE :s OR CONCAT(u.first_name, ' ', u.last_name) ILIKE :s)",
        { s: '%' + filters.search + '%' },
      );
    }

    const rows = await qb.getMany();
    return {
      scope: { restricted, semesters: scope ?? [] },
      projects: rows.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status,
        technologies: p.technologies,
        area: p.academicArea?.name ?? null,
        academicAreaId: p.academicAreaId,
        repositoryUrl: p.repositoryUrl,
        demoUrl: p.demoUrl,
        updatedAt: p.updatedAt,
        student: p.createdByProfile?.user
          ? p.createdByProfile.user.firstName + ' ' + p.createdByProfile.user.lastName
          : null,
        semester: p.createdByProfile?.semester ?? null,
      })),
    };
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
    // La evidencia queda a nombre de quien la adjunta; si es un integrante sin
    // perfil propio, se atribuye al dueno del proyecto.
    const ownProfile = await this.profiles.findOne({ where: { userId: user.userId } });
    const evidence = this.evidences.create({
      projectId: project.id,
      studentProfileId: ownProfile?.id ?? project.createdByProfileId,
      academicAreaId: project.academicAreaId,
      evidenceType: dto.evidenceType,
      description: dto.description ?? null,
      fileUrl: dto.fileUrl ?? null,
      externalUrl: dto.externalUrl ?? null,
      fileName: dto.fileName ?? null,
      mimeType: dto.mimeType ?? null,
      fileSize: dto.fileSize ?? null,
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
