import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { MessagingService } from './messaging.service';
import {
  CreateContactRequestDto,
  CreateTeamDto,
  CreateTeamNeedDto,
  DecideContactRequestDto,
  DecideTeamInvitationDto,
  InviteToTeamDto,
  OpenDirectConversationDto,
  SendMessageDto,
  UpdateTeamNeedDto,
} from './dto/collaboration.dto';

/**
 * Colaboración entre estudiantes (§42 a §47).
 *
 * Todo lo de aquí es del Estudiante: contactos, equipos y mensajería son
 * relaciones entre pares. Un docente o la dirección no participan, y por eso no
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
    private readonly messaging: MessagingService,
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

  @ApiBearerAuth()
  @Post('team-needs/:id/team')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Crea el equipo de una necesidad propia (§46).' })
  async createTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teams.createTeam(await this.profileId(user), id, dto.name);
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
  // §42 · Mensajería
  // =========================================================================

  @ApiBearerAuth()
  @Get('conversations')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Conversaciones del estudiante (§42).' })
  async conversations(@CurrentUser() user: AuthenticatedUser) {
    return this.messaging.list(await this.profileId(user));
  }

  @ApiBearerAuth()
  @Post('conversations/direct')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Abre la conversación con un contacto (§42.1).',
    description: 'Exige contacto aceptado: sin él no hay canal.',
  })
  async openDirect(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OpenDirectConversationDto,
  ) {
    return this.messaging.openDirect(await this.profileId(user), dto.profileId);
  }

  @ApiBearerAuth()
  @Get('conversations/:id/messages')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Mensajes de una conversación propia.' })
  async messages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('before') before?: string,
  ) {
    return this.messaging.messagesOf(await this.profileId(user), id, before);
  }

  @ApiBearerAuth()
  @Post('conversations/:id/messages')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Envía un mensaje (§42).' })
  async send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messaging.send(await this.profileId(user), id, dto.body);
  }
}
