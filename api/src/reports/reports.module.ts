import { HomeOverviewService } from './home-overview.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from '../entities/student-profile.entity';
import { StudentInterest } from '../entities/student-interest.entity';
import { StudentSkillInterest } from '../entities/student-skill-interest.entity';
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
      StudentSkillInterest,
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
  providers: [ReportsService, AnalyticsService, AnalyticsPrivacyService, HomeOverviewService],
  // El asistente de IA redacta sobre estas cifras; no las calcula (V2 §63).
  exports: [AnalyticsService],
})
export class ReportsModule {}
