import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { GamificationTrigger, ProjectBackingTier, ProjectVisibility, RolNombre } from '@perfil/shared';
import { GamificationProposal } from '../entities/gamification-proposal.entity';
import { GamificationCriterion } from '../entities/gamification-criterion.entity';
import { GamificationEvent } from '../entities/gamification.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { User } from '../entities/user.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { TeacherScopeService } from '../access/teacher-scope.service';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { GamificationService } from './gamification.service';

/** Criterios que admiten una propuesta docente sobre un proyecto (§9.3). */
const TRIGGERS_DE_PROYECTO: GamificationTrigger[] = [GamificationTrigger.PROYECTO_CORROBORADO];
/** Respaldo mínimo: el proyecto tiene que poder sostener lo que se premia. */
const RESPALDOS: ProjectBackingTier[] = [
  ProjectBackingTier.SUPPORTED, ProjectBackingTier.CORROBORATED, ProjectBackingTier.REVIEWED,
];
/** Visibilidades que un docente puede ver (no «privado» ni «equipo»). */
const VISIBLES: ProjectVisibility[] = [ProjectVisibility.TEACHERS, ProjectVisibility.PROFILE, ProjectVisibility.PUBLIC_LINK];

/**
 * V4.1 A41-016 (§9.3, §9.4, A.10): el docente propone y Dirección decide.
 *
 * - El estudiante nunca se premia a sí mismo ni el docente otorga puntos.
 * - Solo sobre un proyecto visible a docentes, con respaldo suficiente, de un
 *   estudiante (dueño o integrante que confirmó su contribución) del alcance
 *   del docente. La lista de verificación ayuda; no aprueba sola.
 * - Al aprobarse, los puntos entran una vez (clave estudiante + criterio +
 *   origen) al historial.
 */
