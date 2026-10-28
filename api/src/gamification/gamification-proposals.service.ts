import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { GAMIFICATION_TRIGGER_LABEL, GamificationTrigger, ProjectBackingTier, ProjectVisibility, RolNombre } from '@perfil/shared';
import { GamificationProposal } from '../entities/gamification-proposal.entity';
import { GamificationCriterion } from '../entities/gamification-criterion.entity';
import { GamificationEvent } from '../entities/gamification.entity';
import { LearningResource } from '../entities/learning-resource.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { User } from '../entities/user.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { TeacherScopeService } from '../access/teacher-scope.service';
import { ApprovalPoliciesService } from '../access/approval-policies.service';
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

/** Tipo del origen en el historial de puntos (`gamification_events.source_entity_type`). */
const ORIGEN_EN_HISTORIAL = { project: 'project', resource: 'learning_resource' } as const;

type Origen = { tipo: 'project'; proyecto: Project } | { tipo: 'resource'; recurso: LearningResource };

/**
 * V4.1 A41-016 (§9.3, §9.4, A.10) y V5 §10: el docente propone y Dirección decide.
 *
 * - El estudiante nunca se premia a sí mismo.
 * - Proyecto (PROJECT_TEACHER_RECOGNITION): visible a docentes, con respaldo
 *   suficiente, de un estudiante (dueño o integrante que confirmó su
 *   contribución) del alcance del docente. Reconocer no cambia el respaldo.
 * - Recurso (RESOURCE_COMPLETION_ATTESTED, V5 §8.3): publicado y con su
 *   criterio de «completado»; el docente da fe con sustento. Abrirlo,
 *   descargarlo o guardarlo nunca lo dispara.
 * - Con autonomía de Dirección (V5 §9.2) se otorga sin revisión y queda en el
 *   historial de acciones directas.
 * - Los puntos entran una vez (clave estudiante + criterio + origen), con quién
 *   los otorgó y quién los aprobó (V5 §10.3).
 */
