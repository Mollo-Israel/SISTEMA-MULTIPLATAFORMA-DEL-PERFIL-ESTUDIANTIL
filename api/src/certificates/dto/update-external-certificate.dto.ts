import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateExternalCertificateDto } from './create-external-certificate.dto';

/**
 * El origen no se edita (V3 §15/§16): una credencial histórica no pasa a
 * «de una oportunidad» —ni al revés— cambiando un campo. Se registra de nuevo.
 */
export class UpdateExternalCertificateDto extends PartialType(
  OmitType(CreateExternalCertificateDto, ['activityId'] as const),
) {}
