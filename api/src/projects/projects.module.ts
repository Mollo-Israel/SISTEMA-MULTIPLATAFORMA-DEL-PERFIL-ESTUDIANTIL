import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { ProjectInvitation } from '../entities/project-invitation.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { User } from '../entities/user.entity';
import { AffinityRecalcModule } from '../affinity-recalc/affinity-recalc.module';
import { AccessModule } from '../access/access.module';
import { ProjectsService } from './projects.service';
import { ProjectMembersService } from './project-members.service';
import { ProjectsController } from './projects.controller';

/**
 * Portafolio de proyectos (Objetivo 5).
 * Importa AccessModule para reutilizar TeacherScopeService: el alcance
 * academico del docente tiene una unica fuente de verdad en todo el sistema.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectMember,
      ProjectInvitation,
      ProjectEvidence,
      StudentProfile,
      AcademicArea,
      User,
    ]),
    AffinityRecalcModule,
    AccessModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectMembersService],
  exports: [ProjectsService, ProjectMembersService],
})
export class ProjectsModule {}
