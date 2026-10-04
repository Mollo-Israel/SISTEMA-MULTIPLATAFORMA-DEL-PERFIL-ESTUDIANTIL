import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  AffinityLevel,
  AvailabilityRequirement,
  AvailabilityStatus,
  TEAM_SUGGESTION_WEIGHTS,
  TeamInvitationStatus,
  TeamNameStatus,
  TeamNeedStatus,
  TeamStatus,
  TeamSuggestionReason,
  UserStatus,
} from '@perfil/shared';
import { AffinityResult } from '../entities/affinity-result.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { BackedSkillsService } from '../backed-skills/backed-skills.service';
import { AiService } from '../ai/ai.service';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { checkTeamName, forbiddenTerms } from './team-name.rules';
import {
  Team,
  TeamInvitation,
  TeamMember,
  TeamNeed,
  TeamNeedArea,
  TeamNeedSkill,
} from '../entities/collaboration.entity';

/** Cuántos candidatos se devuelven como máximo. */
const MAX_SUGERENCIAS = 10;

/** Un motivo de sugerencia, con lo que aporta sobre 100 (§47). */
export interface MotivoSugerencia {
  code: TeamSuggestionReason;
  label: string;
  points: number;
}

/**
 * Equipos, necesidades y sugerencia de integrantes (§46, §47, §93).
 *
 * §46 abre con el objetivo —*«priorizar complementariedad»*— y §47 lo convierte
 * en una ponderación concreta: la mitad del puntaje es cuánto cubre el
 * candidato de lo que **falta**. Un equipo no se forma juntando a los cinco
 * mejores; se forma cubriendo huecos.
 *
 * §47 cierra con *«No enviar invitaciones automáticamente»*. Por eso aquí se
 * sugiere y nada más: invitar es una llamada aparte que hace una persona.
 */
