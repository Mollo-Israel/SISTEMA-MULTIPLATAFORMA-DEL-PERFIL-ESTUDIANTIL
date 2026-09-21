import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { AccountTokenPurpose } from '@perfil/shared';
import { AccountToken } from '../entities/account-token.entity';
import { identityConfig } from '../config/identity.config';

export interface IssuedToken {
  /** Valor en claro. Solo existe aqui y en el correo; no se persiste. */
  token: string;
  expiresAt: Date;
}

/** SHA-256 en hexadecimal. Un token tiene entropia suficiente: no necesita sal. */
function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AccountTokensService {
  constructor(
    @InjectRepository(AccountToken)
    private readonly tokens: Repository<AccountToken>,
    private readonly config: ConfigService,
  ) {}

  /**
   * Emite un token y revoca los anteriores del mismo proposito (§12).
   *
   * Pedir un enlace nuevo invalida el viejo: si no fuera asi, un enlace
   * filtrado seguiria sirviendo indefinidamente mientras el usuario pide
   * reenvios.
   */
  async issue(
    userId: string,
    purpose: AccountTokenPurpose,
    manager?: EntityManager,
  ): Promise<IssuedToken> {
    const repo = manager ? manager.getRepository(AccountToken) : this.tokens;

    await repo.update(
      { userId, purpose, usedAt: IsNull(), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs(purpose));

    await repo.save(
      repo.create({ userId, purpose, tokenHash: hash(token), expiresAt }),
    );

    return { token, expiresAt };
  }

  /**
   * Busca un token utilizable.
   *
   * Devuelve null tanto si no existe como si expiró o ya se usó: quien
   * pregunta no debe poder distinguir esos casos.
   */
  async findUsable(token: string, purpose: AccountTokenPurpose): Promise<AccountToken | null> {
    if (!token || token.length < 16) return null;
    const candidate = await this.tokens.findOne({
      where: { tokenHash: hash(token), purpose },
      relations: { user: true },
    });
    if (!candidate) return null;

    // Comparacion en tiempo constante sobre el hash. La busqueda ya fue por
    // indice, pero confirmarlo asi evita depender del motor para esta garantia.
    const a = Buffer.from(candidate.tokenHash, 'hex');
    const b = Buffer.from(hash(token), 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    return candidate.isUsable() ? candidate : null;
  }

  /** Marca el token como consumido. Un token sirve exactamente una vez. */
  async consume(tokenId: string, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(AccountToken) : this.tokens;
    await repo.update({ id: tokenId }, { usedAt: new Date() });
  }

  /**
   * Segundos que faltan para poder pedir otro envio, o 0 si ya se puede (§12).
   * Evita que el reenvio se convierta en un generador de correo masivo.
   */
  async cooldownRemaining(userId: string, purpose: AccountTokenPurpose): Promise<number> {
    const last = await this.tokens.findOne({
      where: { userId, purpose },
      order: { createdAt: 'DESC' },
    });
    if (!last) return 0;

    const cooldownMs = identityConfig.resendCooldownSeconds(this.config) * 1000;
    const elapsed = Date.now() - last.createdAt.getTime();
    return elapsed >= cooldownMs ? 0 : Math.ceil((cooldownMs - elapsed) / 1000);
  }

  /** Revoca los tokens vivos de un usuario, por ejemplo al suspender la cuenta. */
  async revokeAll(userId: string, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(AccountToken) : this.tokens;
    await repo.update(
      { userId, usedAt: IsNull(), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private ttlMs(purpose: AccountTokenPurpose): number {
    return purpose === AccountTokenPurpose.ACCOUNT_ACTIVATION
      ? identityConfig.activationTtlHours(this.config) * 60 * 60 * 1000
      : identityConfig.passwordResetTtlMinutes(this.config) * 60 * 1000;
  }
}
