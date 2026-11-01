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
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ProjectsService } from './projects.service';
import { ProjectMembersService } from './project-members.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddEvidenceDto } from './dto/add-evidence.dto';
import {
  ConfirmContributionDto,
  ProposeContributionDto, RequestCorrectionDto } from './dto/contribution.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { InviteMemberDto, RespondInvitationDto } from './dto/invite-member.dto';
import { GalleryConsentDto } from './dto/gallery-consent.dto';

class AcceptSuggestionDto {
  @IsUUID('4') skillId: string;
  @IsUUID('4') areaId: string;
  @IsOptional() @IsString() @MaxLength(80) signal?: string;
  @IsOptional() @IsString() @MaxLength(160) source?: string;
}

class ExclusionReasonDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

class AnalyzeRepositoryDto {
  @IsString() @MinLength(8, { message: 'Escribe el enlace del repositorio.' }) @MaxLength(300) repositoryUrl: string;
}

class SignalDto {
  @IsString() @MinLength(1) @MaxLength(80) signal: string;
}

class RequestSkillDto {
  @IsString() @MinLength(2, { message: 'Indica el nombre de la tecnología.' }) @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(160) source?: string;
}

/**
 * Portafolio de proyectos estudiantiles (Objetivo 5, RF13 a RF15).
 *
 * El estudiante gestiona sus proyectos y sus integrantes; el docente consulta
 * los proyectos habilitados de los estudiantes de su alcance academico.
 */
