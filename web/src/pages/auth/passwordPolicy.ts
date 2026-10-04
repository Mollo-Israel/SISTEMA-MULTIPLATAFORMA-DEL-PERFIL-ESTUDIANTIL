/**
 * Política de contraseñas (§13), replicada en el cliente.
 *
 * Es una copia deliberada de lo que valida el servidor: aquí sirve para que el
 * usuario vea qué le falta mientras escribe, no para decidir si la contraseña
 * se acepta. Esa decisión la sigue tomando la API, y si ambas discrepan manda
 * la API.
 */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export interface PasswordRequirement {
  t: string;
  ok: boolean;
}

/**
 * La misma regla que el servidor para el correo (V2 §17): no puede ser el
 * correo ni contener su parte local cuando esta tiene 4 o más caracteres.
 */
function contieneCorreo(password: string, email: string): boolean {
  const lower = password.toLowerCase();
  const correo = email.toLowerCase().trim();
  const local = correo.split('@')[0] ?? '';
  return lower === correo || (local.length >= 4 && lower.includes(local));
}

/**
 * Requisitos visibles. Con `email` se añade el de no contener el correo, que
 * el servidor también exige. El código universitario no viaja al navegador
 * (es dato institucional): si la contraseña lo contiene, lo dice el servidor.
 */
export function passwordRequirements(password: string, context: { email?: string } = {}): PasswordRequirement[] {
  const email = context.email?.trim();
  const reglas = [
    { t: `${PASSWORD_MIN}+ caracteres`, ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX },
    { t: 'Una mayúscula', ok: /[A-Z]/.test(password) },
    { t: 'Una minúscula', ok: /[a-z]/.test(password) },
    { t: 'Un número', ok: /\d/.test(password) },
    { t: 'Un símbolo', ok: /[^A-Za-z0-9\s]/.test(password) },
    { t: 'Sin espacios', ok: password.length > 0 && !/\s/.test(password) },
  ];
  if (email && email.includes('@')) {
    reglas.push({ t: 'Sin tu correo', ok: password.length > 0 && !contieneCorreo(password, email) });
  }
  return reglas;
}

/**
 * Avance de la barra: qué parte de los requisitos se cumple.
 *
 * Con todos cumplidos la barra se llena. Antes contaba además un «bonus» por
 * pasar de 16 caracteres, así que una contraseña válida de 12 se quedaba al
 * 86 %: el usuario veía la barra sin completar y creía que le faltaba algo.
 */
export function passwordStrength(password: string, context: { email?: string } = {}): number {
  const reqs = passwordRequirements(password, context);
  const met = reqs.filter((r) => r.ok).length;
  return Math.round((met / reqs.length) * 100);
}

/** Cómo de robusta es, en palabras, una vez cumplidos los requisitos. */
export function passwordVerdict(password: string, context: { email?: string } = {}): string | null {
  if (!passwordRequirements(password, context).every((r) => r.ok)) return null;
  return password.length >= 16 ? 'Contraseña muy segura' : 'Contraseña segura';
}
