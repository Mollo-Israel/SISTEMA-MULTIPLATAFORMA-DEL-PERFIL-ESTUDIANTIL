import { PartialType } from '@nestjs/swagger';
import { CreateExternalCertificateDto } from './create-external-certificate.dto';

export class UpdateExternalCertificateDto extends PartialType(CreateExternalCertificateDto) {}
