import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ReportsService } from './reports.service';
import { AnalyticsService } from './analytics.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly analytics: AnalyticsService,
  ) {}

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

  // ---------- Evolucion del estudiante (§63) ----------

  /**
   * La evolucion del propio estudiante (§63).
   *
   * Devuelve lo que §63 enumera y nada mas: periodo, area, afinidad, respaldo y
   * su nivel. Sin proyecciones ni comparaciones con una media, que invitarian a
   * leerlo como una nota.
   */
  @Get('me/evolution')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Evolución descriptiva del propio estudiante (§63).' })
  async myEvolution(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.studentEvolution(await this.analytics.ownProfileId(user));
  }

  /**
   * La evolucion de un estudiante del alcance del docente (§63, §68).
   *
   * El alcance se comprueba dentro, con TeacherScopeService: proteger el
   * endpoint por rol dejaria a cualquier docente ver la evolucion de cualquiera.
   */
  @Get('student/:studentId/evolution')
  @Roles(RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Evolución de un estudiante del alcance autorizado (§63, §68).' })
  studentEvolution(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.analytics.studentEvolutionForStaff(user, studentId);
  }

  // ---------- Panel docente (§68) ----------

  @Get('teacher/support-summary')
  @Roles(RolNombre.TEACHER, RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Respaldo del grupo del docente, limitado a sus semestres (§68).',
  })
  teacherSupportSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.teacherSupportSummary(user);
  }

  // ---------- Direccion (§64, §69) ----------

  @Get('director/trends')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Tendencias descriptivas de la carrera (§64).',
    description:
      'Describen lo que ocurrió. §64 prohíbe predecir notas, abandono, aprobación, '
      + 'éxito profesional o rendimiento, y por eso aquí no hay ninguna proyección.',
  })
  directorTrends() {
    return this.analytics.directorTrends();
  }

  @Get('director/affinity-map-v2')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Mapa de áreas con afinidad y respaldo, con umbral de privacidad (§65, §69).',
  })
  directorAffinityMapV2(@Query('semesters') semesters?: string) {
    const lista = (semesters ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 8);
    return this.analytics.directorAffinityMap(lista.length > 0 ? lista : undefined);
  }

  // ---------- Sociedad cientifica (§65) ----------

  @Get('society/activities')
  @Roles(RolNombre.SCIENTIFIC_SOCIETY, RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Métricas de las actividades que organiza la sociedad científica (§65).',
    description:
      'Solo sus actividades. No incluye perfiles, afinidades ni proyectos: §65 le concede '
      + 'las métricas de lo que organizó y nada más.',
  })
  societyMetrics(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.societyMetrics(user);
  }
}
