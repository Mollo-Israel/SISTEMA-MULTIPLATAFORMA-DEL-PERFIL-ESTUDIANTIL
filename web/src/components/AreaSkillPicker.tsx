import { useMemo, useState } from 'react';
import type { AcademicArea, Skill } from '../services/types';
import { useConfirm } from './feedback';

/** Normaliza para buscar sin tildes ni mayúsculas. */
const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface AreaSkillValue {
  areaIds: string[];
  skillIds: string[];
  /**
   * V3.2 §11.4: área en la que se usa cada habilidad (skillId → areaId).
   * Importa cuando una habilidad pertenece a varias de las áreas elegidas
   * (Python: IA y Desarrollo Web); si falta, vale su área principal.
   */
  contexts?: Record<string, string>;
}

/**
 * Selección relacional área → habilidades (V3 §4, §21.2).
 *
 * Primero se eligen las áreas; después solo se ofrecen las habilidades de esas
 * áreas, agrupadas por área. Quitar un área quita también sus habilidades, así
 * nunca queda guardada una habilidad de un área no elegida (el servidor lo
 * exige igual). Se guardan IDs reales, nunca texto libre.
 *
 * V3.2 §11.3: bajo cada área van sus habilidades y, aparte, las que la tienen
 * como secundaria («Relacionadas con esta área»).
 *
 * V3.2 §11.4: si una habilidad aparece en dos áreas elegidas, queda marcada
 * en una sola —la de su contexto— y pulsarla en la otra la cambia de área.
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
  confirmarQuitar = false,
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
  /**
   * V5 §11.2 (F10): pedir confirmación antes de quitar un área que se lleva
   * tecnologías, y avisar cuando un área se queda sin ninguna (sin quitarla).
   */
  confirmarQuitar?: boolean;
}) {
  const confirm = useConfirm();
  const [sinTecnologias, setSinTecnologias] = useState<string | null>(null);
  const [buscar, setBuscar] = useState('');
  const [buscarArea, setBuscarArea] = useState('');
  const activas = useMemo(() => areas.filter((a) => a.isActive !== false), [areas]);
  // V3.2 §6.3: con más de 10 áreas no se despliegan todas: las elegidas y,
  // de las demás, las que coinciden con la búsqueda (hasta 12).
  const MAX_AREAS_VISIBLES = 12;
  const muchas = activas.length > 10;
  const areasVisibles = useMemo(() => {
    if (!muchas) return activas;
    const q = norm(buscarArea.trim());
    const elegidas = activas.filter((a) => value.areaIds.includes(a.id));
    const resto = activas
      .filter((a) => !value.areaIds.includes(a.id))
      .filter((a) => !q || norm(a.name).includes(q) || (a.tags ?? []).some((t) => norm(t).includes(q)));
    return [...elegidas, ...resto.slice(0, MAX_AREAS_VISIBLES)];
  }, [activas, muchas, buscarArea, value.areaIds]);
  const ocultas = muchas ? activas.length - areasVisibles.length : 0;

  const grupos = useMemo(() => {
    const q = norm(buscar.trim());
    return value.areaIds
      .map((id) => activas.find((a) => a.id === id))
      .filter((a): a is AcademicArea => !!a)
      .map((area) => {
        const vigentes = skills
          .filter((s) => s.isActive !== false)
          .filter((s) => !q || norm(s.name).includes(q) || (s.aliases ?? []).some((al) => norm(al).includes(q)))
          .sort((a, b) => a.name.localeCompare(b.name));
        return {
          area,
          skills: vigentes.filter((s) => s.academicAreaId === area.id),
          relacionadas: vigentes.filter((s) => s.academicAreaId !== area.id && (s.secondaryAreaIds ?? []).includes(area.id)),
        };
      });
  }, [value.areaIds, activas, skills, buscar]);

  const alternarArea = async (id: string) => {
    if (value.areaIds.includes(id)) {
      const quedan = value.areaIds.filter((x) => x !== id);
      // Se queda solo lo que todavía pertenece (principal o secundaria) a un área elegida.
      const sigue = (s: Skill) =>
        (!!s.academicAreaId && quedan.includes(s.academicAreaId)) || (s.secondaryAreaIds ?? []).some((a) => quedan.includes(a));
      const vigentes = new Set(skills.filter(sigue).map((s) => s.id));
      const seVan = value.skillIds.filter((s) => !vigentes.has(s));
      if (confirmarQuitar && seVan.length > 0) {
        const nombres = skills.filter((s) => seVan.includes(s.id)).map((s) => s.name);
        const ok = await confirm({
          title: `Quitar «${activas.find((a) => a.id === id)?.name ?? 'el área'}»`,
          message: `También se quita${nombres.length === 1 ? '' : 'n'} ${nombres.join(', ')}, que solo ${nombres.length === 1 ? 'pertenece' : 'pertenecen'} a esta área.`,
          confirmLabel: 'Quitar área y tecnologías',
          tone: 'danger',
        });
        if (!ok) return;
      }
      if (sinTecnologias === id) setSinTecnologias(null);
      onChange({ areaIds: quedan, skillIds: value.skillIds.filter((s) => vigentes.has(s)) });
    } else if (value.areaIds.length < maxAreas) {
      onChange({ ...value, areaIds: [...value.areaIds, id] });
    }
  };

  /** Áreas elegidas a las que pertenece la habilidad (principal o secundaria). */
  const areasDe = (s: Skill) =>
    value.areaIds.filter((a) => s.academicAreaId === a || (s.secondaryAreaIds ?? []).includes(a));

  /** Área de contexto: la indicada si sigue valiendo; si no, la principal o la primera secundaria. */
  const contextoDe = (s: Skill): string | null => {
    const posibles = areasDe(s);
    const pedido = value.contexts?.[s.id];
    if (pedido && posibles.includes(pedido)) return pedido;
    if (s.academicAreaId && posibles.includes(s.academicAreaId)) return s.academicAreaId;
    return posibles[0] ?? null;
  };

  const alternarSkill = (s: Skill, areaId: string) => {
    const id = s.id;
    const elegida = value.skillIds.includes(id);
    const contextos = { ...(value.contexts ?? {}) };
    if (elegida && contextoDe(s) !== areaId) {
      // Ya estaba elegida en otra área: se cambia su contexto, no se quita.
      contextos[id] = areaId;
      onChange({ ...value, contexts: contextos });
      return;
    }
    if (elegida) {
      delete contextos[id];
      const restantes = value.skillIds.filter((x) => x !== id);
      // F10: el área se queda sin tecnologías; se avisa y no se quita sola.
      if (confirmarQuitar && !restantes.some((x) => {
        const otra = skills.find((k) => k.id === x);
        return !!otra && contextoDe(otra) === areaId;
      })) setSinTecnologias(areaId);
      onChange({ ...value, skillIds: restantes, contexts: contextos });
    } else if (value.skillIds.length < maxSkills) {
      contextos[id] = areaId;
      if (sinTecnologias === areaId) setSinTecnologias(null);
      onChange({ ...value, skillIds: [...value.skillIds, id], contexts: contextos });
    }
  };

  const totalVisibles = grupos.reduce((n, g) => n + g.skills.length + g.relacionadas.length, 0);

  const chip = (s: Skill, areaId: string) => {
    const elegida = value.skillIds.includes(s.id);
    const on = elegida && contextoDe(s) === areaId;
    const enOtra = elegida && !on;
    const otra = enOtra ? activas.find((a) => a.id === contextoDe(s))?.name : null;
    return (
      <button
        type="button"
        key={s.id}
        className={`chip ${on ? 'on' : ''} ${enOtra ? 'chip-otra' : ''}`}
        aria-pressed={on}
        title={enOtra ? `Elegida en «${otra}». Pulsa para usarla en esta área.` : undefined}
        onClick={() => alternarSkill(s, areaId)}
      >
        {s.name}
        {enOtra && <span className="sr-only"> (elegida en {otra})</span>}
      </button>
    );
  };

  return (
    <div className="area-skill-picker">
      <div className="field">
        <span className="field-label">{areaLabel}</span>
        {muchas && (
          <input
            type="search"
            value={buscarArea}
            onChange={(e) => setBuscarArea(e.target.value)}
            placeholder="Buscar área…"
            aria-label="Buscar área"
            style={{ marginBottom: '0.45rem' }}
          />
        )}
        <div className="chip-row" role="group" aria-label={areaLabel}>
          {areasVisibles.map((a) => {
            const on = value.areaIds.includes(a.id);
            return (
              <button
                type="button"
                key={a.id}
                className={`chip ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => void alternarArea(a.id)}
              >
                {a.name}
              </button>
            );
          })}
        </div>
        {ocultas > 0 && (
          <span className="muted small">
            {buscarArea.trim()
              ? `${ocultas} área(s) más no coinciden o no se muestran: afina la búsqueda.`
              : `Hay ${ocultas} área(s) más: escribe para buscarlas.`}
          </span>
        )}
        {areaError && <span className="field-error">{areaError}</span>}
      </div>

      <div className="field">
        <span className="field-label">{skillLabel}</span>
        {value.areaIds.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            Elige al menos un área para ver sus habilidades.
          </p>
        ) : (
          <>
            {totalVisibles > 12 || buscar ? (
              <input
                type="search"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Buscar habilidad…"
                aria-label="Buscar habilidad"
                style={{ marginBottom: '0.5rem' }}
              />
            ) : null}
            {grupos.map(({ area, skills: delArea, relacionadas }) => (
              <div key={area.id} className="skill-group">
                <div className="skill-group-title">{area.name}</div>
                {sinTecnologias === area.id && (
                  <p className="notice notice-warn small" role="status" data-testid="area-sin-tecnologias">
                    «{area.name}» se quedó sin tecnologías. Puedes mantenerla o quitarla; no se quita sola.
                    {' '}<button type="button" className="link-button" onClick={() => void alternarArea(area.id)}>Quitar el área</button>
                    {' · '}<button type="button" className="link-button" onClick={() => setSinTecnologias(null)}>Mantenerla</button>
                  </p>
                )}
                {delArea.length === 0 && relacionadas.length === 0 ? (
                  <p className="muted small" style={{ margin: '0 0 0.4rem' }}>
                    {buscar ? 'Ninguna coincide con la búsqueda.' : 'Esta área todavía no tiene habilidades en el catálogo.'}
                  </p>
                ) : (
                  <>
                    {delArea.length > 0 && <div className="chip-row">{delArea.map((s) => chip(s, area.id))}</div>}
                    {relacionadas.length > 0 && (
                      <>
                        <div className="muted small" style={{ margin: '0.35rem 0 0.2rem' }}>Relacionadas con esta área</div>
                        <div className="chip-row">{relacionadas.map((s) => chip(s, area.id))}</div>
                      </>
                    )}
                  </>
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
