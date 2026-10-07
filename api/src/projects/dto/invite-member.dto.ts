import { PROJECT_ROLES } from '@perfil/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { cleanLine } from '../../common/validation';

/**
 * Invitacion a integrar un proyecto (RF14).
 *
 * V3 §30.1: el rol propuesto sale de un catálogo controlado. Describe qué
 * hará; nunca es fuente de afinidad.
 */
export class InviteMemberDto {
  @ApiProperty({ description: 'Perfil del estudiante al que se invita' })
  @IsUUID('4', { message: 'El estudiante invitado no es válido.' })
  invitedProfileId: string;

  /** V3 §30.1: del catálogo controlado de roles de proyecto. */
  @ApiProperty({ enum: PROJECT_ROLES, example: 'Backend' })
  @IsIn([...PROJECT_ROLES], { message: `El rol debe ser uno de: ${PROJECT_ROLES.join(', ')}.` })
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
