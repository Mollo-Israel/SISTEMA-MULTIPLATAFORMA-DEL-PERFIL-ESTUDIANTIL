import type { IconType } from 'react-icons';
import {
  FiBook, FiCode, FiCompass, FiCpu, FiDatabase, FiGlobe, FiLayers, FiShield, FiSmartphone, FiStar,
  FiTerminal, FiZap,
} from 'react-icons/fi';

/**
 * Avatares de catálogo (V3 §11.2). La lista coincide con `AVATAR_KEYS` de
 * `shared`; la API rechaza cualquier otra clave. Son ilustraciones, no fotos:
 * no hay imágenes que moderar.
 */
export const AVATARES: { key: string; icon: IconType; fondo: string; label: string }[] = [
  { key: 'code', icon: FiCode, fondo: '#7a1f2b', label: 'Código' },
  { key: 'cpu', icon: FiCpu, fondo: '#2f5d8a', label: 'Procesador' },
  { key: 'database', icon: FiDatabase, fondo: '#2e7d5b', label: 'Base de datos' },
  { key: 'globe', icon: FiGlobe, fondo: '#5b4b9a', label: 'Web' },
  { key: 'shield', icon: FiShield, fondo: '#8a5a12', label: 'Seguridad' },
  { key: 'smartphone', icon: FiSmartphone, fondo: '#1f6f78', label: 'Móvil' },
  { key: 'terminal', icon: FiTerminal, fondo: '#3b3f46', label: 'Terminal' },
  { key: 'layers', icon: FiLayers, fondo: '#9a3b6b', label: 'Capas' },
  { key: 'zap', icon: FiZap, fondo: '#b06a00', label: 'Energía' },
  { key: 'book', icon: FiBook, fondo: '#4a6b2f', label: 'Libro' },
  { key: 'compass', icon: FiCompass, fondo: '#30607f', label: 'Brújula' },
  { key: 'star', icon: FiStar, fondo: '#a0302d', label: 'Estrella' },
];

/** Avatar de catálogo; sin clave, las iniciales. */
export default function Avatar({
  avatarKey,
  nombre,
  size = 44,
}: {
  avatarKey?: string | null;
  nombre?: string;
  size?: number;
}) {
  const a = AVATARES.find((x) => x.key === avatarKey);
  const iniciales = (nombre ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span
      className="avatar-cat"
      style={{ width: size, height: size, background: a?.fondo ?? 'var(--bordo)', fontSize: size * 0.42 }}
      role="img"
      aria-label={a ? `Avatar: ${a.label}` : `Iniciales ${iniciales}`}
    >
      {a ? <a.icon size={size * 0.5} /> : iniciales || '·'}
    </span>
  );
}

/** Selector de avatar de catálogo. */
export function AvatarChooser({ value, onChange }: { value: string | null; onChange: (k: string | null) => void }) {
  return (
    <div className="avatar-grid" role="radiogroup" aria-label="Avatar">
      {AVATARES.map((a) => {
        const on = value === a.key;
        return (
          <button
            key={a.key}
            type="button"
            role="radio"
            aria-checked={on}
            className={`avatar-opcion ${on ? 'on' : ''}`}
            onClick={() => onChange(on ? null : a.key)}
            title={a.label}
          >
            <Avatar avatarKey={a.key} size={46} />
          </button>
        );
      })}
    </div>
  );
}
