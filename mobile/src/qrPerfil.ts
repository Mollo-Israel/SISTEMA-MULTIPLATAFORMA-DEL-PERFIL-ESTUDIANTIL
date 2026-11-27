/**
 * V7.1 §12.1 (T04, T05): qué hacer con el texto de un QR escaneado.
 *
 * Solo se acepta el enlace de un perfil compartible de Afinia:
 * `http(s)://<el mismo servidor que el enlace propio>/p/<identificador>`. No se
 * siguen URLs arbitrarias ni se abre el navegador: de un QR válido solo se
 * extrae el identificador, y el perfil se pide a la API, que decide si existe
 * y qué campos se ven. Un QR de otro sitio, con usuario y contraseña, con
 * parámetros o con un identificador mal formado se descarta con un mensaje.
 *
 * Sin dependencias de React Native: lo prueban las unitarias de la API
 * (api/test/unit/v7-qr-perfil.test.ts).
 */

/** Mismo alfabeto y largo que `PUBLIC_SLUG_ALPHABET` y `PUBLIC_SLUG_LENGTH` de shared. */
export const ALFABETO_IDENTIFICADOR = '23456789bcdfghjkmnpqrstvwxyz';
export const LARGO_IDENTIFICADOR = 12;
const MAX_LARGO_QR = 300;

export type LecturaDeQr =
  | { tipo: 'perfil'; slug: string }
  | { tipo: 'descartado'; mensaje: string };

const NO_ES_AFINIA = 'Este código no es el perfil compartible de alguien de Afinia. No se abrió nada.';

/** Servidor (host y puerto, en minúsculas) de un enlace http(s), o null. */
export function servidorDe(url: string | null | undefined): string | null {
  const m = /^https?:\/\/([^/?#\s]+)/i.exec(String(url ?? '').trim());
  if (!m || m[1].includes('@')) return null;
  return m[1].toLowerCase();
}

function identificadorValido(slug: string): boolean {
  return slug.length === LARGO_IDENTIFICADOR && [...slug].every((c) => ALFABETO_IDENTIFICADOR.includes(c));
}

/**
 * @param texto lo que leyó la cámara.
 * @param enlacePropio el enlace del propio perfil: dice cuál es el servidor de Afinia.
 */
export function leerQrDePerfil(texto: string, enlacePropio: string | null | undefined): LecturaDeQr {
  const crudo = String(texto ?? '').trim();
  const afinia = servidorDe(enlacePropio);
  if (!crudo || crudo.length > MAX_LARGO_QR || !afinia) return { tipo: 'descartado', mensaje: NO_ES_AFINIA };
  const m = /^https?:\/\/([^/?#\s]+)\/p\/([^/?#\s]+)\/?$/i.exec(crudo);
  if (!m || m[1].includes('@') || m[1].toLowerCase() !== afinia) return { tipo: 'descartado', mensaje: NO_ES_AFINIA };
  const slug = m[2];
  if (!identificadorValido(slug)) {
    return { tipo: 'descartado', mensaje: 'El código no tiene un identificador de perfil válido. Pide a la persona que te lo muestre de nuevo.' };
  }
  return { tipo: 'perfil', slug };
}
