import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre, ValidationResourceType } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { ValidationService } from './validation.service';
import { ValidationWorker } from './validation.worker';

/**
 * Consulta del Motor de Validación (§26, §76).
 *
 * El veredicto de un recurso lo ve su dueño y el administrador. No es
 * información sensible en sí, pero decir públicamente que el certificado de
 * alguien quedó `INCONCLUSIVE` sería exponer algo que no le corresponde a
 * nadie más.
 */
@ApiTags('validation')
@ApiBearerAuth()
@Controller('validation')
export class ValidationController {
  constructor(
    private readonly validation: ValidationService,
    private readonly worker: ValidationWorker,
    @InjectRepository(ProjectEvidence) private readonly evidences: Repository<ProjectEvidence>,
    @InjectRepository(ExternalCertificate)
    private readonly certificates: Repository<ExternalCertificate>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
  ) {}

  @Get('queue')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Estado de la cola de validación.',
    description: 'Diagnóstico: cuántos trabajos hay en cada estado y cuántos están listos.',
  })
  queue() {
    return this.validation.queueStats();
  }

  @Post('run')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Procesar la cola ahora.',
    description:
      'Fuerza una vuelta del worker sin esperar a su temporizador. Pensado para '
      + 'diagnóstico y para las pruebas de integración, que no deben depender del reloj.',
  })
  async run(@Query('limit') limit?: string) {
    const tope = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const procesados = await this.worker.runOnce(tope);
    return { procesados };
  }

  @Get(':resourceType/:resourceId')
  @Roles(RolNombre.STUDENT, RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Veredicto de validación de un recurso propio.',
    description:
      'Incluye el nivel de respaldo (§30), la metadata extraída (§29) y el resultado '
      + 'de comprobar el enlace (§31). Nada de esto afirma autenticidad legal.',
  })
  async forResource(
    @CurrentUser() user: AuthenticatedUser,
    @Param('resourceType') resourceType: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
  ) {
    const tipo = this.parseType(resourceType);
    await this.assertOwnership(user, tipo, resourceId);

    const record = await this.validation.findForOrFail(tipo, resourceId);
    return {
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      status: record.status,
      backingTier: record.backingTier,
      identityMatchStatus: record.identityMatchStatus,
      extractedData: record.extractedData,
      linkCheck: record.linkCheck,
      isDuplicate: record.duplicateOfId !== null,
      validatorVersion: record.validatorVersion,
      attempts: record.attempts,
      errorCode: record.errorCode,
      finishedAt: record.finishedAt,
      /**
       * Se repite en cada respuesta a propósito: quien lea esto debe tener
       * delante que el sistema mide corroboración técnica, no autenticidad.
       */
      disclaimer:
        'Afinia comprueba qué puede corroborarse técnicamente. No certifica la '
        + 'autenticidad legal de ningún documento.',
    };
  }

  private parseType(valor: string): ValidationResourceType {
    const normalizado = valor.toLowerCase().replace(/-/g, '_');
    const tipos = Object.values(ValidationResourceType) as string[];
    if (!tipos.includes(normalizado)) {
      throw new NotFoundException('Tipo de recurso no reconocido.');
    }
    return normalizado as ValidationResourceType;
  }

  /** El administrador ve cualquiera; el estudiante, solo lo suyo. */
  private async assertOwnership(
    user: AuthenticatedUser,
    tipo: ValidationResourceType,
    resourceId: string,
  ): Promise<void> {
    if (user.role === RolNombre.ADMIN) return;

    const profile = await this.profiles.findOne({ where: { userId: user.userId } });
    if (!profile) throw new ForbiddenException('No tiene perfil estudiantil.');

    const dueño = tipo === ValidationResourceType.EXTERNAL_CERTIFICATE
      ? (await this.certificates.findOne({ where: { id: resourceId } }))?.studentProfileId
      : (await this.evidences.findOne({ where: { id: resourceId } }))?.studentProfileId;

    // Un recurso ajeno responde 404, no 403: confirmar que existe ya diría
    // algo que no corresponde.
    if (!dueño || dueño !== profile.id) {
      throw new NotFoundException('Recurso no encontrado.');
    }
  }
}
