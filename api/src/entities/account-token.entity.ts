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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /** Un token sirve si no se usó, no se revocó y no ha expirado. */
  isUsable(now: Date = new Date()): boolean {
    return !this.usedAt && !this.revokedAt && this.expiresAt.getTime() > now.getTime();
  }
}
