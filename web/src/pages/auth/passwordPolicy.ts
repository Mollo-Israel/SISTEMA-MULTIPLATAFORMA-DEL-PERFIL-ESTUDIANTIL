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

export function passwordRequirements(password: string): PasswordRequirement[] {
  return [
    { t: `${PASSWORD_MIN}+ caracteres`, ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX },
    { t: 'Una mayúscula', ok: /[A-Z]/.test(password) },
    { t: 'Una minúscula', ok: /[a-z]/.test(password) },
    { t: 'Un número', ok: /\d/.test(password) },
    { t: 'Un símbolo', ok: /[^A-Za-z0-9\s]/.test(password) },
    { t: 'Sin espacios', ok: password.length > 0 && !/\s/.test(password) },
  ];
}

/**
 * Avance de la barra: qué parte de los requisitos se cumple.
 *
 * Con todos cumplidos la barra se llena. Antes contaba además un «bonus» por
 * pasar de 16 caracteres, así que una contraseña válida de 12 se quedaba al
 * 86 %: el usuario veía la barra sin completar y creía que le faltaba algo.
 */
export function passwordStrength(password: string): number {
  const reqs = passwordRequirements(password);
  const met = reqs.filter((r) => r.ok).length;
  return Math.round((met / reqs.length) * 100);
}

/** Cómo de robusta es, en palabras, una vez cumplidos los requisitos. */
export function passwordVerdict(password: string): string | null {
  if (!passwordRequirements(password).every((r) => r.ok)) return null;
  return password.length >= 16 ? 'Contraseña muy segura' : 'Contraseña segura';
}
