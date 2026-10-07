import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LinkCheckStatus, ProjectEventType, TechnologyStatus } from '@perfil/shared';
import { Project } from './project.entity';
import { User } from './user.entity';

/** Metadata publica de un repositorio (§37). */
export interface RepositoryMetadata {
  exists: boolean;
  owner: string | null;
  repositoryName: string | null;
  defaultBranch: string | null;
  /** Lenguajes que reporta el proveedor, de mayor a menor peso. */
  languages: string[];
  updatedAt: string | null;
  /** V3 §24.1: último push. */
  pushedAt?: string | null;
  readmePresence: boolean;
  /** Ficheros de manifiesto encontrados en la raíz. */
  manifests: string[];
  /**
   * V3 §24.3: tecnologías candidatas leídas de los manifiestos, con el
   * fichero y la dependencia que las delató.
   */
  dependencySignals?: { technology: string; file: string; evidence: string }[];
  stars: number | null;
  /** V3 §24.6: la respuesta vino de la caché (fresca o confirmada con 304). */
  fromCache?: boolean;
  /** Motivo por el que no se pudo consultar, si lo hubo. */
  error: string | null;
}

/** Tecnologia y de donde salio (§38). */
export interface TechnologySignal {
  name: string;
  status: TechnologyStatus;
  /** De donde vino el indicio: 'languages', 'package.json'… */
  source: string | null;
}

/**
 * Comprobacion de un repositorio publico (§37, §73.4).
 *
 * GitHub es opcional: un proyecto no necesita repositorio para existir. Cuando
 * lo hay, se consulta solo metadata publica y manifiestos, nunca el contenido
 * completo — §37 lo prohibe explicitamente.
 */
@Entity('project_repository_checks')
export class ProjectRepositoryCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'repository_url', type: 'varchar', length: 500 })
  repositoryUrl: string;

  @Column({ type: 'enum', enum: LinkCheckStatus, default: LinkCheckStatus.UNVERIFIED })
  status: LinkCheckStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: RepositoryMetadata | null;

  /**
   * Cruce entre lo declarado y lo encontrado (§38).
   *
   * `DETECTED` no afirma dominio: solo que hay indicios compatibles.
   */
  @Column({ name: 'technology_signals', type: 'jsonb', default: () => "'[]'::jsonb" })
  technologySignals: TechnologySignal[];

  @Column({ name: 'checked_at', type: 'timestamptz', default: () => 'now()' })
  checkedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

/**
 * Comprobacion de una demo desplegada (§39, §73.4).
 *
 * Solo se comprueba lo observable: que responda, si usa HTTPS, su titulo y su
 * metadata publica. §39 es explicito en que no se infiere backend ni base de
 * datos: React declarado puede dejar rastro publico; PostgreSQL declarado
 * normalmente no, y se queda como declarado.
 */
@Entity('project_link_checks')
export class ProjectLinkCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'enum', enum: LinkCheckStatus, default: LinkCheckStatus.UNVERIFIED })
  status: LinkCheckStatus;

  @Column({ name: 'is_https', type: 'boolean', default: false })
  isHttps: boolean;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  @Column({ name: 'http_status', type: 'smallint', nullable: true })
  httpStatus: number | null;

  @Column({ name: 'blocked_reason', type: 'varchar', length: 200, nullable: true })
  blockedReason: string | null;

  /**
   * V3 §26: metadata pública mínima de la página (descripción, nombre del
   * sitio, adónde llevó). Prueba que hay un despliegue accesible; nunca se
   * deduce de aquí el backend ni la base de datos.
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: { description: string | null; siteName: string | null; finalUrl: string | null } | null;

  @Column({ name: 'checked_at', type: 'timestamptz', default: () => 'now()' })
  checkedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

/**
 * Bitacora del proyecto (§41).
 *
 * La auditoria funcional se hace con eventos estructurados, no analizando
 * conversaciones. Es distinta de `audit_events`, que registra decisiones
 * administrativas sobre personas: esta cuenta la vida de un proyecto y la ven
 * sus integrantes.
 *
 * El metadato es minimo y nunca lleva secretos.
 */
@Entity('project_events')
@Index('IDX_project_events_proyecto', ['projectId', 'createdAt'])
export class ProjectEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  /** Nulo cuando lo produjo el sistema, no una persona. */
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_user_id' })
  actor: User | null;

  @Column({ name: 'event_type', type: 'enum', enum: ProjectEventType })
  eventType: ProjectEventType;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
