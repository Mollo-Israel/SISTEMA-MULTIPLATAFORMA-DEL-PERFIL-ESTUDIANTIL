import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export type MailJobKind = 'account_activation' | 'password_reset';
export type MailJobStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';

/**
 * Un correo de cuenta pendiente de enviar.
 *
 * Guarda la **intención** —«mandarle la activación a esta persona»—, no el
 * mensaje. El token se emite justo antes de enviar, de modo que en esta tabla
 * nunca hay un enlace ni un código utilizables: si alguien la lee, no obtiene
 * nada con lo que activar una cuenta ajena.
 *
 * Existe por tres razones:
 *
 * - **Importar un padrón no puede esperar al SMTP.** Trescientas altas son
 *   trescientos correos; enviarlos dentro de la petición la dejaba colgada
 *   varios minutos.
 * - **Las solicitudes públicas no deben delatar qué cuentas existen.** Si la
 *   respuesta esperara al envío, una cuenta real tardaría un segundo más que
 *   una inexistente, y eso basta para enumerar correos.
 * - **Un fallo del proveedor no puede perder el correo.** Se reintenta con
 *   espera creciente, y el administrador ve en qué quedó cada envío.
 */
@Entity('mail_jobs')
@Index(['status', 'nextAttemptAt'])
@Index(['userId', 'kind', 'createdAt'])
export class MailJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 30 })
  kind: MailJobKind;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: MailJobStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  /** Motivo del último fallo, legible para el administrador. Nunca un secreto. */
  @Column({ name: 'last_error', type: 'varchar', length: 300, nullable: true })
  lastError: string | null;

  @Column({ name: 'next_attempt_at', type: 'timestamptz', default: () => 'now()' })
  nextAttemptAt: Date;

  /** Quién lo pidió: el administrador, la importación o el propio titular. */
  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
