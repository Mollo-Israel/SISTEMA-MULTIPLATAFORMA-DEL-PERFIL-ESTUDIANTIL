import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from './user.entity';

/**
 * Notificación dentro de Afinia (V3 §33). No es un chat: avisa de un hecho y
 * lleva a donde se resuelve.
 */
@Entity('notifications')
@Unique('uq_notification_dedupe', ['recipientUserId', 'dedupeKey'])
@Index('idx_notifications_inbox', ['recipientUserId', 'readAt', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recipient_user_id', type: 'uuid' })
  recipientUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_user_id' })
  recipient: User;

  /** Tipo estable (§33): PARTICIPATION_CONFIRMED, TEAM_INVITATION… */
  @Column({ type: 'varchar', length: 60 })
  type: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 60, nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'varchar', length: 500 })
  body: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  link: string | null;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 200 })
  dedupeKey: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;
}
