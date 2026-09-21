/**
 * Detección del tipo real de un archivo por su firma (especificacion §27.3).
 *
 * El `Content-Type` de una subida lo escribe el cliente, así que no es un dato
 * sobre el archivo: es una afirmación de quien lo envía. Un ejecutable
 * declarado como `application/pdf` pasaría cualquier filtro que se base en esa
 * cabecera.
 *
 * Se resuelve leyendo los primeros bytes. Son cuatro formatos y unas pocas
 * líneas, así que se escribe aquí en lugar de traer una dependencia: una
 * comprobación de seguridad que se puede leer entera en un minuto vale más que
 * una que hay que creerse a ciegas.
 */

export type DetectedMime =
  | 'application/pdf'
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp';

/** Tipos que el sistema acepta (§27.3, más WEBP que ya se admitía). */
export const ACCEPTED_MIME_TYPES: readonly DetectedMime[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

export const HUMAN_ACCEPTED = 'PDF, PNG, JPG o WEBP';

/**
 * Devuelve el tipo real del archivo, o `null` si no es ninguno de los
 * aceptados.
 *
 * Deliberadamente no intenta reconocer nada más: saber que algo es un ZIP no
 * sirve de nada aquí, y una lista larga solo añade superficie.
 */
export function detectMimeType(buffer: Buffer): DetectedMime | null {
  if (buffer.length < 12) return null;

  // %PDF-
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    return 'application/pdf';
  }

  // \x89 P N G \r \n \x1a \n
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
    && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JFIF/Exif: empieza en FF D8 FF y termina en FF D9.
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // RIFF ---- WEBP
  if (
    buffer.subarray(0, 4).toString('latin1') === 'RIFF'
    && buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Comprueba que el tipo declarado y el real sean el mismo.
 *
 * Que coincidan no prueba que el archivo sea inofensivo, pero que **no**
 * coincidan es motivo suficiente para rechazarlo: un archivo que miente sobre
 * lo que es no tiene ningún motivo legítimo para hacerlo.
 */
export function mimeMatches(declared: string, detected: DetectedMime): boolean {
  if (declared === detected) return true;
  // Algunos clientes envían variantes históricas del tipo JPEG.
  if (detected === 'image/jpeg') {
    return declared === 'image/jpg' || declared === 'image/pjpeg';
  }
  return false;
}
