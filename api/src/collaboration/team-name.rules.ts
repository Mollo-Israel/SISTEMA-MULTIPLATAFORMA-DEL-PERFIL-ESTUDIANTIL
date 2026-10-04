/**
 * Primera barrera de moderación de nombres de equipo (especificación V2 §44).
 *
 * Reglas deterministas: longitud, caracteres, nada de enlaces, correos ni
 * teléfonos, y una lista de términos prohibidos (la base más la configurable
 * en `TEAM_NAME_FORBIDDEN_TERMS`). La IA, si está configurada, solo se consulta
 * después y solo para lo ambiguo: §44 dice «no depender exclusivamente de IA».
 *
 * Funciones puras: se prueban sin base de datos ni servidor.
 */

export const TEAM_NAME_MIN = 3;
export const TEAM_NAME_MAX = 60;

/**
 * Base mínima. Se compara por palabra completa, no por subcadena: «puta» no
 * puede bloquear «Computación».
 */
export const BASE_FORBIDDEN_TERMS = [
  'puta', 'puto', 'putas', 'putos', 'mierda', 'pendejo', 'pendeja', 'cabron', 'cabrona',
  'verga', 'marica', 'maricon', 'idiota', 'idiotas', 'estupido', 'estupida', 'imbecil',
  'culero', 'culo', 'joder', 'carajo', 'huevon', 'zorra', 'perra',
  'fuck', 'shit', 'bitch', 'asshole', 'nazi', 'nazis', 'hitler',
];

export type TeamNameCheck =
  | { ok: true; name: string }
  | { ok: false; code: TeamNameRejection; message: string };

export type TeamNameRejection =
  | 'TEAM_NAME_LENGTH'
  | 'TEAM_NAME_CHARACTERS'
  | 'TEAM_NAME_CONTACT'
  | 'TEAM_NAME_REPEATED'
  | 'TEAM_NAME_FORBIDDEN';

const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '8': 'b',
};

/** Una palabra reducida a lo que se lee: sin tildes, sin «leet», sin letras repetidas. */
export function normalizeWord(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[0-9!@$]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-zñ]/g, '')
    .replace(/(.)\1+/g, '$1');
}

/** Lista de términos prohibidos: la base más la del entorno, normalizadas. */
export function forbiddenTerms(extra: string | undefined | null): string[] {
  const propios = (extra ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const todos = [...BASE_FORBIDDEN_TERMS, ...propios]
    .flatMap((t) => t.split(/\s+/).length > 1 ? [t.split(/\s+/).map(normalizeWord).join(' ')] : [normalizeWord(t)])
    .filter(Boolean);
  return [...new Set(todos)];
}

/** Palabras del nombre ya normalizadas, uniendo letras sueltas («p u t a»). */
function palabras(name: string): string[] {
  const crudas = name.split(/[\s\-_.]+/).filter(Boolean);
  const salida: string[] = [];
  let sueltas = '';
  for (const c of crudas) {
    const n = normalizeWord(c);
    if (n.length === 1) {
      sueltas += n;
      continue;
    }
    if (sueltas) salida.push(sueltas.replace(/(.)\1+/g, '$1'));
    sueltas = '';
    if (n) salida.push(n);
  }
  if (sueltas) salida.push(sueltas.replace(/(.)\1+/g, '$1'));
  return salida;
}

export function checkTeamName(raw: string, terms: string[]): TeamNameCheck {
  const name = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < TEAM_NAME_MIN || name.length > TEAM_NAME_MAX) {
    return {
      ok: false,
      code: 'TEAM_NAME_LENGTH',
      message: `El nombre del equipo debe tener entre ${TEAM_NAME_MIN} y ${TEAM_NAME_MAX} caracteres.`,
    };
  }
  // El dominio se busca en minúsculas pegado a una palabra («equipo.com»):
  // «.NET» o «ASP.NET» son nombres técnicos, no enlaces (§23.4).
  if (
    /https?:|www\.|@|(\d[\s-]?){7,}/i.test(name)
    || /[a-z0-9-]\.(com|net|org|io|bo|xyz|me|info|app|dev)\b/.test(name)
  ) {
    return {
      ok: false,
      code: 'TEAM_NAME_CONTACT',
      message: 'El nombre del equipo no puede llevar enlaces, correos ni teléfonos.',
    };
  }
  if (!/^[\p{L}\p{N} .\-_&'+#()]+$/u.test(name) || (name.match(/\p{L}/gu) ?? []).length < 2) {
    return {
      ok: false,
      code: 'TEAM_NAME_CHARACTERS',
      message: 'Usa letras, números, espacios y los signos . - _ & \' + # ( ). Debe tener al menos dos letras.',
    };
  }
  if (/(.)\1{4,}/u.test(name)) {
    return {
      ok: false,
      code: 'TEAM_NAME_REPEATED',
      message: 'El nombre del equipo no puede repetir el mismo carácter tantas veces.',
    };
  }
  const ws = palabras(name);
  const frase = ws.join(' ');
  const prohibido = terms.find((t) =>
    t.includes(' ')
      ? ` ${frase} `.includes(` ${t} `)
      // También en plural: «pendejos», «idiotas».
      : ws.some((w) => w === t || w === `${t}s` || w === `${t}es`) || ws.join('') === t,
  );
  if (prohibido) {
    return {
      ok: false,
      code: 'TEAM_NAME_FORBIDDEN',
      message: 'Ese nombre no es apropiado para un equipo de la carrera. Elige otro.',
    };
  }
  return { ok: true, name };
}
