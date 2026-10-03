/**
 * Validaciones de formulario, copia de las del servidor.
 *
 * Aquí sirven para avisar mientras se escribe y para poner cada error debajo
 * de su casilla; quien decide sigue siendo la API. Si alguna vez discrepan,
 * manda la API, y el mensaje que devuelve aparece en el mismo sitio.
 *
 * Cada validador devuelve el mensaje de error, o `null` si el valor sirve.
 */

const LETRA = 'A-Za-zÀ-ÖØ-öø-ÿ';
const LETRAS_RE = new RegExp(`[${LETRA}]`, 'g');

const contarLetras = (v: string) => (v.match(LETRAS_RE) ?? []).length;

export type Validator = (value: string) => string | null;

/** Nombres y apellidos de personas: letras, espacio, apóstrofo y guion. */
export const PERSON_NAME_RE = new RegExp(`^[${LETRA}]+(?:[ '-][${LETRA}]+)*$`);

/**
 * Nombre de área académica, categoría o criterio.
 *
 * Empieza por letra, tiene al menos tres letras, y entre palabras admite
 * espacio y los signos de un título («Industria 4.0», «IoT y Sistemas
 * Embebidos», «Gestión de Proyectos (PMI)»). Rechaza «#!@#!@#» y «123213».
 */
export const CATALOG_NAME_RE = new RegExp(
  `^[${LETRA}]+(?:[ .,/&'()-]+[${LETRA}0-9]+)*\\)?$`,
);

/**
 * Nombre de habilidad o tecnología.
 *
 * Más permisivo que un área, porque las tecnologías tienen nombres raros:
 * «C++», «C#», «.NET», «Node.js», «UI/UX», «3ds Max». Pero exige al menos una
 * letra y que los signos vayan entre palabras, no sueltos.
 */
export const SKILL_NAME_RE = new RegExp(
  `^\\.?[${LETRA}0-9]+(?:[ ./&'()-]+[${LETRA}0-9]+)*\\)?(?:\\+\\+|#)?$`,
);

/** Etiqueta del motor: minúsculas, números y los signos de una tecnología. */
export const TAG_RE = /^[a-z0-9áéíóúüñ][a-z0-9áéíóúüñ .+#-]{0,39}$/;

/** Código interno: minúsculas, números y guion bajo, empezando por letra. */
export const CODE_RE = /^[a-z][a-z0-9_]{2,59}$/;

export const INSTITUTIONAL_EMAIL_RE = /^[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)*univalle\.edu$/i;

export const UNIVERSITY_CODE_RE = /^[A-Za-z0-9._-]{3,30}$/;

const limpio = (v: string) => v.replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------

export const required =
  (mensaje = 'Este campo es obligatorio.'): Validator =>
  (v) =>
    limpio(v ?? '').length === 0 ? mensaje : null;

export function personName(campo: 'nombre' | 'apellido'): Validator {
  return (v) => {
    const t = limpio(v ?? '');
    if (!t) return campo === 'nombre' ? 'Escribe al menos un nombre.' : 'Escribe al menos un apellido.';
    if (t.length < 2) return 'Debe tener al menos 2 letras.';
    if (t.length > 50) return 'No puede superar 50 caracteres.';
    if (/\d/.test(t)) return 'No puede contener números.';
    if (!PERSON_NAME_RE.test(t)) return 'Solo letras, espacios, apóstrofo o guion.';
    return null;
  };
}

export const institutionalEmail: Validator = (v) => {
  const t = (v ?? '').trim().toLowerCase();
  if (!t) return 'Escribe el correo institucional.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return 'El correo no tiene un formato válido.';
  if (!INSTITUTIONAL_EMAIL_RE.test(t)) return 'Debe terminar en @univalle.edu o @est.univalle.edu.';
  return null;
};

export function catalogName(que: string, max = 120): Validator {
  return (v) => {
    const t = limpio(v ?? '');
    if (!t) return `Escribe el nombre ${que}.`;
    if (t.length < 3) return 'Debe tener al menos 3 caracteres.';
    if (t.length > max) return `No puede superar ${max} caracteres.`;
    if (/^[\d\s.,-]+$/.test(t)) return 'No puede ser solo números.';
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ]/.test(t)) return 'Debe empezar por una letra.';
    if (contarLetras(t) < 3) return 'Debe contener al menos 3 letras.';
    if (!CATALOG_NAME_RE.test(t)) {
      return 'Solo letras, números, espacios y signos de puntuación entre palabras (sin símbolos sueltos).';
    }
    return null;
  };
}

