import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  TEAM_APPLICATION_REJECTION_REASONS,
  TeamApplicationRejectionReason,
  TeamApplicationStatus,
  TeamInvitationStatus,
  TeamNameStatus,
  TeamNeedStatus,
  TeamStatus,
} from '@perfil/shared';
import { StudentProfile } from '../entities/student-profile.entity';
import {
  Team,
  TeamApplication,
  TeamInvitation,
  TeamMember,
  TeamNeed,
} from '../entities/collaboration.entity';
import { BackedSkillsService } from '../backed-skills/backed-skills.service';
import { NOTIFICATION_EMITTER, NotificationEmitter } from '../notifications/notification.port';
import { semestreElegible } from './team-need.rules';
import { AuditEventType, AuditService } from '../audit/audit.service';

const ENLACE = '/student/collaboration?tab=equipos';
const motivoDe = (code: string | null) =>
  TEAM_APPLICATION_REJECTION_REASONS.find((r) => r.code === code)?.label ?? null;

/**
 * Postulaciones a necesidades de equipo (V3 §31, §55).
 *
 *   estudiante ve una necesidad abierta para su semestre → postula
 *   → el responsable acepta (entra al equipo) o rechaza con un motivo
 *   predefinido y, si ayuda, un comentario breve.
 *
 * Postular no es insistir: hay una fila por (necesidad, estudiante); retirarse
 * permite volver a postular, un rechazo no. Al llenarse los cupos la necesidad
 * se cierra y las postulaciones pendientes se rechazan con «equipo completo»,
 * para que nadie quede esperando una respuesta que no llegará.
 */
