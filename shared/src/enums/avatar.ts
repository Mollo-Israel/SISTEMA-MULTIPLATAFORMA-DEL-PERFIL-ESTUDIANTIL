/**
 * Avatares de catálogo (V3 §11.2).
 *
 * El estudiante elige una ilustración predeterminada en lugar de subir una
 * foto: no hay imágenes que moderar ni datos biométricos que proteger. La API
 * solo acepta estas claves; la web y el móvil las dibujan.
 */
export const AVATAR_KEYS = [
  'code', 'cpu', 'database', 'globe', 'shield', 'smartphone',
  'terminal', 'layers', 'zap', 'book', 'compass', 'star',
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];
