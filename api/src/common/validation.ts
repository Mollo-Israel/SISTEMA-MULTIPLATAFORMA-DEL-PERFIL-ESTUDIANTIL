// Helpers reutilizables de validacion/transformacion para los DTOs.
import { registerDecorator, ValidationOptions } from 'class-validator';

// Detecta caracteres invisibles/no imprimibles que no deben quedar en un campo:
// control ASCII (salvo tab y salto de linea, que se colapsan luego), DEL,
// espacios de ancho cero y marcas Unicode invisibles. No afecta letras ni acentos.
const isInvisible = (code: number): boolean => {
  if (code === 0x09 || code === 0x0a) return false; // tab y \n: los maneja el colapso de espacios
  if (code <= 0x1f) return true; // resto de controles ASCII
  if (code === 0x7f) return true; // DEL
  if (code >= 0x200b && code <= 0x200d) return true; // zero-width space/non-joiner/joiner
  if (code === 0x2060) return true; // word joiner
  if (code === 0xfeff) return true; // zero-width no-break space / BOM
  return false;
};

const stripInvisible = (input: string): string => {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0);
    if (code === undefined || !isInvisible(code)) out += ch;
  }
  return out;
};

export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// Campo de una sola linea (nombres, titulos, ubicaciones, emisores...):
// normaliza Unicode, elimina invisibles y colapsa cualquier espacio a uno solo.
export const cleanLine = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return stripInvisible(value.normalize('NFC'))
    .replace(/\s+/g, ' ')
    .trim();
};

// Texto largo (biografias, descripciones): conserva saltos de linea pero
// limpia invisibles, colapsa espacios/tabs y evita mas de un renglon en blanco.
export const cleanText = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return stripInvisible(value.normalize('NFC'))
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Limpia cada elemento del arreglo, descarta vacios y elimina duplicados
// (sin distinguir mayusculas/minusculas para las cadenas).
export const trimUniqueArray = ({ value }: { value: unknown }) => {
  if (!Array.isArray(value)) return value;
  const cleaned = value
    .map((v) =>
      typeof v === 'string'
        ? stripInvisible(v.normalize('NFC')).replace(/\s+/g, ' ').trim()
        : v,
    )
    .filter((v) => v !== '' && v !== null && v !== undefined);
  const seen = new Set<unknown>();
  const out: unknown[] = [];
  for (const v of cleaned) {
    const key = typeof v === 'string' ? v.toLocaleLowerCase() : v;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
};

// Nombre/apellido: letras (con acentos), separados por un solo espacio, apostrofo o guion.
export const NAME_RE = /^[A-Za-zÀ-ÿ]+(?:[ '-][A-Za-zÀ-ÿ]+)*$/;

// Correo institucional: debe terminar en univalle.edu (admite subdominios).
// El dominio autorizado real se configura por entorno
// (INSTITUTIONAL_EMAIL_DOMAINS, especificacion §11); esta expresion es el
// formato de respaldo para los DTO que no reciben configuracion.
export const UNIVALLE_RE = /^[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)*univalle\.edu$/i;

/**
 * Contrasena (especificacion §13): 12 a 128 caracteres, con mayuscula,
 * minuscula, numero y simbolo, sin espacios.
 *
 * Nota sobre el hash: bcrypt solo considera los primeros 72 bytes. Se admiten
 * 128 caracteres porque la especificacion lo exige y porque una frase larga es
 * mejor practica, pero mas alla de 72 bytes la cola no aporta entropia
 * adicional. 72 bytes ya son holgadamente suficientes.
 */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
export const PASSWORD_RE = new RegExp(
  '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9\\s])(?!.*\\s)'
    + `.{${PASSWORD_MIN},${PASSWORD_MAX}}$`,
);

export const NAME_MSG = 'Solo admite letras, espacios, apóstrofo o guion.';
export const EMAIL_MSG = 'El correo debe ser institucional (terminar en univalle.edu).';
export const PASSWORD_MSG =
  `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres e incluir mayúscula, `
  + 'minúscula, número y símbolo, sin espacios.';

/**
 * Comprobaciones que una expresion regular no puede hacer (§13): la
 * contrasena no puede ser el propio correo ni contener el codigo
 * universitario. Devuelve el motivo del rechazo, o null si es aceptable.
 */
export function passwordPolicyError(
  password: string,
  context: { email?: string | null; universityCode?: string | null } = {},
): string | null {
  if (!PASSWORD_RE.test(password)) return PASSWORD_MSG;

  const lower = password.toLowerCase();
  const email = context.email?.toLowerCase().trim();
  if (email) {
    const localPart = email.split('@')[0];
    if (lower === email || (localPart.length >= 4 && lower.includes(localPart))) {
      return 'La contraseña no puede contener su correo institucional.';
    }
  }

  const code = context.universityCode?.toLowerCase().trim();
  if (code && code.length >= 4 && lower.includes(code)) {
    return 'La contraseña no puede contener su código universitario.';
  }

  return null;
}

/**
 * Valida que una fecha no sea anterior a la de otro campo del mismo DTO.
 * Se usa para rangos: la fecha "hasta" nunca antes que la fecha "desde".
 */
export function IsNotBeforeField(otherField: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotBeforeField',
      target: object.constructor,
      propertyName,
      constraints: [otherField],
      options: validationOptions,
      validator: {
        validate(value: unknown, args?: { object: object; constraints: unknown[] }) {
          if (value === undefined || value === null || value === '') return true;
          if (!args) return true;
          const other = (args.object as Record<string, unknown>)[args.constraints[0] as string];
          if (other === undefined || other === null || other === '') return true;
          if (typeof value !== 'string' || typeof other !== 'string') return false;
          const end = new Date(value).getTime();
          const start = new Date(other).getTime();
          if (Number.isNaN(end) || Number.isNaN(start)) return false;
          return end >= start;
        },
        defaultMessage() {
          return 'La fecha no puede ser anterior a la fecha inicial.';
        },
      },
    });
  };
}

