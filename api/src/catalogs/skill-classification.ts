import { AREA_SYNONYMS, AreaTag } from '../onboarding/questionnaire';

/**
 * Validación semántica de la clasificación de habilidades (V2 §23.3).
 *
 * No basta con exigir un área: «React Native» guardada en «Desarrollo Web»
 * envenena recomendaciones, afinidad (§48) y equipos. Tres niveles:
 *
 * 1. **Reglas canónicas** para tecnologías inequívocas. Si el catálogo tiene el
 *    área que la regla indica y se intenta guardar en otra área conocida, se
 *    bloquea.
 * 2. **Sugerencia** para lo demás: el área cuyas etiquetas coinciden con el
 *    nombre o los alias. Guardar en otra exige confirmar con un motivo, que se
 *    audita.
 * 3. Sin regla ni coincidencia: se guarda donde el administrador diga.
 *
 * La IA puede sugerir, pero nunca crea una clasificación definitiva (§23.3):
 * esto es determinista.
 */
export const SKILL_CANONICAL_RULES: Record<string, AreaTag> = Object.fromEntries(
  (
    [
      ['desarrollo-movil', ['react native', 'flutter', 'kotlin', 'swift', 'swiftui', 'android', 'ios', 'ionic', 'xamarin', 'expo', 'jetpack compose']],
      ['desarrollo-web', ['react', 'react.js', 'reactjs', 'angular', 'vue', 'vue.js', 'next.js', 'nextjs', 'nuxt', 'svelte', 'html', 'css', 'html y css', 'tailwind css', 'bootstrap', 'django', 'laravel', 'express', 'nestjs', 'php']],
      ['datos', ['postgresql', 'mysql', 'mariadb', 'mongodb', 'sql server', 'oracle database', 'sqlite', 'redis', 'sql', 'power bi', 'tableau', 'cassandra']],
      ['inteligencia-artificial', ['tensorflow', 'pytorch', 'scikit-learn', 'keras', 'opencv', 'machine learning', 'deep learning', 'redes neuronales']],
      ['ciberseguridad', ['kali linux', 'wireshark', 'metasploit', 'burp suite', 'owasp', 'pentesting', 'nmap']],
      ['redes', ['cisco ios', 'packet tracer', 'tcp/ip', 'ccna', 'routing', 'ospf', 'bgp']],
      ['infraestructura', ['docker', 'kubernetes', 'aws', 'azure', 'google cloud', 'terraform', 'ansible', 'jenkins', 'ci/cd', 'github actions']],
      ['videojuegos', ['unity', 'unreal engine', 'godot']],
      ['sistemas-embebidos', ['arduino', 'raspberry pi', 'esp32', 'freertos']],
      ['gestion-proyectos', ['scrum', 'kanban', 'jira', 'trello']],
      ['diseno-ux', ['figma', 'adobe xd', 'sketch']],
    ] as [AreaTag, string[]][]
  ).flatMap(([tag, nombres]) => nombres.map((n) => [n, tag])),
);

export interface AreaLike {
  id: string;
  name: string;
  tags: string[] | null;
  isActive?: boolean;
}

export function normalizeTerm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** La etiqueta del cuestionario de un área (misma lógica que la orientación). */
export function tagOfArea(area: AreaLike): AreaTag | null {
  const todas = Object.keys(AREA_SYNONYMS) as AreaTag[];
  const sin = (t: AreaTag) => AREA_SYNONYMS[t].map(normalizeTerm);
  const etiquetas = (area.tags ?? []).map(normalizeTerm);
  const nombre = normalizeTerm(area.name);
  return (
    todas.find((t) => sin(t).some((s) => etiquetas.includes(s)))
    ?? todas.find((t) => sin(t).includes(nombre))
    ?? todas.find((t) => sin(t).some((s) => s.length >= 5 && nombre.includes(s)))
    ?? null
  );
}

export interface Classification {
  /** `canonical`: regla dura; `suggested`: coincidencia por etiquetas; `none`. */
  rule: 'canonical' | 'suggested' | 'none';
  /** Áreas que la regla o la sugerencia aceptan. */
  areaIds: string[];
  areaNames: string[];
  reason: string | null;
}

/** Clasifica una tecnología contra el catálogo de áreas activas. */
export function classifySkill(name: string, aliases: string[], areas: AreaLike[]): Classification {
  const activas = areas.filter((a) => a.isActive !== false);
  const terminos = [name, ...aliases].map(normalizeTerm).filter(Boolean);

  const canonica = terminos.map((t) => SKILL_CANONICAL_RULES[t]).find(Boolean);
  if (canonica) {
    const destino = activas.filter((a) => tagOfArea(a) === canonica);
    if (destino.length > 0) {
      return {
        rule: 'canonical',
        areaIds: destino.map((a) => a.id),
        areaNames: destino.map((a) => a.name),
        reason: `Según las reglas del catálogo, «${name}» pertenece a ${destino.map((a) => a.name).join(' o ')}.`,
      };
    }
  }

  const palabras = new Set(terminos.flatMap((t) => [t, ...t.split(/[ ./-]+/).filter((p) => p.length >= 3)]));
  const porEtiqueta = activas.filter((a) => (a.tags ?? []).some((tag) => palabras.has(normalizeTerm(tag))));
  if (porEtiqueta.length > 0) {
    return {
      rule: 'suggested',
      areaIds: porEtiqueta.map((a) => a.id),
      areaNames: porEtiqueta.map((a) => a.name),
      reason: `Por sus etiquetas, «${name}» parece de ${porEtiqueta.map((a) => a.name).join(' o ')}.`,
    };
  }
  return { rule: 'none', areaIds: [], areaNames: [], reason: null };
}
