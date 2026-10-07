import { NOTIFICATION_EMITTER, NotificationEmitter } from '../notifications/notification.port';
import { ProjectSkill } from '../entities/project-area.entity';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolNombre } from '@perfil/shared';
import { ProjectSkillEvidenceStatus, ProjectEventType } from '@perfil/shared';
import { ProjectFeedback } from '../entities/project-feedback.entity';
import { ProjectEventsService } from '../projects/project-events.service';
import { ProjectBackingService } from '../projects/project-backing.service';
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
    private readonly events: ProjectEventsService,
    private readonly backing: ProjectBackingService,
    @InjectRepository(ProjectSkill) private readonly projectSkills: Repository<ProjectSkill>,
    @Inject(NOTIFICATION_EMITTER) private readonly notifications: NotificationEmitter,
  ) {}

  /** V3 §33: TEACHER_FEEDBACK_RECEIVED, al responsable y a los integrantes. */
  private async avisarEquipo(projectId: string, feedbackId: string): Promise<void> {
    try {
      const p = await this.projects.findOne({ where: { id: projectId }, relations: { members: true, createdByProfile: true } });
      if (!p) return;
      const usuarios = new Set<string>([...(p.members ?? []).map((m) => m.userId), ...(p.createdByProfile ? [p.createdByProfile.userId] : [])]);
      for (const userId of usuarios) {
        await this.notifications.emit({
          userId,
          kind: 'TEACHER_FEEDBACK_RECEIVED',
          title: 'Retroalimentación docente',
          body: `Un docente comentó «${p.title}». Es orientación, no una nota.`,
          link: '/student/projects',
          entityType: 'project',
          entityId: projectId,
          dedupeKey: `teacher-feedback:${feedbackId}:${userId}`,
        });
      }
    } catch {
      // sin efecto sobre la operación
    }
  }

  /**
   * V3 §29: un docente autorizado confirma una tecnología declarada con
   * retroalimentación específica. Queda CORROBORATED_BY_ACADEMIC_REVIEW si el
   * repositorio no la respaldaba, y el comentario es retroalimentación
   * docente visible para el equipo. No es una nota ni una aprobación oficial.
   */
  async confirmSkill(user: AuthenticatedUser, projectId: string, skillId: string, comment: string) {
    await this.projectsService.findOneForUser(user, projectId);
    const fila = await this.projectSkills.findOne({ where: { projectId, skillId }, relations: { skill: true } });
    if (!fila) throw new NotFoundException('Esa tecnología no está declarada en el proyecto.');

    await this.feedback.save(this.feedback.create({
      projectId,
      teacherUserId: user.userId,
      comment: `Tecnología confirmada: ${fila.skill?.name ?? ''}. ${comment}`.slice(0, 1000),
    }));
    fila.academicReviewedById = user.userId;
    fila.academicReviewedAt = new Date();
    fila.academicReviewComment = comment.slice(0, 500);
    if (fila.evidenceStatus === ProjectSkillEvidenceStatus.DECLARED) {
      fila.evidenceStatus = ProjectSkillEvidenceStatus.CORROBORATED_BY_ACADEMIC_REVIEW;
      fila.evidenceSource = 'revisión docente';
    }
    await this.projectSkills.save(fila);

    await this.events.record({
      projectId,
      actorUserId: user.userId,
      eventType: ProjectEventType.FEEDBACK_ADDED,
      metadata: { tecnologiaConfirmada: fila.skill?.name ?? skillId },
    });
    await this.backing.recalculate(projectId, user.userId);
    await this.avisarEquipo(projectId, `skill-${skillId}-${Date.now()}`);
    return { skillId, name: fila.skill?.name ?? null, evidenceStatus: fila.evidenceStatus, academicReviewedAt: fila.academicReviewedAt };
  }

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

    // §40: la retroalimentación aumenta el nivel de respaldo, queda
    // asociada al docente y genera evento. No es nota ni calificación: que
    // un proyecto llegue a REVIEWED significa que alguien con criterio lo
    // miró, no que esté aprobado.
    await this.events.record({
      projectId,
      actorUserId: user.userId,
      eventType: ProjectEventType.FEEDBACK_ADDED,
      metadata: { longitud: dto.comment.length },
    });
    await this.backing.recalculate(projectId, user.userId);
    await this.avisarEquipo(projectId, saved.id);

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
