import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { User } from '../entities/user.entity';
import { AffinityRecalcModule } from '../affinity-recalc/affinity-recalc.module';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectMember,
      ProjectEvidence,
      StudentProfile,
      AcademicArea,
      User,
    ]),
    AffinityRecalcModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
