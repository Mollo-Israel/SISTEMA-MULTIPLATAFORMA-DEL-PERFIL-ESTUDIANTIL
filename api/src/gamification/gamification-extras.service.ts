import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { GamificationTrigger, RolNombre } from '@perfil/shared';
import {
  GamificationChallenge,
  GamificationReward,
  RedemptionStatus,
  RewardRedemption,
} from '../entities/gamification-extra.entity';
import { GamificationEvent, StudentPoints } from '../entities/gamification.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { TeacherScopeService } from '../access/teacher-scope.service';
import { GamificationService } from './gamification.service';

export interface ChallengeInput {
  title: string;
  description?: string | null;
  points: number;
  academicAreaId?: string | null;
  isActive?: boolean;
}

export interface RewardInput {
  name: string;
  description?: string | null;
  cost: number;
  stock?: number | null;
  isActive?: boolean;
}

export type Periodo = 'week' | 'month' | 'year';

/** Inicio del periodo en la zona de la universidad (semana desde el lunes). */
function inicioDe(periodo: Periodo, ahora = new Date()): Date {
  const d = new Date(ahora);
  d.setHours(0, 0, 0, 0);
  if (periodo === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (periodo === 'month') d.setDate(1);
  if (periodo === 'year') d.setMonth(0, 1);
  return d;
}

const esPersonal = (rol: RolNombre) => rol !== RolNombre.STUDENT;
const esAdmin = (u: AuthenticatedUser) => u.role === RolNombre.ADMIN;

/**
 * Lo que el documento de correcciones pidió sumar a la gamificación (§66):
 *
 * - **Retos docentes**: el docente define qué premiar en su curso y lo
 *   reconoce a sus estudiantes. Solo a los de su alcance (§68): proteger la
 *   ruta por rol no basta, un docente no reconoce a alumnos que no acompaña.
 * - **Recompensas**: los puntos se pueden canjear. Se reservan al pedir y
 *   vuelven si quien ofrece la recompensa la rechaza.
 * - **Periodos**: puntos de la semana, del mes y del año.
 *
 * Y lo que se mantiene: nada de esto alimenta la afinidad, y no hay ranking
 * público. El docente ve los puntos de *sus* estudiantes para reconocerlos;
 * ningún estudiante ve los de otro.
 */
@Injectable()
export class GamificationExtrasService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly gamification: GamificationService,
    private readonly scope: TeacherScopeService,
    @InjectRepository(GamificationChallenge) private readonly retos: Repository<GamificationChallenge>,
    @InjectRepository(GamificationReward) private readonly recompensas: Repository<GamificationReward>,
    @InjectRepository(RewardRedemption) private readonly canjes: Repository<RewardRedemption>,
    @InjectRepository(GamificationEvent) private readonly eventos: Repository<GamificationEvent>,
    @InjectRepository(StudentPoints) private readonly totales: Repository<StudentPoints>,
    @InjectRepository(StudentProfile) private readonly perfiles: Repository<StudentProfile>,
  ) {}

  // ======================================================================
  //  Retos
  // ======================================================================

  listChallenges(user: AuthenticatedUser) {
    return this.retos.find({
      where: esAdmin(user) ? {} : { createdByUserId: user.userId },
      relations: { academicArea: true },
      order: { createdAt: 'DESC' },
    });
  }

  createChallenge(user: AuthenticatedUser, dto: ChallengeInput) {
    return this.retos.save(
      this.retos.create({
        title: dto.title,
        description: dto.description || null,
        points: dto.points,
        academicAreaId: dto.academicAreaId ?? null,
        createdByUserId: user.userId,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async updateChallenge(user: AuthenticatedUser, id: string, dto: Partial<ChallengeInput>) {
    const reto = await this.retoPropio(user, id);
    if (dto.title !== undefined) reto.title = dto.title;
    if (dto.description !== undefined) reto.description = dto.description || null;
    if (dto.points !== undefined) reto.points = dto.points;
    if (dto.academicAreaId !== undefined) reto.academicAreaId = dto.academicAreaId || null;
    if (dto.isActive !== undefined) reto.isActive = dto.isActive;
    return this.retos.save(reto);
  }

  /**
   * Reconoce un reto a varios estudiantes.
   *
   * Cada uno se comprueba contra el alcance de quien reconoce. Un estudiante
   * que ya lo tenía no suma de nuevo: la clave del evento es reto + perfil.
   */
  async awardChallenge(user: AuthenticatedUser, id: string, studentProfileIds: string[]) {
    const reto = await this.retoPropio(user, id);
    if (!reto.isActive) {
      throw new BadRequestException('Este reto está desactivado: actívelo para reconocerlo.');
    }
    const resultado = { awarded: 0, alreadyHad: 0 };
    for (const profileId of [...new Set(studentProfileIds)]) {
      await this.scope.assertCanAccessProfile(user, profileId);
      const nuevo = await this.gamification.award(profileId, {
        trigger: GamificationTrigger.RECONOCIMIENTO_DOCENTE,
        dedupeKey: `reto:${reto.id}`,
        reason: `Reto «${reto.title}» reconocido por ${user.email.split('@')[0]}`,
        points: reto.points,
        sourceEntityType: 'gamification_challenge',
        sourceEntityId: reto.id,
      });
      if (nuevo) resultado.awarded += 1;
      else resultado.alreadyHad += 1;
    }
    return resultado;
  }

  private async retoPropio(user: AuthenticatedUser, id: string) {
    const reto = await this.retos.findOne({ where: { id } });
    if (!reto) throw new NotFoundException('Reto no encontrado.');
    if (!esAdmin(user) && reto.createdByUserId !== user.userId) {
      throw new ForbiddenException('Solo quien creó el reto puede modificarlo o reconocerlo.');
    }
    return reto;
  }

  // ======================================================================
  //  Recompensas y canjes
  // ======================================================================

  async listRewards(user: AuthenticatedUser) {
    const filas = await this.recompensas.find({
      where: esPersonal(user.role) ? (esAdmin(user) ? {} : { createdByUserId: user.userId }) : { isActive: true },
      relations: { createdBy: true },
      order: { cost: 'ASC' },
    });
    return filas.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      cost: r.cost,
      stock: r.stock,
      isActive: r.isActive,
      offeredBy: r.createdBy ? `${r.createdBy.firstName} ${r.createdBy.lastName}` : null,
    }));
  }

  createReward(user: AuthenticatedUser, dto: RewardInput) {
    return this.recompensas.save(
      this.recompensas.create({
        name: dto.name,
        description: dto.description || null,
        cost: dto.cost,
        stock: dto.stock ?? null,
        createdByUserId: user.userId,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async updateReward(user: AuthenticatedUser, id: string, dto: Partial<RewardInput>) {
    const r = await this.recompensas.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Recompensa no encontrada.');
    if (!esAdmin(user) && r.createdByUserId !== user.userId) {
      throw new ForbiddenException('Solo quien ofrece la recompensa puede modificarla.');
    }
    if (dto.name !== undefined) r.name = dto.name;
    if (dto.description !== undefined) r.description = dto.description || null;
    if (dto.cost !== undefined) r.cost = dto.cost;
    if (dto.stock !== undefined) r.stock = dto.stock;
    if (dto.isActive !== undefined) r.isActive = dto.isActive;
    return this.recompensas.save(r);
  }

  /** Puntos ganados menos los reservados o gastados en canjes. */
  async balance(studentProfileId: string) {
    const [total, gastado] = await Promise.all([
      this.totales.findOne({ where: { studentProfileId } }),
      this.canjes
        .createQueryBuilder('c')
        .select('COALESCE(SUM(c.cost), 0)', 's')
        .where('c.student_profile_id = :id AND c.status IN (:...st)', {
          id: studentProfileId,
          st: ['pending', 'delivered'],
        })
        .getRawOne<{ s: string }>(),
    ]);
    const ganado = total?.totalPoints ?? 0;
    const usado = Number(gastado?.s ?? 0);
    return { earned: ganado, spent: usado, available: Math.max(0, ganado - usado) };
  }

  /**
   * Canjear: con bloqueo por estudiante, para que dos pulsaciones seguidas no
   * gasten dos veces el mismo saldo.
   */
  async redeem(studentProfileId: string, rewardId: string) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [`canje:${studentProfileId}`]);
      const reward = await manager.findOne(GamificationReward, {
        where: { id: rewardId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!reward || !reward.isActive) throw new NotFoundException('Esa recompensa ya no está disponible.');
      if (reward.stock !== null && reward.stock <= 0) {
        throw new ConflictException('Esa recompensa se agotó.');
      }
      const saldo = await this.balance(studentProfileId);
      if (saldo.available < reward.cost) {
        throw new BadRequestException(
          `Te faltan ${reward.cost - saldo.available} puntos para esta recompensa (tienes ${saldo.available}).`,
        );
      }
      if (reward.stock !== null) {
        await manager.update(GamificationReward, { id: reward.id }, { stock: reward.stock - 1 });
      }
      return manager.save(
        manager.create(RewardRedemption, {
          rewardId: reward.id,
          studentProfileId,
          cost: reward.cost,
          status: 'pending',
        }),
      );
    });
  }

  myRedemptions(studentProfileId: string) {
    return this.canjes.find({
      where: { studentProfileId },
      relations: { reward: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** Canjes de las recompensas que ofrece este usuario (todas, si es admin). */
  async pendingRedemptions(user: AuthenticatedUser) {
    const filas = await this.canjes.find({
      where: esAdmin(user) ? {} : { reward: { createdByUserId: user.userId } },
      relations: { reward: true, studentProfile: { user: true } },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return filas.map((c) => ({
      id: c.id,
      reward: c.reward?.name,
      cost: c.cost,
      status: c.status,
      note: c.note,
      createdAt: c.createdAt,
      resolvedAt: c.resolvedAt,
      student: c.studentProfile?.user
        ? `${c.studentProfile.user.firstName} ${c.studentProfile.user.lastName}`
        : null,
    }));
  }

  async resolveRedemption(user: AuthenticatedUser, id: string, status: RedemptionStatus, note?: string) {
    if (status === 'pending') throw new BadRequestException('Indique si se entregó o se rechaza.');
    const c = await this.canjes.findOne({ where: { id }, relations: { reward: true } });
    if (!c) throw new NotFoundException('Canje no encontrado.');
    if (!esAdmin(user) && c.reward.createdByUserId !== user.userId) {
      throw new ForbiddenException('Solo quien ofrece la recompensa resuelve sus canjes.');
    }
    if (c.status !== 'pending') throw new ConflictException('Este canje ya se resolvió.');
    c.status = status;
    c.note = note?.trim() || null;
    c.resolvedByUserId = user.userId;
    c.resolvedAt = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager.save(c);
      // Rechazar devuelve la unidad; los puntos vuelven solos porque el saldo
      // solo cuenta los canjes pendientes y entregados.
      if (status === 'rejected' && c.reward.stock !== null) {
        await manager.increment(GamificationReward, { id: c.rewardId }, 'stock', 1);
      }
    });
    return c;
  }

  // ======================================================================
  //  Periodos
  // ======================================================================

  async periods(studentProfileId: string) {
    const salida: Record<Periodo, number> = { week: 0, month: 0, year: 0 };
    for (const p of ['week', 'month', 'year'] as Periodo[]) {
      const fila = await this.eventos
        .createQueryBuilder('e')
        .select('COALESCE(SUM(e.points), 0)', 's')
        .where('e.student_profile_id = :id AND e.occurred_at >= :desde', {
          id: studentProfileId,
          desde: inicioDe(p),
        })
        .getRawOne<{ s: string }>();
      salida[p] = Number(fila?.s ?? 0);
    }
    return salida;
  }

  /**
   * Puntos del periodo de los estudiantes del alcance del docente.
   *
   * No es un ranking público: lo ve solo quien acompaña a esos estudiantes,
   * para decidir a quién reconocer.
   */
  async scopePoints(user: AuthenticatedUser, periodo: Periodo) {
    const alcance = await this.scope.scopeFor(user);
    if (Array.isArray(alcance) && alcance.length === 0) return { period: periodo, students: [] };
    const qb = this.perfiles
      .createQueryBuilder('p')
      .innerJoin('p.user', 'u')
      .select(['p.id AS "profileId"', `u.first_name || ' ' || u.last_name AS "name"`, 'p.semester AS "semester"'])
      .addSelect(
        `(SELECT COALESCE(SUM(e.points), 0) FROM gamification_events e
           WHERE e.student_profile_id = p.id AND e.occurred_at >= :desde)`,
        'points',
      )
      .setParameter('desde', inicioDe(periodo))
      .orderBy('points', 'DESC')
      .addOrderBy('"name"', 'ASC')
      .limit(200);
    if (alcance) qb.where('p.semester IN (:...alcance)', { alcance });
    const filas = await qb.getRawMany<{ profileId: string; name: string; semester: number; points: string }>();
    return {
      period: periodo,
      students: filas.map((f) => ({ ...f, points: Number(f.points) })),
    };
  }

  async ensureProfiles(ids: string[]) {
    const n = await this.perfiles.count({ where: { id: In(ids) } });
    if (n !== new Set(ids).size) throw new BadRequestException('Algún estudiante no existe.');
  }
}
