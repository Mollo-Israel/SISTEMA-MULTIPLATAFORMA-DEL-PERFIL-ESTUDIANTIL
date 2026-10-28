import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import { RolNombre } from '@perfil/shared';
import { ApprovalModule, ApprovalPolicy } from '../entities/approval-policy.entity';
import { User } from '../entities/user.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { AuditEventType, AuditService } from '../audit/audit.service';

/** Módulos en los que Dirección puede conceder una excepción hoy (§9.2). */
export const MODULOS_CON_EXCEPCION: ApprovalModule[] = ['RESOURCE', 'GAMIFICATION'];

const NOMBRE_MODULO: Record<ApprovalModule, string> = {
  RESOURCE: 'recursos', GAMIFICATION: 'puntos', ACTIVITY: 'actividades',
};

/**
 * Autonomía docente (V5 §9.2): REQUIRE_REVIEW por defecto y excepciones que
 * concede Dirección, por docente y por módulo.
 *
 * - Solo Dirección concede y revoca: Administración ve, pero no es autoridad
 *   académica (§10.2).
 * - Solo para docentes. La sociedad científica no hereda excepciones (E08).
 * - `ACTIVITY` queda en revisión obligatoria hasta la decisión institucional
 *   (ND-03): la API la rechaza aunque el esquema la admita.
 * - Revocar cierra la excepción para lo que venga; lo publicado u otorgado
 *   con ella se conserva y sigue apuntando a la fila (E03).
 */
