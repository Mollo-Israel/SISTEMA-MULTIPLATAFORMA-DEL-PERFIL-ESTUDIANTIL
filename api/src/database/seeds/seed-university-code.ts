import { createHash } from 'crypto';
import { RolNombre, UNIVERSITY_CODE_BODY_LENGTH, UNIVERSITY_CODE_PREFIX } from '@perfil/shared';

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Código universitario estable para las cuentas sembradas.
 *
 * Sale del correo, así que volver a sembrar no cambia el código de nadie.
 * Solo para datos de demostración: las cuentas reales lo reciben de quien
 * las crea o del padrón.
 */
export function seedUniversityCode(role: RolNombre, email: string): string {
  const bytes = createHash('sha256').update(`afinia:${email.toLowerCase()}`).digest();
  let cuerpo = '';
  for (let i = 0; i < UNIVERSITY_CODE_BODY_LENGTH; i++) cuerpo += ALFABETO[bytes[i] % ALFABETO.length];
  return `${UNIVERSITY_CODE_PREFIX[role]}-${cuerpo}`;
}
