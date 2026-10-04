import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Project } from './project.entity';
import { User } from './user.entity';
import { ProjectMemberSkill } from './project-member-skill.entity';

@Entity('project_members')
@Unique('uq_project_member', ['projectId', 'userId'])
export class ProjectMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, (project) => project.members, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.projectMemberships, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 80, nullable: true })
  role: string | null;

  /**
   * Fila del responsable del proyecto (V2 §34, §48): existe para que también
   * él confirme las tecnologías que usó. No es un integrante «aceptado» y no
   * eleva el respaldo del proyecto.
   */
  @Column({ name: 'is_owner', type: 'boolean', default: false })
  isOwner: boolean;

  @Column({ type: 'text', nullable: true })
  contribution: string | null;

  /**
   * Cuando el propio integrante confirmo su contribucion (§33).
   *
   * Nulo significa que lo que hay lo escribio otra persona y el integrante
   * aun no lo ha revisado. §33 es explicito: no se permite que el creador
   * atribuya unilateralmente experiencia definitiva a otro estudiante, asi
   * que hasta que no confirma, esa contribucion no alimenta su perfil.
   */
  @Column({ name: 'contribution_confirmed_at', type: 'timestamptz', nullable: true })
  contributionConfirmedAt: Date | null;

  /** Tecnologias que uso este integrante en concreto (§34). */
  @OneToMany(() => ProjectMemberSkill, (link) => link.projectMember)
  memberSkills: ProjectMemberSkill[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
