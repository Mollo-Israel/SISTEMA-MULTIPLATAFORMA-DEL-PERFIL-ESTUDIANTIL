import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { ActivityCategory } from '../entities/activity-category.entity';
import { ActivitySkill } from '../entities/activity-skill.entity';
import { Skill } from '../entities/skill.entity';
import { ActivityGamificationRule, ActivityReview } from '../entities/activity-review.entity';
import { GamificationCriterion } from '../entities/gamification-criterion.entity';
import { AccessModule } from '../access/access.module';
import { TrajectoryModule } from '../trajectory/trajectory.module';
import { ActivitiesService } from './activities.service';
import { ActivitiesController } from './activities.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Activity,
      ActivityRegistration,
      StudentProfile,
      AcademicArea,
      ActivityCategory,
      ActivitySkill,
      Skill,
      ActivityReview,
      ActivityGamificationRule,
      GamificationCriterion,
    ]),
    TrajectoryModule,
    AccessModule,
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
