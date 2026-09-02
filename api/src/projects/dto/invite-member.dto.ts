import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { cleanLine } from '../../common/validation';

/**
 * Invitacion a integrar un proyecto (RF14).
 *
 * El rol propuesto es texto acotado, no un enum cerrado: el documento no fija
 * un catalogo de roles y cada proyecto academico usa los suyos.
 */
export class InviteMemberDto {
  @ApiProperty({ description: 'Perfil del estudiante al que se invita' })
  @IsUUID('4', { message: 'El estudiante invitado no es válido.' })
  invitedProfileId: string;

  @ApiProperty({ example: 'Desarrollador backend' })
  @Transform(cleanLine)
  @IsString()
  @IsNotEmpty({ message: 'Debe indicar el rol propuesto.' })
  @MinLength(3, { message: 'El rol debe tener al menos 3 caracteres.' })
  @MaxLength(80, { message: 'El rol no puede superar 80 caracteres.' })
  proposedRole: string;
}

/** Respuesta del estudiante invitado: aceptar o rechazar (RF14). */
export class RespondInvitationDto {
  @ApiProperty({
    enum: ['accept', 'reject'],
    example: 'accept',
    description: 'Decisión del estudiante invitado.',
  })
  @IsIn(['accept', 'reject'], { message: 'La decisión debe ser aceptar o rechazar.' })
  decision: 'accept' | 'reject';
}
