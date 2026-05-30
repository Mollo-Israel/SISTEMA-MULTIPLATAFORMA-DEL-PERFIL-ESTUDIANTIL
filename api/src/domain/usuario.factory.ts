import { RolNombre } from '@perfil/shared';
import { Usuario, UsuarioProps } from './usuario.base';
import { Estudiante } from './estudiante';
import { Docente } from './docente';
import { DirectorCarrera } from './director-carrera';
import { RepresentanteSociedadCientifica } from './representante-sociedad-cientifica';
import { Administrador } from './administrador';

export function crearUsuarioDominio(rol: RolNombre, props: UsuarioProps): Usuario {
  switch (rol) {
    case RolNombre.ESTUDIANTE:
      return new Estudiante(props);
    case RolNombre.DOCENTE:
      return new Docente(props);
    case RolNombre.DIRECTOR:
      return new DirectorCarrera(props);
    case RolNombre.SOCIEDAD_CIENTIFICA:
      return new RepresentanteSociedadCientifica(props);
    case RolNombre.ADMINISTRADOR:
      return new Administrador(props);
    default:
      throw new Error(`Rol no soportado: ${rol}`);
  }
}
