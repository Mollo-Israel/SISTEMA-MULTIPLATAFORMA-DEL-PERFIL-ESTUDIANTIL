import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * V9 · Correo personal comprobado de un estudiante.
 *
 * Las insignias de Credly, Coursera o Accredible se emiten al correo con el
 * que el estudiante se inscribió, casi nunca el institucional. Para que
 * Afinia reconozca al destinatario de una insignia (su correo va como hash
 * con sal), necesita saber qué correos son de verdad del estudiante: los que
 * él demostró controlar con un código.
 *
 * Un correo comprobado pertenece a un solo usuario: si dos cuentas pudieran
 * comprobar el mismo, la de menos escrúpulos se apropiaría de las insignias
 * de la otra.
 */
@Entity('student_verified_emails')
@Index('UQ_student_verified_emails_usuario_correo', ['userId', 'email'], { unique: true })
export class StudentVerifiedEmail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** En minúsculas. */
  @Column({ type: 'varchar', length: 254 })
  email: string;

  /** SHA-256 del código vigente; null cuando ya se comprobó o venció. */
  @Column({ name: 'code_hash', type: 'char', length: 64, nullable: true })
  codeHash: string | null;

  @Column({ name: 'code_expires_at', type: 'timestamptz', nullable: true })
  codeExpiresAt: Date | null;

  @Column({ type: 'smallint', default: 0 })
  attempts: number;

  /** Códigos enviados en la ventana actual (límite anti-abuso). */
  @Column({ name: 'sent_count', type: 'smallint', default: 0 })
  sentCount: number;

  @Column({ name: 'last_sent_at', type: 'timestamptz', nullable: true })
  lastSentAt: Date | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
