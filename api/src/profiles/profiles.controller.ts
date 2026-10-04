import { ConfirmInstitutionalDto, OnboardingPrivacyDto, ReplaceSkillInterestsDto } from './dto/skill-interests.dto';
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
import { SearchPeersDto } from './dto/search-peers.dto';
import { SetInstitutionalDataDto } from './dto/institutional-data.dto';
import { UpdateVisibilityDto } from './dto/visibility.dto';
import { OnboardingStepDto } from './dto/onboarding-step.dto';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('students')
  @ApiOperation({ summary: 'Estudiantes que el usuario puede consultar (alcance docente).' })
  @Roles(RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  listStudents(@CurrentUser() user: AuthenticatedUser, @Query('search') search?: string) {
    return this.profilesService.listStudents(user, search);
  }

  @Get('peers')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Buscar compañeros por nombre para invitarlos a un proyecto (RF14).',
    description:
      'Tarjeta mínima: nombre y semestre, sin correo. Requiere al menos 2 caracteres ' +
      'y devuelve como máximo 20 resultados. Excluye al propio estudiante y las cuentas inactivas.',
  })
  searchPeers(@CurrentUser() user: AuthenticatedUser, @Query() query: SearchPeersDto) {
    return this.profilesService.searchPeers(user, query.search);
  }

  @Post('me')
  @ApiOperation({ summary: 'Crea el perfil del estudiante autenticado.' })
  @Roles(RolNombre.STUDENT)
  createMyProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProfileDto) {
    return this.profilesService.createMyProfile(user.userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Perfil del estudiante autenticado.' })
  @Roles(RolNombre.STUDENT)
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getOwnProfile(user.userId);
  }

  @Patch('me')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Editar mi perfil.',
    description:
      'Solo campos propios (§17.2). El semestre y el código universitario son '
      + 'institucionales y no se editan desde aquí (§17.1).',
  })
  updateMyProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.profilesService.updateMyProfile(user.userId, dto);
  }

  // ---------------- Bienvenida ----------------

  @Get('me/onboarding')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Estado de mi bienvenida.',
    description: 'Si la terminé, por qué paso voy y qué tengo declarado. Funciona aunque aún no tenga perfil.',
  })
  onboardingState(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.onboardingState(user.userId);
  }

  @Patch('me/onboarding')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Guardar por qué paso de la bienvenida voy.' })
  saveOnboardingStep(@CurrentUser() user: AuthenticatedUser, @Body() dto: OnboardingStepDto) {
    return this.profilesService.saveOnboardingStep(user.userId, dto.step);
  }

  @Post('me/onboarding/institutional-confirmation')
  @Roles(RolNombre.STUDENT)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Paso 1: confirmo mis datos institucionales.',
    description: 'Semestre y código universitario se ven, no se editan (V2 §6.1, §20.2). Acepta una bio opcional.',
  })
  confirmInstitutional(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmInstitutionalDto) {
    return this.profilesService.confirmInstitutionalData(user.userId, dto.bio);
  }

  @Post('me/onboarding/privacy')
  @Roles(RolNombre.STUDENT)
  @HttpCode(200)
  @ApiOperation({ summary: 'Paso 4: mi privacidad básica (V2 §20.2).' })
  onboardingPrivacy(@CurrentUser() user: AuthenticatedUser, @Body() dto: OnboardingPrivacyDto) {
    return this.profilesService.saveOnboardingPrivacy(user.userId, dto);
  }

  @Post('me/onboarding/complete')
  @Roles(RolNombre.STUDENT)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Terminar la bienvenida.',
    description: 'Exige lo obligatorio de V2 §20.2: datos confirmados, un interés o área de mejora, disponibilidad y privacidad. El cuestionario es opcional.',
  })
  completeOnboarding(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.completeOnboarding(user.userId);
  }

  // ---------------- Privacidad (§44) ----------------

  @Get('me/visibility')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Qué comparto hoy en mi perfil compartible.' })
  getMyVisibility(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getVisibility(user.userId);
  }

  @Put('me/visibility')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Cambiar qué comparto.',
    description:
      'La lista de campos es cerrada: el correo institucional, los archivos '
      + 'privados y los identificadores internos no tienen forma de activarse.',
  })
  updateMyVisibility(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateVisibilityDto,
  ) {
    return this.profilesService.updateVisibility(user.userId, dto);
  }

  // ---------------- Datos institucionales (§17.1) ----------------

  @Patch(':studentId/institutional-data')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Fijar el semestre y el código universitario de un estudiante.',
    description:
      'Reservado al administrador. Normalmente estos datos llegan por importación '
      + 'de padrón; esto cubre el alta manual y la corrección puntual.',
  })
  setInstitutionalData(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: SetInstitutionalDataDto,
  ) {
    return this.profilesService.setInstitutionalData(studentId, dto, admin.userId);
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

  // ---------------- Tecnologías de interés (V2 §21, §22) ----------------

  @Get('me/skill-interests')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Tecnologías que me interesan o quiero mejorar.' })
  getSkillInterests(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getSkillInterests(user.userId);
  }

  @Put('me/skill-interests')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Reemplazar mis tecnologías de interés.',
    description: 'Declarativo: alimenta recomendaciones y colaboración, nunca la afinidad (V2 §21).',
  })
  replaceSkillInterests(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReplaceSkillInterestsDto) {
    return this.profilesService.replaceSkillInterests(user.userId, dto.items);
  }

  @Post('me/skills')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Retirado: nivel autodeclarado (V2 §22). Responde 410.', deprecated: true })
  addSkills() {
    return this.profilesService.retiredSelfSkillLevel();
  }

  @Put('me/skills')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Retirado: nivel autodeclarado (V2 §22). Responde 410.', deprecated: true })
  replaceSkills() {
    return this.profilesService.retiredSelfSkillLevel();
  }

  @Get('me/summary')
  @ApiOperation({ summary: 'Perfil dinámico: tecnologías respaldadas, intereses y trayectoria.' })
  @Roles(RolNombre.STUDENT)
  getMySummary(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getSummary(user.userId);
  }

  @Get(':studentId/allowed')
  @ApiOperation({ summary: 'Perfil permitido de un estudiante del alcance del docente.' })
  @Roles(RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  getAllowedView(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.profilesService.getAllowedView(user, studentId);
  }
}
