import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserStatus } from '@perfil/shared';
import { Role } from './role.entity';
import { StudentProfile } from './student-profile.entity';
import { ProjectMember } from './project-member.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 160 })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName: string;

  /**
   * Código universitario, en toda cuenta: `PREFIJO-XXXXXXX` según el rol
   * (ver `UNIVERSITY_CODE_PREFIX`). Único. En un estudiante, su perfil guarda
   * una copia sincronizada.
   */
  @Index('uq_users_university_code', { unique: true })
  @Column({ name: 'university_code', type: 'varchar', length: 11 })
  universityCode: string;

  /** Semestre que cursa, en los roles que lo indican (`SEMESTER_ROLES`). */
  @Column({ type: 'smallint', nullable: true })
  semester: number | null;

  /**
   * Semestres adicionales que cursa un estudiante por arrastre o repetición
   * (V3 §8.1). Los gestiona Administración; el estudiante no los edita. El
   * alcance docente considera el semestre actual **y** estos.
   */
  @Column({ name: 'academic_scope_semesters', type: 'smallint', array: true, default: () => "'{}'" })
  academicScopeSemesters: number[];

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Index()
  @Column({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @ManyToOne(() => Role, (role) => role.users, { nullable: false })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @OneToOne(() => StudentProfile, (profile) => profile.user)
  studentProfile: StudentProfile | null;

  @OneToMany(() => ProjectMember, (member) => member.user)
  projectMemberships: ProjectMember[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * El hash nunca sale en una respuesta, aunque el usuario viaje anidado en
   * otra entidad (creador de una actividad, actor de una revisión...).
   * Las consultas internas siguen leyéndolo con normalidad.
   */
  toJSON(): Omit<this, 'passwordHash' | 'toJSON'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = this;
    return rest as Omit<this, 'passwordHash' | 'toJSON'>;
  }
}
