import {
  BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { VerifiableCredential } from '../entities/verifiable-credential.entity';
import { CREDENTIAL_DOCS_RATE_LIMIT, CREDENTIAL_FILE_RATE_LIMIT, CREDENTIAL_VERIFY_RATE_LIMIT } from './credentials.config';
import { CredentialVerificationService } from './credential-verification.service';
import { VerifiableCredentialsService } from './verifiable-credentials.service';
import { CredentialLedgerService } from './credential-ledger.service';
import { VerifyBatchDto, VerifyPresentedDto } from './dto/credentials.dto';
import { normalizePublicCode } from './public-code';

/** Tope de los archivos que se verifican: el mismo que el de las subidas. */
const MAX_VERIFY_FILE = 10 * 1024 * 1024;

/**
 * Lo público de los registros verificables (V8). Sin sesión, por necesidad:
 * quien verifica es un tercero (una empresa, otra universidad, un sistema).
 *
 * - Documentos estándar que cualquier verificador Open Badges consulta:
 *   perfil del emisor con sus claves, JWKS, listas de estado, aserciones 2.0.
 * - Verificador: por código, por credencial, por archivo y en lote.
 *
 * Cada ruta tiene su límite de peticiones. Los códigos tienen 60 bits
 * aleatorios y un carácter de control: no se pueden enumerar.
 */
@ApiTags('credenciales verificables (público)')
@Controller('public/credentials')
export class PublicCredentialsController {
  constructor(
    private readonly vcs: VerifiableCredentialsService,
    private readonly verification: CredentialVerificationService,
    private readonly ledger: CredentialLedgerService,
  ) {}

  /** Documento público consultable desde cualquier origen (lo piden las billeteras y verificadores). */
  private abierto(res: Response, maxAge: number) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', maxAge > 0 ? `public, max-age=${maxAge}` : 'no-store');
  }

  private async porCodigo(code: string): Promise<VerifiableCredential> {
    const canonico = normalizePublicCode(code);
    const vc = canonico ? await this.vcs.findByCode(canonico) : null;
    if (!vc) throw new NotFoundException('No existe un registro con ese código.');
    return vc;
  }

  @Get('issuer')
  @Public()
  @Throttle({ default: CREDENTIAL_DOCS_RATE_LIMIT })
  @ApiOperation({ summary: 'Perfil del emisor (Open Badges 3.0) con sus claves Multikey.' })
  async issuer(@Res({ passthrough: true }) res: Response) {
    this.abierto(res, 300);
    return this.vcs.issuerProfile();
  }

  @Get('keys')
  @Public()
  @Throttle({ default: CREDENTIAL_DOCS_RATE_LIMIT })
  @ApiOperation({ summary: 'Claves públicas de firma como JWKS (para VC-JWT).' })
  async keys(@Res({ passthrough: true }) res: Response) {
    this.abierto(res, 300);
    return this.vcs.jwks();
  }

  @Get('status/:purpose')
  @Public()
  @Throttle({ default: CREDENTIAL_DOCS_RATE_LIMIT })
  @ApiOperation({ summary: 'Lista de estado firmada (W3C Bitstring Status List): revocation o suspension.' })
  async status(@Param('purpose') purpose: string, @Res({ passthrough: true }) res: Response) {
    if (purpose !== 'revocation' && purpose !== 'suspension') throw new NotFoundException('Lista inexistente.');
    this.abierto(res, 30);
    return this.vcs.statusList(purpose);
  }

  @Get('ledger/head')
  @Public()
  @Throttle({ default: CREDENTIAL_DOCS_RATE_LIMIT })
  @ApiOperation({ summary: 'Cabeza de la bitácora encadenada: anótela para comprobar después que el pasado no cambió.' })
  async ledgerHead(@Res({ passthrough: true }) res: Response) {
    this.abierto(res, 0);
    return { head: await this.ledger.head(), algorithm: 'SHA-256(prev|seq|evento|código|JCS(datos))' };
  }

  @Get('ob2/issuer')
  @Public()
  @Throttle({ default: CREDENTIAL_DOCS_RATE_LIMIT })
  @ApiOperation({ summary: 'Emisor en Open Badges 2.0.' })
  ob2Issuer(@Res({ passthrough: true }) res: Response) {
    this.abierto(res, 300);
    return this.vcs.ob2Issuer();
  }

  @Get('ob2/badges/:code/image.svg')
  @Public()
  @Throttle({ default: CREDENTIAL_DOCS_RATE_LIMIT })
  @ApiOperation({ summary: 'Imagen de la insignia (SVG).' })
  async ob2BadgeImage(@Param('code') code: string, @Res() res: Response) {
    const vc = await this.porCodigo(code);
    this.abierto(res, 3600);
    res.type('image/svg+xml').send(this.vcs.badgeSvg(vc, false));
  }

  @Get('ob2/badges/:code')
  @Public()
  @Throttle({ default: CREDENTIAL_DOCS_RATE_LIMIT })
  @ApiOperation({ summary: 'BadgeClass de Open Badges 2.0.' })
  async ob2Badge(@Param('code') code: string, @Res({ passthrough: true }) res: Response) {
    const vc = await this.porCodigo(code);
    this.abierto(res, 300);
    return this.vcs.ob2Badge(vc);
  }

  @Get('ob2/assertions/:code')
  @Public()
  @Throttle({ default: CREDENTIAL_DOCS_RATE_LIMIT })
  @ApiOperation({ summary: 'Aserción alojada de Open Badges 2.0 (verification: hosted). Refleja el estado en vivo.' })
  async ob2Assertion(@Param('code') code: string, @Res({ passthrough: true }) res: Response) {
    const vc = await this.porCodigo(code);
    this.abierto(res, 0);
    return this.vcs.ob2Assertion(vc);
  }

  @Post('verify')
  @Public()
  @HttpCode(200)
  @Throttle({ default: CREDENTIAL_VERIFY_RATE_LIMIT })
  @ApiOperation({ summary: 'Verifica una credencial presentada: JSON (OB 3.0/2.0), VC-JWT o URL.' })
  verify(@Body() dto: VerifyPresentedDto) {
    const c = dto.credential;
    if (typeof c !== 'string' && (typeof c !== 'object' || c === null || Array.isArray(c))) {
      throw new BadRequestException({ message: 'Pega la credencial en JSON, un JWT o una URL.', fields: { credential: ['Formato no admitido.'] } });
    }
    return this.verification.presented(c);
  }

  @Post('verify-file')
  @Public()
  @HttpCode(200)
  @Throttle({ default: CREDENTIAL_FILE_RATE_LIMIT })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Verifica un archivo: PDF de Afinia, insignia horneada (PNG/SVG), JSON, imagen con QR o certificado entregado (por huella).' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_VERIFY_FILE, files: 1 } }))
  verifyFile(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException({ message: 'Adjunta un archivo.', fields: { file: ['Adjunta un archivo.'] } });
    return this.verification.file(file.buffer, file.originalname ?? 'archivo');
  }

  @Post('verify-batch')
  @Public()
  @HttpCode(200)
  @Throttle({ default: CREDENTIAL_FILE_RATE_LIMIT })
  @ApiOperation({ summary: 'Verifica hasta 25 códigos de una vez (por ejemplo, los de una postulación).' })
  verifyBatch(@Body() dto: VerifyBatchDto) {
    return this.verification.batch(dto.codes);
  }

  @Get(':code/ob3')
  @Public()
  @Throttle({ default: CREDENTIAL_DOCS_RATE_LIMIT })
  @ApiOperation({ summary: 'La credencial Open Badges 3.0 firmada (Data Integrity eddsa-jcs-2022).' })
  async ob3(@Param('code') code: string, @Res({ passthrough: true }) res: Response) {
    const vc = await this.porCodigo(code);
    this.abierto(res, 0);
    return vc.credentialJson;
  }

  @Get(':code')
  @Public()
  @Throttle({ default: CREDENTIAL_VERIFY_RATE_LIMIT })
  @ApiOperation({ summary: 'Informe de verificación de un código: integridad, firma, bitácora y estado.' })
  async byCode(@Param('code') code: string, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.verification.byCode(code);
  }
}
