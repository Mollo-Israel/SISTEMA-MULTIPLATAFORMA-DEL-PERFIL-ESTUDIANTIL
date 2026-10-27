import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { RegistrationStatus } from '@perfil/shared';

export class ConfirmParticipationDto {
  @ApiProperty({ description: 'ID del perfil del estudiante a confirmar' })
  @IsUUID('4')
  studentProfileId: string;

  /**
   * V5 §6: `accepted` admite la solicitud (en una externa: el proveedor lo
   * aceptó); `rejected` no la admite, con motivo; `confirmed` / `absent`
   * registran la asistencia de una interna cuando el evento ya empezó.
   */
  @ApiProperty({
    enum: [RegistrationStatus.ACCEPTED, RegistrationStatus.REJECTED, RegistrationStatus.CONFIRMED, RegistrationStatus.ABSENT],
    example: RegistrationStatus.CONFIRMED,
  })
  @IsEnum(RegistrationStatus)
  @IsIn([RegistrationStatus.ACCEPTED, RegistrationStatus.REJECTED, RegistrationStatus.CONFIRMED, RegistrationStatus.ABSENT])
  status: RegistrationStatus;

  /** Obligatorio al rechazar: lo ve el estudiante. */
  @ApiPropertyOptional({ example: 'El taller es solo para 5.º semestre.' })
  @ValidateIf((o: ConfirmParticipationDto) => o.status === RegistrationStatus.REJECTED || o.reason !== undefined)
  @IsString({ message: 'Explica el motivo.' })
  @MinLength(5, { message: 'Explica el motivo (al menos 5 caracteres).' })
  @MaxLength(300, { message: 'El motivo no puede superar 300 caracteres.' })
  reason?: string;
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
