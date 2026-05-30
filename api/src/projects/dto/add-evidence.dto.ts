import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { EvidenceType } from '@perfil/shared';

export class AddEvidenceDto {
  @ApiProperty({ enum: EvidenceType })
  @IsEnum(EvidenceType)
  evidenceType: EvidenceType;

  @ApiProperty({ required: false, example: 'Capturas del despliegue' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiProperty({ required: false, description: 'Ruta del archivo (cuando evidenceType=file)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileUrl?: string;

  @ApiProperty({ required: false, description: 'Enlace externo (cuando evidenceType=link)' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  externalUrl?: string;
}
