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
export const UNIVALLE_RE = /^[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)*univalle\.edu$/i;

// Contrasena fuerte: mayuscula, minuscula, numero y simbolo; sin espacios; 8 a 72.
export const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])(?!.*\s).{8,72}$/;

export const NAME_MSG = 'Solo admite letras, espacios, apóstrofo o guion.';
export const EMAIL_MSG = 'El correo debe ser institucional (terminar en univalle.edu).';
export const PASSWORD_MSG =
  'La contraseña debe incluir mayúscula, minúscula, número y símbolo, sin espacios.';

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
