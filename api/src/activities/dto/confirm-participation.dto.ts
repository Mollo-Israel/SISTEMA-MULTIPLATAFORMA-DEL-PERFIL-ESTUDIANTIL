import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsUUID } from 'class-validator';
import { RegistrationStatus } from '@perfil/shared';

export class ConfirmParticipationDto {
  @ApiProperty({ description: 'ID del perfil del estudiante a confirmar' })
  @IsUUID('4')
  studentProfileId: string;

  @ApiProperty({
    enum: [RegistrationStatus.CONFIRMED, RegistrationStatus.ABSENT],
    example: RegistrationStatus.CONFIRMED,
  })
  @IsEnum(RegistrationStatus)
  @IsIn([RegistrationStatus.CONFIRMED, RegistrationStatus.ABSENT])
  status: RegistrationStatus;
}
