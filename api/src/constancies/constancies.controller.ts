import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ConstanciesService } from './constancies.service';
import { CreateInternalConstancyDto } from './dto/create-internal-constancy.dto';

/**
 * Constancias internas (RF12).
 *
 * Segun el documento vigente, solo el director de carrera las emite. El
 * administrador conserva funciones de soporte. No sustituyen a los certificados
 * oficiales de la universidad.
 */
@ApiTags('constancies')
@ApiBearerAuth()
@Controller('constancies/internal')
export class ConstanciesController {
  constructor(private readonly constanciesService: ConstanciesService) {}

  @Post()
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({
    summary:
      'Emitir constancia interna. Requiere participación confirmada y no admite duplicados.',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInternalConstancyDto) {
    return this.constanciesService.create(user, dto);
  }

  @Get('eligible/:activityId')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({
    summary:
      'Participantes confirmados de una actividad, indicando si ya tienen constancia emitida.',
  })
  eligible(@Param('activityId', ParseUUIDPipe) activityId: string) {
    return this.constanciesService.findEligible(activityId);
  }

  @Get('activity/:activityId')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Constancias emitidas para una actividad.' })
  byActivity(@Param('activityId', ParseUUIDPipe) activityId: string) {
    return this.constanciesService.findByActivity(activityId);
  }

  @Get('my')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Constancias internas del estudiante.' })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.constanciesService.findMine(user.userId);
  }

  @Get('student/:studentId')
  @Roles(RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Constancias de un estudiante, dentro del alcance del consultante.' })
  findByStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.constanciesService.findByStudent(user, studentId);
  }
}