@Injectable()
export class TeamApplicationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(TeamApplication) private readonly applications: Repository<TeamApplication>,
    @InjectRepository(TeamNeed) private readonly needs: Repository<TeamNeed>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(TeamMember) private readonly members: Repository<TeamMember>,
    @InjectRepository(TeamInvitation) private readonly invitations: Repository<TeamInvitation>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    private readonly backedSkills: BackedSkillsService,
    @Inject(NOTIFICATION_EMITTER) private readonly notifications: NotificationEmitter,
    private readonly audit: AuditService,
  ) {}

  async apply(applicantProfileId: string, needId: string, message?: string) {
    const need = await this.needs.findOne({ where: { id: needId }, relations: { owner: true } });
    const yo = await this.profiles.findOne({ where: { id: applicantProfileId }, relations: { user: true } });
    // Quien no puede verla tampoco sabe que existe (§55: «estudiante permitido»).
    if (!need || !yo || !semestreElegible(need.targetSemesters, yo.semester)) {
      throw new NotFoundException('Necesidad no encontrada.');
    }
    if (need.ownerProfileId === applicantProfileId) {
      throw new BadRequestException({ code: 'TEAM_APPLICATION_OWN_NEED', message: 'Es tu propia necesidad.' });
    }
    if (need.status !== TeamNeedStatus.OPEN) {
      throw new ConflictException({ code: 'TEAM_NEED_CLOSED', message: 'Esa necesidad ya no recibe postulaciones.' });
    }
    const equipo = await this.teams.findOne({ where: { teamNeedId: need.id } });
    if (equipo) {
      if (await this.members.exists({ where: { teamId: equipo.id, studentProfileId: applicantProfileId } })) {
        throw new ConflictException({ code: 'TEAM_ALREADY_MEMBER', message: 'Ya formas parte de ese equipo.' });
      }
      await this.assertHaySitio(need, equipo.id);
    }

    const previa = await this.applications.findOne({ where: { teamNeedId: need.id, applicantProfileId } });
    if (previa?.status === TeamApplicationStatus.PENDING) {
      throw new ConflictException({ code: 'TEAM_APPLICATION_PENDING', message: 'Ya postulaste; espera la respuesta.' });
    }
    if (previa?.status === TeamApplicationStatus.ACCEPTED) {
      throw new ConflictException({ code: 'TEAM_ALREADY_MEMBER', message: 'Ya te aceptaron en ese equipo.' });
    }
    if (previa?.status === TeamApplicationStatus.REJECTED) {
      throw new ConflictException({
        code: 'TEAM_APPLICATION_REJECTED',
        message: 'El responsable ya respondió a tu postulación. Puedes buscar otras necesidades abiertas.',
      });
    }

    let guardada: TeamApplication;
    if (previa) {
      previa.status = TeamApplicationStatus.PENDING;
      previa.message = message ?? null;
      previa.decidedAt = null;
      guardada = await this.applications.save(previa);
    } else {
      guardada = await this.applications.save(this.applications.create({
        teamNeedId: need.id, applicantProfileId, message: message ?? null, status: TeamApplicationStatus.PENDING,
      }));
    }

    // V3 §65.
    await this.audit.record({
      actorUserId: yo.userId,
      eventType: AuditEventType.TEAM_APPLICATION_CREATED,
      entityType: 'team_application',
      entityId: guardada.id,
      metadata: { necesidad: need.id, conPresentacion: !!message },
    });
    const nombre = yo.user ? `${yo.user.firstName} ${yo.user.lastName}` : 'Un estudiante';
    await this.avisar({
      userId: need.owner.userId,
      kind: 'TEAM_APPLICATION',
      title: 'Nueva postulación a tu equipo',
      body: `${nombre} postuló a «${need.purpose}».`,
      link: ENLACE,
      entityType: 'team_application',
      entityId: guardada.id,
      dedupeKey: `team-application:${guardada.id}:${guardada.updatedAt.getTime()}`,
    });
    return this.vista(guardada, need);
  }

  async withdraw(applicantProfileId: string, applicationId: string) {
    const a = await this.applications.findOne({ where: { id: applicationId, applicantProfileId } });
    if (!a) throw new NotFoundException('Postulación no encontrada.');
    if (a.status !== TeamApplicationStatus.PENDING) {
      throw new ConflictException({ code: 'TEAM_APPLICATION_DECIDED', message: 'Esa postulación ya tiene respuesta.' });
    }
    a.status = TeamApplicationStatus.WITHDRAWN;
    a.decidedAt = new Date();
    await this.applications.save(a);
    return { id: a.id, status: a.status };
  }

  async mine(applicantProfileId: string) {
    const filas = await this.applications.find({
      where: { applicantProfileId },
      relations: { need: { owner: { user: true } } },
      order: { createdAt: 'DESC' },
    });
    return filas.map((a) => this.vista(a, a.need));
  }

  /**
   * Lo que el responsable necesita para decidir: quién, su semestre, su
   * disponibilidad y cuáles de las habilidades que faltan tiene respaldadas.
   * Nada de puntajes ni de rankings entre postulantes.
   */
  async forNeed(ownerProfileId: string, needId: string) {
    const need = await this.needs.findOne({ where: { id: needId }, relations: { requiredSkills: { skill: true } } });
    if (!need) throw new NotFoundException('Necesidad no encontrada.');
    if (need.ownerProfileId !== ownerProfileId) throw new ForbiddenException('Esa necesidad es de otro estudiante.');

    const filas = await this.applications.find({
      where: { teamNeedId: need.id, status: In([TeamApplicationStatus.PENDING, TeamApplicationStatus.ACCEPTED, TeamApplicationStatus.REJECTED]) },
      relations: { applicant: { user: true } },
      order: { createdAt: 'ASC' },
    });
    const respaldo = filas.length ? await this.backedSkills.forProfiles(filas.map((f) => f.applicantProfileId)) : new Map();
    const requeridas = new Map((need.requiredSkills ?? []).map((s) => [s.skillId, s.skill?.name ?? null]));
    const orden = { [TeamApplicationStatus.PENDING]: 0, [TeamApplicationStatus.ACCEPTED]: 1 } as Record<string, number>;
    return filas
      .map((a) => ({
        ...this.vista(a, need),
        applicant: {
          profileId: a.applicantProfileId,
          name: a.applicant?.user ? `${a.applicant.user.firstName} ${a.applicant.user.lastName}` : 'Estudiante',
          semester: a.applicant?.semester ?? null,
          availability: a.applicant?.availability ?? null,
        },
        coversSkills: ((respaldo.get(a.applicantProfileId) ?? []) as { skillId: string; name: string }[])
          .filter((s) => requeridas.has(s.skillId))
          .map((s) => ({ skillId: s.skillId, name: s.name })),
      }))
      .sort((x, y) => (orden[x.status] ?? 2) - (orden[y.status] ?? 2));
  }

  async decide(
    ownerProfileId: string,
    applicationId: string,
    dto: { decision: 'accept' | 'reject'; reason?: TeamApplicationRejectionReason; comment?: string },
  ) {
    const a = await this.applications.findOne({
      where: { id: applicationId },
      relations: { need: { owner: { user: true } }, applicant: true },
    });
    // De otra necesidad: 404, sin revelar que existe.
    if (!a || a.need.ownerProfileId !== ownerProfileId) throw new NotFoundException('Postulación no encontrada.');
    if (a.status !== TeamApplicationStatus.PENDING) {
      throw new ConflictException({ code: 'TEAM_APPLICATION_DECIDED', message: 'Esa postulación ya tiene respuesta.' });
    }
    const need = a.need;

    if (dto.decision === 'reject') {
      if (!dto.reason) {
        throw new BadRequestException({
          code: 'TEAM_APPLICATION_REASON_REQUIRED',
          message: 'Elige un motivo.',
          fields: { reason: ['Elige un motivo.'] },
        });
      }
      if (dto.reason === 'other' && !dto.comment?.trim()) {
        throw new BadRequestException({
          code: 'TEAM_APPLICATION_COMMENT_REQUIRED',
          message: 'Con «Otro motivo», explícalo en una línea.',
          fields: { comment: ['Explica el motivo en una línea.'] },
        });
      }
      await this.rechazar(a, dto.reason, dto.comment?.trim() || null);
      return { id: a.id, status: a.status, reason: a.rejectionReason, reasonLabel: motivoDe(a.rejectionReason) };
    }

    // Aceptar: el equipo se constituye si aún no existía (§31).
    const equipo = await this.equipoDe(need);
    await this.assertHaySitio(need, equipo.id);
    await this.dataSource.transaction(async (m) => {
      a.status = TeamApplicationStatus.ACCEPTED;
      a.decidedAt = new Date();
      await m.save(TeamApplication, a);
      await m.save(m.create(TeamMember, { teamId: equipo.id, studentProfileId: a.applicantProfileId }));
      // Una invitación pendiente a la misma persona deja de tener sentido.
      await m.update(TeamInvitation,
        { teamId: equipo.id, invitedProfileId: a.applicantProfileId, status: TeamInvitationStatus.PENDING },
        { status: TeamInvitationStatus.CANCELLED, decidedAt: new Date() });
    });
    await this.audit.record({
      actorUserId: need.owner?.userId ?? null,
      eventType: AuditEventType.TEAM_MEMBER_ACCEPTED,
      entityType: 'team',
      entityId: equipo.id,
      metadata: { integrante: a.applicantProfileId, via: 'postulacion' },
    });
    await this.avisar({
      userId: a.applicant.userId,
      kind: 'TEAM_APPLICATION_ACCEPTED',
      title: 'Te aceptaron en un equipo',
      body: `Ya formas parte de «${equipo.name}».`,
      link: ENLACE,
      entityType: 'team_application',
      entityId: a.id,
      dedupeKey: `team-application-accepted:${a.id}`,
    });

    // Cupos llenos: se cierra y nadie queda esperando.
    const dentro = await this.members.count({ where: { teamId: equipo.id } });
    let closed = false;
    if (dentro >= need.maxMembers) {
      closed = true;
      await this.needs.update({ id: need.id }, { status: TeamNeedStatus.CLOSED });
      const pendientes = await this.applications.find({
        where: { teamNeedId: need.id, status: TeamApplicationStatus.PENDING },
        relations: { need: true, applicant: true },
      });
      for (const p of pendientes) await this.rechazar(p, 'team_full', null);
    }
    return { id: a.id, status: a.status, teamId: equipo.id, needClosed: closed };
  }

  // -------------------------------------------------------------------------

  private async rechazar(a: TeamApplication, reason: TeamApplicationRejectionReason, comment: string | null) {
    a.status = TeamApplicationStatus.REJECTED;
    a.rejectionReason = reason;
    a.rejectionComment = comment;
    a.decidedAt = new Date();
    await this.applications.save(a);
    await this.avisar({
      userId: a.applicant.userId,
      kind: 'TEAM_APPLICATION_REJECTED',
      title: 'Respuesta a tu postulación',
      body: `«${a.need.purpose}»: ${motivoDe(reason)}.${comment ? ` ${comment}` : ''}`,
      link: ENLACE,
      entityType: 'team_application',
      entityId: a.id,
      dedupeKey: `team-application-rejected:${a.id}`,
    });
  }

  /** El equipo de la necesidad; si no existe, se crea con el responsable dentro. */
  private async equipoDe(need: TeamNeed): Promise<Team> {
    const existente = await this.teams.findOne({ where: { teamNeedId: need.id } });
    if (existente) return existente;
    const nombre = need.owner?.user?.firstName ? `Equipo de ${need.owner.user.firstName}` : 'Equipo nuevo';
    return this.dataSource.transaction(async (m) => {
      const equipo = await m.save(m.create(Team, {
        name: nombre.slice(0, 60),
        nameStatus: TeamNameStatus.OK,
        nameFlagReason: null,
        ownerProfileId: need.ownerProfileId,
        teamNeedId: need.id,
        status: TeamStatus.FORMING,
      }));
      await m.save(m.create(TeamMember, { teamId: equipo.id, studentProfileId: need.ownerProfileId, role: 'Responsable' }));
      return equipo;
    });
  }

  private async assertHaySitio(need: TeamNeed, teamId: string) {
    const dentro = await this.members.count({ where: { teamId } });
    if (dentro >= need.maxMembers) {
      throw new ConflictException({ code: 'TEAM_FULL', message: `El equipo ya alcanzó su máximo de ${need.maxMembers} integrantes.` });
    }
  }

  private vista(a: TeamApplication, need: TeamNeed | null) {
    return {
      id: a.id,
      status: a.status,
      message: a.message,
      rejectionReason: a.rejectionReason,
      rejectionReasonLabel: motivoDe(a.rejectionReason),
      rejectionComment: a.rejectionComment,
      createdAt: a.createdAt,
      decidedAt: a.decidedAt,
      need: need
        ? {
            id: need.id,
            purpose: need.purpose,
            status: need.status,
            owner: need.owner?.user ? `${need.owner.user.firstName} ${need.owner.user.lastName}` : null,
          }
        : null,
    };
  }

  private async avisar(evento: Parameters<NotificationEmitter['emit']>[0]): Promise<void> {
    try {
      await this.notifications.emit(evento);
    } catch {
      // sin efecto sobre la operación
    }
  }
}
