import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
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
