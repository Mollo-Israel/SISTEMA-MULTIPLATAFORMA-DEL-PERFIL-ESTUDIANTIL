// Helpers reutilizables de validación/transformación para los DTOs.

export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// Recorta cada string del arreglo, descarta vacíos y elimina duplicados.
export const trimUniqueArray = ({ value }: { value: unknown }) => {
  if (!Array.isArray(value)) return value;
  const cleaned = value
    .map((v) => (typeof v === 'string' ? v.trim() : v))
    .filter((v) => v !== '' && v !== null && v !== undefined);
  return [...new Set(cleaned)];
};

// Nombre/apellido: letras (con acentos), separados por un solo espacio, apóstrofo o guion.
export const NAME_RE = /^[A-Za-zÀ-ÿ]+(?:[ '-][A-Za-zÀ-ÿ]+)*$/;

// Correo institucional: debe terminar en univalle.edu (admite subdominios).
export const UNIVALLE_RE = /^[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)*univalle\.edu$/i;

// Contraseña fuerte: mayúscula, minúscula, número y símbolo; sin espacios; 8 a 72.
export const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])(?!.*\s).{8,72}$/;

export const NAME_MSG = 'Solo admite letras, espacios, apóstrofo o guion.';
export const EMAIL_MSG = 'El correo debe ser institucional (terminar en univalle.edu).';
export const PASSWORD_MSG =
  'La contraseña debe incluir mayúscula, minúscula, número y símbolo, sin espacios.';