@Injectable()
export class GamificationProposalsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly scope: TeacherScopeService,
    private readonly gamification: GamificationService,
    private readonly audit: AuditService,
  ) {}

  private get repo() { return this.dataSource.getRepository(GamificationProposal); }

  async propose(
    user: AuthenticatedUser,
    dto: { projectId: string; studentProfileId: string; criterionId: string; reason: string },
  ) {
    if (user.role !== RolNombre.TEACHER) throw new ForbiddenException('Las propuestas de puntos las hacen los docentes.');
    const motivo = (dto.reason ?? '').trim();
    if (motivo.length < 10) {
      const m = 'Explica por qué lo propones (al menos 10 caracteres): Dirección lo verá.';
      throw new BadRequestException({ message: m, fields: { reason: [m] } });
    }
    const criterio = await this.dataSource.getRepository(GamificationCriterion).findOne({ where: { id: dto.criterionId } });
    if (!criterio || !criterio.isActive || criterio.isBonus || !TRIGGERS_DE_PROYECTO.includes(criterio.trigger)) {
      const m = 'Elige un criterio vigente para proyectos.';
      throw new BadRequestException({ message: m, fields: { criterionId: [m] } });
    }
    const proyecto = await this.dataSource.getRepository(Project).findOne({ where: { id: dto.projectId } });
    if (!proyecto || !VISIBLES.includes(proyecto.visibility)) throw new NotFoundException('Proyecto no encontrado.');
    // El alcance del docente: el estudiante tiene que ser de sus semestres.
    const perfil = await this.scope.assertCanAccessProfile(user, dto.studentProfileId).catch(() => null);
    if (!perfil) throw new NotFoundException('Proyecto no encontrado.');
    const esDueno = proyecto.createdByProfileId === perfil.id;
    const esIntegrante = !esDueno && !!(await this.dataSource.getRepository(ProjectMember).findOne({
      where: { projectId: proyecto.id, userId: perfil.userId },
    }))?.contributionConfirmedAt;
    if (!esDueno && !esIntegrante) {
      const m = 'El estudiante no figura en ese proyecto con su contribución confirmada.';
      throw new BadRequestException({ message: m, fields: { studentProfileId: [m] } });
    }
    if (!RESPALDOS.includes(proyecto.backingTier)) {
      const m = 'El proyecto todavía no tiene respaldo suficiente para premiarse.';
      throw new BadRequestException({ code: 'PROJECT_BACKING_INSUFFICIENT', message: m });
    }
    const vigente = await this.repo.findOne({
      where: {
        criterionId: criterio.id, sourceType: 'project', sourceId: proyecto.id,
        studentProfileId: perfil.id, status: In(['pending', 'approved']),
      },
    });
    if (vigente) throw new ConflictException('Ya hay una propuesta igual pendiente o aprobada.');
    // §9.6: una recompensa por hecho. Antes de V4.1 el proyecto corroborado
    // daba puntos solo; si ya los dio, no se vuelve a premiar el mismo hecho.
    const yaPremiado = await this.dataSource.getRepository(GamificationEvent).findOne({
      where: { studentProfileId: perfil.id, trigger: criterio.trigger, sourceEntityType: 'project', sourceEntityId: proyecto.id },
    });
    if (yaPremiado) throw new ConflictException('Ese proyecto ya recibió puntos por este hecho.');
    const guardada = await this.repo.save(this.repo.create({
      criterionId: criterio.id, sourceType: 'project', sourceId: proyecto.id,
      studentProfileId: perfil.id, proposedBy: user.userId, reason: motivo, status: 'pending',
    }));
    await this.audit.record({
      actorUserId: user.userId,
      eventType: AuditEventType.GAMIFICATION_PROPOSED,
      entityType: 'gamification_proposal',
      entityId: guardada.id,
      metadata: { criterionId: criterio.id, projectId: proyecto.id, studentProfileId: perfil.id },
    });
    return this.vista([guardada]).then((v) => v[0]);
  }

  /** Docente: las suyas. Dirección y Administración: todas (por estado). */
  async list(user: AuthenticatedUser, status?: string) {
    const where: Record<string, unknown> = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) where.status = status;
    if (user.role === RolNombre.TEACHER) where.proposedBy = user.userId;
    else if (user.role !== RolNombre.CAREER_DIRECTOR && user.role !== RolNombre.ADMIN) {
      throw new ForbiddenException('Su rol no consulta propuestas de puntos.');
    }
    const filas = await this.repo.find({ where, order: { createdAt: 'DESC' }, take: 200 });
    return this.vista(filas);
  }

  async review(user: AuthenticatedUser, id: string, decision: 'approve' | 'reject', comment?: string) {
    if (user.role !== RolNombre.CAREER_DIRECTOR && user.role !== RolNombre.ADMIN) {
      throw new ForbiddenException('Las propuestas de puntos las decide Dirección.');
    }
    const propuesta = await this.repo.findOne({ where: { id } });
    if (!propuesta) throw new NotFoundException('Propuesta no encontrada.');
    if (propuesta.status !== 'pending') throw new ConflictException('Esa propuesta ya fue decidida.');
    if (decision === 'reject' && !comment?.trim()) {
      const m = 'Explica por qué se rechaza.';
      throw new BadRequestException({ message: m, fields: { comment: [m] } });
    }
    const criterio = await this.dataSource.getRepository(GamificationCriterion).findOne({ where: { id: propuesta.criterionId } });
    if (decision === 'approve') {
      if (!criterio?.isActive) throw new ConflictException('El criterio ya no está vigente.');
      const proyecto = await this.dataSource.getRepository(Project).findOne({ where: { id: propuesta.sourceId } });
      await this.gamification.award(propuesta.studentProfileId, {
        trigger: criterio.trigger,
        // §9.6: una recompensa por hecho (estudiante + criterio + origen).
        dedupeKey: `criterio:${criterio.id}:project:${propuesta.sourceId}`,
        points: criterio.points,
        reason: `${criterio.name} — «${proyecto?.title ?? 'proyecto'}» (propuesto por docente, aprobado por Dirección)`,
        sourceEntityType: 'project',
        sourceEntityId: propuesta.sourceId,
      });
    }
    propuesta.status = decision === 'approve' ? 'approved' : 'rejected';
    propuesta.reviewComment = comment?.trim() || null;
    propuesta.reviewedBy = user.userId;
    propuesta.reviewedAt = new Date();
    await this.repo.save(propuesta);
    await this.audit.record({
      actorUserId: user.userId,
      eventType: AuditEventType.GAMIFICATION_PROPOSAL_REVIEWED,
      entityType: 'gamification_proposal',
      entityId: propuesta.id,
      metadata: { decision, comment: propuesta.reviewComment },
    });
    return (await this.vista([propuesta]))[0];
  }

  /** Lo que Dirección necesita para decidir: proyecto, estudiante, criterio, motivo y respaldo. */
  private async vista(filas: GamificationProposal[]) {
    if (filas.length === 0) return [];
    const ids = (k: keyof GamificationProposal) => [...new Set(filas.map((f) => f[k] as string))];
    const [criterios, proyectos, perfiles, docentes] = await Promise.all([
      this.dataSource.getRepository(GamificationCriterion).find({ where: { id: In(ids('criterionId')) } }),
      this.dataSource.getRepository(Project).find({ where: { id: In(ids('sourceId')) } }),
      this.dataSource.getRepository(StudentProfile).find({ where: { id: In(ids('studentProfileId')) }, relations: { user: true } }),
      this.dataSource.getRepository(User).find({ where: { id: In(ids('proposedBy')) } }),
    ]);
    return filas.map((f) => {
      const c = criterios.find((x) => x.id === f.criterionId);
      const p = proyectos.find((x) => x.id === f.sourceId);
      const e = perfiles.find((x) => x.id === f.studentProfileId);
      const d = docentes.find((x) => x.id === f.proposedBy);
      return {
        id: f.id,
        status: f.status,
        reason: f.reason,
        reviewComment: f.reviewComment,
        createdAt: f.createdAt,
        reviewedAt: f.reviewedAt,
        criterion: c ? { id: c.id, name: c.name, points: c.points } : null,
        project: p ? { id: p.id, title: p.title, backingTier: p.backingTier, repositoryUrl: p.repositoryUrl ?? null } : null,
        student: e ? { profileId: e.id, name: `${e.user?.firstName ?? ''} ${e.user?.lastName ?? ''}`.trim(), semester: e.semester } : null,
        proposedBy: d ? `${d.firstName} ${d.lastName}` : null,
      };
    });
  }
}
