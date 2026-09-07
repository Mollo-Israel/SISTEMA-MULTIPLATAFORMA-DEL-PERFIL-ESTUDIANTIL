import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { TeacherScopeService } from '../access/teacher-scope.service';
import { AffinityEngineService } from './affinity.engine';

/**
 * Consulta de afinidades academicas (RF17).
 *
 * El estudiante consulta las suyas. Los roles institucionales consultan las de
 * un estudiante solo dentro de su alcance academico: el control lo aplica
 * TeacherScopeService, que es la unica fuente de verdad de esa regla en todo el
 * sistema (RN-23). Ocultar un boton no es autorizacion.
 */
@ApiTags('affinity')
@ApiBearerAuth()
@Controller('affinity')
export class AffinityController {
  constructor(
    private readonly engine: AffinityEngineService,
    private readonly teacherScope: TeacherScopeService,
  ) {}

  @Post('recalculate/me')
  @Roles(RolNombre.STUDENT)
  @HttpCode(200)
  @ApiOperation({ summary: 'Recalcula la afinidad del estudiante autenticado.' })
  async recalculateMine(@CurrentUser() user: AuthenticatedUser) {
    const profileId = await this.engine.resolveProfileIdByUser(user.userId);
    return this.engine.recalculate(profileId);
  }

  @Post('recalculate/:studentId')
  @Roles(RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Recalcula la afinidad de un estudiante de su alcance.' })
  async recalculateStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    await this.teacherScope.assertCanAccessProfile(user, studentId);
    return this.engine.recalculate(studentId);
  }

  // ------------------------------------------------------------------
  // Consulta del estudiante
  // ------------------------------------------------------------------

  /**
   * Se conserva devolviendo la lista simple de resultados: es la forma que ya
   * consumen las pantallas y las pruebas del avance anterior. La vista rica de
   * RF17 vive en /affinity/me/summary.
   */
  @Get('me')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Areas de afinidad del estudiante autenticado.' })
  async getMine(@CurrentUser() user: AuthenticatedUser) {
    const profileId = await this.engine.resolveProfileIdByUser(user.userId);
    return this.engine.getForProfile(profileId);
  }

  @Get('me/summary')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Afinidades con estado, ranking y nivel relativo (RF17).',
    description:
      'Distingue de forma explicita el caso en que todavia no hay informacion ' +
      'suficiente para orientar, que es la salida de fallo que define RF17.',
  })
  async summaryMine(@CurrentUser() user: AuthenticatedUser) {
    const profileId = await this.engine.resolveProfileIdByUser(user.userId);
    return this.engine.getSummary(profileId);
  }

  @Get('me/areas/:areaId/breakdown')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Por que el estudiante tiene esa afinidad con un area.',
    description: 'La suma de las contribuciones es exactamente el puntaje del area.',
  })
  async breakdownMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('areaId', ParseUUIDPipe) areaId: string,
  ) {
    const profileId = await this.engine.resolveProfileIdByUser(user.userId);
    return this.engine.getBreakdown(profileId, areaId);
  }

  @Get('me/history')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Evolucion de las afinidades del estudiante (RF17).',
    description:
      'Historial de calculos anteriores. No es una prediccion: RN-15 excluye ' +
      'usar estos datos para anticipar resultados academicos.',
  })
  async historyMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const profileId = await this.engine.resolveProfileIdByUser(user.userId);
    return this.engine.getHistory(profileId, limit);
  }

  // ------------------------------------------------------------------
  // Consulta institucional, siempre dentro del alcance academico
  // ------------------------------------------------------------------

  @Get('student/:studentId')
  @Roles(RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Areas de afinidad de un estudiante de su alcance.' })
  async getStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    await this.teacherScope.assertCanAccessProfile(user, studentId);
    return this.engine.getForProfile(studentId);
  }

  @Get('student/:studentId/summary')
  @Roles(RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Afinidades con estado y ranking de un estudiante de su alcance.' })
  async summaryStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    await this.teacherScope.assertCanAccessProfile(user, studentId);
    return this.engine.getSummary(studentId);
  }

  @Get('student/:studentId/areas/:areaId/breakdown')
  @Roles(RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Desglose de un area de un estudiante de su alcance.' })
  async breakdownStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
  ) {
    await this.teacherScope.assertCanAccessProfile(user, studentId);
    return this.engine.getBreakdown(studentId, areaId);
  }

  // ------------------------------------------------------------------
  // Reglas y mapa agregado
  // ------------------------------------------------------------------

  @Get('weights')
  @ApiOperation({
    summary: 'Ponderaciones vigentes del motor (RN-14).',
    description:
      'Solo lectura. Son configuracion del sistema, no un catalogo editable: ' +
      'ningun requerimiento funcional concede su administracion.',
  })
  async weights() {
    return this.engine.getWeights();
  }

  @Get('map/basic')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Conteo agregado de afinidades por area academica.' })
  async basicMap() {
    return this.engine.basicMap();
  }
}
