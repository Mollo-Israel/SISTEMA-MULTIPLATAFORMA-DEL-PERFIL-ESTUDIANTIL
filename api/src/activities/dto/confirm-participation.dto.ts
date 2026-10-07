import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsUUID } from 'class-validator';
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
