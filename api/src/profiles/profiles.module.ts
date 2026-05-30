import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from '../entities/student-profile.entity';
import { StudentInterest } from '../entities/student-interest.entity';
import { StudentSkill } from '../entities/student-skill.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { Skill } from '../entities/skill.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { AffinityResult } from '../entities/affinity-result.entity';
import { ProfilesService } from './profiles.service';
import { ProfilesController } from './profiles.controller';
import { AFFINITY_RECALCULATION } from './affinity/affinity-recalculation.port';
import { NoopAffinityRecalculation } from './affinity/noop-affinity-recalculation';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentProfile,
      StudentInterest,
      StudentSkill,
      AcademicArea,
      Skill,
      Project,
      ProjectMember,
      ProjectEvidence,
      ActivityRegistration,
      ExternalCertificate,
      InternalConstancy,
      AffinityResult,
    ]),
  ],
  controllers: [ProfilesController],
  providers: [
    ProfilesService,
    { provide: AFFINITY_RECALCULATION, useClass: NoopAffinityRecalculation },
  ],
  exports: [ProfilesService],
})
export class ProfilesModule {}
