import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EntityManager, IsNull, LessThan, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { AuthSession } from '../entities/auth-session.entity';
import { identityConfig } from '../config/identity.config';

export interface SessionContext {
  userAgent?: string | null;
  ipAddress?: string | null;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Sesiones revocables (especificacion §14).
 *
 * El refresh token es opaco y rotatorio: cada uso emite uno nuevo e invalida
 * el anterior. Asi, si un refresh token se filtra, o bien lo usa el atacante y
 * el usuario legitimo encuentra su sesion cortada, o bien lo usa el usuario y
 * el del atacante deja de servir. En ambos casos el robo se vuelve visible.
 */
@Injectable()
export class AuthSessionsService {
  constructor(
    @InjectRepository(AuthSession)
    private readonly sessions: Repository<AuthSession>,
    private readonly config: ConfigService,
  ) {}

  /** Abre una sesion y devuelve el refresh token en claro. */
  async create(
    userId: string,
    context: SessionContext = {},
    manager?: EntityManager,
  ): Promise<{ sessionId: string; refreshToken: string; expiresAt: Date }> {
    const repo = manager ? manager.getRepository(AuthSession) : this.sessions;
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs());

    const session = await repo.save(
      repo.create({
        userId,
        refreshTokenHash: hash(refreshToken),
        expiresAt,
        userAgent: context.userAgent?.slice(0, 200) ?? null,
        ipAddress: context.ipAddress?.slice(0, 64) ?? null,
      }),
    );

    return { sessionId: session.id, refreshToken, expiresAt };
  }

  /** Sesion viva que corresponde a este refresh token, o null. */
  async findUsable(refreshToken: string): Promise<AuthSession | null> {
    if (!refreshToken || refreshToken.length < 16) return null;
    const session = await this.sessions.findOne({
      where: { refreshTokenHash: hash(refreshToken) },
      relations: { user: { role: true } },
    });
    if (!session) return null;
    return session.isUsable() ? session : null;
  }

  /**
   * Rota el refresh token de una sesion viva.
   *
   * La rotacion es una escritura condicionada al hash anterior: si dos
   * peticiones llegan con el mismo token, solo una encuentra la fila y la otra
   * queda sin sesion, que es el comportamiento deseado ante una reutilizacion.
   */
  async rotate(session: AuthSession): Promise<{ refreshToken: string; expiresAt: Date } | null> {
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs());

    const result = await this.sessions.update(
      { id: session.id, refreshTokenHash: session.refreshTokenHash, revokedAt: IsNull() },
      { refreshTokenHash: hash(refreshToken), expiresAt, lastUsedAt: new Date() },
    );
    if (!result.affected) return null;

    return { refreshToken, expiresAt };
  }

  /** Cierra una sesion concreta. */
  async revoke(sessionId: string, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(AuthSession) : this.sessions;
    await repo.update({ id: sessionId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  /** Cierra la sesion asociada a un refresh token concreto (logout). */
  async revokeByToken(refreshToken: string): Promise<boolean> {
    const session = await this.findUsable(refreshToken);
    if (!session) return false;
    await this.revoke(session.id);
    return true;
  }

  /**
   * Cierra todas las sesiones de un usuario.
   *
   * Es lo que hace util esta tabla: al cambiar la contraseña o suspender una
   * cuenta, el acceso se corta de inmediato en lugar de esperar a que caduquen
   * los JWT ya emitidos.
   */
  async revokeAllForUser(userId: string, manager?: EntityManager): Promise<number> {
    const repo = manager ? manager.getRepository(AuthSession) : this.sessions;
    const result = await repo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return result.affected ?? 0;
  }

  /** Sesiones vivas del usuario, para que pueda reconocerlas y cerrarlas. */
  async listActive(userId: string) {
    const rows = await this.sessions.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return rows
      .filter((s) => s.isUsable())
      .map((s) => ({
        id: s.id,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        expiresAt: s.expiresAt,
      }));
  }

  /** Retira sesiones caducadas. No es critico, pero evita crecimiento inutil. */
  async purgeExpired(): Promise<number> {
    const result = await this.sessions.delete({ expiresAt: LessThan(new Date()) });
    return result.affected ?? 0;
  }

  private ttlMs(): number {
    return identityConfig.refreshTokenTtlDays(this.config) * 24 * 60 * 60 * 1000;
  }
}
