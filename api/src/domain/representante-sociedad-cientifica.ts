import { RolNombre } from '@perfil/shared';
import { Usuario } from './usuario.base';

export class RepresentanteSociedadCientifica extends Usuario {
  get rol(): RolNombre {
    return RolNombre.SOCIEDAD_CIENTIFICA;
  }

  puedePublicarActividadesExtracurriculares(): boolean {
    return true;
  }

  puedeConfirmarParticipacion(): boolean {
    return true;
  }
}
