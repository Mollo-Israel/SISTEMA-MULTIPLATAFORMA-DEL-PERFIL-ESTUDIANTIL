import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { AcademicArea } from './academic-area.entity';
import { LearningResource } from './learning-resource.entity';
import { StudentProfile } from './student-profile.entity';

/** V3.2 §35: un recurso puede tocar varias áreas; `academic_area_id` es la principal. */
@Entity('learning_resource_areas')
export class LearningResourceArea {
  @PrimaryColumn({ name: 'learning_resource_id', type: 'uuid' })
  learningResourceId: string;

  @PrimaryColumn({ name: 'academic_area_id', type: 'uuid' })
  academicAreaId: string;

  @ManyToOne(() => LearningResource, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'learning_resource_id' })
  learningResource: LearningResource;

  @ManyToOne(() => AcademicArea, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea;
}

/**
 * V3.2 §35.1–§35.3: un recurso guardado como favorito. Organización personal;
 * a lo sumo, señal secundaria y explícita para recomendar. Nunca afinidad.
 */
@Entity('learning_resource_favorites')
export class LearningResourceFavorite {
  @PrimaryColumn({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @PrimaryColumn({ name: 'learning_resource_id', type: 'uuid' })
  learningResourceId: string;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @ManyToOne(() => LearningResource, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'learning_resource_id' })
  learningResource: LearningResource;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
