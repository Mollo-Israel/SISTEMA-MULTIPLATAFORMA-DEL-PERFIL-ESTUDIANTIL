import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { RegistrationStatus } from '@perfil/shared';

export class ConfirmParticipationDto {
  @ApiProperty({ description: 'ID del perfil del estudiante a confirmar' })
  @IsUUID('4')
  studentProfileId: string;

  /**
   * `confirmed` en una interna; `accepted` en una externa (V3 §15: el
   * proveedor lo aceptó); `absent` en ambas.
   */
  @ApiProperty({
    enum: [RegistrationStatus.CONFIRMED, RegistrationStatus.ACCEPTED, RegistrationStatus.ABSENT],
    example: RegistrationStatus.CONFIRMED,
  })
  @IsEnum(RegistrationStatus)
  @IsIn([RegistrationStatus.CONFIRMED, RegistrationStatus.ACCEPTED, RegistrationStatus.ABSENT])
  status: RegistrationStatus;
}

/** V4.1 A41-011 (§5): corrección excepcional de Dirección o Administración. */
export class CorrectParticipationDto {
  @ApiProperty({ description: 'ID del perfil del estudiante' })
  @IsUUID('4')
  studentProfileId: string;

  @ApiProperty({ enum: [RegistrationStatus.CONFIRMED, RegistrationStatus.ABSENT, RegistrationStatus.REGISTERED] })
  @IsEnum(RegistrationStatus)
  @IsIn([RegistrationStatus.CONFIRMED, RegistrationStatus.ABSENT, RegistrationStatus.REGISTERED])
  status: RegistrationStatus;

  /** Obligatorio: queda en la auditoría y lo ve el estudiante. */
  @ApiProperty({ example: 'La lista de asistencia en papel muestra que sí asistió.' })
  @IsString()
  @MinLength(10, { message: 'Explica el motivo de la corrección (al menos 10 caracteres).' })
  @MaxLength(400)
  reason: string;
}