export const skillName: Validator = (v) => {
  const t = limpio(v ?? '');
  if (!t) return 'Escribe el nombre de la habilidad.';
  if (t.length > 120) return 'No puede superar 120 caracteres.';
  if (contarLetras(t) === 0) return 'Debe contener letras: no puede ser solo números o símbolos.';
  if (!SKILL_NAME_RE.test(t)) {
    return 'Use el nombre de la tecnología (p. ej. «React», «C#», «Node.js»): sin símbolos sueltos.';
  }
  return null;
};

/** Lista de etiquetas separadas por coma. */
export function tagList({ min = 1, max = 20 } = {}): Validator {
  return (v) => {
    const tags = parseTags(v ?? '');
    if (tags.length < min) {
      return min === 1
        ? 'Añade al menos una etiqueta: son las palabras con las que el motor reconoce el área.'
        : `Añade al menos ${min} etiquetas.`;
    }
    if (tags.length > max) return `Máximo ${max} etiquetas.`;
    const mala = tags.find((t) => !TAG_RE.test(t) || contarLetras(t) === 0);
    if (mala) return `La etiqueta «${mala}» no es válida: usa palabras en minúscula (p. ej. «sql», «react»).`;
    if (new Set(tags).size !== tags.length) return 'Hay etiquetas repetidas.';
    return null;
  };
}

export function parseTags(v: string): string[] {
  return v
    .split(',')
    .map((t) => t.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter(Boolean);
}

export const code: Validator = (v) => {
  const t = (v ?? '').trim();
  if (!t) return 'Escribe un código.';
  if (!CODE_RE.test(t)) {
    return 'Minúsculas, números y guion bajo; empieza por letra (3 a 60 caracteres).';
  }
  return null;
};

export function integerRange(min: number, max: number, que = 'El valor'): Validator {
  return (v) => {
    const t = String(v ?? '').trim();
    if (!t) return `${que} es obligatorio.`;
    if (!/^\d+$/.test(t)) return `${que} debe ser un número entero, sin letras ni signos.`;
    const n = Number(t);
    if (n < min || n > max) return `${que} va de ${min} a ${max}.`;
    return null;
  };
}

export const optionalText =
  (max: number): Validator =>
  (v) =>
    limpio(v ?? '').length > max ? `No puede superar ${max} caracteres.` : null;

export const universityCode: Validator = (v) => {
  const t = (v ?? '').trim();
  if (!t) return null;
  if (!UNIVERSITY_CODE_RE.test(t)) return 'De 3 a 30 caracteres: letras, números, punto, guion o guion bajo.';
  return null;
};

/** Sugiere un código a partir de un nombre: «Bases de Datos» → «bases_de_datos». */
export function suggestCode(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, 'c_$1')
    .slice(0, 60);
}

/** Aplica un conjunto de validadores y devuelve los errores encontrados. */
export function validate<T extends Record<string, string>>(
  values: T,
  rules: Partial<Record<keyof T, Validator>>,
): Partial<Record<keyof T, string>> {
  const errores: Partial<Record<keyof T, string>> = {};
  for (const [campo, regla] of Object.entries(rules) as [keyof T, Validator][]) {
    const e = regla(values[campo] ?? '');
    if (e) errores[campo] = e;
  }
  return errores;
}
