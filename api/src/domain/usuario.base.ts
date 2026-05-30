import { RolNombre, UserStatus } from '@perfil/shared';

export interface UsuarioProps {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
}

export abstract class Usuario {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly status: UserStatus;

  constructor(props: UsuarioProps) {
    this.id = props.id;
    this.email = props.email;
    this.firstName = props.firstName;
    this.lastName = props.lastName;
    this.status = props.status;
  }

  abstract get rol(): RolNombre;

  get nombreCompleto(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  estaActivo(): boolean {
    return this.status === UserStatus.ACTIVE;
  }

  tieneRol(rol: RolNombre): boolean {
    return this.rol === rol;
  }
}
