import { createHash } from 'crypto';
import { AiTaskType, CvAssistMode } from '@perfil/shared';

/**
 * Lo que rodea a una llamada de IA y no depende del proveedor (V2 §43.3,
 * §43.4, §61.3): saneamiento, huella, instrucciones por tarea y validación de
 * la respuesta. Funciones puras, probadas sin red.
 */

/**
 * Quita lo que nunca debe salir hacia un proveedor externo (§43.4): correos,
 * teléfonos, tokens (JWT, `Bearer`, cadenas largas tipo clave) y parámetros
 * de URL. Luego normaliza espacios y recorta a `maxChars`.
 */
export function sanitizeForAi(text: string, maxChars: number): string {
  return (text ?? '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, '[token]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '[token]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[correo]')
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi, '$1')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[teléfono]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[clave]')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, Math.max(0, maxChars));
}

/** Huella de la entrada saneada (§43.3): reconoce pedidos iguales sin guardarlos. */
export function inputFingerprint(task: AiTaskType, input: string): string {
  return createHash('sha256').update(`${task}\n${input}`).digest('hex');
}

/** Primer objeto JSON de la respuesta, aunque venga envuelto en texto o en ```. */
export function parseJsonLoose(text: string): Record<string, unknown> | null {
  const limpio = text.replace(/```(?:json)?/gi, '');
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (inicio < 0 || fin <= inicio) return null;
  try {
    const v = JSON.parse(limpio.slice(inicio, fin + 1));
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const BASE =
  'Eres el asistente de Afinia, el sistema de perfil estudiantil de Ingeniería de Sistemas de la ' +
  'Universidad del Valle (Bolivia). Respondes en español neutro. Solo sugieres: no decides, no ' +
  'acreditas habilidades ni inventas datos. Responde únicamente con JSON válido, sin texto adicional.';

export const PROMPTS = {
  activityTags: (texto: string) => ({
    system: `${BASE} Formato: {"tags": ["..."]}, de 3 a 8 etiquetas cortas en minúsculas.`,
    user: `Propón etiquetas temáticas para esta actividad académica:\n${texto}`,
  }),
  skillArea: (habilidad: string, areas: string[]) => ({
    system: `${BASE} Formato: {"area": "<nombre exacto de la lista o null>", "reason": "..."}.`,
    user: `¿En cuál de estas áreas encaja mejor la tecnología «${habilidad}»? Áreas: ${areas.join(' | ')}. Si ninguna encaja, area = null.`,
  }),
  evidenceSummary: (texto: string) => ({
    system: `${BASE} Formato: {"summary": "..."} en 2 a 4 oraciones. Describe solo lo que está en la lista; no valores su autenticidad.`,
    user: `Resume las evidencias registradas de este proyecto:\n${texto}`,
  }),
  inconsistency: (texto: string) => ({
    system: `${BASE} Formato: {"explanation": "..."} en lenguaje sencillo, con qué revisar para corregirlo. No cambies ni cuestiones el resultado de las reglas.`,
    user: `Explica al estudiante estas observaciones automáticas de su proyecto:\n${texto}`,
  }),
  cv: (texto: string, modo: CvAssistMode) => ({
    system:
      `${BASE} Formato: {"texts": ["..."]}. Reglas estrictas: no inventes experiencia, cargos, ` +
      'empresas, certificaciones, fechas ni cifras; usa solo los hechos del texto; no cambies datos institucionales.',
    user: {
      [CvAssistMode.IMPROVE]: `Mejora la redacción de este texto de CV, conservando los hechos (1 versión):\n${texto}`,
      [CvAssistMode.SUMMARIZE]: `Resume este texto de CV en 2 o 3 oraciones (1 versión):\n${texto}`,
      [CvAssistMode.REORGANIZE]: `Reorganiza este texto de CV para que se lea mejor (1 versión):\n${texto}`,
      [CvAssistMode.ALTERNATIVES]: `Propón 3 redacciones alternativas de este texto de CV:\n${texto}`,
    }[modo],
  }),
  analytics: (cifras: string) => ({
    system: `${BASE} Formato: {"narrative": "..."} en 3 a 5 oraciones. Usa solo las cifras dadas, sin calcular ni inventar otras.`,
    user: `Redacta una lectura de estas tendencias agregadas de la carrera:\n${cifras}`,
  }),
  moderation: (nombre: string) => ({
    system:
      `${BASE} Formato: {"flagged": true|false, "reason": "...", "suggestion": "..."}. ` +
      'Marca flagged=true solo si el nombre es ofensivo, discriminatorio, sexual, violento o una burla a personas.',
    user: `Nombre de un equipo de estudiantes: «${nombre}»`,
  }),
};

const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

/** Números de dos o más cifras de un texto, para comparar contra la fuente. */
export function numbersIn(text: string): Set<string> {
  return new Set((text.match(/\d+(?:[.,]\d+)?/g) ?? []).filter((n) => n.replace(/\D/g, '').length >= 2));
}

/**
 * Validación determinista de lo que vuelve (§5.3): la respuesta se acepta solo
 * si tiene la forma esperada y no trae datos que la fuente no tenía.
 */
export const VALIDATE = {
  tags(raw: Record<string, unknown>): { tags: string[] } | null {
    const lista = Array.isArray(raw.tags) ? raw.tags : [];
    const tags = [...new Set(lista
      .map((t) => (typeof t === 'string' ? t.toLowerCase().trim().replace(/\s+/g, ' ') : ''))
      .filter((t) => t.length >= 2 && t.length <= 40 && /^[\p{L}\p{N} .+#/-]+$/u.test(t)))].slice(0, 8);
    return tags.length ? { tags } : null;
  },
  text(raw: Record<string, unknown>, key: string, max = 1200): string | null {
    return str(raw[key], max);
  },
  /** Cada alternativa se descarta si trae cifras que el original no tenía (§61.3). */
  cv(raw: Record<string, unknown>, original: string): { texts: string[]; discarded: number } | null {
    const fuente = numbersIn(original);
    const todas = (Array.isArray(raw.texts) ? raw.texts : [])
      .map((t) => str(t, 2000))
      .filter((t): t is string => !!t);
    const validas = todas.filter((t) => [...numbersIn(t)].every((n) => fuente.has(n))).slice(0, 3);
    return validas.length ? { texts: validas, discarded: todas.length - validas.length } : null;
  },
  /** La narrativa no puede citar cifras que no estén en los datos (§63). */
  narrative(raw: Record<string, unknown>, cifras: string): string | null {
    const texto = str(raw.narrative, 1500);
    if (!texto) return null;
    const fuente = numbersIn(cifras);
    return [...numbersIn(texto)].every((n) => fuente.has(n)) ? texto : null;
  },
  moderation(raw: Record<string, unknown>): { flagged: boolean; reason: string | null; suggestion: string | null } | null {
    if (typeof raw.flagged !== 'boolean') return null;
    return { flagged: raw.flagged, reason: str(raw.reason, 280), suggestion: str(raw.suggestion, 60) };
  },
};
