import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  AvailabilityRequirement,
  ContactRequestStatus,
  ContactSource,
  ConversationKind,
  TeamInvitationStatus,
  TeamNeedStatus,
  TeamStatus,
} from '@perfil/shared';
import { AcademicArea } from './academic-area.entity';
import { Activity } from './activity.entity';
import { Project } from './project.entity';
import { Skill } from './skill.entity';
import { StudentProfile } from './student-profile.entity';

/**
 * Solicitud de contacto entre dos estudiantes (§45).
 *
 * §45 describe el flujo entero y lo cierra con una frase que manda sobre todo
 * lo demas: *«El QR no establece contacto automaticamente»*. Escanear lleva al
 * perfil publico; el contacto nace de una solicitud que la otra persona
 * responde.
 */
@Entity('contact_requests')
@Index('idx_contact_requests_destino', ['targetProfileId', 'status'])
@Check('chk_contact_request_distintos', '"requester_profile_id" <> "target_profile_id"')
export class ContactRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'requester_profile_id', type: 'uuid' })
  requesterProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requester_profile_id' })
  requester: StudentProfile;

  @Column({ name: 'target_profile_id', type: 'uuid' })
  targetProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_profile_id' })
  target: StudentProfile;

  @Column({
    type: 'enum',
    enum: ContactRequestStatus,
    enumName: 'contact_request_status_enum',
    default: ContactRequestStatus.PENDING,
  })
  status: ContactRequestStatus;

  @Column({
    type: 'enum',
    enum: ContactSource,
    enumName: 'contact_source_enum',
    default: ContactSource.DIRECTORY,
  })
  source: ContactSource;

  /** Presentacion breve. Quien recibe decide con algo mas que un nombre. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  message: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/**
 * Contacto establecido (§45).
 *
 * Una sola fila por pareja, con los dos identificadores ordenados. Guardar dos
 * filas simetricas obligaria a mantenerlas de acuerdo, y basta con que una se
 * borre a medias para que A vea a B entre sus contactos y B no vea a A.
 */
@Entity('contacts')
@Unique('uq_contact_pareja', ['profileAId', 'profileBId'])
@Check('chk_contact_orden', '"profile_a_id" < "profile_b_id"')
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'profile_a_id', type: 'uuid' })
  profileAId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_a_id' })
  profileA: StudentProfile;

  @Index()
  @Column({ name: 'profile_b_id', type: 'uuid' })
  profileBId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_b_id' })
  profileB: StudentProfile;

  @Column({
    type: 'enum',
    enum: ContactSource,
    enumName: 'contact_source_enum',
    default: ContactSource.DIRECTORY,
  })
  source: ContactSource;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

/**
 * Necesidad de equipo (§46).
 *
 * §46 abre con el objetivo: *«priorizar complementariedad»*. Por eso lo que se
 * declara son las habilidades que **faltan**, no las que el grupo ya tiene.
 */
@Entity('team_needs')
@Index('idx_team_needs_estado', ['status'])
export class TeamNeed {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'owner_profile_id', type: 'uuid' })
  ownerProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_profile_id' })
  owner: StudentProfile;

  /** Para que se busca gente. Es lo primero que lee un candidato. */
  @Column({ type: 'varchar', length: 300 })
  purpose: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;

  @Column({ name: 'activity_id', type: 'uuid', nullable: true })
  activityId: string | null;

  @ManyToOne(() => Activity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity | null;

  @Column({ name: 'max_members', type: 'smallint', default: 5 })
  maxMembers: number;

  @Column({
    name: 'availability_requirement',
    type: 'enum',
    enum: AvailabilityRequirement,
    enumName: 'availability_requirement_enum',
    default: AvailabilityRequirement.ANY,
  })
  availabilityRequirement: AvailabilityRequirement;

  @Column({
    type: 'enum',
    enum: TeamNeedStatus,
    enumName: 'team_need_status_enum',
    default: TeamNeedStatus.OPEN,
  })
  status: TeamNeedStatus;

  @OneToMany(() => TeamNeedSkill, (s) => s.need)
  requiredSkills: TeamNeedSkill[];

  @OneToMany(() => TeamNeedArea, (a) => a.need)
  preferredAreas: TeamNeedArea[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** Habilidad que una necesidad pide (§46, `required_skills[]`). */
@Entity('team_need_skills')
@Unique('uq_team_need_skill', ['teamNeedId', 'skillId'])
export class TeamNeedSkill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'team_need_id', type: 'uuid' })
  teamNeedId: string;

  @ManyToOne(() => TeamNeed, (n) => n.requiredSkills, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'team_need_id' })
  need: TeamNeed;

  @Index()
  @Column({ name: 'skill_id', type: 'uuid' })
  skillId: string;

  @ManyToOne(() => Skill, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_id' })
  skill: Skill;
}

