import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ProjectFeedbackService } from './project-feedback.service';
import {
  CreateProjectFeedbackDto,
  UpdateProjectFeedbackDto,
} from './dto/project-feedback.dto';

/**
 * Retroalimentacion academica sobre proyectos (RF16).
 *
 * La escribe unicamente el docente, sobre proyectos habilitados para consulta
 * docente y dentro de su alcance academico. La leen ademas los estudiantes
 * vinculados al proyecto.
 */
@ApiTags('project-feedback')
@ApiBearerAuth()
@Controller('projects/:projectId/feedback')
export class ProjectFeedbackController {
  constructor(private readonly service: ProjectFeedbackService) {}

  @Get()
  @Roles(RolNombre.STUDENT, RolNombre.TEACHER, RolNombre.ADMIN)
  @ApiOperation({
    summary:
      'Retroalimentación del proyecto. La ven el docente autorizado y los estudiantes vinculados.',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.service.listForProject(user, projectId);
  }

  @Post()
  @Roles(RolNombre.TEACHER)
  @ApiOperation({
    summary:
      'Registrar retroalimentación. Solo el docente, sobre un proyecto visible dentro de su alcance.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateProjectFeedbackDto,
  ) {
    this.service.assertIsTeacher(user);
    return this.service.create(user, projectId, dto);
  }

  @Patch(':feedbackId')
  @Roles(RolNombre.TEACHER)
  @ApiOperation({ summary: 'Editar la retroalimentación propia.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('feedbackId', ParseUUIDPipe) feedbackId: string,
    @Body() dto: UpdateProjectFeedbackDto,
  ) {
    this.service.assertIsTeacher(user);
    return this.service.update(user, feedbackId, dto);
  }
}