@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly membersService: ProjectMembersService,
  ) {}

  // ---------------- RF13 · Gestionar proyecto del portafolio ----------------

  @Post()
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Registrar un proyecto en el portafolio.' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProjectDto) {
    const { inviteTeamMembers, excludedTeamMembers, ...datos } = dto;
    const creado = await this.projectsService.create(user.userId, datos);
    // V3 §31: «usar uno de mis equipos» precarga las invitaciones.
    // V4.1 A41-023: menos los que el creador dejó fuera de ESTE proyecto, con motivo.
    if (inviteTeamMembers && creado.teamId) {
      await this.membersService.inviteTeam(user, creado.id, excludedTeamMembers ?? []);
    }
    return creado;
  }

  @Post(':id/invite-team')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Invita a los integrantes del equipo vinculado (V3 §31).' })
  inviteTeam(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.membersService.inviteTeam(user, id);
  }

  @Post(':id/my-contribution/correction')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'El integrante pide corregir lo que le propusieron (V3 §30).' })
  requestCorrection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestCorrectionDto,
  ) {
    return this.projectsService.requestCorrection(user.userId, id, dto.note);
  }

  @Patch(':id')
  @Roles(RolNombre.STUDENT, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Editar un proyecto propio, incluida su visibilidad.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(user, id, dto);
  }

  // ---------------- RF15 · Consultar portafolio ----------------

  @Get('my')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary:
      'Portafolio del estudiante: proyectos propios y aquellos donde es integrante aceptado.',
  })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findMine(user.userId);
  }

  @Get('institutional')
  @Roles(RolNombre.TEACHER, RolNombre.ADMIN)
  @ApiOperation({
    summary:
      'Proyectos habilitados para consulta docente, de estudiantes dentro del alcance del docente.',
  })
  findForTeacher(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryProjectsDto) {
    return this.projectsService.findForTeacher(user, query);
  }

  // ---------------- RF14 · Invitaciones recibidas ----------------
  // Va antes de :id para que "invitations" no se interprete como un UUID.

  @Get('invitations/mine')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Invitaciones que ha recibido el estudiante.' })
  myInvitations(@CurrentUser() user: AuthenticatedUser, @Query('pending') pending?: string) {
    return this.membersService.listMyInvitations(user.userId, pending === 'true');
  }

  @Patch('invitations/:invitationId')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Aceptar o rechazar una invitación recibida.' })
  respondInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @Body() dto: RespondInvitationDto,
  ) {
    return this.membersService.respond(user.userId, invitationId, dto.decision);
  }

  /**
   * V3 §40: resumen público de un proyecto compartido por enlace. Sin sesión;
   * el token largo y aleatorio es el único secreto.
   */
  @Get('public/:token')
  @Public()
  @ApiOperation({ summary: 'Resumen público de un proyecto con visibilidad PUBLIC_LINK.' })
  findPublic(@Param('token') token: string) {
    return this.projectsService.findPublic(token);
  }

  @Post('admin/recompute-backing')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Recalcula el respaldo de los proyectos con las reglas vigentes (V3 §28), en tandas.',
    description: 'No consulta GitHub: usa la última comprobación guardada. Repite con `after` hasta que `siguiente` sea null.',
  })
  recomputeBacking(@Query('limit') limit?: string, @Query('after') after?: string) {
    const tope = Math.min(Math.max(Number(limit) || 200, 1), 1000);
    return this.projectsService.recomputeBacking(tope, after && /^[0-9a-f-]{36}$/i.test(after) ? after : undefined);
  }

  @Get(':id/readiness')
  @Roles(RolNombre.STUDENT, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Qué le falta para pasar a ACTIVE (V3 §22).' })
  readiness(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.readinessForUser(user, id);
  }

  @Get(':id')
  @Roles(RolNombre.STUDENT, RolNombre.TEACHER, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Detalle de un proyecto, según visibilidad y alcance.' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.findOneForUser(user, id);
  }

  // ---------------- §33 y §34 · Contribución por integrante ----------------

  @Get(':id/members/detailed')
  @Roles(RolNombre.STUDENT, RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Integrantes con su contribución y sus tecnologías (§33, §34).',
    description:
      'Indica si cada contribución fue confirmada por su propio autor. Mientras no lo '
      + 'esté, lo que figura lo escribió otra persona y no alimenta su perfil.',
  })
  listMembersDetailed(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.listMembersDetailed(user, id);
  }

  @Put(':id/my-contribution')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Confirmar mi contribución y las tecnologías que usé (§33).',
    description:
      'Solo el propio integrante. §33 prohíbe que el responsable atribuya '
      + 'unilateralmente experiencia definitiva a otro estudiante.',
  })
  confirmMyContribution(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmContributionDto,
  ) {
    return this.projectsService.confirmMyContribution(user.userId, id, dto);
  }

  @Put(':id/my-gallery-consent')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'V6 §7.5: mostrar o no mi nombre y mis roles en «Proyectos de la carrera».',
    description: 'Solo el propio integrante, por su sesión. Por omisión, no se muestra.',
  })
  setMyGalleryConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GalleryConsentDto,
  ) {
    return this.projectsService.setMyGalleryConsent(user.userId, id, dto.showInGallery);
  }

  @Patch(':id/members/:memberId/contribution')
  @Roles(RolNombre.STUDENT, RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Proponer la contribución de un integrante (§33).',
    description:
      'El responsable propone; no atribuye. Guardar esto retira la confirmación '
      + 'anterior para que el integrante vuelva a revisarla.',
  })
  proposeContribution(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: ProposeContributionDto,
  ) {
    return this.projectsService.proposeContribution(user, id, memberId, dto);
  }

  // ---------------- §36 a §41 · Respaldo, fuentes externas y bitácora ----------------

  @Get(':id/checks')
  @Roles(RolNombre.STUDENT, RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Nivel de respaldo y estado de repositorio y demo (§36, §37, §39).',
    description:
      'Las tecnologías detectadas indican indicios compatibles en fuentes públicas. '
      + 'No afirman dominio ni autoría (§38).',
  })
  externalChecks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.externalChecks(user, id);
  }

  // ---------------- V4.1 A41-020 · Sugerencias de GitHub con procedencia ----------------

  @Post('repository/analyze')
  @Roles(RolNombre.STUDENT)
  @HttpCode(200)
  @ApiOperation({ summary: 'V5 §11.1: analizar un repositorio antes de guardar (opcional). No guarda nada; si GitHub no responde, INCONCLUSIVE.' })
  analyzeRepository(@CurrentUser() user: AuthenticatedUser, @Body() dto: AnalyzeRepositoryDto) {
    return this.projectsService.analyzeRepository(user, dto.repositoryUrl);
  }

  @Get(':id/suggestions')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Señales detectadas en el repositorio, cotejadas con el catálogo (sin añadirlas solas).' })
  suggestions(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.suggestions(user, id);
  }

  @Post(':id/suggestions/accept')
  @Roles(RolNombre.STUDENT)
  @HttpCode(200)
  @ApiOperation({ summary: 'Aceptar una sugerencia eligiendo el área en la que se usó. Queda con su procedencia.' })
  acceptSuggestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptSuggestionDto,
  ) {
    return this.projectsService.acceptSuggestion(user, id, dto);
  }

  @Post(':id/suggestions/dismiss')
  @Roles(RolNombre.STUDENT)
  @HttpCode(200)
  @ApiOperation({ summary: 'Descartar una sugerencia: no se vuelve a proponer.' })
  dismissSuggestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SignalDto,
  ) {
    return this.projectsService.dismissSuggestion(user, id, dto.signal);
  }

  @Post(':id/suggestions/request-skill')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: '«Tecnología no catalogada»: pedir a Administración que la evalúe.' })
  requestSkill(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestSkillDto,
  ) {
    return this.projectsService.requestSkill(user, id, dto);
  }

  @Post(':id/checks/recheck')
  @Roles(RolNombre.STUDENT, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Volver a comprobar repositorio y demo. Solo el responsable.' })
  recheck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.recheckExternalSources(user, id);
  }

  @Get(':id/points')
  @Roles(RolNombre.STUDENT, RolNombre.TEACHER, RolNombre.ADMIN)
  @ApiOperation({ summary: 'V5: puntos que dio el proyecto (criterio, quién otorgó y aprobó). No cambian el respaldo ni la afinidad.' })
  points(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.pointsForProject(user, id);
  }

  @Get(':id/timeline')
  @Roles(RolNombre.STUDENT, RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Bitácora del proyecto (§41).',
    description: 'Eventos estructurados: quién hizo qué y cuándo. No se analizan conversaciones.',
  })
  timeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
  ) {
    return this.projectsService.timeline(user, id, limit ? Number(limit) : undefined);
  }

  // ---------------- RF14 · Integrantes e invitaciones del proyecto ----------------

  @Get(':id/members')
  @Roles(RolNombre.STUDENT, RolNombre.TEACHER, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Integrantes aceptados del proyecto, con su rol.' })
  async listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    // Ver los integrantes exige poder ver el proyecto.
    await this.projectsService.findOneForUser(user, id);
    return this.membersService.listMembers(id);
  }

  @Get(':id/invitations')
  @Roles(RolNombre.STUDENT, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Invitaciones del proyecto. Solo el estudiante responsable.' })
  listInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.membersService.listProjectInvitations(user, id);
  }

  @Post(':id/invitations')
  @Roles(RolNombre.STUDENT, RolNombre.ADMIN)
  @ApiOperation({
    summary:
      'Invitar a un estudiante con un rol propuesto. Solo pasa a integrante cuando acepta.',
  })
  invite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.membersService.invite(user, id, dto);
  }

  @Patch(':id/invitations/:invitationId/cancel')
  @Roles(RolNombre.STUDENT, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Cancelar una invitación pendiente.' })
  cancelInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.membersService.cancelInvitation(user, id, invitationId);
  }

  @Delete(':id/members/:memberId')
  @Roles(RolNombre.STUDENT, RolNombre.ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Retirar a un integrante del proyecto.' })
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: ExclusionReasonDto,
  ) {
    return this.membersService.removeMember(user, id, memberId, dto?.reason);
  }

  // ---------------- Evidencias del proyecto (RF11 · RF13) ----------------

  @Post(':id/evidences')
  @Roles(RolNombre.STUDENT, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Adjuntar evidencia al proyecto (archivo o enlace).' })
  addEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddEvidenceDto,
  ) {
    return this.projectsService.addEvidence(user, id, dto);
  }

  @Delete(':id/evidences/:evidenceId')
  @ApiOperation({ summary: 'Quita una evidencia del proyecto.' })
  @Roles(RolNombre.STUDENT, RolNombre.ADMIN)
  @HttpCode(204)
  removeEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    return this.projectsService.removeEvidence(user, id, evidenceId);
  }
}
