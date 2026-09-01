import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { QueryActivitiesDto } from './dto/query-activities.dto';
import { ConfirmParticipationDto } from './dto/confirm-participation.dto';

/**
 * Actividades academicas y extracurriculares (Objetivo 3) y registro de
 * participacion (Objetivo 4).
 *
 * Responsables segun el documento vigente:
 *   - Academicas       -> Director de carrera
 *   - Extracurriculares-> Sociedad cientifica
 * El administrador conserva funciones de soporte. El docente consulta, no publica.
 */
const MANAGER_ROLES = [
  RolNombre.CAREER_DIRECTOR,
  RolNombre.SCIENTIFIC_SOCIETY,
  RolNombre.ADMIN,
];

@ApiTags('activities')
@ApiBearerAuth()
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  @Roles(...MANAGER_ROLES)
  @ApiOperation({
    summary:
      'Crear actividad. El director de carrera publica las académicas; la sociedad científica, las extracurriculares.',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateActivityDto) {
    return this.activitiesService.create(user, dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Listar actividades. Filtros opcionales por categoría, área, modalidad y fecha (RF8), más tipo y estado.',
  })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryActivitiesDto) {
    return this.activitiesService.findAll(user, query);
  }

  @Get('managed')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Actividades que el usuario gestiona, incluidos sus borradores.' })
  findManaged(@CurrentUser() user: AuthenticatedUser) {
    return this.activitiesService.findManagedBy(user);
  }

  @Get('my-registrations')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Actividades del estudiante con su estado de participación.' })
  myRegistrations(@CurrentUser() user: AuthenticatedUser) {
    return this.activitiesService.findMyRegistrations(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una actividad; el estudiante recibe además su propio estado.' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    if (user.role === RolNombre.STUDENT) {
      return this.activitiesService.findOneForStudent(user, id);
    }
    return this.activitiesService.findOne(id);
  }

  @Patch(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Editar la actividad o cambiar su estado (publicar, abrir, cerrar…).' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activitiesService.update(user, id, dto);
  }

  @Post(':id/register-interest')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'El estudiante manifiesta interés en la actividad.' })
  registerInterest(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.activitiesService.registerInterest(user.userId, id);
  }

  @Post(':id/register')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'El estudiante se inscribe (crea una solicitud pendiente de aprobación).' })
  register(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.activitiesService.register(user.userId, id);
  }

  @Patch(':id/confirm-participation')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.SCIENTIFIC_SOCIETY, RolNombre.ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Registrar asistencia o participación. Solo el responsable de la actividad (RF10).',
  })
  confirmParticipation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmParticipationDto,
  ) {
    return this.activitiesService.confirmParticipation(
      user,
      id,
      dto.studentProfileId,
      dto.status,
    );
  }

  @Get(':id/participants')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Participantes de la actividad, para el responsable.' })
  getParticipants(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.activitiesService.getParticipants(user, id);
  }
}
