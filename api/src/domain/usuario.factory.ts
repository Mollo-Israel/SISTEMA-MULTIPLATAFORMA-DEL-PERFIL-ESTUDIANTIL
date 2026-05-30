import { RolNombre } from '@perfil/shared';
import { Usuario, UsuarioProps } from './usuario.base';
import { Estudiante } from './estudiante';
import { Docente } from './docente';
import { DirectorCarrera } from './director-carrera';
import { RepresentanteSociedadCientifica } from './representante-sociedad-cientifica';
import { Administrador } from './administrador';

export function crearUsuarioDominio(rol: RolNombre, props: UsuarioProps): Usuario {
  switch (rol) {
    case RolNombre.STUDENT:
      return new Estudiante(props);
    case RolNombre.TEACHER:
      return new Docente(props);
    case RolNombre.CAREER_DIRECTOR:
      return new DirectorCarrera(props);
    case RolNombre.SCIENTIFIC_SOCIETY:
      return new RepresentanteSociedadCientifica(props);
    case RolNombre.ADMIN:
      return new Administrador(props);
    default:
      throw new Error(`Rol no soportado: ${rol}`);
  }
}
