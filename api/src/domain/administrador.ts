import { RolNombre } from '@perfil/shared';
import { Usuario } from './usuario.base';

export class Administrador extends Usuario {
  get rol(): RolNombre {
    return RolNombre.ADMIN;
  }

  puedeGestionarUsuarios(): boolean {
    return true;
  }

  puedeGestionarRoles(): boolean {
    return true;
  }

  puedeGestionarCatalogos(): boolean {
    return true;
  }

  puedeGestionarAreasAcademicas(): boolean {
    return true;
  }
}
