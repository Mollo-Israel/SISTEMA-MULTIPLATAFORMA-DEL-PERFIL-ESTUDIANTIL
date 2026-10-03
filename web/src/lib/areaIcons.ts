import type { IconType } from 'react-icons';
import {
  FiBarChart2, FiBox, FiCloud, FiCode, FiCpu, FiDatabase, FiGitBranch, FiPenTool, FiPlay,
  FiSearch, FiShield, FiSmartphone, FiTarget, FiTrello, FiWifi,
} from 'react-icons/fi';

/**
 * Icono y color de un área académica.
 *
 * Se busca por palabras del nombre y no por el nombre exacto: el catálogo lo
 * administra la carrera, y un área nueva («Computación en la Nube») debe
 * recibir un icono sensato sin tocar el código.
 */
const REGLAS: { palabras: string[]; icono: IconType; color: string }[] = [
  { palabras: ['web', 'frontend', 'backend'], icono: FiCode, color: '#2563eb' },
  { palabras: ['movil', 'mobile', 'android', 'ios'], icono: FiSmartphone, color: '#7c3aed' },
  { palabras: ['inteligencia', 'machine', 'ia '], icono: FiCpu, color: '#db2777' },
  { palabras: ['dato', 'data', 'analit'], icono: FiDatabase, color: '#0891b2' },
  { palabras: ['red', 'network', 'telecom'], icono: FiWifi, color: '#059669' },
  { palabras: ['seguridad', 'ciber', 'security'], icono: FiShield, color: '#dc2626' },
  { palabras: ['software', 'ingenieria'], icono: FiGitBranch, color: '#4f46e5' },
  { palabras: ['gestion', 'proyecto', 'project'], icono: FiTrello, color: '#d97706' },
  { palabras: ['nube', 'cloud', 'infraestructura', 'devops'], icono: FiCloud, color: '#0284c7' },
  { palabras: ['juego', 'game'], icono: FiPlay, color: '#9333ea' },
  { palabras: ['embebido', 'iot', 'robot', 'hardware'], icono: FiBox, color: '#65a30d' },
  { palabras: ['diseno', 'ux', 'ui', 'interfaz'], icono: FiPenTool, color: '#e11d48' },
  { palabras: ['investigacion', 'research'], icono: FiSearch, color: '#475569' },
  { palabras: ['estadistica', 'matematica'], icono: FiBarChart2, color: '#0d9488' },
];

const sinTildes = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function areaVisual(nombre: string): { icono: IconType; color: string } {
  const n = ` ${sinTildes(nombre)} `;
  const regla = REGLAS.find((r) => r.palabras.some((p) => n.includes(p)));
  return regla ? { icono: regla.icono, color: regla.color } : { icono: FiTarget, color: '#7a1424' };
}
