import {
  All,
  Body,
  Controller,
  Delete,
  Get,
  GoneException,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolNombre } from '@perfil/shared';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { StudentProfile } from '../entities/student-profile.entity';
import { PublicProfileService } from './public-profile.service';
import { ContactsService } from './contacts.service';
import { TeamsService } from './teams.service';
import { TeamApplicationsService } from './team-applications.service';
import {
  CreateContactRequestDto,
  CreateTeamDto,
  CreateTeamNeedDto,
  ApplyToTeamNeedDto,
  DecideTeamApplicationDto,
  DecideContactRequestDto,
  DecideTeamInvitationDto,
  ContactNoteDto,
  InviteToTeamDto,
  SaveContactChannelsDto,
  UpdateTeamNeedDto,
} from './dto/collaboration.dto';

/**
 * Colaboración entre estudiantes (§42 a §47).
 *
 * Todo lo de aquí es del Estudiante: contactos y equipos son relaciones entre
 * pares. El chat se retiró (V2 §57): la comunicación sale por los canales que
 * cada uno comparte (§59). Un docente o la dirección no participan, y por eso no
 * hay rutas suyas en este controlador; su acceso a la información académica
 * sigue gobernado por el alcance de siempre (RN-23), que es otra cosa.
 *
 * La única ruta abierta es el perfil compartible, y lo es porque un QR no sirve
 * de nada si hay que iniciar sesión para leerlo.
 */
@ApiTags('collaboration')
@Controller()
export class CollaborationController {
  constructor(
    private readonly publicProfiles: PublicProfileService,
    private readonly contacts: ContactsService,
    private readonly teams: TeamsService,
    private readonly applications: TeamApplicationsService,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
  ) {}

  /** El perfil estudiantil del usuario autenticado. */
  private async profileId(user: AuthenticatedUser): Promise<string> {
    const perfil = await this.profiles.findOne({
      where: { userId: user.userId },
      select: { id: true },
    });
    if (!perfil) {
      throw new NotFoundException('Aún no has creado tu perfil estudiantil.');
    }
    return perfil.id;
  }

  // =========================================================================
  // §43, §44 · Perfil compartible
  // =========================================================================

  /**
   * El perfil compartible de alguien (§43, §44).
   *
   * Abierta a propósito: un QR que exigiera iniciar sesión no serviría para lo
   * que existe. Lo que se ve es solo lo que su dueño activó campo por campo, y
   * un perfil no publicado responde 404 como si no existiera.
   */
  @Public()
  @Get('public/profiles/:slug')
  @ApiOperation({ summary: 'Perfil compartible por su identificador público (§43).' })
  publicProfile(@Param('slug') slug: string) {
    return this.publicProfiles.findBySlug(slug);
  }

