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