// Valida que una fecha (ISO o yyyy-mm-dd) no sea futura. Util para emisiones.
export function IsNotFutureDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotFutureDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === undefined || value === null || value === '') return true;
          if (typeof value !== 'string') return false;
          const d = new Date(value);
          if (Number.isNaN(d.getTime())) return false;
          const pad = (n: number) => String(n).padStart(2, '0');
          // Fecha de calendario del valor: si viene como yyyy-mm-dd la usamos
          // tal cual (sin que la zona horaria la corra un día).
          const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
          const valueDay = iso
            ? `${iso[1]}-${iso[2]}-${iso[3]}`
            : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          const now = new Date();
          const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
          return valueDay <= today;
        },
        defaultMessage() {
          return 'La fecha no puede ser futura.';
        },
      },
    });
  };
}

// ===========================================================================
//  Catálogos: nombres, etiquetas y códigos
// ===========================================================================
//
// El cliente web tiene una copia exacta de estas reglas (web/src/lib/
// validators.ts) para avisar mientras se escribe. Aquí es donde se decide.

const LETRA = 'A-Za-zÀ-ÖØ-öø-ÿ';
const contarLetras = (v: string) => (v.match(new RegExp(`[${LETRA}]`, 'g')) ?? []).length;

/**
 * Nombre de área, categoría o criterio: empieza por letra, tiene al menos tres
 * letras y solo admite signos de puntuación entre palabras. Acepta «Industria
 * 4.0» o «Gestión de Proyectos (PMI)»; rechaza «#!@#!@#» y «123213».
 */
export const CATALOG_NAME_RE = new RegExp(`^[${LETRA}]+(?:[ .,/&'()-]+[${LETRA}0-9]+)*\\)?$`);

/**
 * Nombre de habilidad o tecnología. Más permisivo, porque las tecnologías
 * tienen nombres raros —«C++», «C#», «.NET», «Node.js», «UI/UX»—, pero exige
 * al menos una letra y que los signos vayan entre palabras.
 */
