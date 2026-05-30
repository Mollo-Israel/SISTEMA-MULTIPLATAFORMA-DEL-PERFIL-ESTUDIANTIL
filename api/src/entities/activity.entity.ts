import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ActivityModality, ActivityStatus, ActivityType } from '@perfil/shared';
import { User } from './user.entity';
import { AcademicArea } from './academic-area.entity';
import { ActivityRegistration } from './activity-registration.entity';

@Entity('activities')
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index()
  @Column({ type: 'enum', enum: ActivityType })
  type: ActivityType;

  @Column({ type: 'enum', enum: ActivityModality, default: ActivityModality.PRESENCIAL })
  modality: ActivityModality;

  @Index()
  @Column({ name: 'academic_area_id', type: 'uuid', nullable: true })
  academicAreaId: string | null;

  @ManyToOne(() => AcademicArea, (area) => area.activities, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea | null;

  @Index()
  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ name: 'event_date', type: 'timestamptz', nullable: true })
  eventDate: Date | null;

  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  @Index()
  @Column({ type: 'enum', enum: ActivityStatus, default: ActivityStatus.DRAFT })
  status: ActivityStatus;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[] | null;

  @OneToMany(() => ActivityRegistration, (reg) => reg.activity)
  registrations: ActivityRegistration[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
