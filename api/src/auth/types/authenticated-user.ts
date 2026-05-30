import { RolNombre } from '@perfil/shared';

export interface JwtPayload {
  sub: string;
  email: string;
  role: RolNombre;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: RolNombre;
}
