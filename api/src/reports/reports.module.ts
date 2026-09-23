import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from '../entities/student-profile.entity';
import { StudentInterest } from '../entities/student-interest.entity';
import { StudentSkill } from '../entities/student-skill.entity';
import { Project } from '../entities/project.entity';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { AffinityRecalcModule } from '../affinity-recalc/affinity-recalc.module';
import { AccessModule } from '../access/access.module';
import { AffinityResult } from '../entities/affinity-result.entity';
import { AffinitySnapshot } from '../entities/affinity-snapshot.entity';
import {
  AffinitySnapshotItem,
} from '../entities/affinity-snapshot-item.entity';
import { ReportsService } from './reports.service';
import { AnalyticsService } from './analytics.service';
import { AnalyticsPrivacyService } from './analytics-privacy.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentProfile,
      StudentInterest,
      StudentSkill,
      Project,
      Activity,
      ActivityRegistration,
      AffinityResult,
      AffinitySnapshot,
      AffinitySnapshotItem,
    ]),
    AffinityRecalcModule,
    AccessModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, AnalyticsService, AnalyticsPrivacyService],
})
export class ReportsModule {}