@Injectable()
export class ApprovalPoliciesService {
  constructor(
    @InjectRepository(ApprovalPolicy) private readonly policies: Repository<ApprovalPolicy>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  /** La excepción vigente del usuario para el módulo, o null (REQUIRE_REVIEW). */
  async vigente(user: AuthenticatedUser | undefined, module: ApprovalModule, manager?: EntityManager): Promise<ApprovalPolicy | null> {
    if (!user || user.role !== RolNombre.TEACHER || !MODULOS_CON_EXCEPCION.includes(module)) return null;
    const repo = manager ? manager.getRepository(ApprovalPolicy) : this.policies;
    return repo.findOne({ where: { teacherUserId: user.userId, module, revokedAt: IsNull() } });
  }

  /** Lo que el docente puede hacer sin revisión, para que la interfaz lo diga. */
  async mias(user: AuthenticatedUser) {
    const filas = user.role === RolNombre.TEACHER
      ? await this.policies.find({ where: { teacherUserId: user.userId, revokedAt: IsNull() } })
      : [];
    const directo = (m: ApprovalModule) => filas.some((f) => f.module === m);
    return {
      RESOURCE: directo('RESOURCE') ? 'DIRECT_ALLOWED' : 'REQUIRE_REVIEW',
      GAMIFICATION: directo('GAMIFICATION') ? 'DIRECT_ALLOWED' : 'REQUIRE_REVIEW',
      ACTIVITY: 'REQUIRE_REVIEW',
    } as const;
  }

  /** Docentes con cuenta activa y sus semestres, para elegir a quién conceder. */
  async docentes(user: AuthenticatedUser) {
    this.assertPuedeVer(user);
    const filas: { id: string; first_name: string; last_name: string; email: string; semesters: number[] | null }[] =
      await this.policies.manager.query(`
        SELECT u.id, u.first_name, u.last_name, u.email,
               ARRAY(SELECT t.semester FROM teacher_semester_access t WHERE t.teacher_id = u.id ORDER BY t.semester) AS semesters
          FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.name = $1 AND u.status = 'active'
         ORDER BY u.last_name, u.first_name
         LIMIT 500`, [RolNombre.TEACHER]);
    return filas.map((f) => ({ id: f.id, name: `${f.first_name} ${f.last_name}`, email: f.email, semesters: f.semesters ?? [] }));
  }

  /** Dirección y Administración: todas, vigentes primero. */
  async list(user: AuthenticatedUser, incluirRevocadas = false) {
    this.assertPuedeVer(user);
    const filas = await this.policies.find({
      where: incluirRevocadas ? {} : { revokedAt: IsNull() },
      relations: { teacher: true },
      order: { grantedAt: 'DESC' },
      take: 500,
    });
    return this.vista(filas);
  }

  async grant(user: AuthenticatedUser, dto: { teacherUserId: string; module: string; justification: string }) {
    this.assertDireccion(user);
    const modulo = dto.module as ApprovalModule;
    if (modulo === 'ACTIVITY') {
      const m = 'Las actividades siguen con revisión obligatoria: la excepción necesita una decisión institucional que todavía no está tomada.';
      throw new BadRequestException({ code: 'ACTIVITY_OVERRIDE_NOT_ENABLED', message: m, fields: { module: [m] } });
    }
    if (!MODULOS_CON_EXCEPCION.includes(modulo)) {
      const m = 'Módulo no válido.';
      throw new BadRequestException({ message: m, fields: { module: [m] } });
    }
    const motivo = (dto.justification ?? '').trim();
    if (motivo.length < 10) {
      const m = 'Explica por qué se concede (al menos 10 caracteres): queda en el historial.';
      throw new BadRequestException({ message: m, fields: { justification: [m] } });
    }
    const docente = await this.users.findOne({ where: { id: dto.teacherUserId }, relations: { role: true } });
    if (!docente) throw new NotFoundException('Docente no encontrado.');
    if (docente.role?.name !== RolNombre.TEACHER) {
      const m = 'Las excepciones son solo para docentes: la sociedad científica y los demás roles siguen sus propias reglas.';
      throw new BadRequestException({ code: 'POLICY_TEACHER_ONLY', message: m, fields: { teacherUserId: [m] } });
    }
    const ya = await this.policies.findOne({ where: { teacherUserId: docente.id, module: modulo, revokedAt: IsNull() } });
    if (ya) throw new ConflictException(`${docente.firstName} ${docente.lastName} ya publica ${NOMBRE_MODULO[modulo]} sin revisión.`);
    const fila = await this.policies.save(this.policies.create({
      module: modulo, teacherUserId: docente.id, decision: 'DIRECT_ALLOWED', justification: motivo, grantedBy: user.userId,
    }));
    await this.audit.record({
      actorUserId: user.userId,
      eventType: AuditEventType.APPROVAL_POLICY_GRANTED,
      entityType: 'approval_policy',
      entityId: fila.id,
      metadata: { module: modulo, teacherUserId: docente.id, justification: motivo },
    });
    return (await this.vista([{ ...fila, teacher: docente }]))[0];
  }

  async revoke(user: AuthenticatedUser, id: string, reason: string) {
    this.assertDireccion(user);
    const motivo = (reason ?? '').trim();
    if (motivo.length < 5) {
      const m = 'Explica por qué se revoca.';
      throw new BadRequestException({ message: m, fields: { reason: [m] } });
    }
    const fila = await this.policies.findOne({ where: { id }, relations: { teacher: true } });
    if (!fila) throw new NotFoundException('Excepción no encontrada.');
    if (fila.revokedAt) throw new ConflictException('Esa excepción ya estaba revocada.');
    fila.revokedAt = new Date();
    fila.revokedBy = user.userId;
    fila.revokeReason = motivo;
    await this.policies.save(fila);
    await this.audit.record({
      actorUserId: user.userId,
      eventType: AuditEventType.APPROVAL_POLICY_REVOKED,
      entityType: 'approval_policy',
      entityId: fila.id,
      metadata: { module: fila.module, teacherUserId: fila.teacherUserId, reason: motivo },
    });
    return (await this.vista([fila]))[0];
  }

  /**
   * Historial de acciones directas (§9.3, §9.4): lo que un docente publicó u
   * otorgó con una excepción. Dirección lo ve sin tener que aprobarlo.
   */
  async historialDirecto(user: AuthenticatedUser, teacherUserId?: string) {
    this.assertPuedeVer(user);
    const filtro = teacherUserId ? 'AND p.teacher_user_id = $1' : '';
    const params = teacherUserId ? [teacherUserId] : [];
    const m = this.policies.manager;
    const [recursos, puntos] = await Promise.all([
      m.query(
        `SELECT r.id, r.title, r.created_at AS "at", p.id AS "policyId", p.teacher_user_id AS "teacherUserId",
                u.first_name || ' ' || u.last_name AS "teacher"
           FROM learning_resources r
           JOIN approval_policies p ON p.id = r.policy_id
           JOIN users u ON u.id = p.teacher_user_id
          WHERE r.policy_id IS NOT NULL ${filtro}
          ORDER BY r.created_at DESC LIMIT 200`,
        params,
      ),
      m.query(
        `SELECT g.id, c.name AS "criterion", c.points, g.reason, g.created_at AS "at", g.source_type AS "sourceType", g.source_id AS "sourceId",
                p.id AS "policyId", p.teacher_user_id AS "teacherUserId", u.first_name || ' ' || u.last_name AS "teacher",
                su.first_name || ' ' || su.last_name AS "student"
           FROM gamification_proposals g
           JOIN approval_policies p ON p.id = g.policy_id
           JOIN users u ON u.id = p.teacher_user_id
           JOIN gamification_criteria c ON c.id = g.criterion_id
           JOIN student_profiles sp ON sp.id = g.student_profile_id
           JOIN users su ON su.id = sp.user_id
          WHERE g.policy_id IS NOT NULL ${filtro}
          ORDER BY g.created_at DESC LIMIT 200`,
        params,
      ),
    ]);
    return [
      ...(recursos as { at: string }[]).map((r) => ({ module: 'RESOURCE' as const, ...r })),
      ...(puntos as { at: string }[]).map((p) => ({ module: 'GAMIFICATION' as const, ...p })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }

  private assertDireccion(user: AuthenticatedUser) {
    if (user.role !== RolNombre.CAREER_DIRECTOR) {
      throw new ForbiddenException('Las excepciones de revisión las concede y revoca Dirección.');
    }
  }

  private assertPuedeVer(user: AuthenticatedUser) {
    if (user.role !== RolNombre.CAREER_DIRECTOR && user.role !== RolNombre.ADMIN) {
      throw new ForbiddenException('Su rol no consulta las excepciones de revisión.');
    }
  }

  private async vista(filas: (ApprovalPolicy & { teacher?: User })[]) {
    const ids = [...new Set(filas.flatMap((f) => [f.grantedBy, f.revokedBy]).filter((x): x is string => !!x))];
    const quienes = ids.length ? await this.users.find({ where: { id: In(ids) } }) : [];
    const nombre = (id: string | null) => {
      const u = quienes.find((x) => x.id === id);
      return u ? `${u.firstName} ${u.lastName}` : null;
    };
    return filas.map((f) => ({
      id: f.id,
      module: f.module,
      decision: f.decision,
      teacher: f.teacher ? { id: f.teacher.id, name: `${f.teacher.firstName} ${f.teacher.lastName}`, email: f.teacher.email } : { id: f.teacherUserId },
      justification: f.justification,
      grantedAt: f.grantedAt,
      grantedBy: nombre(f.grantedBy),
      revokedAt: f.revokedAt,
      revokedBy: nombre(f.revokedBy),
      revokeReason: f.revokeReason,
    }));
  }
}
