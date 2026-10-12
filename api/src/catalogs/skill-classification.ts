/**
 * Sugeridor de área para una habilidad nueva (V3.2 §10.5).
 *
 * Analiza el catálogo vigente —no una tabla fija en el código— con una
 * prioridad estricta:
 *
 * 1. Coincidencia **exacta** con el nombre o un alias de una habilidad ya
 *    clasificada («aws» → la habilidad AWS → su área).
 * 2. Coincidencia **exacta** con una etiqueta de área («machine learning»).
 * 3. Relación con habilidades ya clasificadas: el nombre nuevo contiene, como
 *    palabras completas, el de una existente («React Router» ⊃ «React»).
 * 4. Coincidencia semántica débil: comparte una palabra significativa con las
 *    etiquetas o el nombre de un área («Cloud Functions» ~ «cloud»).
 * 5. Sin confianza: no se sugiere nada.
 *
 * Nunca hay coincidencia por subcadena bruta: «aws» no está «dentro» de nada,
 * y un término corto («C», «R», «JS», «AS») solo coincide completo. Las
 * etiquetas solo ayudan a clasificar: no puntúan ni alimentan la afinidad
 * (§10.3, §12.1). La IA puede sugerir, pero esto es determinista y el
 * administrador decide (§10.6).
 */

export interface AreaLike {
  id: string;
  name: string;
  tags: string[] | null;
  description?: string | null;
  isActive?: boolean;
}

/** Una habilidad ya clasificada del catálogo. */
export interface SkillLike {
  name: string;
  aliases: string[] | null;
  academicAreaId: string | null;
  /** V3.2 §11: áreas secundarias de la habilidad. */
  secondaryAreaIds?: string[] | null;
  isActive?: boolean;
}

export type ClassificationRule = 'exact_skill' | 'area_tag' | 'related_skill' | 'weak' | 'none';

export interface Classification {
  /** Qué nivel de la prioridad de §10.5 produjo la sugerencia. */
  rule: ClassificationRule;
  /** `high` y `medium` exigen motivo para guardar en otra área; `low` solo orienta. */
  confidence: 'high' | 'medium' | 'low' | 'none';
  /** Áreas sugeridas (activas). */
  areaIds: string[];
  areaNames: string[];
  reason: string | null;
}

export function normalizeTerm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Por debajo de esto, un término solo coincide completo (§10.5: «C», «R», «JS», «AS»). */
const MIN_PARCIAL = 3;

/** Palabras que no distinguen un área: no cuentan para la coincidencia débil. */
const VACIAS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 'en', 'para', 'con', 'por', 'a', 'al',
  'the', 'and', 'of', 'for', 'to', 'in', 'on', 'with',
]);

/**
 * Etiquetas demasiado genéricas para distinguir un área (V3 §9.4): aparecen en
 * casi cualquier tema de la carrera, así que harían coincidir todo con todo.
 */
export const GENERIC_AREA_TAGS = [
  'sistemas', 'sistema', 'tecnologia', 'tecnologias', 'informatica', 'ingenieria', 'software',
  'programacion', 'desarrollo', 'computacion', 'computadora', 'general', 'varios', 'otros', 'otro',
  'ti', 'it', 'tic', 'tics', 'digital', 'proyecto', 'proyectos', 'aplicacion', 'aplicaciones',
];

/** Palabras de un término (sin tildes, en minúsculas). */
function palabras(texto: string): string[] {
  return normalizeTerm(texto).split(/[\s/,()]+/).filter(Boolean);
}

/** ¿La secuencia `aguja` aparece completa y contigua dentro de `pajar`? */
function contiene(pajar: string[], aguja: string[]): boolean {
  if (aguja.length === 0 || aguja.length >= pajar.length) return false;
  for (let i = 0; i + aguja.length <= pajar.length; i++) {
    if (aguja.every((t, j) => pajar[i + j] === t)) return true;
  }
  return false;
}

/** Áreas de una habilidad: la principal y, si hay, las secundarias. */
function areasDe(skill: SkillLike): string[] {
  return [skill.academicAreaId, ...(skill.secondaryAreaIds ?? [])].filter((a): a is string => !!a);
}

export interface AreaTagAnalysis {
  /** Etiquetas como quedarán guardadas. */
  tags: string[];
  /** Las que no distinguen nada. */
  generic: string[];
  /** Las que ya usa otra área, con cuáles. */
  shared: { tag: string; areas: { id: string; name: string }[] }[];
  /** V3.2 §10.6: las que repiten una habilidad del catálogo (eso es una skill, no una etiqueta). */
  skillDuplicates: { tag: string; skill: string }[];
}

/**
 * Riesgos de un conjunto de etiquetas frente al catálogo (V3 §9.4, V3.2
 * §10.6). No prohíbe nada: lo que se exige es que el riesgo sea visible y que
 * el administrador decida.
 */
export function analyzeAreaTags(
  tags: string[],
  areas: AreaLike[],
  exceptId?: string,
  skills: SkillLike[] = [],
): AreaTagAnalysis {
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
  const nombres = new Map<string, string>();
  for (const s of skills) {
    if (s.isActive === false) continue;
    for (const n of [s.name, ...(s.aliases ?? [])]) nombres.set(normalizeTerm(n), s.name);
  }
  return {
    tags: limpias,
    generic: limpias.filter((t) => GENERIC_AREA_TAGS.includes(normalizeTerm(t))),
    shared,
    skillDuplicates: limpias
      .filter((t) => nombres.has(normalizeTerm(t)))
      .map((t) => ({ tag: t, skill: nombres.get(normalizeTerm(t))! })),
  };
}

