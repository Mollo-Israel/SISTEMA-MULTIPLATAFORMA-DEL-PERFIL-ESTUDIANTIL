import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ---------- Docente ----------

  @Get('teacher/overview')
  @Roles(RolNombre.TEACHER, RolNombre.ADMIN)
  teacherOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.teacherOverview(user);
  }

  @Get('teacher/affinity-summary')
  @Roles(RolNombre.TEACHER, RolNombre.ADMIN)
  teacherAffinitySummary(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.teacherAffinitySummary(user);
  }

  @Get('teacher/projects-summary')
  @Roles(RolNombre.TEACHER, RolNombre.ADMIN)
  teacherProjectsSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.teacherProjectsSummary(user);
  }

  // ---------- Director ----------

  @Get('director/overview')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  directorOverview() {
    return this.reportsService.directorOverview();
  }

  @Get('director/participation-by-semester')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  directorParticipationBySemester() {
    return this.reportsService.directorParticipationBySemester();
  }

  @Get('director/affinity-map')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  directorAffinityMap() {
    return this.reportsService.directorAffinityMap();
  }

  @Get('director/projects-summary')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  directorProjectsSummary() {
    return this.reportsService.directorProjectsSummary();
  }
}