@Injectable()
export class GamificationProposalsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly scope: TeacherScopeService,
    private readonly gamification: GamificationService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalPoliciesService,
  ) {}

  private get repo() { return this.dataSource.getRepository(GamificationProposal); }

  async propose(
    user: AuthenticatedUser,
    dto: { projectId?: string; resourceId?: string; studentProfileId: string; criterionId: string; reason: string },
  ) {
    if (user.role !== RolNombre.TEACHER) throw new ForbiddenException('Las propuestas de puntos las hacen los docentes.');
    if (!!dto.projectId === !!dto.resourceId) {
      const m = 'Indica un proyecto o un recurso (uno de los dos).';
      throw new BadRequestException({ message: m, fields: { projectId: [m] } });
    }
    const motivo = (dto.reason ?? '').trim();
    if (motivo.length < 10) {
      const m = dto.resourceId
        ? 'Explica cómo sabes que lo completó (al menos 10 caracteres): queda como sustento.'
        : 'Explica por qué lo propones (al menos 10 caracteres): Dirección lo verá.';
      throw new BadRequestException({ message: m, fields: { reason: [m] } });
    }
    const criterio = await this.dataSource.getRepository(GamificationCriterion).findOne({ where: { id: dto.criterionId } });
    const disparador = dto.resourceId ? GamificationTrigger.RECURSO_COMPLETADO_ATESTIGUADO : TRIGGERS_DE_PROYECTO[0];
    if (!criterio || !criterio.isActive || criterio.isBonus || criterio.trigger !== disparador) {
      const m = dto.resourceId ? 'Elige un criterio vigente de recurso completado.' : 'Elige un criterio vigente para proyectos.';
      throw new BadRequestException({ message: m, fields: { criterionId: [m] } });
    }
    // El alcance del docente: el estudiante tiene que ser de sus semestres.
    const perfil = await this.scope.assertCanAccessProfile(user, dto.studentProfileId).catch(() => null);
    const origen = dto.projectId
      ? await this.origenProyecto(dto.projectId, perfil)
      : await this.origenRecurso(dto.resourceId!, criterio, perfil);
    if (!perfil) throw new NotFoundException(dto.projectId ? 'Proyecto no encontrado.' : 'Estudiante no encontrado.');
    const sourceType = origen.tipo;
    const sourceId = origen.tipo === 'project' ? origen.proyecto.id : origen.recurso.id;
    const titulo = origen.tipo === 'project' ? origen.proyecto.title : origen.recurso.title;

    const vigente = await this.repo.findOne({
      where: { criterionId: criterio.id, sourceType, sourceId, studentProfileId: perfil.id, status: In(['pending', 'approved']) },
    });
    if (vigente) throw new ConflictException('Ya hay una propuesta igual pendiente o aprobada.');
    // §9.6: una recompensa por hecho. Antes de V4.1 el proyecto corroborado
    // daba puntos solo; si ya los dio, no se vuelve a premiar el mismo hecho.
    const yaPremiado = await this.dataSource.getRepository(GamificationEvent).findOne({
      where: { studentProfileId: perfil.id, trigger: criterio.trigger, sourceEntityType: ORIGEN_EN_HISTORIAL[sourceType], sourceEntityId: sourceId },
    });
    if (yaPremiado) throw new ConflictException(`${sourceType === 'project' ? 'Ese proyecto' : 'Ese recurso'} ya dio puntos a este estudiante por este hecho.`);
    // V5 §9.2: con una excepción de Dirección, el docente otorga sin revisión;
    // queda en el historial de acciones directas, no en la bandeja (§9.4).
    const politica = await this.approvals.vigente(user, 'GAMIFICATION');
    const guardada = await this.repo.save(this.repo.create({
      criterionId: criterio.id, sourceType, sourceId,
      studentProfileId: perfil.id, proposedBy: user.userId, reason: motivo,
      status: politica ? 'approved' : 'pending', policyId: politica?.id ?? null,
    }));
    if (politica) {
      await this.gamification.award(perfil.id, {
        trigger: criterio.trigger,
        dedupeKey: `criterio:${criterio.id}:${sourceType}:${sourceId}`,
        points: criterio.points,
        reason: `${criterio.name} — «${titulo}» (otorgado por docente con autonomía de Dirección)`,
        sourceEntityType: ORIGEN_EN_HISTORIAL[sourceType],
        sourceEntityId: sourceId,
        criterionId: criterio.id,
        awardedBy: user.userId,
        approvedBy: null,
      });
    }
    await this.audit.record({
      actorUserId: user.userId,
      eventType: politica ? AuditEventType.GAMIFICATION_AWARDED_DIRECT : AuditEventType.GAMIFICATION_PROPOSED,
      entityType: 'gamification_proposal',
      entityId: guardada.id,
      metadata: {
        criterionId: criterio.id, sourceType, sourceId, studentProfileId: perfil.id,
        ...(sourceType === 'project' ? { projectId: sourceId } : { resourceId: sourceId }),
        ...(politica ? { policyId: politica.id, points: criterio.points, reason: motivo } : {}),
      },
    });
    return this.vista([guardada]).then((v) => v[0]);
  }

  private async origenProyecto(projectId: string, perfil: StudentProfile | null): Promise<Origen> {
    const proyecto = await this.dataSource.getRepository(Project).findOne({ where: { id: projectId } });
    if (!proyecto || !VISIBLES.includes(proyecto.visibility) || !perfil) throw new NotFoundException('Proyecto no encontrado.');
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
    return { tipo: 'project', proyecto };
  }

  /** V5 §8.3: solo un recurso publicado y con su criterio de «completado». */
  private async origenRecurso(resourceId: string, criterio: GamificationCriterion, perfil: StudentProfile | null): Promise<Origen> {
    const recurso = await this.dataSource.getRepository(LearningResource).findOne({ where: { id: resourceId } });
    const publicado = !!recurso && recurso.status === 'active' && (recurso.reviewStatus === 'not_required' || recurso.reviewStatus === 'approved');
    if (!recurso || !publicado || !perfil) throw new NotFoundException('Recurso no encontrado.');
    if (!recurso.criterionId) {
      const m = 'Este recurso no tiene criterio de «completado»: quien lo administra puede agregarlo.';
      throw new BadRequestException({ code: 'RESOURCE_WITHOUT_CRITERION', message: m, fields: { resourceId: [m] } });
    }
    if (recurso.criterionId !== criterio.id) {
      const m = 'Usa el criterio que tiene configurado el recurso.';
      throw new BadRequestException({ message: m, fields: { criterionId: [m] } });
    }
    return { tipo: 'resource', recurso };
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
      const titulo = propuesta.sourceType === 'resource'
        ? (await this.dataSource.getRepository(LearningResource).findOne({ where: { id: propuesta.sourceId } }))?.title ?? 'recurso'
        : (await this.dataSource.getRepository(Project).findOne({ where: { id: propuesta.sourceId } }))?.title ?? 'proyecto';
      await this.gamification.award(propuesta.studentProfileId, {
        trigger: criterio.trigger,
        // §9.6: una recompensa por hecho (estudiante + criterio + origen).
        dedupeKey: `criterio:${criterio.id}:${propuesta.sourceType}:${propuesta.sourceId}`,
        points: criterio.points,
        reason: `${criterio.name} — «${titulo}» (propuesto por docente, aprobado por Dirección)`,
        sourceEntityType: ORIGEN_EN_HISTORIAL[propuesta.sourceType],
        sourceEntityId: propuesta.sourceId,
        criterionId: criterio.id,
        awardedBy: propuesta.proposedBy,
        approvedBy: user.userId,
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

  /**
   * V5 §10.3: historial de puntos de un estudiante, para «Puntos de
   * estudiantes». Fecha, ±puntos, criterio, origen, quién otorgó y quién
   * aprobó, motivo y estado (aplicado, revertido o pendiente). El docente, solo
   * de los estudiantes de su alcance. No hay ranking.
   */
  async historial(user: AuthenticatedUser, studentProfileId: string) {
    const perfil = await this.scope.assertCanAccessProfile(user, studentProfileId);
    const m = this.dataSource.manager;
    const eventos: {
      id: string; occurred_at: Date; points: number; reason: string; trigger: string; dedupe_key: string;
      source_entity_type: string | null; source_entity_id: string | null;
      criterion: string | null; awarded_by: string | null; approved_by: string | null;
      activity_id: string | null; activity_title: string | null; project_title: string | null; resource_title: string | null;
    }[] = await m.query(`
      SELECT e.id, e.occurred_at, e.points, e.reason, e.trigger::text AS trigger, e.dedupe_key,
             e.source_entity_type, e.source_entity_id,
             c.name AS criterion,
             ua.first_name || ' ' || ua.last_name AS awarded_by,
             up.first_name || ' ' || up.last_name AS approved_by,
             a.id AS activity_id, a.title AS activity_title,
             p.title AS project_title, lr.title AS resource_title
        FROM gamification_events e
        LEFT JOIN gamification_criteria c ON c.id = e.criterion_id
        LEFT JOIN users ua ON ua.id = e.awarded_by
        LEFT JOIN users up ON up.id = e.approved_by
        LEFT JOIN activity_registrations r ON e.source_entity_type = 'activity_registration' AND r.id = e.source_entity_id
        LEFT JOIN activities a ON a.id = r.activity_id
        LEFT JOIN projects p ON e.source_entity_type = 'project' AND p.id = e.source_entity_id
        LEFT JOIN learning_resources lr ON e.source_entity_type = 'learning_resource' AND lr.id = e.source_entity_id
       WHERE e.student_profile_id = $1
       ORDER BY e.occurred_at DESC
       LIMIT 300`, [perfil.id]);
    const pendientes = await this.repo.find({ where: { studentProfileId: perfil.id, status: 'pending' }, order: { createdAt: 'DESC' } });
    const vistaPendientes = await this.vista(pendientes);
    const origen = (e: (typeof eventos)[number]) => {
      if (e.source_entity_type === 'activity_registration') return { type: 'activity' as const, id: e.activity_id, title: e.activity_title };
      if (e.source_entity_type === 'project') return { type: 'project' as const, id: e.source_entity_id, title: e.project_title };
      if (e.source_entity_type === 'learning_resource') return { type: 'resource' as const, id: e.source_entity_id, title: e.resource_title };
      return { type: 'other' as const, id: e.source_entity_id, title: null };
    };
    const total = eventos.reduce((s, e) => s + e.points, 0);
    if (user.role === RolNombre.TEACHER) {
      await this.audit.record({
        actorUserId: user.userId,
        eventType: AuditEventType.GAMIFICATION_SCOPE_VIEWED,
        entityType: 'student_profile',
        entityId: perfil.id,
        metadata: { detail: 'history' },
      });
    }
    return {
      student: { profileId: perfil.id, name: `${perfil.user?.firstName ?? ''} ${perfil.user?.lastName ?? ''}`.trim(), semester: perfil.semester },
      totalPoints: total,
      items: [
        ...vistaPendientes.map((p) => ({
          id: p.id,
          at: p.createdAt,
          points: p.criterion?.points ?? 0,
          criterion: p.criterion?.name ?? null,
          family: null as string | null,
          origin: p.project
            ? { type: 'project' as const, id: p.project.id, title: p.project.title }
            : p.resource ? { type: 'resource' as const, id: p.resource.id, title: p.resource.title } : { type: 'other' as const, id: null, title: null },
          awardedBy: p.proposedBy,
          approvedBy: null as string | null,
          reason: p.reason,
          status: 'PENDING' as const,
        })),
        ...eventos.map((e) => ({
          id: e.id,
          at: e.occurred_at,
          points: e.points,
          criterion: e.criterion,
          family: GAMIFICATION_TRIGGER_LABEL[e.trigger] ?? e.trigger,
          origin: origen(e),
          awardedBy: e.awarded_by,
          approvedBy: e.approved_by,
          reason: e.reason,
          // Un reverso es un movimiento propio en el historial: nada se borra.
          status: (e.points < 0 ? 'REVERSED' : 'APPLIED') as 'REVERSED' | 'APPLIED',
        })),
      ],
    };
  }

  /** Lo que Dirección necesita para decidir: origen, estudiante, criterio, motivo y respaldo. */
  private async vista(filas: GamificationProposal[]) {
    if (filas.length === 0) return [];
    const ids = (k: keyof GamificationProposal, tipo?: GamificationProposal['sourceType']) =>
      [...new Set(filas.filter((f) => !tipo || f.sourceType === tipo).map((f) => f[k] as string))];
    const deProyecto = ids('sourceId', 'project');
    const deRecurso = ids('sourceId', 'resource');
    const [criterios, proyectos, recursos, perfiles, docentes] = await Promise.all([
      this.dataSource.getRepository(GamificationCriterion).find({ where: { id: In(ids('criterionId')) } }),
      deProyecto.length ? this.dataSource.getRepository(Project).find({ where: { id: In(deProyecto) } }) : Promise.resolve([] as Project[]),
      deRecurso.length ? this.dataSource.getRepository(LearningResource).find({ where: { id: In(deRecurso) } }) : Promise.resolve([] as LearningResource[]),
      this.dataSource.getRepository(StudentProfile).find({ where: { id: In(ids('studentProfileId')) }, relations: { user: true } }),
      this.dataSource.getRepository(User).find({ where: { id: In(ids('proposedBy')) } }),
    ]);
    return filas.map((f) => {
      const c = criterios.find((x) => x.id === f.criterionId);
      const p = f.sourceType === 'project' ? proyectos.find((x) => x.id === f.sourceId) : undefined;
      const r = f.sourceType === 'resource' ? recursos.find((x) => x.id === f.sourceId) : undefined;
      const e = perfiles.find((x) => x.id === f.studentProfileId);
      const d = docentes.find((x) => x.id === f.proposedBy);
      return {
        id: f.id,
        status: f.status,
        sourceType: f.sourceType,
        reason: f.reason,
        reviewComment: f.reviewComment,
        createdAt: f.createdAt,
        reviewedAt: f.reviewedAt,
        criterion: c ? { id: c.id, name: c.name, points: c.points } : null,
        project: p ? { id: p.id, title: p.title, backingTier: p.backingTier, repositoryUrl: p.repositoryUrl ?? null } : null,
        resource: r ? { id: r.id, title: r.title } : null,
        student: e ? { profileId: e.id, name: `${e.user?.firstName ?? ''} ${e.user?.lastName ?? ''}`.trim(), semester: e.semester } : null,
        proposedBy: d ? `${d.firstName} ${d.lastName}` : null,
        // V5 §9.2: otorgado por el docente con una excepción, sin revisión.
        direct: !!f.policyId,
      };
    });
  }
}
