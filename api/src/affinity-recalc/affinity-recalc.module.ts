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
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { AffinityResult } from '../entities/affinity-result.entity';
import { AccessModule } from '../access/access.module';
import { AFFINITY_RECALCULATION } from './affinity-recalculation.port';
import { AffinityEngineService } from './affinity.engine';
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
      ExternalCertificate,
      InternalConstancy,
      AffinityResult,
    ]),
    AccessModule,
  ],
  controllers: [AffinityController],
  providers: [
    AffinityEngineService,
    { provide: AFFINITY_RECALCULATION, useExisting: AffinityEngineService },
  ],
  exports: [AFFINITY_RECALCULATION, AffinityEngineService],
})
export class AffinityRecalcModule {}
