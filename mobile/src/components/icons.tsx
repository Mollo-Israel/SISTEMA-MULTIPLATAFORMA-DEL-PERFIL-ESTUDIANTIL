import Feather from '@expo/vector-icons/Feather';
import type { StyleProp, TextStyle } from 'react-native';
import { colors } from '../theme';

/**
 * Iconos de la aplicacion movil.
 *
 * Se usa Feather, que es exactamente el mismo conjunto que el panel web
 * consume a traves de `react-icons/fi`: la lupa, la papelera o el calendario se
 * dibujan igual en los dos clientes.
 *
 * Antes se usaban caracteres Unicode sueltos ("⌕", "☷", "✦"). Se veian
 * distintos en cada telefono y en Android varios caian en el cuadro vacio de
 * "glifo no disponible", porque dependian de la fuente del sistema. Una fuente
 * de iconos empaquetada con la aplicacion no depende de nada externo.
 */

export type IconName = keyof typeof Feather.glyphMap;

export function Icon({
  name,
  size = 16,
  color = colors.gray500,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Feather name={name} size={size} color={color} style={style} />;
}

/** Icono de cada pestaña de la barra inferior, por rol. */
export const TAB_ICON: Record<string, IconName> = {
  // Estudiante
  Inicio: 'home',
  Perfil: 'user',
  Actividades: 'calendar',
  Proyectos: 'folder',
  Afinidad: 'bar-chart-2',
  Sugerencias: 'compass',
  // Docente
  Estudiante: 'users',
  Reporte: 'file-text',
  // Direccion de carrera
  Dashboard: 'grid',
  Constancias: 'award',
  Semestre: 'pie-chart',
  // Administracion
  Usuarios: 'users',
  'Áreas': 'layers',
  // Comun
  'Próximamente': 'more-horizontal',
};
