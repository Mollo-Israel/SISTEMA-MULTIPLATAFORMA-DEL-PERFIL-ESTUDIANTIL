import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { VerifiableCredentialsService } from './verifiable-credentials.service';
import { CredentialReasonDto, IssuePendingDto, SetCredentialPolicyDto } from './dto/credentials.dto';

const FORMATOS: Record<string, { tipo: string; extension: string }> = {
  pdf: { tipo: 'application/pdf', extension: 'pdf' },
  json: { tipo: 'application/json', extension: 'json' },
  jwt: { tipo: 'application/vc+jwt', extension: 'jwt' },
  svg: { tipo: 'image/svg+xml', extension: 'svg' },
  png: { tipo: 'image/png', extension: 'png' },
  qr: { tipo: 'image/svg+xml', extension: 'svg' },
};

/**
 * Registros verificables con sesión (V8).
 *
 * - El estudiante ve, pide y descarga los suyos.
 * - Dirección decide la política (ND-01), emite en lote, suspende, levanta y
 *   revoca, y audita la integridad.
 * - Administración solo consulta y audita: no decide sobre documentos
 *   académicos (§6.5).
 */
@ApiTags('credenciales verificables')
@ApiBearerAuth()
@Controller('credentials')
export class CredentialsController {
  constructor(private readonly vcs: VerifiableCredentialsService) {}

  @Get('mine')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Mis registros verificables, lo pendiente de firmar y si Dirección habilitó la emisión.' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.vcs.mine(user);
  }

  @Post('mine/issue')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Firma todos mis hechos pendientes (403 CREDENTIAL_ISSUANCE_DISABLED si Dirección no lo habilitó).' })
  issueMine(@CurrentUser() user: AuthenticatedUser) {
    return this.vcs.issueMine(user);
  }

  @Get('policy')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Política vigente de emisión y su historia (V5 ND-01).' })
  policy() {
    return this.vcs.policy();
  }

  @Post('policy')
  @Roles(RolNombre.CAREER_DIRECTOR)
  @ApiOperation({ summary: 'Dirección habilita o apaga la emisión, con justificación.' })
  setPolicy(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetCredentialPolicyDto) {
    return this.vcs.setPolicy(user, dto.enabled, dto.justification);
  }

  @Get('registry')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Registro de credenciales emitidas, con su estado en vivo.' })
  list(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('sourceType') sourceType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.vcs.list({ status, q, sourceType, limit: Number(limit), offset: Number(offset) });
  }

  @Post('registry/issue-pending')
  @Roles(RolNombre.CAREER_DIRECTOR)
  @ApiOperation({ summary: 'Firma lo pendiente (de una actividad o de todas).' })
  issuePending(@CurrentUser() user: AuthenticatedUser, @Body() dto: IssuePendingDto) {
    return this.vcs.issuePending(user, dto.activityId);
  }

  @Get('registry/integrity')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Auditoría completa: cadena de la bitácora, firmas y huellas de cada registro.' })
  integrity() {
    return this.vcs.integrity();
  }

  @Get('registry/:id')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Detalle de un registro con su historia en la bitácora.' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.vcs.detail(id);
  }

  @Post('registry/:id/suspend')
  @Roles(RolNombre.CAREER_DIRECTOR)
  @ApiOperation({ summary: 'Suspende un registro (reversible), con motivo.' })
  suspend(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CredentialReasonDto) {
    return this.vcs.suspend(user, id, dto.reason);
  }

  @Post('registry/:id/lift')
  @Roles(RolNombre.CAREER_DIRECTOR)
  @ApiOperation({ summary: 'Levanta una suspensión, con motivo.' })
  lift(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CredentialReasonDto) {
    return this.vcs.liftSuspension(user, id, dto.reason);
  }

  @Post('registry/:id/revoke')
  @Roles(RolNombre.CAREER_DIRECTOR)
  @ApiOperation({ summary: 'Revoca un registro. Es definitivo: ni la base de datos lo deja deshacer.' })
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CredentialReasonDto) {
    return this.vcs.revoke(user, id, dto.reason);
  }

  @Get(':id/download/:format')
  @Roles(RolNombre.STUDENT, RolNombre.CAREER_DIRECTOR)
  @ApiOperation({ summary: 'Descarga: pdf, json (OB 3.0), jwt (VC-JWT), svg o png (insignias horneadas) y qr.' })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('format') format: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const f = FORMATOS[format];
    if (!f) throw new NotFoundException('Formato no disponible.');
    const vc = await this.vcs.ownedOrDirector(user, id);
    let datos: Buffer;
    switch (format) {
      case 'pdf': datos = this.vcs.pdf(vc); break;
      case 'json': datos = Buffer.from(this.vcs.credentialJsonText(vc), 'utf8'); break;
      case 'jwt': datos = Buffer.from(vc.credentialJwt, 'utf8'); break;
      case 'svg': datos = Buffer.from(this.vcs.badgeSvg(vc, true), 'utf8'); break;
      case 'png': datos = this.vcs.badgePng(vc); break;
      default: datos = Buffer.from(this.vcs.qrSvg(vc), 'utf8');
    }
    const nombre = format === 'qr' ? `qr-${vc.publicCode}.svg` : `registro-${vc.publicCode}.${f.extension}`;
    res.set({
      'Content-Type': f.tipo,
      'Content-Disposition': `${format === 'qr' ? 'inline' : 'attachment'}; filename="${nombre}"`,
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(datos);
  }
}
