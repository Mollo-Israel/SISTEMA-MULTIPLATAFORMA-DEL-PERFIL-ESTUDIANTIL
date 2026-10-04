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
import { ProjectsService } from './projects.service';
import { ProjectMembersService } from './project-members.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddEvidenceDto } from './dto/add-evidence.dto';
import {
  ConfirmContributionDto,
  ProposeContributionDto,
} from './dto/contribution.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { InviteMemberDto, RespondInvitationDto } from './dto/invite-member.dto';

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
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.userId, dto);
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

  @Post(':id/checks/recheck')
  @Roles(RolNombre.STUDENT, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Volver a comprobar repositorio y demo. Solo el responsable.' })
  recheck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.recheckExternalSources(user, id);
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
  ) {
    return this.membersService.removeMember(user, id, memberId);
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
