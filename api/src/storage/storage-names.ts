import * as path from 'node:path';

/** Prefijo publico bajo el que se sirven los archivos guardados. */
export const FILES_ROUTE = '/api/files';

/** Caracteres de control ASCII y DEL, que no deben quedar en un nombre visible. */
const CONTROL_CHARS = new RegExp('[\u0000-\u001f\u007f]', 'g');

/** Extension segura por tipo aceptado. Nunca se usa la del nombre original. */
const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

export function extensionFor(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? '.bin';
}

/** Nombre visible saneado: sin rutas ni caracteres de control. */
export function safeDisplayName(name: string): string {
  const base = path.basename(name).replace(CONTROL_CHARS, '').trim();
  return (base || 'archivo').slice(0, 120);
}