export const SKILL_NAME_RE = new RegExp(
  `^\\.?[${LETRA}0-9]+(?:[ ./&'()-]+[${LETRA}0-9]+)*\\)?(?:\\+\\+|#)?$`,
);

/** Etiqueta del motor: minúsculas, números y los signos de una tecnología. */
export const TAG_RE = /^[a-z0-9áéíóúüñ][a-z0-9áéíóúüñ .+#-]{0,39}$/;

/** Código interno: minúsculas, números y guion bajo, empezando por letra. */
export const CODE_RE = /^[a-z][a-z0-9_]{2,59}$/;
export const CODE_MSG =
  'El código solo admite minúsculas, números y guion bajo, y empieza por letra (3 a 60 caracteres).';

/** «Bases de Datos» → «bases_de_datos». Para sugerir y para rellenar códigos. */
export function slugCode(nombre: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 56);
  if (!base) return 'item';
  return /^[a-z]/.test(base) ? base : `c_${base}`.slice(0, 56);
}

/**
 * Decorador a partir de una función que devuelve el motivo del error o null.
 *
 * El mensaje se recalcula desde el valor en `defaultMessage`, en lugar de
 * guardarlo entre una llamada y otra: así no hay estado compartido entre dos
 * validaciones.
 */
function regla(
  nombre: string,
  validar: (v: string) => string | null,
  validationOptions?: ValidationOptions,
) {
  const motivo = (value: unknown): string | null => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') return 'Debe ser texto.';
    return validar(value);
  };
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: nombre,
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => motivo(value) === null,
        defaultMessage: (args?: { value: unknown }) => motivo(args?.value) ?? 'El valor no es válido.',
      },
    });
  };
}

/** Nombre de catálogo (área, categoría, criterio) con un mensaje preciso. */
export function IsCatalogName(validationOptions?: ValidationOptions) {
  return regla(
    'isCatalogName',
    (v) => {
      const t = v.trim();
      if (/^[\d\s.,-]+$/.test(t)) return 'El nombre no puede ser solo números.';
      if (!new RegExp(`^[${LETRA}]`).test(t)) return 'El nombre debe empezar por una letra.';
      if (contarLetras(t) < 3) return 'El nombre debe contener al menos 3 letras.';
      if (!CATALOG_NAME_RE.test(t)) {
        return 'El nombre solo admite letras, números, espacios y signos de puntuación entre palabras.';
      }
      return null;
    },
    validationOptions,
  );
}

/** Nombre de habilidad o tecnología. */
export function IsSkillName(validationOptions?: ValidationOptions) {
  return regla(
    'isSkillName',
    (v) => {
      const t = v.trim();
      if (contarLetras(t) === 0) return 'El nombre debe contener letras: no puede ser solo números o símbolos.';
      if (!SKILL_NAME_RE.test(t)) {
        return 'Use el nombre de la tecnología (p. ej. «React», «C#», «Node.js»): sin símbolos sueltos.';
      }
      return null;
    },
    validationOptions,
  );
}

/** Pasa a minúsculas y limpia cada etiqueta antes de validarla. */
export const lowerTags = ({ value }: { value: unknown }) => {
  const limpio = trimUniqueArray({ value });
  return Array.isArray(limpio)
    ? limpio.map((t) => (typeof t === 'string' ? t.toLowerCase() : t))
    : limpio;
};

/** Cada etiqueta, con el motivo exacto si alguna no sirve. */
export function IsTagList(validationOptions?: ValidationOptions) {
  const motivo = (value: unknown): string | null => {
    if (value === undefined || value === null) return null;
    if (!Array.isArray(value)) return 'Las etiquetas deben ser una lista.';
    const mala = value.find(
      (t) => typeof t !== 'string' || !TAG_RE.test(t) || contarLetras(t) === 0,
    );
    return mala === undefined
      ? null
      : `La etiqueta «${String(mala)}» no es válida: use palabras en minúscula (p. ej. «sql», «react»).`;
  };
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isTagList',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => motivo(value) === null,
        defaultMessage: (args?: { value: unknown }) => motivo(args?.value) ?? 'Etiquetas no válidas.',
      },
    });
  };
}
