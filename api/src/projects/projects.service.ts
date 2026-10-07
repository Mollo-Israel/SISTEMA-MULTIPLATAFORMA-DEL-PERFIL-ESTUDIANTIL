import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import {
  EvidenceType,
  ProjectEventType,
  ProjectInvitationStatus,
  ProjectStatus,
  ProjectVisibility,
  RolNombre,
  ValidationResourceType,
} from '@perfil/shared';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { ProjectMemberSkill } from '../entities/project-member-skill.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ProjectFeedback } from '../entities/project-feedback.entity';
import { ProjectArea, ProjectSkill } from '../entities/project-area.entity';
import { ProjectInvitation } from '../entities/project-invitation.entity';
import { Team, TeamMember } from '../entities/collaboration.entity';
import { assertSkillsBelongToAreas } from '../catalogs/area-skill.guard';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { Readiness, projectReadiness } from './project-readiness.rules';
import { Skill } from '../entities/skill.entity';
import {
  ProjectLinkCheck,
  ProjectRepositoryCheck,
} from '../entities/project-check.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { User } from '../entities/user.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddEvidenceDto } from './dto/add-evidence.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { TeacherScopeService, scopeSql } from '../access/teacher-scope.service';
import { LinkCheckerService } from '../validation/link-checker.service';
import { ValidationService } from '../validation/validation.service';
import { UploadsService } from '../storage/uploads.service';
import { FILES_ROUTE } from '../storage/local-storage.driver';
import { ProjectEventsService } from './project-events.service';
import { ProjectBackingService } from './project-backing.service';
import { RepositoryInspectorService } from './repository-inspector.service';
import {
  TRAJECTORY_RECALCULATION,
  TrajectoryRecalculationPort,
} from '../trajectory/trajectory-recalculation.port';