/**
 * Clasifica una tecnología contra el catálogo vigente (V3.2 §10.5).
 */
export function classifySkill(
  name: string,
  aliases: string[],
  areas: AreaLike[],
  catalogo: SkillLike[] = [],
): Classification {
  const activas = areas.filter((a) => a.isActive !== false);
  const activasIds = new Set(activas.map((a) => a.id));
  const nombreDe = (id: string) => activas.find((a) => a.id === id)!.name;
  const terminos = [...new Set([name, ...aliases].map(normalizeTerm).filter(Boolean))];
  const habilidades = catalogo.filter((s) => s.isActive !== false && s.academicAreaId);

  const resultado = (
    rule: ClassificationRule,
    confidence: Classification['confidence'],
    ids: string[],
    reason: (nombres: string) => string,
  ): Classification => {
    const validos = [...new Set(ids)].filter((id) => activasIds.has(id));
    if (validos.length === 0) return { rule: 'none', confidence: 'none', areaIds: [], areaNames: [], reason: null };
    const nombres = validos.map(nombreDe);
    return { rule, confidence, areaIds: validos, areaNames: nombres, reason: reason(nombres.join(' o ')) };
  };

  // 1 · Coincidencia exacta con una habilidad o un alias existente.
  const exactas = habilidades.filter((s) =>
    [s.name, ...(s.aliases ?? [])].some((n) => terminos.includes(normalizeTerm(n))));
  if (exactas.length > 0) {
    const r = resultado('exact_skill', 'high', exactas.map((s) => s.academicAreaId!), (areasTxt) =>
      `«${name}» coincide con la habilidad ${exactas.map((s) => `«${s.name}»`).join(', ')} del catálogo, que está en ${areasTxt}.`);
    if (r.rule !== 'none') return r;
  }

  // 2 · Coincidencia exacta con una etiqueta de área: la etiqueta completa, o
  //     sus palabras completas dentro del nombre («machine learning ops»). Una
  //     etiqueta corta solo vale si es el término entero.
  const nuevos = terminos.map(palabras);
  const casaEtiqueta = (tag: string) => {
    const t = palabras(tag);
    if (t.length === 0) return false;
    if (terminos.includes(t.join(' '))) return true;
    return t.join(' ').length >= MIN_PARCIAL && nuevos.some((n) => contiene(n, t));
  };
  const porEtiqueta = activas.filter((a) => (a.tags ?? []).some(casaEtiqueta));
  if (porEtiqueta.length > 0) {
    return resultado('area_tag', 'medium', porEtiqueta.map((a) => a.id), (areasTxt) =>
      `«${name}» es una etiqueta de ${areasTxt}.`);
  }

  // 3 · Relación con habilidades ya clasificadas, por palabras completas.
  // Cuántas palabras comparte la mejor coincidencia de cada habilidad: gana
  // la más específica («React Native Kit» es de «React Native», no de «React»).
  const largo = (s: SkillLike): number => {
    const conocidos = [s.name, ...(s.aliases ?? [])].map(palabras);
    let mejor = 0;
    for (const n of nuevos) {
      for (const k of conocidos) {
        if (k.join(' ').length >= MIN_PARCIAL && contiene(n, k)) mejor = Math.max(mejor, k.length);
        if (n.join(' ').length >= MIN_PARCIAL && contiene(k, n)) mejor = Math.max(mejor, n.length);
      }
    }
    return mejor;
  };
  const medidas = habilidades.map((s) => ({ s, n: largo(s) })).filter((x) => x.n > 0);
  const maximo = Math.max(0, ...medidas.map((x) => x.n));
  const relacionadas = medidas.filter((x) => x.n === maximo).map((x) => x.s);
  if (relacionadas.length > 0) {
    const porArea = new Map<string, string[]>();
    for (const s of relacionadas) {
      for (const a of areasDe(s).slice(0, 1)) porArea.set(a, [...(porArea.get(a) ?? []), s.name]);
    }
    return resultado('related_skill', 'medium', [...porArea.keys()], (areasTxt) =>
      `«${name}» se relaciona con ${[...porArea.values()].flat().slice(0, 3).map((n) => `«${n}»`).join(', ')}, de ${areasTxt}.`);
  }

  // 4 · Coincidencia semántica débil: una palabra significativa en común.
  const significativas = new Set(
    nuevos.flat().filter((p) => p.length >= 4 && !VACIAS.has(p) && !GENERIC_AREA_TAGS.includes(p)),
  );
  if (significativas.size > 0) {
    const puntaje = activas
      .map((a) => {
        const vocabulario = new Set(
          [a.name, ...(a.tags ?? [])].flatMap(palabras).filter((p) => p.length >= 4 && !VACIAS.has(p)),
        );
        return { a, n: [...significativas].filter((p) => vocabulario.has(p)).length };
      })
      .filter((x) => x.n > 0);
    const mejor = Math.max(0, ...puntaje.map((x) => x.n));
    const ganadoras = puntaje.filter((x) => x.n === mejor).map((x) => x.a.id);
    // Con más de dos empatadas no hay señal: mejor no sugerir.
    if (ganadoras.length > 0 && ganadoras.length <= 2) {
      return resultado('weak', 'low', ganadoras, (areasTxt) =>
        `Por el vocabulario del área, «${name}» podría ser de ${areasTxt}. Es una sugerencia débil: confirma tú.`);
    }
  }

  // 5 · Sin confianza.
  return { rule: 'none', confidence: 'none', areaIds: [], areaNames: [], reason: null };
}
