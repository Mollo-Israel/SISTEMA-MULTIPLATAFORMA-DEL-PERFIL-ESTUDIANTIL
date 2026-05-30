import { RolNombre } from '@perfil/shared';
import { Usuario } from './usuario.base';

export class Docente extends Usuario {
  get rol(): RolNombre {
    return RolNombre.TEACHER;
  }

  puedePublicarActividades(): boolean {
    return true;
  }

  puedeConfirmarParticipacion(): boolean {
    return true;
  }

  puedeRegistrarConstancias(): boolean {
    return true;
  }

  puedeVerReportesBasicos(): boolean {
    return true;
  }
}
