import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Sesion abierta de un usuario (especificacion §14).
 *
 * Existe para poder **revocar**. Un JWT por si solo no se puede retirar antes
 * de que expire; con una fila por sesion, cerrar sesion, cambiar la contraseña
 * o suspender una cuenta cortan el acceso de inmediato.
 *
 * Igual que con los tokens de activacion, se guarda solo el hash del refresh
 * token.
 */
@Entity('auth_sessions')
@Index(['userId', 'revokedAt'])
export class AuthSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** SHA-256 del refresh token vigente de esta sesion. */
  @Index({ unique: true })
  @Column({ name: 'refresh_token_hash', type: 'varchar', length: 64 })
  refreshTokenHash: string;

  /**
   * SHA-256 del refresh token que este reemplazó en la última rotación.
   *
   * Sirve solo durante una ventana corta tras `rotatedAt`: cubre la recarga
   * de la página en medio de una renovación, cuando el navegador descarta la
   * cookie nueva y vuelve a presentar la anterior.
   */
  @Index('idx_auth_sessions_previous_hash')
  @Column({ name: 'previous_refresh_token_hash', type: 'varchar', length: 64, nullable: true })
  previousRefreshTokenHash: string | null;

  @Column({ name: 'rotated_at', type: 'timestamptz', nullable: true })
  rotatedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  /** Ultima vez que esta sesion rotó su refresh token. */
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  /**
   * Contexto minimo para que el usuario reconozca sus sesiones. No se guarda
   * nada que permita reconstruir el token ni identificar de mas.
   */
  @Column({ name: 'user_agent', type: 'varchar', length: 200, nullable: true })
  userAgent: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  isUsable(now: Date = new Date()): boolean {
    return !this.revokedAt && this.expiresAt.getTime() > now.getTime();
  }
}
