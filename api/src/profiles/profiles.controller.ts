import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ProfilesService } from './profiles.service';
import { CreateFreeInterestDto, UpdateFreeInterestDto } from './dto/free-interest.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ReplaceInterestsDto, SetInterestsDto } from './dto/set-interests.dto';
import { ReplaceSkillsDto, SetSkillsDto } from './dto/set-skills.dto';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('students')
  @Roles(RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  listStudents(@CurrentUser() user: AuthenticatedUser, @Query('search') search?: string) {
    return this.profilesService.listStudents(user, search);
  }

  @Post('me')
  @Roles(RolNombre.STUDENT)
  createMyProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProfileDto) {
    return this.profilesService.createMyProfile(user.userId, dto);
  }

  @Get('me')
  @Roles(RolNombre.STUDENT)
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getOwnProfile(user.userId);
  }

  @Patch('me')
  @Roles(RolNombre.STUDENT)
  updateMyProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.profilesService.updateMyProfile(user.userId, dto);
  }

  // ---------------- Intereses en texto libre (RF5) ----------------

  @Get('me/free-interests')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary:
      'Intereses declarados en texto libre. Distintos de las áreas de preferencia, que salen del catálogo.',
  })
  listFreeInterests(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.listFreeInterests(user.userId);
  }

  @Post('me/free-interests')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Agregar un interés en texto libre.' })
  addFreeInterest(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFreeInterestDto) {
    return this.profilesService.addFreeInterest(user.userId, dto);
  }

  @Patch('me/free-interests/:id')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Editar un interés propio.' })
  updateFreeInterest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFreeInterestDto,
  ) {
    return this.profilesService.updateFreeInterest(user.userId, id, dto);
  }

  @Delete('me/free-interests/:id')
  @Roles(RolNombre.STUDENT)
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un interés propio.' })
  removeFreeInterest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.profilesService.removeFreeInterest(user.userId, id);
  }

  // ---------------- Areas de preferencia (RF5) ----------------
  // Seleccion del catalogo de areas academicas con prioridad 1-5.
  // Se conserva la tabla student_interests por seguridad de datos; el nombre
  // de dominio y de la API es "areas de preferencia".

  @Post('me/preferred-areas')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Agregar o actualizar áreas de preferencia con su prioridad.' })
  addPreferredAreas(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetInterestsDto) {
    return this.profilesService.addInterests(user.userId, dto.items);
  }

  @Put('me/preferred-areas')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Reemplazar el conjunto completo de áreas de preferencia.' })
  replacePreferredAreas(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReplaceInterestsDto,
  ) {
    return this.profilesService.replaceInterests(user.userId, dto.items);
  }

  @Post('me/interests')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Alias histórico de POST /profiles/me/preferred-areas.', deprecated: true })
  addInterests(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetInterestsDto) {
    return this.profilesService.addInterests(user.userId, dto.items);
  }

  @Put('me/interests')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Alias histórico de PUT /profiles/me/preferred-areas.', deprecated: true })
  replaceInterests(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReplaceInterestsDto) {
    return this.profilesService.replaceInterests(user.userId, dto.items);
  }

  @Post('me/skills')
  @Roles(RolNombre.STUDENT)
  addSkills(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetSkillsDto) {
    return this.profilesService.addSkills(user.userId, dto.items);
  }

  @Put('me/skills')
  @Roles(RolNombre.STUDENT)
  replaceSkills(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReplaceSkillsDto) {
    return this.profilesService.replaceSkills(user.userId, dto.items);
  }

  @Get('me/summary')
  @Roles(RolNombre.STUDENT)
  getMySummary(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getSummary(user.userId);
  }

  @Get(':studentId/allowed')
  @Roles(RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  getAllowedView(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.profilesService.getAllowedView(user, studentId);
  }
}
