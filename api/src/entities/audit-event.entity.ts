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
 * Evento de auditoria (especificacion §70).
 *
 * Responde "quien hizo que, sobre que y cuando" para las acciones que cambian
 * acceso, identidad o trayectoria. No sustituye al log de aplicacion: aqui solo
 * entra lo que alguien podria tener que justificar despues.
 *
 * §70 prohibe expresamente guardar contraseñas, tokens, contenido de chat o
 * binarios. `metadata` es para identificadores y valores cortos.
 */
@Entity('audit_events')
@Index(['entityType', 'entityId'])
@Index(['actorUserId', 'createdAt'])
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nulo solo si lo origina el propio sistema (por ejemplo, un worker). */
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_user_id' })
  actor: User | null;

  /** Verbo en mayusculas: USER_PROVISIONED, PARTICIPATION_CONFIRMED, etc. */
  @Index()
  @Column({ name: 'event_type', type: 'varchar', length: 60 })
  eventType: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 60 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 64, nullable: true })
  entityId: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
