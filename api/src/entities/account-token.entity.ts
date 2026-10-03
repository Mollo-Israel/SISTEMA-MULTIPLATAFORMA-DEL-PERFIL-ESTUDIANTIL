import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AccountTokenPurpose } from '@perfil/shared';
import { User } from './user.entity';

/**
 * Token de un solo uso para activar una cuenta o restablecer la contraseña
 * (especificacion §12).
 *
 * Se guarda **solo el hash**: si alguien lee esta tabla no obtiene enlaces
 * utilizables. El token en claro existe unicamente el tiempo que tarda en
 * llegar al correo de su destinatario.
 */
@Entity('account_tokens')
@Index(['userId', 'purpose'])
export class AccountToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: AccountTokenPurpose,
    enumName: 'account_token_purpose_enum',
  })
  purpose: AccountTokenPurpose;

  /** SHA-256 del token entregado. Unico: dos tokens no colisionan. */
  @Index({ unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  /** Sellado al consumirlo. Un token usado no vuelve a servir. */
  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  /**
   * Sellado cuando se emite otro token del mismo proposito: pedir un enlace
   * nuevo invalida el anterior (§12).
   */
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  /** Por qué se revocó: se pidió otro, se agotaron los intentos o se suspendió la cuenta. */
  @Column({ name: 'revoked_reason', type: 'varchar', length: 30, nullable: true })
  revokedReason: TokenRevocationReason | null;

  /**
   * HMAC del código de seis dígitos que acompaña al enlace.
   *
   * Con hash simple, un millón de combinaciones se recorren en segundos; el
   * HMAC necesita además el secreto del servidor.
   */
  @Column({ name: 'code_hash', type: 'varchar', length: 64, nullable: true })
  codeHash: string | null;

  /** Intentos fallidos con el código. Al quinto, el token se revoca. */
  @Column({ name: 'failed_attempts', type: 'int', default: 0 })
  failedAttempts: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /** Un token sirve si no se usó, no se revocó y no ha expirado. */
  isUsable(now: Date = new Date()): boolean {
    return !this.usedAt && !this.revokedAt && this.expiresAt.getTime() > now.getTime();
  }

  /** En qué estado está, para poder decirle al usuario qué le pasó. */
  state(now: Date = new Date()): TokenState {
    if (this.usedAt) return 'used';
    if (this.revokedAt) {
      return this.revokedReason === 'too_many_attempts'
        ? 'locked'
        : this.revokedReason === 'account_suspended'
          ? 'suspended'
          : 'replaced';
    }
    if (this.expiresAt.getTime() <= now.getTime()) return 'expired';
    return 'valid';
  }
}

export type TokenRevocationReason = 'replaced' | 'too_many_attempts' | 'account_suspended';

/**
 * Estado de un token desde el punto de vista de quien lo presenta.
 *
 * Distinguirlos no filtra nada: para preguntar por un token hay que tenerlo, y
 * tenerlo es haber recibido el correo. Sí le ahorra al usuario la duda de si
 * escribió mal o si tiene que pedir otro.
 */
export type TokenState = 'valid' | 'used' | 'expired' | 'replaced' | 'locked' | 'suspended';
