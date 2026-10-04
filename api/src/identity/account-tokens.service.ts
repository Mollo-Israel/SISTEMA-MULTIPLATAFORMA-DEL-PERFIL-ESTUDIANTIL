import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EntityManager, IsNull, MoreThan, Repository } from 'typeorm';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { AccountTokenPurpose } from '@perfil/shared';
import { AccountToken, TokenRevocationReason, TokenState } from '../entities/account-token.entity';
import { identityConfig } from '../config/identity.config';
import { resolveJwtSecret } from '../config/security.config';

export interface IssuedToken {
  /** Valor en claro del enlace. Solo existe aquí y en el correo; no se persiste. */
  token: string;
  /** Código de seis dígitos que acompaña al enlace. Tampoco se persiste en claro. */
  code: string;
  expiresAt: Date;
}


/** SHA-256 en hexadecimal. Un token tiene entropía suficiente: no necesita sal. */
function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function igualesEnTiempoConstante(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

export type CodeCheck =
  | { ok: true; record: AccountToken }
  | { ok: false; locked: boolean };

@Injectable()
export class AccountTokensService {
  constructor(
    @InjectRepository(AccountToken)
    private readonly tokens: Repository<AccountToken>,
    private readonly config: ConfigService,
  ) {}

  /**
   * Emite un token y revoca los anteriores del mismo propósito (§12).
   *
   * Pedir un enlace nuevo invalida el viejo: si no fuera así, un enlace
   * filtrado seguiría sirviendo indefinidamente mientras el usuario pide
   * reenvíos.
   */
  async issue(
    userId: string,
    purpose: AccountTokenPurpose,
    manager?: EntityManager,
  ): Promise<IssuedToken> {
    const repo = manager ? manager.getRepository(AccountToken) : this.tokens;

    await repo.update(
      { userId, purpose, usedAt: IsNull(), revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: 'replaced' },
    );

    const token = randomBytes(32).toString('base64url');
    // randomInt usa el generador criptográfico; Math.random no serviría aquí.
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + this.ttlMs(purpose));

    await repo.save(
      repo.create({
        userId,
        purpose,
        tokenHash: hash(token),
        codeHash: this.codeHash(userId, purpose, code),
        expiresAt,
      }),
    );

    return { token, code, expiresAt };
  }

  /**
   * Estado de un token, para explicarle al usuario qué le pasó.
   *
   * `invalid` cubre tanto el token inexistente como el mal copiado: esos dos sí
   * se confunden, porque distinguirlos no le sirve a nadie.
   */
  async inspect(
    token: string,
    purpose: AccountTokenPurpose,
  ): Promise<{ record: AccountToken | null; state: TokenState | 'invalid' }> {
    if (!token || token.length < 16) return { record: null, state: 'invalid' };
    const candidate = await this.tokens.findOne({
      where: { tokenHash: hash(token), purpose },
      relations: { user: true },
    });
    if (!candidate || !igualesEnTiempoConstante(candidate.tokenHash, hash(token))) {
      return { record: null, state: 'invalid' };
    }
    return { record: candidate, state: candidate.state() };
  }

  /** Busca un token utilizable. Null si no existe, expiró, se usó o se revocó. */
  async findUsable(token: string, purpose: AccountTokenPurpose): Promise<AccountToken | null> {
    const { record, state } = await this.inspect(token, purpose);
    return state === 'valid' ? record : null;
  }

  /**
   * Comprueba un código de seis dígitos contra el token vivo del usuario.
   *
   * Cada fallo cuenta. Al quinto, el token se revoca: seis dígitos solo son
   * seguros si no se pueden probar todos.
   */
  async verifyCode(
    userId: string,
    purpose: AccountTokenPurpose,
    code: string,
  ): Promise<CodeCheck> {
    const vivo = await this.tokens.findOne({
      where: { userId, purpose, usedAt: IsNull(), revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
      relations: { user: true },
    });
    if (!vivo || !vivo.codeHash || vivo.state() !== 'valid') {
      return { ok: false, locked: false };
    }

    const limpio = String(code ?? '').replace(/\D/g, '');
    if (limpio.length === 6 && igualesEnTiempoConstante(vivo.codeHash, this.codeHash(userId, purpose, limpio))) {
      return { ok: true, record: vivo };
    }

    // El incremento va en SQL para que dos intentos simultáneos no se pisen y
    // cuenten como uno.
    const resultado = await this.tokens.query(
      `UPDATE account_tokens SET failed_attempts = failed_attempts + 1
        WHERE id = $1 RETURNING failed_attempts`,
      [vivo.id],
    );
    // Con PostgreSQL, TypeORM devuelve un UPDATE como [filas, afectadas].
    const filas = Array.isArray(resultado?.[0]) ? resultado[0] : resultado;
    const usados = Number(filas?.[0]?.failed_attempts ?? vivo.failedAttempts + 1);
    if (usados >= identityConfig.codeMaxAttempts(this.config)) {
      await this.tokens.update(
        { id: vivo.id },
        { revokedAt: new Date(), revokedReason: 'too_many_attempts' },
      );
      return { ok: false, locked: true };
    }
    return { ok: false, locked: false };
  }

  /** Marca el token como consumido. Un token sirve exactamente una vez. */
  async consume(tokenId: string, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(AccountToken) : this.tokens;
    await repo.update({ id: tokenId }, { usedAt: new Date() });
  }

  /**
   * Segundos que faltan para poder pedir otro envío, o 0 si ya se puede (§12).
   * Evita que el reenvío se convierta en un generador de correo masivo.
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

  /**
   * Cuántos correos de este propósito se enviaron al usuario en 24 horas.
   *
   * El cooldown evita la ráfaga; esto evita el goteo: veinte reenvíos a lo
   * largo de un día bastan para que un proveedor marque el remitente como
   * spam, y entonces dejan de llegar también los correos legítimos.
   */
  async sentInLastDay(userId: string, purpose: AccountTokenPurpose): Promise<number> {
    return this.tokens.count({
      where: { userId, purpose, createdAt: MoreThan(new Date(Date.now() - 24 * 60 * 60 * 1000)) },
    });
  }

  /** Revoca los tokens vivos de un usuario, por ejemplo al suspender la cuenta. */
  async revokeAll(
    userId: string,
    manager?: EntityManager,
    reason: TokenRevocationReason = 'account_suspended',
  ): Promise<void> {
    const repo = manager ? manager.getRepository(AccountToken) : this.tokens;
    await repo.update(
      { userId, usedAt: IsNull(), revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  private ttlMs(purpose: AccountTokenPurpose): number {
    return purpose === AccountTokenPurpose.ACCOUNT_ACTIVATION
      ? identityConfig.activationTtlHours(this.config) * 60 * 60 * 1000
      : identityConfig.passwordResetTtlMinutes(this.config) * 60 * 1000;
  }

  /**
   * HMAC del código, atado al usuario y al propósito.
   *
   * La clave se deriva del secreto de firma, así que no hay que configurar un
   * secreto más; y como incluye el usuario, el mismo código de dos personas
   * no produce el mismo hash.
   */
  private codeHash(userId: string, purpose: AccountTokenPurpose, code: string): string {
    const clave = createHmac('sha256', resolveJwtSecret(this.config))
      .update('afinia:codigo-de-cuenta')
      .digest();
    return createHmac('sha256', clave).update(`${userId}:${purpose}:${code}`).digest('hex');
  }
}
