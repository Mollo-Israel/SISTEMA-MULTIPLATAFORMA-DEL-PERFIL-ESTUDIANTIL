import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserStatus } from '@perfil/shared';

/**
 * Cambio de estado de una cuenta (especificacion §9.3).
 *
 * Sustituye al booleano `active`, que no podia expresar los cuatro estados.
 * No se permite fijar PENDING_ACTIVATION a mano: ese estado lo produce el
 * provisionamiento, y volver a el implicaria invalidar una contrasena ya
 * fijada por su titular.
 */
export class SetStatusDto {
  @ApiProperty({
    enum: [UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.INACTIVE],
    description:
      'ACTIVE reactiva una cuenta ya activada; SUSPENDED retira el acceso de forma '
      + 'reversible; INACTIVE es la baja conservando el historial.',
  })
  @IsEnum(UserStatus, { message: 'Estado no válido.' })
  status: UserStatus;
}
