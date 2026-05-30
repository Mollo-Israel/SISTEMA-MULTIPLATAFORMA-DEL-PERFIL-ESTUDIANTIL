import { RolNombre } from '@perfil/shared';
import { Usuario } from './usuario.base';

export class Estudiante extends Usuario {
  get rol(): RolNombre {
    return RolNombre.STUDENT;
  }

  puedeRegistrarProyectos(): boolean {
    return true;
  }

  puedeInscribirseEnActividades(): boolean {
    return true;
  }

  puedeGestionarSuPerfil(): boolean {
    return true;
  }
}
