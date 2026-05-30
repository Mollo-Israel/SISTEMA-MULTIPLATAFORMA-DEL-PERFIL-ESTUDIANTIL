import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FindOptionsWhere } from 'typeorm';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { Activity } from '../entities/activity.entity';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ConfirmParticipationDto } from './dto/confirm-participation.dto';
import { QueryActivitiesDto } from './dto/query-activities.dto';

@ApiTags('activities')
@ApiBearerAuth()
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  @Roles(RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.SCIENTIFIC_SOCIETY, RolNombre.ADMIN)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateActivityDto) {
    return this.activitiesService.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryActivitiesDto) {
    const filters: FindOptionsWhere<Activity> = {};
    if (query.type) filters.type = query.type;
    if (query.category) filters.category = query.category;
    if (query.status) filters.status = query.status;
    if (query.areaId) filters.academicAreaId = query.areaId;
    return this.activitiesService.findAll(user, filters);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.activitiesService.findOne(id);
  }

  @Patch(':id')
  @Roles(RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.SCIENTIFIC_SOCIETY, RolNombre.ADMIN)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activitiesService.update(user, id, dto);
  }

  @Post(':id/register-interest')
  @Roles(RolNombre.STUDENT)
  registerInterest(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.activitiesService.registerInterest(user.userId, id);
  }

  @Post(':id/register')
  @Roles(RolNombre.STUDENT)
  register(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.activitiesService.register(user.userId, id);
  }

  @Patch(':id/confirm-participation')
  @Roles(RolNombre.TEACHER, RolNombre.SCIENTIFIC_SOCIETY, RolNombre.ADMIN)
  confirmParticipation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmParticipationDto,
  ) {
    return this.activitiesService.confirmParticipation(user, id, dto.studentProfileId, dto.status);
  }

  @Get(':id/participants')
  @Roles(RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.SCIENTIFIC_SOCIETY, RolNombre.ADMIN)
  getParticipants(@Param('id', ParseUUIDPipe) id: string) {
    return this.activitiesService.getParticipants(id);
  }
}
