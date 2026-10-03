import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiStar } from 'react-icons/fi';
import type { AcademicArea, Skill, SkillLevel } from '../services/types';
import { areaVisual } from '../lib/areaIcons';
import '../welcome.css';

/**
 * Lo que el estudiante declara de sí mismo: áreas, intereses y habilidades.
 *
 * Los mismos selectores en la bienvenida y en «Mi perfil», para que declarar
 * algo se vea y se sienta igual la primera vez y todas las siguientes.
 */

/** Tres niveles de interés en palabras; por dentro son las prioridades de §18. */
export const NIVEL_INTERES = [
  { prioridad: 1, label: 'Mucho' },
  { prioridad: 3, label: 'Bastante' },
  { prioridad: 5, label: 'Un poco' },
];

/** Una prioridad cualquiera (1-5) llevada al nivel en palabras más cercano. */
export function nivelDeInteres(prioridad: number): number {
  if (!prioridad) return 0;
  return prioridad <= 2 ? 1 : prioridad <= 4 ? 3 : 5;
}

export const NIVEL_SKILL: { value: SkillLevel; label: string }[] = [
  { value: 'basic', label: 'Básico' },
  { value: 'intermediate', label: 'Intermedio' },
  { value: 'advanced', label: 'Avanzado' },
];

export function AreaChooser({
  areas,
  value,
  onChange,
}: {
  areas: AcademicArea[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="wz-areas">
      {areas.map((a) => {
        const on = value.includes(a.id);
        const { icono: Icono, color } = areaVisual(a.name);
        return (
          <motion.button
            type="button"
            key={a.id}
            className={`wz-area ${on ? 'on' : ''}`}
            style={{ ['--c' as string]: color }}
            onClick={() => onChange(on ? value.filter((x) => x !== a.id) : [...value, a.id])}
            whileTap={{ scale: 0.97 }}
            aria-pressed={on}
          >
            <span className="ico"><Icono /></span>
            <span className="nm">{a.name}</span>
            <span className="chk">{on && <FiCheck size={13} />}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function InterestChooser({
  areas,
  value,
  onChange,
}: {
  areas: AcademicArea[];
  value: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
}) {
  return (
    <div className="wz-interests">
      {areas.map((a) => {
        const actual = nivelDeInteres(value[a.id] ?? 0);
        const { icono: Icono, color } = areaVisual(a.name);
        return (
          <div key={a.id} className={`wz-int ${actual ? 'on' : ''}`} style={{ ['--c' as string]: color }}>
            <span className="ico"><Icono /></span>
            <span className="nm">{a.name}</span>
            <div className="lv" role="group" aria-label={`Interés en ${a.name}`}>
              {NIVEL_INTERES.map((n) => (
                <button
                  type="button"
                  key={n.prioridad}
                  className={actual === n.prioridad ? 'on' : ''}
                  onClick={() => onChange({ ...value, [a.id]: actual === n.prioridad ? 0 : n.prioridad })}
                  aria-pressed={actual === n.prioridad}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SkillChooser({
  areas,
  skills,
  value,
  onChange,
  destacadas,
  alto = true,
}: {
  areas: AcademicArea[];
  skills: Skill[];
  value: Record<string, SkillLevel>;
  onChange: (v: Record<string, SkillLevel>) => void;
  /** Áreas cuyas habilidades se muestran primero. */
  destacadas: Set<string>;
  /** Con scroll propio (bienvenida) o a lo largo de la página (perfil). */
  alto?: boolean;
}) {
  const grupos = useMemo(() => {
    const porArea = new Map<string, Skill[]>();
    skills.forEach((s) => {
      const k = s.academicAreaId ?? 'sin-area';
      porArea.set(k, [...(porArea.get(k) ?? []), s]);
    });
    return [...porArea.entries()]
      .map(([areaId, lista]) => ({
        areaId,
        nombre: areas.find((a) => a.id === areaId)?.name ?? 'Otras',
        lista: [...lista].sort((a, b) => a.name.localeCompare(b.name)),
        destacada: destacadas.has(areaId),
      }))
      .sort((a, b) => Number(b.destacada) - Number(a.destacada) || a.nombre.localeCompare(b.nombre));
  }, [skills, areas, destacadas]);

  return (
    <div className="wz-skillgroups" style={alto ? undefined : { maxHeight: 'none', overflow: 'visible' }}>
      {grupos.map((g) => (
        <div key={g.areaId} className={`wz-group ${g.destacada ? 'mine' : ''}`}>
          <h4>
            {g.nombre}
            {g.destacada && <span className="tag"><FiStar size={11} /> de tus áreas</span>}
          </h4>
          <div className="wz-skills">
            {g.lista.map((s) => {
              const nivel = value[s.id];
              return (
                <div key={s.id} className={`wz-skill ${nivel ? 'on' : ''}`}>
                  <span className="nm">{s.name}</span>
                  <div className="lv">
                    {NIVEL_SKILL.map((n) => (
                      <button
                        type="button"
                        key={n.value}
                        className={nivel === n.value ? 'on' : ''}
                        onClick={() => {
                          const next = { ...value };
                          if (next[s.id] === n.value) delete next[s.id];
                          else next[s.id] = n.value;
                          onChange(next);
                        }}
                        aria-pressed={nivel === n.value}
                      >
                        {n.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
