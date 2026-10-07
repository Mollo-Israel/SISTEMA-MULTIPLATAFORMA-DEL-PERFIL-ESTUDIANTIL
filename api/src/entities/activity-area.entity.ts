import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Activity } from './activity.entity';
import { AcademicArea } from './academic-area.entity';

/**
 * Áreas de una oportunidad (V3 §12.1, `areas[]`). Una oportunidad puede tocar
 * varias áreas; `activities.academic_area_id` conserva la principal.
 */
@Entity('activity_areas')
export class ActivityArea {
  @PrimaryColumn({ name: 'activity_id', type: 'uuid' })
  activityId: string;

  @PrimaryColumn({ name: 'academic_area_id', type: 'uuid' })
  academicAreaId: string;

  @ManyToOne(() => Activity, (activity) => activity.activityAreas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  @ManyToOne(() => AcademicArea, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea;
}
