import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus } from '@perfil/shared';
import { UsersService } from '../../users/users.service';
import { resolveJwtSecret } from '../../config/security.config';
import { AuthenticatedUser, JwtPayload } from '../types/authenticated-user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(config),
    });
  }

  /**
   * El token solo identifica al usuario. El rol y el estado se leen de la base
   * en cada peticion, de modo que:
   *  - un usuario desactivado deja de tener acceso de inmediato, sin esperar a
   *    que expire su token (RF2);
   *  - un cambio de rol hecho por el administrador surte efecto de inmediato;
   *  - un rol manipulado dentro del token no tiene ningun efecto.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findAuthContext(payload.sub);
    if (!user) {
      throw new UnauthorizedException('La sesión ya no es válida.');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('La cuenta está inactiva.');
    }
    return { userId: user.id, email: user.email, role: user.role };
  }
}
