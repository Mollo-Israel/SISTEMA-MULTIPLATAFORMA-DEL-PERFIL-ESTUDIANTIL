import { useEffect, useId, useState } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { activityService } from '../services';
import type { ActivityPerson } from '../services/types';

const ROL: Record<string, string> = {
  TEACHER: 'Docente',
  CAREER_DIRECTOR: 'Dirección',
  SCIENTIFIC_SOCIETY: 'Sociedad científica',
  STUDENT: 'Estudiante',
  ADMIN: 'Administración',
};

export const nombrePersona = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;

/**
 * Combobox de personas con búsqueda (V3.2 §6.3, §16–§17).
 *
 * No despliega cien nombres: busca mientras se escribe (debounce) y muestra
 * hasta 20 candidatos que quien edita podría asignar —lo decide el servidor—.
 * Lo elegido queda como burbujas que se pueden quitar.
 */
export default function PersonPicker({
  kind,
  activityType,
  value,
  onChange,
  label,
  hint,
  error,
  max = 5,
  disabled = false,
}: {
  kind: 'responsible' | 'contact';
  activityType: 'academica' | 'extracurricular';
  value: ActivityPerson[];
  onChange: (v: ActivityPerson[]) => void;
  label: string;
  hint?: string;
  error?: string | null;
  max?: number;
  disabled?: boolean;
}) {
  const id = useId();
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [opciones, setOpciones] = useState<ActivityPerson[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const t = setTimeout(() => {
      setCargando(true);
      activityService.people(kind, activityType, q.trim())
        .then(setOpciones)
        .catch(() => setOpciones([]))
        .finally(() => setCargando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, abierto, kind, activityType]);

  const elegidos = new Set(value.map((p) => p.id));
  const disponibles = opciones.filter((o) => !elegidos.has(o.id));
  const lleno = value.length >= max;

  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {value.length > 0 && (
        <div className="chip-row" style={{ marginBottom: '0.35rem' }}>
          {value.map((p) => (
            <span key={p.id} className="chip on">
              {nombrePersona(p)}
              {p.role && <span className="muted small"> · {ROL[p.role] ?? p.role}</span>}
              {!disabled && (
                <button
                  type="button"
                  className="chip-x"
                  aria-label={`Quitar a ${nombrePersona(p)}`}
                  onClick={() => onChange(value.filter((x) => x.id !== p.id))}
                >
                  <FiX size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && !lleno && (
        <div className="person-picker">
          <div className="search-input">
            <FiSearch size={14} aria-hidden />
            <input
              id={id}
              role="combobox"
              aria-expanded={abierto}
              aria-controls={`${id}-lista`}
              aria-autocomplete="list"
              value={q}
              onChange={(e) => { setQ(e.target.value); setAbierto(true); }}
              onFocus={() => setAbierto(true)}
              onBlur={() => setTimeout(() => setAbierto(false), 150)}
              placeholder="Escribe un nombre o correo…"
            />
          </div>
          {abierto && (
            <ul id={`${id}-lista`} role="listbox" className="person-options">
              {cargando && <li className="muted small">Buscando…</li>}
              {!cargando && disponibles.length === 0 && <li className="muted small">Sin resultados.</li>}
              {!cargando && disponibles.map((o) => (
                <li
                  key={o.id}
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange([...value, o]);
                    setQ('');
                  }}
                >
                  <strong>{nombrePersona(o)}</strong>{' '}
                  <span className="muted small">{ROL[o.role ?? ''] ?? o.role} · {o.email}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error ? <span className="field-error" role="alert">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}
