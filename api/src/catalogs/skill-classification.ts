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

/**
 * Etiquetas demasiado genéricas para distinguir un área (V3 §9.4): aparecen en
 * casi cualquier tema de la carrera, así que harían coincidir todo con todo.
 */
export const GENERIC_AREA_TAGS = [
  'sistemas', 'sistema', 'tecnologia', 'tecnologias', 'informatica', 'ingenieria', 'software',
  'programacion', 'desarrollo', 'computacion', 'computadora', 'general', 'varios', 'otros', 'otro',
  'ti', 'it', 'tic', 'tics', 'digital', 'proyecto', 'proyectos', 'aplicacion', 'aplicaciones',
];

export interface AreaTagAnalysis {
  /** Etiquetas como quedarán guardadas. */
  tags: string[];
  /** Las que no distinguen nada. */
  generic: string[];
  /** Las que ya usa otra área, con cuáles. */
  shared: { tag: string; areas: { id: string; name: string }[] }[];
}

/**
 * Riesgos de un conjunto de etiquetas frente al catálogo (V3 §9.4). No
 * prohíbe nada: una etiqueta puede repetirse entre áreas; lo que se exige es
 * que el riesgo sea visible y se confirme.
 */
export function analyzeAreaTags(tags: string[], areas: AreaLike[], exceptId?: string): AreaTagAnalysis {
  const limpias = [...new Set(tags.map((t) => t.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean))];
  const otras = areas.filter((a) => a.id !== exceptId && a.isActive !== false);
  const shared = limpias
    .map((tag) => ({
      tag,
      areas: otras
        .filter((a) => (a.tags ?? []).some((t) => normalizeTerm(t) === normalizeTerm(tag)))
        .map((a) => ({ id: a.id, name: a.name })),
    }))
    .filter((s) => s.areas.length > 0);
  return {
    tags: limpias,
    generic: limpias.filter((t) => GENERIC_AREA_TAGS.includes(normalizeTerm(t))),
    shared,
  };
}

export interface Classification {
  /** `canonical`: regla dura; `suggested`: etiquetas o habilidades ya clasificadas; `none`. */
  rule: 'canonical' | 'suggested' | 'none';
  /** Áreas que la regla o la sugerencia aceptan. */
  areaIds: string[];
  areaNames: string[];
  reason: string | null;
}

/** Una habilidad ya clasificada del catálogo, para la sugerencia dinámica. */
export interface SkillLike {
  name: string;
  aliases: string[] | null;
  academicAreaId: string | null;
  isActive?: boolean;
}

/** Términos de un texto, por palabra (sin tildes, en minúsculas). */
function tokens(texto: string): string[] {
  return normalizeTerm(texto).split(/[\s/,()]+/).filter(Boolean);
}

/** ¿La secuencia `aguja` aparece completa y contigua dentro de `pajar`? */
function contiene(pajar: string[], aguja: string[]): boolean {
  if (aguja.length === 0 || aguja.length > pajar.length) return false;
  for (let i = 0; i + aguja.length <= pajar.length; i++) {
    if (aguja.every((t, j) => pajar[i + j] === t)) return true;
  }
  return false;
}

/**
 * Áreas sugeridas por las habilidades **ya clasificadas** del catálogo (V3 §9.3).
 *
 * Si el nombre nuevo contiene, como palabra completa, el nombre o un alias de
 * una habilidad existente («React Router» ⊃ «React», «PostgreSQL 16» ⊃
 * «PostgreSQL»), su área es una buena candidata. Es determinista y usa el
 * catálogo vigente: lo que el administrador clasificó ayer ya sirve hoy, sin
 * tocar código. Se exige al menos dos caracteres para no casar «C» con todo.
 */
export function suggestFromCatalog(
  terminos: string[],
  catalogo: SkillLike[],
): Map<string, string[]> {
  const nuevos = terminos.map(tokens).filter((t) => t.length > 0);
  const porArea = new Map<string, string[]>();
  for (const skill of catalogo) {
    if (skill.isActive === false || !skill.academicAreaId) continue;
    const conocidos = [skill.name, ...(skill.aliases ?? [])]
      .map(tokens)
      .filter((t) => t.join(' ').length >= 2);
    const coincide = nuevos.some((n) => conocidos.some((k) => contiene(n, k) || contiene(k, n)));
    if (!coincide) continue;
    const lista = porArea.get(skill.academicAreaId) ?? [];
    if (!lista.includes(skill.name)) lista.push(skill.name);
    porArea.set(skill.academicAreaId, lista);
  }
  return porArea;
}

/**
 * Clasifica una tecnología contra el catálogo (V2 §23.3, V3 §9.3).
 *
 * Orden: regla canónica (inequívoca) → sugerencia dinámica por etiquetas de
 * áreas **y** por habilidades ya clasificadas → nada. No depende solo de una
 * tabla fija: el catálogo actual participa en cada sugerencia.
 */
export function classifySkill(
  name: string,
  aliases: string[],
  areas: AreaLike[],
  catalogo: SkillLike[] = [],
): Classification {
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
  const porCatalogo = suggestFromCatalog([name, ...aliases], catalogo);
  const activasIds = new Set(activas.map((a) => a.id));
  const ids = [...new Set([...porEtiqueta.map((a) => a.id), ...[...porCatalogo.keys()].filter((id) => activasIds.has(id))])];
  if (ids.length > 0) {
    const nombre = (id: string) => activas.find((a) => a.id === id)!.name;
    const motivos: string[] = [];
    if (porEtiqueta.length > 0) motivos.push(`sus etiquetas (${porEtiqueta.map((a) => a.name).join(', ')})`);
    const similares = [...porCatalogo.entries()].filter(([id]) => activasIds.has(id));
    if (similares.length > 0) {
      motivos.push(
        `habilidades ya clasificadas (${similares.map(([id, ss]) => `${ss.slice(0, 3).join(', ')} en ${nombre(id)}`).join('; ')})`,
      );
    }
    return {
      rule: 'suggested',
      areaIds: ids,
      areaNames: ids.map(nombre),
      reason: `Por ${motivos.join(' y ')}, «${name}» parece de ${ids.map(nombre).join(' o ')}.`,
    };
  }
  return { rule: 'none', areaIds: [], areaNames: [], reason: null };
}
