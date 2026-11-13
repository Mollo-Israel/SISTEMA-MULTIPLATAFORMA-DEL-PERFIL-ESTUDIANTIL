import * as path from 'node:path';

/** Prefijo publico bajo el que se sirven los archivos guardados. */
export const FILES_ROUTE = '/api/files';

/** Quita los caracteres de control ASCII y DEL, que no deben quedar en un nombre visible. */
function sinCaracteresDeControl(texto: string): string {
  let salida = '';
  for (const c of texto) {
    const codigo = c.codePointAt(0) ?? 0;
    if (codigo > 0x1f && codigo !== 0x7f) salida += c;
  }
  return salida;
}

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
  const base = sinCaracteresDeControl(path.basename(name)).trim();
  return (base || 'archivo').slice(0, 120);
}
