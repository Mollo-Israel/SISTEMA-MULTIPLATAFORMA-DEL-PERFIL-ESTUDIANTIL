import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { ActivityCategory } from '../entities/activity-category.entity';
import { ActivitySkill } from '../entities/activity-skill.entity';
import { ActivityArea } from '../entities/activity-area.entity';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { ExternalOpportunityValidationReference } from '../entities/external-opportunity-validation-reference.entity';
import { StorageModule } from '../storage/storage.module';
import { CredentialEligibilityService } from './credential-eligibility.service';
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
      ActivityArea,
      InternalConstancy,
      Skill,
      ActivityReview,
      ActivityGamificationRule,
      GamificationCriterion,
      ExternalCertificate,
      ExternalOpportunityValidationReference,
    ]),
    TrajectoryModule,
    AccessModule,
    StorageModule,
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, CredentialEligibilityService],
  exports: [ActivitiesService, CredentialEligibilityService],
})
export class ActivitiesModule {}