@Injectable()
export class TeamsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(TeamNeed) private readonly needs: Repository<TeamNeed>,
    @InjectRepository(TeamNeedSkill) private readonly needSkills: Repository<TeamNeedSkill>,
    @InjectRepository(TeamNeedArea) private readonly needAreas: Repository<TeamNeedArea>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(TeamMember) private readonly members: Repository<TeamMember>,
    @InjectRepository(TeamInvitation)
    private readonly invitations: Repository<TeamInvitation>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(AffinityResult) private readonly affinities: Repository<AffinityResult>,
    private readonly backedSkills: BackedSkillsService,
    private readonly ai: AiService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  /**
   * §44: reglas primero —longitud, caracteres, contacto, términos prohibidos—
   * y, si pasan, la IA opcional busca ambigüedad. Lo que las reglas rechazan
   * no se guarda; lo que la IA marca se guarda pero no se comparte.
   */
  private async moderarNombre(raw: string, actorUserId: string, teamId: string | null) {
    const regla = checkTeamName(raw, forbiddenTerms(this.config.get<string>('TEAM_NAME_FORBIDDEN_TERMS')));
    if (!regla.ok) {
      await this.audit.record({
        actorUserId,
        eventType: AuditEventType.TEAM_NAME_MODERATED,
        entityType: 'team',
        entityId: teamId,
        metadata: { resultado: 'rechazado', regla: regla.code },
      });
      throw new BadRequestException({ code: regla.code, message: regla.message, fields: { name: [regla.message] } });
    }
    const ia = await this.ai.moderateTeamName(regla.name, actorUserId, teamId);
    if (ia.flagged) {
      await this.audit.record({
        actorUserId,
        eventType: AuditEventType.TEAM_NAME_MODERATED,
        entityType: 'team',
        entityId: teamId,
        metadata: { resultado: 'marcado' },
      });
    }
    return {
      name: regla.name,
      status: ia.flagged ? TeamNameStatus.FLAGGED : TeamNameStatus.OK,
      reason: ia.flagged
        ? [ia.reason ?? 'El asistente lo consideró ambiguo.', ia.suggestion ? `Sugerencia: ${ia.suggestion}.` : '']
            .filter(Boolean).join(' ').slice(0, 300)
        : null,
    };
  }

  private assertNombreCompartible(equipo: Team) {
    if (equipo.nameStatus === TeamNameStatus.FLAGGED) {
      throw new ConflictException({
        code: 'TEAM_NAME_FLAGGED',
        message: 'Corrige el nombre del equipo antes de invitar: quedó marcado para revisión.',
      });
    }
  }

  // =========================================================================
  // §46 · Necesidades
  // =========================================================================

  async createNeed(
    ownerProfileId: string,
    dto: {
      purpose: string;
      description?: string;
      projectId?: string;
      activityId?: string;
      maxMembers?: number;
      availabilityRequirement?: AvailabilityRequirement;
      requiredSkillIds?: string[];
      preferredAreaIds?: string[];
    },
  ) {
    const need = await this.needs.save(
      this.needs.create({
        ownerProfileId,
        purpose: dto.purpose,
        description: dto.description ?? null,
        projectId: dto.projectId ?? null,
        activityId: dto.activityId ?? null,
        maxMembers: dto.maxMembers ?? 5,
        availabilityRequirement: dto.availabilityRequirement ?? AvailabilityRequirement.ANY,
        status: TeamNeedStatus.OPEN,
      }),
    );
    await this.replaceNeedSkills(need.id, dto.requiredSkillIds ?? []);
    await this.replaceNeedAreas(need.id, dto.preferredAreaIds ?? []);
    return this.findNeed(need.id, ownerProfileId);
  }

  async updateNeed(
    ownerProfileId: string,
    needId: string,
    dto: {
      purpose?: string;
      description?: string;
      maxMembers?: number;
      availabilityRequirement?: AvailabilityRequirement;
      status?: TeamNeedStatus;
      requiredSkillIds?: string[];
      preferredAreaIds?: string[];
    },
  ) {
    const need = await this.ownNeed(ownerProfileId, needId);
    if (dto.purpose !== undefined) need.purpose = dto.purpose;
    if (dto.description !== undefined) need.description = dto.description ?? null;
    if (dto.maxMembers !== undefined) need.maxMembers = dto.maxMembers;
    if (dto.availabilityRequirement !== undefined) {
      need.availabilityRequirement = dto.availabilityRequirement;
    }
    if (dto.status !== undefined) need.status = dto.status;
    await this.needs.save(need);

    if (dto.requiredSkillIds !== undefined) {
      await this.replaceNeedSkills(need.id, dto.requiredSkillIds);
    }
    if (dto.preferredAreaIds !== undefined) {
      await this.replaceNeedAreas(need.id, dto.preferredAreaIds);
    }
    return this.findNeed(need.id, ownerProfileId);
  }

  /** Las necesidades abiertas de la carrera, para quien busca a qué sumarse. */
  async openNeeds(studentProfileId: string) {
    const filas = await this.needs.find({
      where: { status: TeamNeedStatus.OPEN },
      relations: {
        owner: { user: true },
        requiredSkills: { skill: true },
        preferredAreas: { academicArea: true },
      },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return filas.map((n) => this.vistaNecesidad(n, n.ownerProfileId === studentProfileId));
  }

  async myNeeds(ownerProfileId: string) {
    const filas = await this.needs.find({
      where: { ownerProfileId },
      relations: {
        owner: { user: true },
        requiredSkills: { skill: true },
        preferredAreas: { academicArea: true },
      },
      order: { createdAt: 'DESC' },
    });
    return filas.map((n) => this.vistaNecesidad(n, true));
  }

  async findNeed(needId: string, studentProfileId: string) {
    const need = await this.needs.findOne({
      where: { id: needId },
      relations: {
        owner: { user: true },
        requiredSkills: { skill: true },
        preferredAreas: { academicArea: true },
      },
    });
    if (!need) throw new NotFoundException('Necesidad no encontrada.');
    return this.vistaNecesidad(need, need.ownerProfileId === studentProfileId);
  }

  // =========================================================================
  // §47 · Sugerencia de integrantes
  // =========================================================================

  /**
   * Candidatos para cubrir una necesidad, con su motivo (§47).
   *
   * La ponderación es la de §47 y está en `TEAM_SUGGESTION_WEIGHTS`, en
   * `shared`, para que la pantalla muestre exactamente los mismos números que
   * el cálculo usa.
   *
   * Nadie recibe nada por aparecer aquí: §47 prohíbe invitar automáticamente.
   */
  async suggestions(ownerProfileId: string, needId: string) {
    const need = await this.ownNeed(ownerProfileId, needId, {
      requiredSkills: true,
      preferredAreas: true,
    });

    const requeridas = new Set((need.requiredSkills ?? []).map((s) => s.skillId));
    const areas = new Set((need.preferredAreas ?? []).map((a) => a.academicAreaId));

    // Quien ya está dentro no se sugiere, y lo que ya cubre el equipo deja de
    // ser un hueco: §46 pide complementariedad, no más de lo mismo.
    const equipo = await this.teams.findOne({ where: { teamNeedId: need.id } });
    const dentro = new Set<string>([ownerProfileId]);
    let cubiertasPorElEquipo = new Set<string>();
    if (equipo) {
      const integrantes = await this.members.find({ where: { teamId: equipo.id } });
      integrantes.forEach((m) => dentro.add(m.studentProfileId));
      const suyas = [...(await this.backedSkills.forProfiles([...dentro])).values()].flat();
      cubiertasPorElEquipo = new Set(
        suyas.map((s) => s.skillId).filter((id) => requeridas.has(id)),
      );
    } else {
      const propias = await this.backedSkills.forProfile(ownerProfileId);
      cubiertasPorElEquipo = new Set(
        propias.map((s) => s.skillId).filter((id) => requeridas.has(id)),
      );
    }

    const faltantes = [...requeridas].filter((id) => !cubiertasPorElEquipo.has(id));

    const invitados = await this.invitations.find({
      where: {
        teamId: equipo?.id ?? '00000000-0000-4000-8000-000000000000',
        status: In([TeamInvitationStatus.PENDING, TeamInvitationStatus.ACCEPTED]),
      },
    });
    invitados.forEach((i) => dentro.add(i.invitedProfileId));

    // §62 y §44: solo participa quien aceptó aparecer en sugerencias.
    const candidatos = await this.profiles
      .createQueryBuilder('p')
      .innerJoin('p.user', 'u')
      .select('p.id', 'profileId')
      .addSelect('p.semester', 'semester')
      .addSelect('p.availability', 'availability')
      .addSelect("CONCAT(u.first_name, ' ', u.last_name)", 'name')
      .where('p.peer_discoverable = true')
      .andWhere('u.status = :activo', { activo: UserStatus.ACTIVE })
      .andWhere('p.id NOT IN (:...dentro)', { dentro: [...dentro] })
      .getRawMany<{
        profileId: string;
        semester: number | null;
        availability: AvailabilityStatus;
        name: string;
      }>();
    if (candidatos.length === 0) return { need: this.vistaNecesidad(need, true), candidates: [] };

    const ids = candidatos.map((c) => c.profileId);
    // V2 §55: solo habilidades respaldadas por trayectoria (proyectos con
    // contribución confirmada, actividades confirmadas), nunca declaradas.
    const [porCandidato, afinidades] = await Promise.all([
      this.backedSkills.forProfiles(ids),
      areas.size > 0
        ? this.affinities.find({
            where: { studentProfileId: In(ids), academicAreaId: In([...areas]) },
          })
        : Promise.resolve([] as AffinityResult[]),
    ]);

    const afinidadPorCandidato = new Map<string, AffinityResult[]>();
    for (const a of afinidades) {
      const lista = afinidadPorCandidato.get(a.studentProfileId) ?? [];
      lista.push(a);
      afinidadPorCandidato.set(a.studentProfileId, lista);
    }

    const resultado = candidatos
      .map((c) => {
        const motivos: MotivoSugerencia[] = [];
        const suyas = porCandidato.get(c.profileId) ?? [];

        // ------------------------------------------- 50 % · lo que falta
        const cubre = suyas.filter((s) => faltantes.includes(s.skillId));
        if (faltantes.length > 0 && cubre.length > 0) {
          const proporcion = cubre.length / faltantes.length;
          motivos.push({
            code: TeamSuggestionReason.SKILL_COVERAGE,
            label: `Experiencia respaldada en ${cubre.length} de ${faltantes.length} habilidades que faltan: `
              + cubre.map((s) => s.name).slice(0, 3).join(', '),
            points: this.redondear(TEAM_SUGGESTION_WEIGHTS.SKILL_COVERAGE * proporcion),
          });
        }

        // --------------------------------- 20 % · afinidad con el contexto
        const suyasAfinidad = afinidadPorCandidato.get(c.profileId) ?? [];
        const mejor = suyasAfinidad.sort((a, b) => Number(b.score) - Number(a.score))[0];
        if (mejor && Number(mejor.score) > 0) {
          motivos.push({
            code: TeamSuggestionReason.CONTEXT_AFFINITY,
            label: 'Tiene afinidad con el área del equipo',
            points: this.redondear(
              TEAM_SUGGESTION_WEIGHTS.CONTEXT_AFFINITY * (Number(mejor.score) / 100),
            ),
          });
        }

        // ----------------------------------------- 15 % · disponibilidad
        const disponible = this.cumpleDisponibilidad(c.availability, need.availabilityRequirement);
        if (disponible && c.availability !== AvailabilityStatus.UNSPECIFIED) {
          motivos.push({
            code: TeamSuggestionReason.AVAILABILITY,
            label:
              c.availability === AvailabilityStatus.LOOKING
                ? 'Declaró que busca sumarse a algo'
                : 'Declaró que escucha propuestas',
            points: TEAM_SUGGESTION_WEIGHTS.AVAILABILITY,
          });
        }

        // ------------------------------------ 15 % · respaldo relacionado
        if (mejor && Number(mejor.supportScore ?? 0) > 0) {
          motivos.push({
            code: TeamSuggestionReason.SUPPORT_BACKED,
            label: 'Su trayectoria en el área está respaldada',
            points: this.redondear(
              TEAM_SUGGESTION_WEIGHTS.SUPPORT * (Number(mejor.supportScore) / 100),
            ),
          });
        }

        return {
          profileId: c.profileId,
          name: c.name,
          semester: c.semester === null ? null : Number(c.semester),
          availability: c.availability,
          /*
           * §47 nombra la disponibilidad entre los factores, y una necesidad
           * puede exigirla. Quien no la cumple no se descarta en silencio: se
           * deja fuera, porque el responsable pidió expresamente ese filtro.
           */
          meetsAvailability: disponible,
          reasons: motivos,
          score: this.redondear(motivos.reduce((a, m) => a + m.points, 0)),
        };
      })
      .filter((c) => c.meetsAvailability && c.reasons.length > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, MAX_SUGERENCIAS);

    return {
      need: this.vistaNecesidad(need, true),
      /** Lo que el equipo todavía no cubre: es de lo que trata §93. */
      missingSkills: (need.requiredSkills ?? [])
        .filter((s) => faltantes.includes(s.skillId))
        .map((s) => ({ skillId: s.skillId, name: s.skill?.name ?? null })),
      coveredSkills: (need.requiredSkills ?? [])
        .filter((s) => cubiertasPorElEquipo.has(s.skillId))
        .map((s) => ({ skillId: s.skillId, name: s.skill?.name ?? null })),
      candidates: resultado,
    };
  }

  private cumpleDisponibilidad(
    estado: AvailabilityStatus,
    requisito: AvailabilityRequirement,
  ): boolean {
    if (requisito === AvailabilityRequirement.ANY) return true;
    if (requisito === AvailabilityRequirement.LOOKING) {
      return estado === AvailabilityStatus.LOOKING;
    }
    return estado === AvailabilityStatus.LOOKING || estado === AvailabilityStatus.OPEN;
  }

  // =========================================================================
  // §46 · Equipos e invitaciones
  // =========================================================================

  /**
   * Crea el equipo de una necesidad.
   *
   * El responsable entra como primer integrante y se abre la conversación del
   * equipo (§42.2). Todo junto: un equipo sin su responsable dentro, o con una
   * conversación a la que él no pertenece, es un estado que no debería existir.
   */
  async createTeam(ownerProfileId: string, needId: string, rawName: string, actorUserId: string) {
    const need = await this.ownNeed(ownerProfileId, needId);
    const existente = await this.teams.findOne({ where: { teamNeedId: need.id } });
    if (existente) {
      throw new ConflictException('Esa necesidad ya tiene un equipo.');
    }
    const { name, status: nameStatus, reason: nameFlagReason } =
      await this.moderarNombre(rawName, actorUserId, null);

    return this.dataSource.transaction(async (manager) => {
      const equipo = await manager.save(
        manager.create(Team, {
          name,
          nameStatus,
          nameFlagReason,
          ownerProfileId,
          teamNeedId: need.id,
          status: TeamStatus.FORMING,
        }),
      );
      await manager.save(
        manager.create(TeamMember, {
          teamId: equipo.id,
          studentProfileId: ownerProfileId,
          role: 'Responsable',
        }),
      );
      return {
        id: equipo.id,
        name: equipo.name,
        status: equipo.status,
        needId: need.id,
        nameStatus: equipo.nameStatus,
        nameFlagReason: equipo.nameFlagReason,
      };
    });
  }

  /** §44: corregir el nombre vuelve a pasar por la moderación completa. */
  async renameTeam(ownerProfileId: string, teamId: string, rawName: string, actorUserId: string) {
    const equipo = await this.ownTeam(ownerProfileId, teamId);
    const { name, status, reason } = await this.moderarNombre(rawName, actorUserId, equipo.id);
    equipo.name = name;
    equipo.nameStatus = status;
    equipo.nameFlagReason = reason;
    await this.teams.save(equipo);
    return { id: equipo.id, name: equipo.name, nameStatus: equipo.nameStatus, nameFlagReason: equipo.nameFlagReason };
  }

  /** §47: invitar es un acto de una persona, nunca del motor. */
  async invite(
    ownerProfileId: string,
    teamId: string,
    invitedProfileId: string,
    message?: string,
  ) {
    const equipo = await this.ownTeam(ownerProfileId, teamId);
    this.assertNombreCompartible(equipo);
    if (invitedProfileId === ownerProfileId) {
      throw new BadRequestException('Ya formas parte del equipo.');
    }

    const yaEsta = await this.members.exists({
      where: { teamId: equipo.id, studentProfileId: invitedProfileId },
    });
    if (yaEsta) throw new ConflictException('Esa persona ya está en el equipo.');

    await this.assertHaySitio(equipo);

    const previa = await this.invitations.findOne({
      where: { teamId: equipo.id, invitedProfileId },
    });
    if (previa && previa.status === TeamInvitationStatus.PENDING) {
      throw new ConflictException('Ya tiene una invitación pendiente.');
    }
    if (previa) {
      // Se reutiliza la fila: la clave única es (equipo, invitado), y volver a
      // invitar a quien declinó es legítimo mientras no se convierta en insistir.
      previa.status = TeamInvitationStatus.PENDING;
      previa.message = message ?? null;
      previa.decidedAt = null;
      previa.invitedByProfileId = ownerProfileId;
      return this.invitations.save(previa);
    }

    return this.invitations.save(
      this.invitations.create({
        teamId: equipo.id,
        invitedProfileId,
        invitedByProfileId: ownerProfileId,
        message: message ?? null,
        status: TeamInvitationStatus.PENDING,
      }),
    );
  }

  async myInvitations(studentProfileId: string) {
    const filas = await this.invitations.find({
      where: { invitedProfileId: studentProfileId, status: TeamInvitationStatus.PENDING },
      relations: { team: { need: true, owner: { user: true } } },
      order: { createdAt: 'DESC' },
    });
    // §44: un equipo con el nombre marcado no se muestra a terceros.
    return filas.filter((i) => i.team?.nameStatus !== TeamNameStatus.FLAGGED).map((i) => ({
      id: i.id,
      message: i.message,
      createdAt: i.createdAt,
      team: {
        id: i.team?.id ?? null,
        name: i.team?.name ?? null,
        purpose: i.team?.need?.purpose ?? null,
        owner: i.team?.owner?.user
          ? `${i.team.owner.user.firstName} ${i.team.owner.user.lastName}`
          : 'Estudiante',
      },
    }));
  }

  /**
   * El invitado decide. Aceptar lo suma al equipo y a su conversación.
   *
   * El cupo se comprueba **al aceptar** y no solo al invitar: entre una cosa y
   * la otra pueden haber entrado otros, y un equipo que se pasa de su máximo
   * declarado deja de responder a lo que su responsable pidió.
   */
  async decideInvitation(
    studentProfileId: string,
    invitationId: string,
    decision: 'accept' | 'decline',
  ) {
    const invitacion = await this.invitations.findOne({
      where: { id: invitationId },
      relations: { team: { need: true } },
    });
    if (!invitacion || invitacion.invitedProfileId !== studentProfileId) {
      throw new NotFoundException('Invitación no encontrada.');
    }
    if (invitacion.status !== TeamInvitationStatus.PENDING) {
      throw new ConflictException('Esa invitación ya fue respondida.');
    }

    if (decision === 'decline') {
      invitacion.status = TeamInvitationStatus.DECLINED;
      invitacion.decidedAt = new Date();
      await this.invitations.save(invitacion);
      return { status: invitacion.status };
    }

    const equipo = invitacion.team;
    if (!equipo) throw new NotFoundException('El equipo ya no existe.');
    if (equipo.nameStatus === TeamNameStatus.FLAGGED) {
      throw new NotFoundException('Invitación no encontrada.');
    }
    await this.assertHaySitio(equipo);

    await this.dataSource.transaction(async (manager) => {
      invitacion.status = TeamInvitationStatus.ACCEPTED;
      invitacion.decidedAt = new Date();
      await manager.save(TeamInvitation, invitacion);
      await manager.save(
        manager.create(TeamMember, { teamId: equipo.id, studentProfileId }),
      );
    });

    return { status: TeamInvitationStatus.ACCEPTED, teamId: equipo.id };
  }

  /** Los equipos del estudiante, con lo que §93 pide mostrar. */
  async myTeams(studentProfileId: string) {
    const pertenencias = await this.members.find({ where: { studentProfileId } });
    if (pertenencias.length === 0) return [];

    const equipos = await this.teams.find({
      where: { id: In(pertenencias.map((m) => m.teamId)) },
      relations: {
        need: { requiredSkills: { skill: true } },
        members: { studentProfile: { user: true } },
      },
      order: { createdAt: 'DESC' },
    });

    const resultado: Record<string, unknown>[] = [];
    for (const equipo of equipos) {
      const requeridas = (equipo.need?.requiredSkills ?? []).map((s) => ({
        skillId: s.skillId,
        name: s.skill?.name ?? null,
      }));
      const ids = (equipo.members ?? []).map((m) => m.studentProfileId);
      const suyas = ids.length ? [...(await this.backedSkills.forProfiles(ids)).values()].flat() : [];
      const cubiertas = new Set(suyas.map((s) => s.skillId));

      resultado.push({
        id: equipo.id,
        name: equipo.name,
        nameStatus: equipo.nameStatus,
        nameFlagReason: equipo.nameFlagReason,
        needId: equipo.teamNeedId,
        status: equipo.status,
        purpose: equipo.need?.purpose ?? null,
        isOwner: equipo.ownerProfileId === studentProfileId,
        maxMembers: equipo.need?.maxMembers ?? null,
        // §93: objetivo, requeridas, cubiertas y vacantes. Nada de «ranking de
        // mejores estudiantes».
        requiredSkills: requeridas,
        coveredSkills: requeridas.filter((s) => cubiertas.has(s.skillId)),
        missingSkills: requeridas.filter((s) => !cubiertas.has(s.skillId)),
        openings: Math.max(0, (equipo.need?.maxMembers ?? 0) - (equipo.members?.length ?? 0)),
        members: (equipo.members ?? []).map((m) => ({
          profileId: m.studentProfileId,
          name: m.studentProfile?.user
            ? `${m.studentProfile.user.firstName} ${m.studentProfile.user.lastName}`
            : 'Estudiante',
          role: m.role,
          availability: m.studentProfile?.availability ?? null,
        })),
      });
    }
    return resultado;
  }

  /** Pertenencia aceptada a un equipo. Lo usa la mensajería (§42.2). */
  async isMember(teamId: string, studentProfileId: string): Promise<boolean> {
    return this.members.exists({ where: { teamId, studentProfileId } });
  }

  // =========================================================================
  // Interno
  // =========================================================================

  private async assertHaySitio(equipo: Team): Promise<void> {
    const need = equipo.need
      ?? (equipo.teamNeedId
        ? await this.needs.findOne({ where: { id: equipo.teamNeedId } })
        : null);
    const tope = need?.maxMembers ?? 20;
    const dentro = await this.members.count({ where: { teamId: equipo.id } });
    if (dentro >= tope) {
      throw new ConflictException(`El equipo ya alcanzó su máximo de ${tope} integrantes.`);
    }
  }

  private async ownNeed(
    ownerProfileId: string,
    needId: string,
    relations?: Record<string, unknown>,
  ): Promise<TeamNeed> {
    const need = await this.needs.findOne({
      where: { id: needId },
      relations: (relations ?? {
        requiredSkills: { skill: true },
        preferredAreas: { academicArea: true },
      }) as never,
    });
    if (!need) throw new NotFoundException('Necesidad no encontrada.');
    if (need.ownerProfileId !== ownerProfileId) {
      throw new ForbiddenException('Esa necesidad es de otro estudiante.');
    }
    return need;
  }

  private async ownTeam(ownerProfileId: string, teamId: string): Promise<Team> {
    const equipo = await this.teams.findOne({
      where: { id: teamId },
      relations: { need: true },
    });
    if (!equipo) throw new NotFoundException('Equipo no encontrado.');
    if (equipo.ownerProfileId !== ownerProfileId) {
      throw new ForbiddenException('Solo el responsable del equipo puede hacer eso.');
    }
    return equipo;
  }

  private async replaceNeedSkills(teamNeedId: string, skillIds: string[]): Promise<void> {
    await this.needSkills.delete({ teamNeedId });
    if (skillIds.length === 0) return;
    await this.needSkills.insert(skillIds.map((skillId) => ({ teamNeedId, skillId })));
  }

  private async replaceNeedAreas(teamNeedId: string, areaIds: string[]): Promise<void> {
    await this.needAreas.delete({ teamNeedId });
    if (areaIds.length === 0) return;
    await this.needAreas.insert(
      areaIds.map((academicAreaId) => ({ teamNeedId, academicAreaId })),
    );
  }

  private vistaNecesidad(need: TeamNeed, esPropia: boolean) {
    return {
      id: need.id,
      purpose: need.purpose,
      description: need.description,
      status: need.status,
      maxMembers: need.maxMembers,
      availabilityRequirement: need.availabilityRequirement,
      projectId: need.projectId,
      activityId: need.activityId,
      isOwner: esPropia,
      owner: {
        profileId: need.ownerProfileId,
        name: need.owner?.user
          ? `${need.owner.user.firstName} ${need.owner.user.lastName}`
          : 'Estudiante',
      },
      requiredSkills: (need.requiredSkills ?? []).map((s) => ({
        skillId: s.skillId,
        name: s.skill?.name ?? null,
      })),
      preferredAreas: (need.preferredAreas ?? []).map((a) => ({
        academicAreaId: a.academicAreaId,
        name: a.academicArea?.name ?? null,
      })),
      createdAt: need.createdAt,
    };
  }

  private redondear(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
