import { RolNombre, UserStatus } from '@perfil/shared';
import { User } from '../../entities/user.entity';

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  role: RolNombre;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    role: user.role.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
