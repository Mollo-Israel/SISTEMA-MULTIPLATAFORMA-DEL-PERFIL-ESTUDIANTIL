import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { RecommendationsService } from './recommendations.service';
import { UpdateRecommendationDto } from './dto/update-recommendation.dto';
import { QueryRecommendationHistoryDto } from './dto/query-recommendation-history.dto';

/**
 * Recomendaciones academicas ligeras (RF18).
 *
 * El actor de RF18 y de la Tabla 2.27 es el Estudiante, y solo el. No existe
 * consulta institucional de recomendaciones: ningun requerimiento la concede.
 */
@ApiTags('recommendations')
@ApiBearerAuth()
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly service: RecommendationsService) {}

  @Get('me')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Recomendaciones del estudiante, agrupadas por tipo (RF18).',
    description:
      'Genera las recomendaciones al consultar, como describe la Tabla 2.27. El campo outcome ' +
      'distingue tres casos: available, insufficient_profile (flujo 2a) y no_matches (flujo 3a).',
  })
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getMine(user.userId);
  }

  @Get('me/history')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Recomendaciones guardadas o descartadas por el estudiante (RN-16).' })
  history(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryRecommendationHistoryDto) {
    return this.service.history(user.userId, query.status);
  }

  @Get('rules')
  @ApiOperation({
    summary: 'Reglas con que se generan las recomendaciones, de solo lectura.',
    description: 'El puntaje de una recomendación es exactamente la suma de sus motivos.',
  })
  rules() {
    return this.service.getRules();
  }

  @Get('me/:id')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Detalle de una recomendación propia (Tabla 2.27, paso 7).',
    description: 'Abrir el detalle la marca como vista: es la operación markAsViewed() del diagrama de clases.',
  })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getOne(user.userId, id);
  }

  @Patch('me/:id')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Guardar, descartar o restaurar una recomendación (RN-16).',
    description: 'La decisión del estudiante se conserva aunque las recomendaciones se vuelvan a generar.',
  })
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecommendationDto,
  ) {
    return this.service.decide(user.userId, id, dto.status);
  }
}