  @ApiBearerAuth()
  @Get('profiles/me/public-link')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Enlace y código QR del perfil compartible propio (§43).',
    description: 'El QR contiene únicamente la URL del perfil, nada más.',
  })
  async myPublicLink(@CurrentUser() user: AuthenticatedUser) {
    return this.publicProfiles.myLink(await this.profileId(user));
  }

  @ApiBearerAuth()
  @Post('profiles/me/public-link/rotate')
  @Roles(RolNombre.STUDENT)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cambia el identificador público (§43).',
    description: 'Los códigos QR impresos con el identificador anterior dejan de funcionar.',
  })
  async rotateSlug(@CurrentUser() user: AuthenticatedUser) {
    return this.publicProfiles.rotateSlug(await this.profileId(user));
  }

  // =========================================================================
  // §45 · Contactos
  // =========================================================================

  @ApiBearerAuth()
  @Post('contacts/requests')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Solicita contacto a quien publicó su perfil (§45).',
    description: 'Escanear un QR no establece contacto: lo establece esta solicitud, si la aceptan.',
  })
  async requestContact(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateContactRequestDto,
  ) {
    return this.contacts.request(await this.profileId(user), dto.slug, dto);
  }

  @ApiBearerAuth()
  @Get('contacts/requests/received')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Solicitudes de contacto pendientes de responder.' })
  async receivedRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.contacts.received(await this.profileId(user));
  }

  @ApiBearerAuth()
  @Get('contacts/requests/sent')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Solicitudes enviadas que siguen sin respuesta.' })
  async sentRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.contacts.sent(await this.profileId(user));
  }

  @ApiBearerAuth()
  @Patch('contacts/requests/:id')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Acepta o rechaza una solicitud (§45).' })
  async decideRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideContactRequestDto,
  ) {
    return this.contacts.decide(await this.profileId(user), id, dto.decision);
  }

  @ApiBearerAuth()
  @Delete('contacts/requests/:id')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Retira una solicitud propia que nadie respondió.' })
  async cancelRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contacts.cancel(await this.profileId(user), id);
  }

  @ApiBearerAuth()
  @Get('contacts')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Contactos establecidos.' })
  async listContacts(@CurrentUser() user: AuthenticatedUser) {
    return this.contacts.list(await this.profileId(user));
  }

  @ApiBearerAuth()
  @Delete('contacts/:profileId')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Deshace un contacto. Cualquiera de los dos puede.' })
  async removeContact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('profileId', ParseUUIDPipe) otherProfileId: string,
  ) {
    return this.contacts.remove(await this.profileId(user), otherProfileId);
  }

  // =========================================================================
  // §46, §47 · Necesidades, equipos e invitaciones
  // =========================================================================

  @ApiBearerAuth()
  @Post('team-needs')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Declara qué le falta a un equipo (§46).' })
  async createNeed(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTeamNeedDto,
  ) {
    return this.teams.createNeed(await this.profileId(user), dto);
  }

  @ApiBearerAuth()
  @Get('team-needs')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Necesidades abiertas de la carrera.' })
  async openNeeds(@CurrentUser() user: AuthenticatedUser) {
    return this.teams.openNeeds(await this.profileId(user));
  }

  @ApiBearerAuth()
  @Get('team-needs/mine')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Necesidades propias.' })
  async myNeeds(@CurrentUser() user: AuthenticatedUser) {
    return this.teams.myNeeds(await this.profileId(user));
  }

  @ApiBearerAuth()
  @Patch('team-needs/:id')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Edita o cierra una necesidad propia.' })
  async updateNeed(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamNeedDto,
  ) {
    return this.teams.updateNeed(await this.profileId(user), id, dto);
  }

  @ApiBearerAuth()
  @Get('team-needs/:id/suggestions')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Candidatos para cubrir la necesidad, con su motivo (§47).',
    description:
      'Solo sugiere. §47 prohíbe enviar invitaciones automáticamente: invitar es otra llamada, '
      + 'que hace una persona.',
  })
  async suggestions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.teams.suggestions(await this.profileId(user), id);
  }

  // V3 §31, §55 · Postulaciones ----------------------------------------------

  @ApiBearerAuth()
  @Post('team-needs/:id/applications')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Postula a una necesidad abierta para tu semestre (V3 §55).' })
  async apply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyToTeamNeedDto,
  ) {
    return this.applications.apply(await this.profileId(user), id, dto.message);
  }

  @ApiBearerAuth()
  @Get('team-needs/:id/applications')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Postulaciones a una necesidad propia, con lo que cada una cubre.' })
  async applicationsForNeed(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applications.forNeed(await this.profileId(user), id);
  }

  @ApiBearerAuth()
  @Get('team-applications/mine')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Mis postulaciones y su respuesta.' })
  async myApplications(@CurrentUser() user: AuthenticatedUser) {
    return this.applications.mine(await this.profileId(user));
  }

  @ApiBearerAuth()
  @Patch('team-applications/:id')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'El responsable acepta o rechaza una postulación (V3 §55).',
    description: 'Rechazar exige un motivo predefinido; «other» exige además un comentario breve.',
  })
  async decideApplication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideTeamApplicationDto,
  ) {
    return this.applications.decide(await this.profileId(user), id, dto);
  }

  @ApiBearerAuth()
  @Delete('team-applications/:id')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Retira una postulación propia pendiente.' })
  async withdrawApplication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applications.withdraw(await this.profileId(user), id);
  }

  @ApiBearerAuth()
  @Post('team-needs/:id/team')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Crea el equipo de una necesidad propia (§46).' })
  async createTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teams.createTeam(await this.profileId(user), id, dto.name, user.userId);
  }

  @ApiBearerAuth()
  @Patch('teams/:id')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Corrige el nombre del equipo; vuelve a moderarse (V2 §44).' })
  async renameTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teams.renameTeam(await this.profileId(user), id, dto.name, user.userId);
  }

  @ApiBearerAuth()
  @Get('teams/mine')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Equipos del estudiante, con lo cubierto y lo que falta (§93).' })
  async myTeams(@CurrentUser() user: AuthenticatedUser) {
    return this.teams.myTeams(await this.profileId(user));
  }

  @ApiBearerAuth()
  @Post('teams/:id/invitations')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Invita a alguien al equipo (§47).' })
  async invite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteToTeamDto,
  ) {
    return this.teams.invite(
      await this.profileId(user),
      id,
      dto.invitedProfileId,
      dto.message,
    );
  }

  @ApiBearerAuth()
  @Get('teams/invitations/mine')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Invitaciones a equipos pendientes de responder.' })
  async myInvitations(@CurrentUser() user: AuthenticatedUser) {
    return this.teams.myInvitations(await this.profileId(user));
  }

  @ApiBearerAuth()
  @Patch('teams/invitations/:id')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Acepta o declina una invitación a un equipo.' })
  async decideInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideTeamInvitationDto,
  ) {
    return this.teams.decideInvitation(await this.profileId(user), id, dto.decision);
  }

  // =========================================================================
  // V2 §59 · Canales de contacto · §56 · Nota por contacto
  // =========================================================================

  @ApiBearerAuth()
  @Get('profiles/me/contact-channels')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Canales de contacto que comparto (V2 §59).' })
  async myChannels(@CurrentUser() user: AuthenticatedUser) {
    return this.contacts.myChannels(await this.profileId(user));
  }

  @ApiBearerAuth()
  @Put('profiles/me/contact-channels')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Reemplaza mis canales de contacto; cada uno se valida por formato.' })
  async saveChannels(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveContactChannelsDto) {
    return this.contacts.saveChannels(await this.profileId(user), dto.channels);
  }

  @ApiBearerAuth()
  @Patch('contacts/:profileId/note')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Alias, contexto y canal preferido de un contacto (V2 §56). Solo los ve quien los escribe.' })
  async saveNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: ContactNoteDto,
  ) {
    return this.contacts.saveNote(await this.profileId(user), profileId, dto);
  }

  // =========================================================================
  // V2 §57 · Chat retirado
  // =========================================================================

  /**
   * Las rutas de mensajería responden 410 Gone: un cliente antiguo recibe un
   * motivo claro en lugar de un 404 que parezca un error. Las conversaciones
   * históricas se conservan en la base, sin acceso.
   */
  @ApiBearerAuth()
  @All(['conversations', 'conversations/*'])
  @ApiOperation({ summary: 'Retirado (V2 §57): Afinia no tiene chat interno.' })
  chatRetired(): never {
    throw new GoneException({
      code: 'CHAT_RETIRED',
      message: 'Afinia ya no tiene chat interno. Usa los canales de contacto que comparte cada persona.',
    });
  }
}
