import { RolNombre } from '@perfil/shared';
import { Usuario } from './usuario.base';

export class DirectorCarrera extends Usuario {
  get rol(): RolNombre {
    return RolNombre.DIRECTOR;
  }

  puedeVerReportesGenerales(): boolean {
    return true;
  }

  puedeVerMapaAfinidad(): boolean {
    return true;
  }

  puedeRegistrarConstancias(): boolean {
    return true;
  }
}
