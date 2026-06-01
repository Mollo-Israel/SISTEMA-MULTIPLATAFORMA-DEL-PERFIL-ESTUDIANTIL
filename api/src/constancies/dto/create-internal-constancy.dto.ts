import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ConstancyStatus } from '@perfil/shared';
import { trim } from '../../common/validation';

export class CreateInternalConstancyDto {
  @ApiProperty({ description: 'ID del perfil del estudiante' })
  @IsUUID('4', { message: 'Estudiante inválido.' })
  profileId: string;

  @ApiProperty({ required: false, description: 'Actividad relacionada (opcional)' })
  @IsOptional()
  @IsUUID('4')
  activityId?: string;

  @ApiProperty({ required: false, description: 'Registro de participación (recomendado si existe)' })
  @IsOptional()
  @IsUUID('4')
  activityRegistrationId?: string;

  @ApiProperty({ example: 'Participó como ponente en el seminario interno.' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  @MaxLength(300, { message: 'La descripción no puede superar 300 caracteres.' })
  description: string;

  @ApiProperty({ enum: ConstancyStatus, required: false, default: ConstancyStatus.AUTHORIZED })
  @IsOptional()
  @IsEnum(ConstancyStatus)
  status?: ConstancyStatus;
}
