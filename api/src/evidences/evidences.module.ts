import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { TrajectoryModule } from '../trajectory/trajectory.module';
import { StorageModule } from '../storage/storage.module';
import { EvidencesService } from './evidences.service';
import { EvidencesController } from './evidences.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectEvidence,
      StudentProfile,
      Project,
      ProjectMember,
      Activity,
      ActivityRegistration,
      AcademicArea,
    ]),
    TrajectoryModule,
    StorageModule,
  ],
  controllers: [EvidencesController],
  providers: [EvidencesService],
  exports: [EvidencesService],
})
export class EvidencesModule {}
