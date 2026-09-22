import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from '../entities/student-profile.entity';
import { StudentInterest } from '../entities/student-interest.entity';
import { StudentSkill } from '../entities/student-skill.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ProjectFeedback } from '../entities/project-feedback.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { ValidationRecord } from '../entities/validation-record.entity';
import { AffinityResult } from '../entities/affinity-result.entity';
import { AffinityWeight } from '../entities/affinity-weight.entity';
import { AffinityContribution } from '../entities/affinity-contribution.entity';
import { AffinitySnapshot } from '../entities/affinity-snapshot.entity';
import { AffinitySnapshotItem } from '../entities/affinity-snapshot-item.entity';
import { AccessModule } from '../access/access.module';
import { AffinityEngineService } from './affinity.engine';
import { AffinityBackfillService } from './affinity-backfill.service';
import { AffinityController } from './affinity.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentProfile,
      StudentInterest,
      StudentSkill,
      AcademicArea,
      ActivityRegistration,
      Project,
      ProjectMember,
      ProjectEvidence,
      ProjectFeedback,
      ExternalCertificate,
      InternalConstancy,
      ValidationRecord,
      AffinityResult,
      AffinityWeight,
      AffinityContribution,
      AffinitySnapshot,
      AffinitySnapshotItem,
    ]),
    AccessModule,
  ],
  controllers: [AffinityController],
  providers: [AffinityEngineService, AffinityBackfillService],
  // El puerto de recomputacion ya no vive aqui: §109 lo centraliza en
  // TrajectoryModule, que coordina afinidad y recomendaciones. Exponerlo desde
  // los dos sitios permitiria saltarse al coordinador sin darse cuenta.
  exports: [AffinityEngineService, AffinityBackfillService],
})
export class AffinityRecalcModule {}