/** Area preferida de una necesidad (§46, `preferred_areas[]`). */
@Entity('team_need_areas')
@Unique('uq_team_need_area', ['teamNeedId', 'academicAreaId'])
export class TeamNeedArea {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'team_need_id', type: 'uuid' })
  teamNeedId: string;

  @ManyToOne(() => TeamNeed, (n) => n.preferredAreas, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'team_need_id' })
  need: TeamNeed;

  @Index()
  @Column({ name: 'academic_area_id', type: 'uuid' })
  academicAreaId: string;

  @ManyToOne(() => AcademicArea, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea;
}

/** Equipo formado a partir de una necesidad (§46). */
@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Index()
  @Column({ name: 'owner_profile_id', type: 'uuid' })
  ownerProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_profile_id' })
  owner: StudentProfile;

  @Index()
  @Column({ name: 'team_need_id', type: 'uuid', nullable: true })
  teamNeedId: string | null;

  @ManyToOne(() => TeamNeed, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'team_need_id' })
  need: TeamNeed | null;

  @Column({
    type: 'enum',
    enum: TeamStatus,
    enumName: 'team_status_enum',
    default: TeamStatus.FORMING,
  })
  status: TeamStatus;

  @OneToMany(() => TeamMember, (m) => m.team)
  members: TeamMember[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** Integrante aceptado de un equipo (§46). */
@Entity('team_members')
@Unique('uq_team_member', ['teamId', 'studentProfileId'])
export class TeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @ManyToOne(() => Team, (t) => t.members, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Column({ type: 'varchar', length: 80, nullable: true })
  role: string | null;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}

/**
 * Invitacion a un equipo (§47).
 *
 * §47 termina con *«No enviar invitaciones automaticamente»*: el motor sugiere,
 * una persona decide. `reason` guarda por que se sugirio, para que quien recibe
 * sepa de donde sale y no le llegue como spam.
 */
@Entity('team_invitations')
@Unique('uq_team_invitation', ['teamId', 'invitedProfileId'])
@Index('idx_team_invitations_invitado', ['invitedProfileId', 'status'])
export class TeamInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @ManyToOne(() => Team, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ name: 'invited_profile_id', type: 'uuid' })
  invitedProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invited_profile_id' })
  invited: StudentProfile;

  @Column({ name: 'invited_by_profile_id', type: 'uuid' })
  invitedByProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invited_by_profile_id' })
  invitedBy: StudentProfile;

  @Column({
    type: 'enum',
    enum: TeamInvitationStatus,
    enumName: 'team_invitation_status_enum',
    default: TeamInvitationStatus.PENDING,
  })
  status: TeamInvitationStatus;

  @Column({ type: 'varchar', length: 300, nullable: true })
  message: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

/**
 * Conversacion (§42).
 *
 * §42 la llama «apoyo contextual» y es exactamente eso: existe porque hay una
 * relacion detras -un contacto aceptado o un equipo-, no al reves. Sus reglas
 * son igual de explicitas: no alimenta afinidad, no puntua por cantidad, no se
 * analiza el contenido y no sirve como prueba de contribucion. La bitacora del
 * proyecto (§41) es la fuente de auditoria.
 */
@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ConversationKind,
    enumName: 'conversation_kind_enum',
  })
  kind: ConversationKind;

  /** Solo en las de equipo. Una directa no pertenece a ningun equipo. */
  @Index()
  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  @OneToMany(() => ConversationMember, (m) => m.conversation)
  members: ConversationMember[];

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

/** Quien participa de una conversacion (§42, §107 `canAccessConversation`). */
@Entity('conversation_members')
@Unique('uq_conversation_member', ['conversationId', 'studentProfileId'])
export class ConversationMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => Conversation, (c) => c.members, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  /** Hasta donde leyo. Sirve para marcar lo no leido, nada mas. */
  @Column({ name: 'last_read_at', type: 'timestamptz', nullable: true })
  lastReadAt: Date | null;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}

/**
 * Mensaje (§42).
 *
 * Se guarda el texto y quien lo escribio. Nada mas: §42 prohibe analizar el
 * contenido para inferir competencia, asi que no hay etiquetas, ni conteos por
 * persona, ni ningun campo derivado que invite a hacerlo mas adelante.
 */
@Entity('messages')
@Index('idx_messages_conversacion', ['conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => Conversation, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Index()
  @Column({ name: 'sender_profile_id', type: 'uuid' })
  senderProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_profile_id' })
  sender: StudentProfile;

  @Column({ type: 'varchar', length: 2000 })
  body: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
