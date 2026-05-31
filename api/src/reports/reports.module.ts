import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from '../entities/student-profile.entity';
import { StudentInterest } from '../entities/student-interest.entity';
import { StudentSkill } from '../entities/student-skill.entity';
import { Project } from '../entities/project.entity';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { AffinityRecalcModule } from '../affinity-recalc/affinity-recalc.module';
import { ReportsService } from './reports.service';
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
    ]),
    AffinityRecalcModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
