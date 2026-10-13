import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength,
  ValidateIf,
} from 'class-validator';
import { ConstancyStatus } from '@perfil/shared';
import { cleanText } from '../../common/validation';

export class CreateInternalConstancyDto {
  @ApiProperty({ description: 'ID del perfil del estudiante' })
  @IsUUID('4', { message: 'Estudiante inválido.' })
  profileId: string;

  @ApiProperty({
    description:
      'Actividad que respalda la constancia. El estudiante debe tener participación confirmada en ella.',
  })
  @IsUUID('4', { message: 'Actividad inválida.' })
  activityId: string;

  @ApiProperty({ example: 'Participó como ponente en el seminario interno.' })
  @Transform(cleanText)
  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  @MinLength(5, { message: 'La descripción debe tener al menos 5 caracteres.' })
  @MaxLength(300, { message: 'La descripción no puede superar 300 caracteres.' })
  description: string;

  @ApiProperty({ enum: ConstancyStatus, required: false, default: ConstancyStatus.AUTHORIZED })
  @IsOptional()
  @IsEnum(ConstancyStatus)
  status?: ConstancyStatus;
}

/** V3.2 §28.3: entrega del certificado institucional a confirmados. */
export class DeliverInstitutionCertificateDto {
  @ApiProperty({ type: [String], description: 'Perfiles de los participantes confirmados que lo reciben.' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Elige al menos un participante confirmado.' })
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  profileIds: string[];

  @ApiProperty({ required: false, nullable: true, description: 'Archivo del certificado (subido por quien entrega).' })
  @IsOptional()
  @ValidateIf((o: DeliverInstitutionCertificateDto) => o.storedFileId !== null)
  @IsUUID('4', { message: 'El archivo no es válido.' })
  storedFileId?: string | null;

  @ApiProperty({ required: false, nullable: true, description: 'Código de verificación del emisor.' })
  @IsOptional()
  @ValidateIf((o: DeliverInstitutionCertificateDto) => o.certificateCode !== null)
  @IsString()
  @MaxLength(80, { message: 'El código no puede superar 80 caracteres.' })
  certificateCode?: string | null;
}