/** Lo escrito primero, en su orden; luego lo del catálogo que falte (sin duplicar por mayúsculas). */
function unirTecnologias(escritas: string[], delCatalogo: string[]): string[] {
  const vistas = new Set(escritas.map((t) => t.toLowerCase()));
  return [...escritas, ...delCatalogo.filter((t) => !vistas.has(t.toLowerCase()) && vistas.add(t.toLowerCase()))];
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember) private readonly members: Repository<ProjectMember>,
    @InjectRepository(ProjectEvidence) private readonly evidences: Repository<ProjectEvidence>,
    @InjectRepository(ProjectFeedback)
    private readonly feedback: Repository<ProjectFeedback>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly teacherScope: TeacherScopeService,
    @InjectRepository(ProjectMemberSkill)
    private readonly memberSkills: Repository<ProjectMemberSkill>,
    @InjectRepository(Skill) private readonly skills: Repository<Skill>,
    @InjectRepository(ProjectRepositoryCheck)
    private readonly repoChecks: Repository<ProjectRepositoryCheck>,
    @InjectRepository(ProjectLinkCheck)
    private readonly linkChecks: Repository<ProjectLinkCheck>,
    private readonly events: ProjectEventsService,
    private readonly backing: ProjectBackingService,
    private readonly repositoryInspector: RepositoryInspectorService,
    private readonly linkChecker: LinkCheckerService,
    private readonly uploads: UploadsService,
    private readonly validation: ValidationService,
    @Inject(TRAJECTORY_RECALCULATION)
    private readonly trajectory: TrajectoryRecalculationPort,
    @InjectRepository(ProjectArea) private readonly projectAreas: Repository<ProjectArea>,
    @InjectRepository(ProjectSkill) private readonly projectSkills: Repository<ProjectSkill>,
    @InjectRepository(ProjectInvitation) private readonly invitations: Repository<ProjectInvitation>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(TeamMember) private readonly teamMembers: Repository<TeamMember>,
    private readonly audit: AuditService,
  ) {}

  /** Áreas pedidas: `areaIds`, o el `areaId` de antes. `undefined` si no se tocan. */
  private areasPedidas(dto: { areaIds?: string[]; areaId?: string | null }): string[] | undefined {
    if (dto.areaIds !== undefined) return [...new Set(dto.areaIds ?? [])];
    if (dto.areaId !== undefined) return dto.areaId ? [dto.areaId] : [];
    return undefined;
  }

  private async replaceAreas(projectId: string, areaIds: string[]): Promise<void> {
    await this.projectAreas.delete({ projectId });
    if (areaIds.length) {
      await this.projectAreas.save(areaIds.map((academicAreaId) => this.projectAreas.create({ projectId, academicAreaId })));
    }
  }

  private async replaceSkills(projectId: string, skillIds: string[]): Promise<void> {
    await this.projectSkills.delete({ projectId });
    if (skillIds.length) {
      await this.projectSkills.save(skillIds.map((skillId) => this.projectSkills.create({ projectId, skillId })));
    }
  }

  /** §21.1: solo un equipo del que forma parte (dueño o integrante). */
  private async assertTeamOfUser(profileId: string, teamId: string): Promise<void> {
    const team = await this.teams.findOne({ where: { id: teamId } });
    const propio = team?.ownerProfileId === profileId
      || await this.teamMembers.exists({ where: { teamId, studentProfileId: profileId } });
    if (!team || !propio) {
      const m = 'Solo puedes vincular un equipo del que formas parte.';
      throw new BadRequestException({ message: m, fields: { teamId: [m] } });
    }
  }

  /** §40: el enlace público existe solo mientras la visibilidad es PUBLIC_LINK. */
  private sincronizarEnlacePublico(project: Project): void {
    if (project.visibility === ProjectVisibility.PUBLIC_LINK) {
      project.publicLinkToken ??= randomBytes(24).toString('base64url');
    } else {
      project.publicLinkToken = null;
    }
  }

  /**
   * Requisitos para ACTIVE (V3 §22), calculados sobre lo guardado.
   */
  async readinessOf(projectId: string): Promise<Readiness> {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado.');
    const [areaCount, skillCount, repo, demo, miembros, pendientes, evidencias] = await Promise.all([
      this.projectAreas.count({ where: { projectId } }),
      this.projectSkills.count({ where: { projectId } }),
      this.repoChecks.findOne({ where: { projectId }, order: { checkedAt: 'DESC' } }),
      this.linkChecks.findOne({ where: { projectId }, order: { checkedAt: 'DESC' } }),
      this.members.find({ where: { projectId } }),
      this.invitations.count({ where: { projectId, status: ProjectInvitationStatus.PENDING } }),
      this.evidences.count({ where: { projectId } }),
    ]);
    const owner = miembros.find((m) => m.isOwner);
    return projectReadiness({
      title: project.title,
      areaCount,
      skillCount,
      repositoryUrl: project.repositoryUrl,
      repositoryCheck: repo && repo.repositoryUrl === project.repositoryUrl ? repo.status : null,
      members: miembros.filter((m) => !m.isOwner).map((m) => ({ confirmed: m.contributionConfirmedAt !== null })),
      pendingInvitations: pendientes,
      ownContributionConfirmed: !!owner?.contributionConfirmedAt,
      evidenceCount: evidencias,
      demoCheck: demo && demo.url === project.demoUrl ? demo.status : null,
    });
  }

  async readinessForUser(user: AuthenticatedUser, projectId: string): Promise<Readiness> {
    const project = await this.findOneOrFail(projectId);
    await this.assertOwnerOrMember(user, project);
    return this.readinessOf(projectId);
  }

  private notReady(r: Readiness): BadRequestException {
    return new BadRequestException({
      code: 'PROJECT_NOT_READY',
      message: 'Todavía no puede activarse: ' + r.missing.map((m) => m.message).join(' '),
      details: { missing: r.missing, warnings: r.warnings },
      fields: { status: r.missing.map((m) => m.message) },
    });
  }

  private async registrarActivacion(project: Project, actorUserId: string): Promise<void> {
    await this.events.record({
      projectId: project.id,
      actorUserId,
      eventType: ProjectEventType.PROJECT_ACTIVATED,
      metadata: {},
    });
    await this.audit.record({
      actorUserId,
      eventType: AuditEventType.PROJECT_ACTIVATED,
      entityType: 'project',
      entityId: project.id,
      metadata: { title: project.title },
    });
  }

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    const profile = await this.requireProfile(userId);
    const areaIds = this.areasPedidas(dto) ?? [];
    for (const a of areaIds) await this.assertAreaExists(a);
    if (dto.skillIds?.length) {
      await assertSkillsBelongToAreas(this.projects.manager, dto.skillIds, areaIds);
    }
    if (dto.teamId) await this.assertTeamOfUser(profile.id, dto.teamId);
    const skillsCatalogo = dto.skillIds?.length
      ? await this.skills.find({ where: { id: In(dto.skillIds) } })
      : [];
    if (skillsCatalogo.length !== (dto.skillIds?.length ?? 0)) {
      throw new BadRequestException({ message: 'Alguna tecnología no está en el catálogo.', fields: { skillIds: ['Alguna tecnología no está en el catálogo.'] } });
    }

    // V3 §22: se guarda como borrador y solo pasa a ACTIVE si cumple los
    // requisitos, que en parte dependen de comprobar el repositorio.
    const quiereActivo = dto.status === ProjectStatus.ACTIVE;
    const project = this.projects.create({
      title: dto.title,
      description: dto.description ?? null,
      academicAreaId: areaIds[0] ?? null,
      // Las tecnologías escritas se conservan; si vienen del catálogo, sus
      // nombres alimentan el cruce con el repositorio y los filtros docentes.
      technologies: skillsCatalogo.length
        ? unirTecnologias(dto.technologies ?? [], skillsCatalogo.map((s) => s.name))
        : (dto.technologies ?? null),
      status: quiereActivo ? ProjectStatus.DRAFT : (dto.status ?? ProjectStatus.DRAFT),
      repositoryUrl: dto.repositoryUrl ?? null,
      demoUrl: dto.demoUrl ?? null,
      visibility: dto.visibility ?? ProjectVisibility.PROFILE,
      teamId: dto.teamId ?? null,
      createdByProfileId: profile.id,
    });
    this.sincronizarEnlacePublico(project);
    const saved = await this.projects.save(project);
    await this.replaceAreas(saved.id, areaIds);
    await this.replaceSkills(saved.id, dto.skillIds ?? []);

    // V2 §34, §48: el responsable también es integrante, para confirmar las
    // tecnologías que usó. Su fila no cuenta como integrante aceptado (§36).
    await this.members.save(
      this.members.create({
        projectId: saved.id,
        userId,
        role: 'Responsable',
        contribution: null,
        contributionConfirmedAt: new Date(),
        isOwner: true,
      }),
    );

    // §41: la bitacora empieza en el minuto uno.
    await this.events.record({
      projectId: saved.id,
      actorUserId: userId,
      eventType: ProjectEventType.PROJECT_CREATED,
      metadata: { title: saved.title, visibility: saved.visibility },
    });

    // §32: crear un proyecto por si solo deja DECLARED. Se calcula igual,
    // no se asume: si el alta trajo repositorio o demo, ya hay algo que
    // comprobar.
    await this.checkExternalSources(saved.id, userId);

    if (quiereActivo) {
      const r = await this.readinessOf(saved.id);
      if (!r.ready) {
        // Nadie más lo vio: se deshace el alta para no dejar un borrador que
        // el estudiante no pidió.
        await this.projects.delete(saved.id);
        throw this.notReady(r);
      }
      await this.projects.update(saved.id, { status: ProjectStatus.ACTIVE });
      await this.registrarActivacion(saved, userId);
    }
    await this.backing.recalculate(saved.id, userId);

    await this.trajectory.requestRecalculation(profile.id);
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
    const visibilidadAnterior = project.visibility;
    const estadoAnterior = project.status;

    const areaIds = this.areasPedidas(dto);
    if (areaIds !== undefined) {
      for (const a of areaIds) await this.assertAreaExists(a);
      project.academicAreaId = areaIds[0] ?? null;
    }
    const areasFinales = areaIds
      ?? (await this.projectAreas.find({ where: { projectId: id } })).map((x) => x.academicAreaId);
    if (dto.skillIds !== undefined || areaIds !== undefined) {
      const skillsFinales = dto.skillIds
        ?? (await this.projectSkills.find({ where: { projectId: id } })).map((x) => x.skillId);
      await assertSkillsBelongToAreas(this.projects.manager, skillsFinales, areasFinales);
    }
    if (dto.teamId !== undefined) {
      if (dto.teamId) await this.assertTeamOfUser(project.createdByProfileId, dto.teamId);
      project.teamId = dto.teamId ?? null;
    }

    // V3 §22: un ACTIVE no puede quedarse sin lo que lo hizo activable.
    const sigueActivo = (dto.status ?? project.status) === ProjectStatus.ACTIVE && estadoAnterior === ProjectStatus.ACTIVE;
    if (sigueActivo) {
      const quitar: string[] = [];
      if (areaIds !== undefined && areaIds.length === 0) quitar.push('Un proyecto activo necesita al menos un área.');
      if (dto.skillIds !== undefined && dto.skillIds.length === 0) quitar.push('Un proyecto activo necesita al menos una tecnología.');
      if (dto.repositoryUrl !== undefined && !dto.repositoryUrl) quitar.push('Un proyecto activo necesita su repositorio.');
      if (quitar.length) {
        throw new BadRequestException({ code: 'PROJECT_ACTIVE_REQUIREMENT', message: quitar.join(' '), fields: { status: quitar } });
      }
    }

    if (dto.title !== undefined) project.title = dto.title;
    if (dto.description !== undefined) project.description = dto.description;
    if (dto.technologies !== undefined) project.technologies = dto.technologies;
    const activar = dto.status === ProjectStatus.ACTIVE && estadoAnterior !== ProjectStatus.ACTIVE;
    if (dto.status !== undefined && !activar) project.status = dto.status;
    const enlacesCambian =
      (dto.repositoryUrl !== undefined && dto.repositoryUrl !== project.repositoryUrl)
      || (dto.demoUrl !== undefined && dto.demoUrl !== project.demoUrl);

    if (dto.repositoryUrl !== undefined) project.repositoryUrl = dto.repositoryUrl;
    if (dto.demoUrl !== undefined) project.demoUrl = dto.demoUrl;
    if (dto.visibility !== undefined) project.visibility = dto.visibility;
    this.sincronizarEnlacePublico(project);

    await this.projects.save(project);
    if (areaIds !== undefined) await this.replaceAreas(project.id, areaIds);
    if (dto.skillIds !== undefined) {
      await this.replaceSkills(project.id, dto.skillIds);
      const nombres = (await this.skills.find({ where: { id: In(dto.skillIds.length ? dto.skillIds : ['00000000-0000-4000-8000-000000000000']) } })).map((s) => s.name);
      if (nombres.length) await this.projects.update(project.id, { technologies: nombres });
    }

    if (dto.visibility !== undefined && dto.visibility !== visibilidadAnterior) {
      await this.events.record({
        projectId: project.id,
        actorUserId: user.userId,
        eventType: ProjectEventType.PROJECT_VISIBILITY_CHANGED,
        metadata: { de: visibilidadAnterior, a: dto.visibility },
      });
    }
    if (dto.status === ProjectStatus.ARCHIVED && estadoAnterior !== ProjectStatus.ARCHIVED) {
      await this.events.record({
        projectId: project.id,
        actorUserId: user.userId,
        eventType: ProjectEventType.PROJECT_ARCHIVED,
        metadata: {},
      });
    }

    // Los enlaces solo se vuelven a comprobar si cambiaron: consultar
    // GitHub en cada edicion del titulo gastaria cuota para nada.
    if (enlacesCambian) await this.checkExternalSources(project.id, user.userId);

    if (activar) {
      // §22: los requisitos se miden con lo ya guardado y comprobado.
      const r = await this.readinessOf(project.id);
      if (!r.ready) throw this.notReady(r);
      await this.projects.update(project.id, { status: ProjectStatus.ACTIVE });
      await this.registrarActivacion(project, user.userId);
    }
    await this.backing.recalculate(project.id, user.userId);

    await this.trajectory.requestRecalculation(project.createdByProfileId);
    // V3 §21: cambiar de estado (activar, archivar, volver a borrador) cambia
    // también la afinidad de cada integrante, no solo la del responsable.
    const estadoFinal = activar ? ProjectStatus.ACTIVE : project.status;
    if (estadoFinal !== estadoAnterior) {
      const integrantes = await this.members.find({ where: { projectId: project.id } });
      const perfiles = integrantes.length
        ? await this.profiles.find({ where: { userId: In(integrantes.map((m) => m.userId)) } })
        : [];
      for (const perfil of perfiles) {
        if (perfil.id !== project.createdByProfileId) await this.trajectory.requestRecalculation(perfil.id);
      }
    }
    return this.findOneOrFail(id);
  }

  async findMine(userId: string) {
    const profile = await this.requireProfile(userId);
    const memberships = await this.members.find({ where: { userId } });
    const memberProjectIds = memberships.map((m) => m.projectId);

    const owned = await this.projects.find({
      where: { createdByProfileId: profile.id },
      relations: {
        academicArea: true, members: true, evidences: true,
        projectAreas: { academicArea: true }, projectSkills: { skill: true },
      },
      order: { createdAt: 'DESC' },
    });
    const ownedIds = new Set(owned.map((p) => p.id));
    const extraIds = memberProjectIds.filter((pid) => !ownedIds.has(pid));
    const memberProjects = extraIds.length
      ? await this.projects.find({
          where: { id: In(extraIds) },
          relations: {
            academicArea: true, members: true, evidences: true,
            projectAreas: { academicArea: true }, projectSkills: { skill: true },
          },
          order: { createdAt: 'DESC' },
        })
      : [];

    // La interfaz necesita distinguir de que proyectos es responsable y en
    // cuales participa como integrante aceptado (RF15).
    const roleOf = (projectId: string) =>
      memberships.find((m) => m.projectId === projectId)?.role ?? null;

    // Cuanta retroalimentacion docente tiene cada proyecto (RF16). Sin este
    // dato el estudiante no tiene forma de saber que un docente le comento:
    // tendria que abrir los proyectos uno por uno para descubrirlo.
    const counts = await this.feedbackCounts([
      ...owned.map((p) => p.id),
      ...memberProjects.map((p) => p.id),
    ]);

    return [
      ...owned.map((p) => ({
        ...p,
        isOwner: true,
        myRole: null as string | null,
        feedbackCount: counts.get(p.id) ?? 0,
      })),
      ...memberProjects.map((p) => ({
        ...p,
        isOwner: false,
        myRole: roleOf(p.id),
        feedbackCount: counts.get(p.id) ?? 0,
      })),
    ];
  }

  /** Comentarios docentes por proyecto, en una sola consulta. */
  private async feedbackCounts(projectIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (projectIds.length === 0) return map;
    const rows = await this.feedback
      .createQueryBuilder('f')
      .select('f.project_id', 'projectId')
      .addSelect('COUNT(*)', 'total')
      .where('f.project_id IN (:...ids)', { ids: projectIds })
      .groupBy('f.project_id')
      .getRawMany<{ projectId: string; total: string }>();
    for (const r of rows) map.set(r.projectId, Number(r.total));
    return map;
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
      if (isOwner || isMember) return;
      // V3 §40: TEAM abre el proyecto al equipo de colaboración vinculado.
      if (project.visibility === ProjectVisibility.TEAM && project.teamId) {
        const perfil = await this.profiles.findOne({ where: { userId: user.userId } });
        const team = await this.teams.findOne({ where: { id: project.teamId } });
        const delEquipo = !!perfil && !!team && (team.ownerProfileId === perfil.id
          || await this.teamMembers.exists({ where: { teamId: team.id, studentProfileId: perfil.id } }));
        if (delEquipo) return;
      }
      throw new ForbiddenException('No tiene acceso a este proyecto.');
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
      // Semestre actual o de arrastre del responsable (V3 §8.1).
      qb.andWhere(scopeSql('prof', 'semesters'), { semesters: scope });
    }
    if (filters.semester) {
      qb.andWhere('prof.semester = :semester', { semester: filters.semester });
    }
    if (filters.status) {
      qb.andWhere('p.status = :status', { status: filters.status });
    }
    if (filters.areaId) {
      // V3 §21.2: cualquiera de sus áreas, no solo la principal.
      qb.andWhere(
        '(p.academic_area_id = :areaId OR EXISTS (SELECT 1 FROM project_areas pa WHERE pa.project_id = p.id AND pa.academic_area_id = :areaId))',
        { areaId: filters.areaId },
      );
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

    if (dto.evidenceType === EvidenceType.FILE && !dto.storedFileId) {
      throw new BadRequestException(
        'Debe indicar storedFileId para una evidencia de tipo archivo. '
        + 'Suba primero el archivo en POST /uploads y use el id que devuelve.',
      );
    }
    if (dto.evidenceType === EvidenceType.LINK && !dto.externalUrl) {
      throw new BadRequestException('Debe indicar externalUrl para una evidencia de tipo link.');
    }

    /*
     * §35: «El propietario de la evidencia es el estudiante cuya trayectoria
     * puede verse afectada».
     *
     * Aquí había un defecto que §35 nombra explícitamente: la evidencia se
     * guardaba a nombre de quien la adjuntaba, pero el recálculo se pedía
     * siempre para el creador del proyecto. Si un integrante subía una
     * evidencia, la afinidad que se actualizaba era la de otra persona, y la
     * suya se quedaba sin el aporte que acababa de hacer.
     */
    const ownProfile = await this.profiles.findOne({ where: { userId: user.userId } });
    if (!ownProfile) {
      throw new BadRequestException('Debe crear su perfil estudiantil antes de adjuntar evidencias.');
    }

    // §27: el archivo se nombra por su identificador y debe ser de quien lo
    // adjunta. La URL suelta permitía adjuntar el archivo de otra persona.
    const archivo = dto.evidenceType === EvidenceType.FILE && dto.storedFileId
      ? await this.uploads.requireOwned(user.userId, dto.storedFileId)
      : null;

    const evidence = this.evidences.create({
      projectId: project.id,
      studentProfileId: ownProfile.id,
      academicAreaId: project.academicAreaId,
      evidenceType: dto.evidenceType,
      description: dto.description ?? null,
      storedFileId: archivo?.id ?? null,
      fileUrl: archivo ? `${FILES_ROUTE}/${archivo.storageKey}` : null,
      fileName: archivo?.originalFilename ?? null,
      mimeType: archivo?.mimeTypeDetected ?? null,
      fileSize: archivo?.sizeBytes ?? null,
      externalUrl: dto.externalUrl ?? null,
    });
    const saved = await this.evidences.save(evidence);

    await this.validation.enqueue({
      resourceType: ValidationResourceType.PROJECT_EVIDENCE,
      resourceId: saved.id,
    });
    await this.events.record({
      projectId: project.id,
      actorUserId: user.userId,
      eventType: ProjectEventType.EVIDENCE_ADDED,
      metadata: { evidenceType: dto.evidenceType, owner: ownProfile.id },
    });
    await this.backing.recalculate(project.id, user.userId);

    // El recálculo va a quien aportó, no al dueño del proyecto (§35).
    await this.trajectory.requestRecalculation(ownProfile.id);
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
    const dueno = evidence.studentProfileId;
    const archivo = evidence.storedFileId;
    await this.evidences.delete(evidence.id);
    if (archivo) await this.uploads.remove(archivo);

    await this.events.record({
      projectId: project.id,
      actorUserId: user.userId,
      eventType: ProjectEventType.EVIDENCE_REMOVED,
      metadata: { owner: dueno },
    });
    await this.backing.recalculate(project.id, user.userId);

    // §35: se recalcula a quien pertenecía, no al dueño del proyecto.
    await this.trajectory.requestRecalculation(dueno);
  }

  // ====================================================================
  //  §33 y §34 · La contribución la confirma su dueño
  // ====================================================================

  /**
   * El integrante declara y confirma lo que hizo (§33).
   *
   * §33 es tajante: «No permitir que el creador atribuya unilateralmente
   * experiencia definitiva a otro estudiante». De modo que esto solo lo puede
   * llamar el propio integrante sobre su propia membresía. El creador puede
   * proponer un texto al invitar, pero mientras el integrante no confirme, esa
   * contribución no alimenta su perfil.
   *
   * Las tecnologías son las **suyas**, no las del proyecto (§34): entrar en un
   * proyecto de cuatro tecnologías no significa haber usado las cuatro.
   */
  async confirmMyContribution(
    userId: string,
    projectId: string,
    dto: { contribution?: string; role?: string; skillIds?: string[] },
  ) {
    const member = await this.members.findOne({ where: { projectId, userId } });
    if (!member) {
      throw new NotFoundException('No eres integrante aceptado de este proyecto.');
    }

    if (dto.contribution !== undefined) member.contribution = dto.contribution ?? null;
    if (dto.role !== undefined) member.role = dto.role ?? null;
    member.contributionConfirmedAt = new Date();
    await this.members.save(member);

    if (dto.skillIds !== undefined) {
      await this.replaceMemberSkills(member.id, dto.skillIds ?? []);
    }

    await this.events.record({
      projectId,
      actorUserId: userId,
      eventType: ProjectEventType.CONTRIBUTION_CONFIRMED,
      metadata: { role: member.role, skills: dto.skillIds?.length ?? 0 },
    });

    // Ahora sí: lo que confirmó pasa a contar en SU perfil (§34).
    const profile = await this.profiles.findOne({ where: { userId } });
    if (profile) await this.trajectory.requestRecalculation(profile.id);

    return this.memberView(member.id);
  }

  /**
   * El creador propone contribución y rol de un integrante (§33).
   *
   * Propone, no atribuye: guardar esto **retira** la confirmación anterior, de
   * modo que el integrante tenga que volver a revisarlo. Si no fuera así,
   * bastaría con editar el texto después de que confirmara para atribuirle lo
   * que uno quisiera.
   */
  async proposeContribution(
    user: AuthenticatedUser,
    projectId: string,
    memberId: string,
    dto: { contribution?: string; role?: string },
  ) {
    const project = await this.findOneOrFail(projectId);
    await this.assertIsOwner(user, project);

    const member = await this.members.findOne({ where: { id: memberId, projectId } });
    if (!member) throw new NotFoundException('Integrante no encontrado en este proyecto.');
    if (member.userId === user.userId) {
      throw new BadRequestException(
        'Su propia contribución se edita desde «confirmar mi contribución».',
      );
    }

    if (dto.contribution !== undefined) member.contribution = dto.contribution ?? null;
    if (dto.role !== undefined) member.role = dto.role ?? null;
    member.contributionConfirmedAt = null;
    await this.members.save(member);

    await this.events.record({
      projectId,
      actorUserId: user.userId,
      eventType: ProjectEventType.CONTRIBUTION_UPDATED,
      metadata: { memberId, requiereConfirmacion: true },
    });

    return this.memberView(member.id);
  }

  /** Integrantes con su contribución, sus tecnologías y si están confirmadas. */
  async listMembersDetailed(user: AuthenticatedUser, projectId: string) {
    const project = await this.findOneOrFail(projectId);
    await this.assertCanView(user, project);

    const rows = await this.members.find({
      where: { projectId },
      relations: { user: true, memberSkills: { skill: true } },
      order: { createdAt: 'ASC' },
    });

    return rows.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user ? `${m.user.firstName} ${m.user.lastName}` : null,
      role: m.role,
      contribution: m.contribution,
      /** §33: mientras sea false, lo que hay lo escribió otra persona. */
      contributionConfirmed: m.contributionConfirmedAt !== null,
      contributionConfirmedAt: m.contributionConfirmedAt,
      skillsUsed: (m.memberSkills ?? []).map((s) => ({
        skillId: s.skillId,
        name: s.skill?.name ?? null,
      })),
      createdAt: m.createdAt,
    }));
  }

  private async replaceMemberSkills(projectMemberId: string, skillIds: string[]): Promise<void> {
    const unicas = [...new Set(skillIds)];
    if (unicas.length > 20) {
      throw new BadRequestException('Máximo 20 tecnologías por integrante.');
    }
    if (unicas.length > 0) {
      const existen = await this.skills.count({ where: { id: In(unicas) } });
      if (existen !== unicas.length) {
        throw new BadRequestException('Alguna de las tecnologías indicadas no existe.');
      }
    }
    await this.memberSkills.delete({ projectMemberId });
    if (unicas.length > 0) {
      await this.memberSkills.save(
        unicas.map((skillId) => this.memberSkills.create({ projectMemberId, skillId })),
      );
    }
  }

  private async memberView(memberId: string) {
    const m = await this.members.findOne({
      where: { id: memberId },
      relations: { user: true, memberSkills: { skill: true } },
    });
    if (!m) throw new NotFoundException('Integrante no encontrado.');
    return {
      id: m.id,
      userId: m.userId,
      name: m.user ? `${m.user.firstName} ${m.user.lastName}` : null,
      role: m.role,
      contribution: m.contribution,
      contributionConfirmed: m.contributionConfirmedAt !== null,
      contributionConfirmedAt: m.contributionConfirmedAt,
      skillsUsed: (m.memberSkills ?? []).map((s) => ({
        skillId: s.skillId,
        name: s.skill?.name ?? null,
      })),
    };
  }

  // ====================================================================
  //  §37 y §39 · Repositorio y demo
  // ====================================================================

  /**
   * Comprueba repositorio y demo, si los hay.
   *
   * Ninguno es obligatorio (§37): un proyecto sin repositorio es un proyecto
   * perfectamente válido que simplemente no puede corroborarse por esa vía.
   *
   * Nunca lanza: que GitHub esté caído no puede impedir crear un proyecto.
   */
  async checkExternalSources(projectId: string, actorUserId: string | null, force = false): Promise<void> {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) return;

    if (project.repositoryUrl) {
      try {
        // V3 §24.4: se cruza con las tecnologías del catálogo del proyecto;
        // lo escrito como texto completa lo que el catálogo no tenga.
        const delCatalogo = (await this.projectSkills.find({ where: { projectId }, relations: { skill: true } }))
          .map((x) => x.skill?.name).filter((n): n is string => !!n);
        const resultado = await this.repositoryInspector.inspect(
          project.repositoryUrl,
          unirTecnologias(delCatalogo, project.technologies ?? []),
          { force },
        );
        await this.repoChecks.save(
          this.repoChecks.create({
            projectId,
            repositoryUrl: project.repositoryUrl,
            status: resultado.status,
            metadata: resultado.metadata,
            technologySignals: resultado.technologySignals,
            checkedAt: new Date(),
          }),
        );
        await this.events.record({
          projectId,
          actorUserId,
          eventType: ProjectEventType.REPOSITORY_CHECKED,
          metadata: {
            status: resultado.status,
            lenguajes: resultado.metadata?.languages?.length ?? 0,
          },
        });
      } catch (error) {
        this.logger.warn(`No se pudo comprobar el repositorio: ${String(error)}`);
      }
    }

    if (project.demoUrl) {
      try {
        // §39: se comprueba lo observable. No se infiere backend ni base de
        // datos desde una web desplegada; eso sigue siendo declarado.
        const pagina = await this.linkChecker.fetchPage(project.demoUrl);
        const check = pagina.result;
        const meta = (prop: string) => {
          if (!pagina.body || !/html/.test(pagina.contentType ?? '')) return null;
          const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']{1,300})["']`, 'i');
          return re.exec(pagina.body)?.[1]?.trim() ?? null;
        };
        await this.linkChecks.save(
          this.linkChecks.create({
            projectId,
            url: project.demoUrl,
            status: check.status,
            isHttps: (check.finalUrl ?? project.demoUrl).startsWith('https://'),
            title: check.title,
            httpStatus: check.httpStatus,
            blockedReason: check.blockedReason,
            metadata: {
              description: meta('og:description') ?? meta('description'),
              siteName: meta('og:site_name'),
              finalUrl: check.finalUrl,
            },
            checkedAt: new Date(),
          }),
        );
        await this.events.record({
          projectId,
          actorUserId,
          eventType: ProjectEventType.DEMO_CHECKED,
          metadata: { status: check.status, https: check.finalUrl?.startsWith('https://') ?? false },
        });
      } catch (error) {
        this.logger.warn(`No se pudo comprobar la demo: ${String(error)}`);
      }
    }
  }

  /** Lo que se sabe del repositorio y la demo de un proyecto (§37, §38, §39). */
  async externalChecks(user: AuthenticatedUser, projectId: string) {
    const project = await this.findOneOrFail(projectId);
    await this.assertCanView(user, project);

    const [repo, demo] = await Promise.all([
      this.repoChecks.findOne({ where: { projectId }, order: { checkedAt: 'DESC' } }),
      this.linkChecks.findOne({ where: { projectId }, order: { checkedAt: 'DESC' } }),
    ]);

    return {
      backingTier: project.backingTier,
      backingReasons: project.backingReasons ?? [],
      repository: repo
        ? {
          url: repo.repositoryUrl,
          status: repo.status,
          metadata: repo.metadata,
          technologySignals: repo.technologySignals,
          checkedAt: repo.checkedAt,
        }
        : null,
      demo: demo
        ? {
          url: demo.url,
          status: demo.status,
          isHttps: demo.isHttps,
          title: demo.title,
          httpStatus: demo.httpStatus,
          blockedReason: demo.blockedReason,
          metadata: demo.metadata,
          checkedAt: demo.checkedAt,
        }
        : null,
      /**
       * Se repite en cada respuesta a propósito: «detected» significa que se
       * encontraron indicios compatibles, no que nadie domine nada (§38).
       */
      disclaimer:
        'Las tecnologías detectadas indican que se encontraron indicios compatibles '
        + 'en fuentes públicas. No afirman dominio ni autoría.',
    };
  }

  /** Vuelve a comprobar las fuentes externas a petición del responsable. */
  async recheckExternalSources(user: AuthenticatedUser, projectId: string) {
    const project = await this.findOneOrFail(projectId);
    await this.assertIsOwner(user, project);
    await this.checkExternalSources(projectId, user.userId, true);
    await this.backing.recalculate(projectId, user.userId);
    return this.externalChecks(user, projectId);
  }

  /** Bitácora del proyecto (§41). */
  async timeline(user: AuthenticatedUser, projectId: string, limit?: number) {
    const project = await this.findOneOrFail(projectId);
    await this.assertCanView(user, project);
    return this.events.list(projectId, limit ?? 100);
  }

  private async findOneOrFail(id: string): Promise<Project> {
    const project = await this.projects.findOne({
      where: { id },
      relations: {
        academicArea: true, members: true, evidences: true, createdByProfile: true,
        projectAreas: { academicArea: true }, projectSkills: { skill: true },
      },
    });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }
    return project;
  }

  /**
   * Vista pública por enlace (V3 §40).
   *
   * Solo lo que describe el proyecto: nunca la bitácora, la auditoría, los
   * correos, los archivos ni la retroalimentación docente. El token es el
   * único secreto; si la visibilidad cambia, deja de funcionar.
   */
  async findPublic(token: string) {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new NotFoundException('Enlace no válido.');
    const p = await this.projects.findOne({
      where: { publicLinkToken: token, visibility: ProjectVisibility.PUBLIC_LINK },
      relations: { projectAreas: { academicArea: true }, projectSkills: { skill: true } },
    });
    if (!p || p.status === ProjectStatus.DRAFT) throw new NotFoundException('Enlace no válido.');
    return {
      title: p.title,
      description: p.description,
      status: p.status,
      areas: (p.projectAreas ?? []).map((a) => a.academicArea?.name).filter(Boolean),
      skills: (p.projectSkills ?? []).map((s) => s.skill?.name).filter(Boolean),
      repositoryUrl: p.repositoryUrl,
      demoUrl: p.demoUrl,
      backingTier: p.backingTier,
      updatedAt: p.updatedAt,
    };
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
