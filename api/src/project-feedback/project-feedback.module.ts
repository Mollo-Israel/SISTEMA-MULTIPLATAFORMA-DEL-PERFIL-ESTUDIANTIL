import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectFeedback } from '../entities/project-feedback.entity';
import { Project } from '../entities/project.entity';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectFeedbackService } from './project-feedback.service';
import { ProjectFeedbackController } from './project-feedback.controller';

/**
 * RF16. Depende de ProjectsModule para reutilizar el control de visibilidad y
 * de alcance academico, en lugar de duplicarlo.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ProjectFeedback, Project]), ProjectsModule],
  controllers: [ProjectFeedbackController],
  providers: [ProjectFeedbackService],
  exports: [ProjectFeedbackService],
})
export class ProjectFeedbackModule {}
