import { useMemo, useState } from 'react';
import type { AcademicArea, Skill } from '../services/types';

/** Normaliza para buscar sin tildes ni mayúsculas. */
const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface AreaSkillValue {
  areaIds: string[];
  skillIds: string[];
}

/**
 * Selección relacional área → habilidades (V3 §4, §21.2).
 *
 * Primero se eligen las áreas; después solo se ofrecen las habilidades de esas
 * áreas, agrupadas por área. Quitar un área quita también sus habilidades, así
 * nunca queda guardada una habilidad de un área no elegida (el servidor lo
 * exige igual). Se guardan IDs reales, nunca texto libre.
 */
export default function AreaSkillPicker({
  areas,
  skills,
  value,
  onChange,
  areaLabel = 'Áreas',
  skillLabel = 'Habilidades',
  maxAreas = 8,
  maxSkills = 15,
  areaError,
  skillError,
}: {
  areas: AcademicArea[];
  skills: Skill[];
  value: AreaSkillValue;
  onChange: (v: AreaSkillValue) => void;
  areaLabel?: string;
  skillLabel?: string;
  maxAreas?: number;
  maxSkills?: number;
  areaError?: string;
  skillError?: string;
}) {
  const [buscar, setBuscar] = useState('');
  const activas = useMemo(() => areas.filter((a) => a.isActive !== false), [areas]);

  const grupos = useMemo(() => {
    const q = norm(buscar.trim());
    return value.areaIds
      .map((id) => activas.find((a) => a.id === id))
      .filter((a): a is AcademicArea => !!a)
      .map((area) => ({
        area,
        skills: skills
          .filter((s) => s.isActive !== false && s.academicAreaId === area.id)
          .filter((s) => !q || norm(s.name).includes(q) || (s.aliases ?? []).some((al) => norm(al).includes(q)))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [value.areaIds, activas, skills, buscar]);

  const alternarArea = (id: string) => {
    if (value.areaIds.includes(id)) {
      const quedan = value.areaIds.filter((x) => x !== id);
      const deEsa = new Set(skills.filter((s) => s.academicAreaId === id).map((s) => s.id));
      onChange({ areaIds: quedan, skillIds: value.skillIds.filter((s) => !deEsa.has(s)) });
    } else if (value.areaIds.length < maxAreas) {
      onChange({ ...value, areaIds: [...value.areaIds, id] });
    }
  };

  const alternarSkill = (id: string) => {
    if (value.skillIds.includes(id)) onChange({ ...value, skillIds: value.skillIds.filter((x) => x !== id) });
    else if (value.skillIds.length < maxSkills) onChange({ ...value, skillIds: [...value.skillIds, id] });
  };

  const totalVisibles = grupos.reduce((n, g) => n + g.skills.length, 0);

  return (
    <div className="area-skill-picker">
      <div className="field">
        <label>{areaLabel}</label>
        <div className="chip-row" role="group" aria-label={areaLabel}>
          {activas.map((a) => {
            const on = value.areaIds.includes(a.id);
            return (
              <button
                type="button"
                key={a.id}
                className={`chip ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => alternarArea(a.id)}
              >
                {a.name}
              </button>
            );
          })}
        </div>
        {areaError && <span className="field-error">{areaError}</span>}
      </div>

      <div className="field">
        <label>{skillLabel}</label>
        {value.areaIds.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            Elige al menos un área para ver sus habilidades.
          </p>
        ) : (
          <>
            {grupos.reduce((n, g) => n + g.skills.length, 0) > 12 || buscar ? (
              <input
                type="search"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Buscar habilidad…"
                aria-label="Buscar habilidad"
                style={{ marginBottom: '0.5rem' }}
              />
            ) : null}
            {grupos.map(({ area, skills: delArea }) => (
              <div key={area.id} className="skill-group">
                <div className="skill-group-title">{area.name}</div>
                {delArea.length === 0 ? (
                  <p className="muted small" style={{ margin: '0 0 0.4rem' }}>
                    {buscar ? 'Ninguna coincide con la búsqueda.' : 'Esta área todavía no tiene habilidades en el catálogo.'}
                  </p>
                ) : (
                  <div className="chip-row">
                    {delArea.map((s) => {
                      const on = value.skillIds.includes(s.id);
                      return (
                        <button
                          type="button"
                          key={s.id}
                          className={`chip ${on ? 'on' : ''}`}
                          aria-pressed={on}
                          onClick={() => alternarSkill(s.id)}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {totalVisibles > 0 && (
              <span className="muted small">
                {value.skillIds.length} de {maxSkills} como máximo.
              </span>
            )}
          </>
        )}
        {skillError && <span className="field-error">{skillError}</span>}
      </div>
    </div>
  );
}
