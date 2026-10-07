import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { ProjectInvitation } from '../entities/project-invitation.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ProjectFeedback } from '../entities/project-feedback.entity';
import { ProjectMemberSkill } from '../entities/project-member-skill.entity';
import {
  ProjectEvent,
  ProjectLinkCheck,
  ProjectRepositoryCheck,
} from '../entities/project-check.entity';
import { Skill } from '../entities/skill.entity';
import { ProjectArea, ProjectSkill } from '../entities/project-area.entity';
import { Team, TeamMember } from '../entities/collaboration.entity';
import { StorageModule } from '../storage/storage.module';
import { ProjectEventsService } from './project-events.service';
import { ProjectBackingService } from './project-backing.service';
import { RepositoryInspectorService } from './repository-inspector.service';
import { StudentProfile } from '../entities/student-profile.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { User } from '../entities/user.entity';
import { TrajectoryModule } from '../trajectory/trajectory.module';
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
      ProjectFeedback,
      StudentProfile,
      AcademicArea,
      User,
      ProjectMemberSkill,
      ProjectRepositoryCheck,
      ProjectLinkCheck,
      ProjectEvent,
      Skill,
      ProjectArea,
      ProjectSkill,
      Team,
      TeamMember,
    ]),
    TrajectoryModule,
    AccessModule,
    StorageModule,
  ],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectMembersService,
    ProjectEventsService,
    ProjectBackingService,
    RepositoryInspectorService,
  ],
  exports: [ProjectsService, ProjectMembersService, ProjectEventsService, ProjectBackingService],
})
export class ProjectsModule {}
