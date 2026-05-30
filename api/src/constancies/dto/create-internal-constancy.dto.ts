import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ConstancyStatus } from '@perfil/shared';

export class CreateInternalConstancyDto {
  @ApiProperty({ description: 'ID del perfil del estudiante' })
  @IsUUID('4')
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
  @IsString()
  @MaxLength(300)
  description: string;

  @ApiProperty({ enum: ConstancyStatus, required: false, default: ConstancyStatus.AUTHORIZED })
  @IsOptional()
  @IsEnum(ConstancyStatus)
  status?: ConstancyStatus;
}
