import { RolNombre } from './role.enum';

/**
 * Código universitario de una cuenta.
 *
 * Toda cuenta lo tiene, con el formato `PREFIJO-XXXXXXX`: un prefijo de tres
 * letras según el rol y siete letras o números en mayúscula. El prefijo hace
 * que el código diga, de un vistazo, a qué tipo de cuenta pertenece.
 *
 * Vive en `shared` para que la API, la web y el móvil validen exactamente lo
 * mismo.
 */
export const UNIVERSITY_CODE_PREFIX: Record<RolNombre, string> = {
  [RolNombre.STUDENT]: 'EST',
  [RolNombre.SCIENTIFIC_SOCIETY]: 'EST',
  [RolNombre.TEACHER]: 'DOC',
  [RolNombre.CAREER_DIRECTOR]: 'DIR',
  [RolNombre.ADMIN]: 'ADM',
};

/** Caracteres después del guion. */
export const UNIVERSITY_CODE_BODY_LENGTH = 7;

/** Forma general: tres letras, guion y siete letras o números en mayúscula. */
export const UNIVERSITY_CODE_PATTERN = /^[A-Z]{3}-[A-Z0-9]{7}$/;

/** Roles que cursan un semestre y lo indican al crear la cuenta. */
export const SEMESTER_ROLES: readonly RolNombre[] = [RolNombre.STUDENT, RolNombre.SCIENTIFIC_SOCIETY];

/** Mayúsculas y sin espacios: «est-38dj1ha » se guarda como «EST-38DJ1HA». */
export function normalizeUniversityCode(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

/** Ejemplo del formato para un rol, para pistas y marcadores de posición. */
export function universityCodeExample(role: RolNombre): string {
  return `${UNIVERSITY_CODE_PREFIX[role]}-38DJ1HA`;
}

/**
 * Motivo por el que un código no sirve para ese rol, o `null` si sirve.
 * El texto está pensado para mostrarse debajo del campo.
 */
export function universityCodeProblem(value: string | null | undefined, role: RolNombre): string | null {
  const code = normalizeUniversityCode(value);
  const prefijo = UNIVERSITY_CODE_PREFIX[role];
  if (!code) return 'El código universitario es obligatorio.';
  if (!UNIVERSITY_CODE_PATTERN.test(code)) {
    return `Formato: ${prefijo}- y 7 letras o números (por ejemplo ${universityCodeExample(role)}).`;
  }
  if (!code.startsWith(`${prefijo}-`)) {
    return `Para este rol el código empieza con ${prefijo}- (por ejemplo ${universityCodeExample(role)}).`;
  }
  return null;
}
