/**
 * Búsqueda de personas por nombre y apellidos (V7.1 §11 y §12.1).
 *
 * «Quispe, Ana», «ana quispe» y «Ána Quíspe» deben encontrar a la misma
 * persona: se comparan palabras normalizadas (sin tildes, en minúsculas, sin
 * comas ni guiones), en cualquier orden, contra «nombre apellidos». Cada
 * palabra se envía como parámetro: nunca se interpola el texto del usuario ni
 * se acepta una expresión regular suya. No usa extensiones de PostgreSQL.
 */

/** Mínimo de letras para sugerir personas: con menos no se enumera a nadie. */
export const MIN_LETRAS_NOMBRE = 2;
/** Palabras que se consideran como máximo (nombre compuesto + dos apellidos). */
const MAX_PALABRAS = 5;
/** Largo máximo de cada palabra. */
const MAX_LARGO_PALABRA = 40;

const CON_TILDE = 'áéíóúüñàèìòùâêîôûäëïöçÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÄËÏÖÇ';
const SIN_TILDE = 'aeiouunaeiouaeiouaeiocAEIOUUNAEIOUAEIOUAEIOC';

/** Texto en minúsculas, sin tildes y con un solo espacio entre palabras. */
export function normalizarNombre(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Las palabras que hay que encontrar. Vacío si, en total, tienen menos de
 * {@link MIN_LETRAS_NOMBRE} caracteres: así una sola letra no lista a nadie.
 */
export function palabrasDeNombre(texto: string | null | undefined): string[] {
  const normal = normalizarNombre(String(texto ?? '').slice(0, 120));
  if (!normal) return [];
  const palabras = [...new Set(normal.split(' ').filter(Boolean).map((p) => p.slice(0, MAX_LARGO_PALABRA)))].slice(0, MAX_PALABRAS);
  const letras = palabras.reduce((n, p) => n + p.length, 0);
  return letras >= MIN_LETRAS_NOMBRE ? palabras : [];
}

/** «nombre apellidos» normalizado en SQL, para el alias de la tabla `users`. */
export function nombreNormalizadoSql(aliasUsuario: string): string {
  return `lower(translate(${aliasUsuario}.first_name || ' ' || ${aliasUsuario}.last_name, '${CON_TILDE}', '${SIN_TILDE}'))`;
}

/**
 * Condición «todas las palabras aparecen en el nombre», con parámetros con
 * nombre para TypeORM (`:prefijo0`, `:prefijo1`…). Las palabras solo tienen
 * letras y dígitos, así que no llevan comodines de LIKE.
 */
export function condicionDeNombre(
  aliasUsuario: string,
  palabras: string[],
  prefijo = 'nombre',
): { sql: string; params: Record<string, string> } {
  const columna = nombreNormalizadoSql(aliasUsuario);
  const params: Record<string, string> = {};
  const partes = palabras.map((p, i) => {
    params[`${prefijo}${i}`] = `%${p}%`;
    return `${columna} LIKE :${prefijo}${i}`;
  });
  return { sql: partes.length ? `(${partes.join(' AND ')})` : 'TRUE', params };
}
