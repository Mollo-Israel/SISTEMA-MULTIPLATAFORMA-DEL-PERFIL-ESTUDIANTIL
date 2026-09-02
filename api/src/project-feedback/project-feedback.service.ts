import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolNombre } from '@perfil/shared';
import { ProjectFeedback } from '../entities/project-feedback.entity';
import { Project } from '../entities/project.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ProjectsService } from '../projects/projects.service';
import {
  CreateProjectFeedbackDto,
  UpdateProjectFeedbackDto,
} from './dto/project-feedback.dto';

/**
 * Retroalimentacion docente sobre proyectos estudiantiles (RF16).
 *
 * Reglas del documento (RN-13, Tabla 2.25):
 *  - Solo el docente la registra.
 *  - Solo sobre proyectos habilitados para consulta docente y dentro de su
 *    contexto academico autorizado.
 *  - Queda disponible para los estudiantes vinculados al proyecto.
 *
 * La verificacion de acceso se delega en ProjectsService para no duplicar la
 * regla de visibilidad ni el alcance por semestre.
 */
@Injectable()
export class ProjectFeedbackService {
  constructor(
    @InjectRepository(ProjectFeedback)
    private readonly feedback: Repository<ProjectFeedback>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(
    user: AuthenticatedUser,
    projectId: string,
    dto: CreateProjectFeedbackDto,
  ): Promise<ProjectFeedback> {
    // findOneForUser aplica visibilidad y alcance: si el docente no puede ver
    // el proyecto, tampoco puede comentarlo.
    await this.projectsService.findOneForUser(user, projectId);

    const saved = await this.feedback.save(
      this.feedback.create({
        projectId,
        teacherUserId: user.userId,
        comment: dto.comment,
      }),
    );
    return this.findOneOrFail(saved.id);
  }

  /**
   * Retroalimentacion de un proyecto.
   * La ven el docente autorizado y los estudiantes vinculados al proyecto; el
   * mismo control de acceso que para ver el proyecto.
   */
  async listForProject(user: AuthenticatedUser, projectId: string) {
    await this.projectsService.findOneForUser(user, projectId);
    const rows = await this.feedback.find({
      where: { projectId },
      relations: { teacher: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((f) => ({
      id: f.id,
      comment: f.comment,
      teacher: f.teacher ? `${f.teacher.firstName} ${f.teacher.lastName}` : null,
      teacherUserId: f.teacherUserId,
      createdAt: f.createdAt,
      editedAt: f.editedAt,
      /** Permite a la interfaz mostrar el botón de editar solo a su autor. */
      canEdit: f.teacherUserId === user.userId,
    }));
  }

  /** El docente corrige su propio comentario; nunca el de otro. */
  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateProjectFeedbackDto,
  ): Promise<ProjectFeedback> {
    const existing = await this.findOneOrFail(id);
    if (existing.teacherUserId !== user.userId) {
      throw new ForbiddenException('Solo puede editar la retroalimentación que usted escribió.');
    }
    // Se revalida el acceso: si el proyecto dejó de estar habilitado o salió de
    // su alcance, el docente ya no lo edita.
    await this.projectsService.findOneForUser(user, existing.projectId);

    if (dto.comment !== undefined) {
      existing.comment = dto.comment;
      existing.editedAt = new Date();
    }
    await this.feedback.save(existing);
    return this.findOneOrFail(id);
  }

  /** Retroalimentación recibida por los proyectos de un estudiante. */
  async countForProjects(projectIds: string[]): Promise<Map<string, number>> {
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

  private async findOneOrFail(id: string): Promise<ProjectFeedback> {
    const row = await this.feedback.findOne({
      where: { id },
      relations: { teacher: true },
    });
    if (!row) {
      throw new NotFoundException('Retroalimentación no encontrada.');
    }
    return row;
  }

  /** Guarda de rol: RF16 corresponde únicamente al docente. */
  assertIsTeacher(user: AuthenticatedUser): void {
    if (user.role !== RolNombre.TEACHER) {
      throw new ForbiddenException(
        'Solo el docente puede registrar retroalimentación sobre un proyecto.',
      );
    }
  }
}
