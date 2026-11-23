/**
 * V9 · Reglas puras de integridad de credenciales externas.
 *
 *  - coherencia entre el código impreso y el que lleva el QR;
 *  - normalización de códigos y enlaces para detectar la misma credencial
 *    registrada por dos estudiantes;
 *  - el conector de Credly (IBM, Cisco, AWS, Microsoft…): de la página
 *    pública de la insignia a su aserción Open Badges oficial.
 *
 * Sin base de datos ni red: se prueban con datos fijos.
 */

/** Código comparable: mayúsculas y solo letras y dígitos. */
export function normalizarCodigo(c: string | null | undefined): string | null {
  if (!c) return null;
  const n = c.normalize('NFKD').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return n.length >= 6 ? n : null;
}

/** Fichas con forma de identificador (≥ 6 caracteres y al menos un dígito). */
export function fichasDeCodigo(texto: string): string[] {
  return [...new Set(
    texto.toUpperCase().split(/[^A-Z0-9]+/).filter((t) => t.length >= 6 && /\d/.test(t)),
  )];
}

/** Forma de un código: letras iniciales y largo. «ICTCRA20250827001275» → «ICTCRA:20». */
function forma(c: string): string {
  const letras = /^[A-Z]*/.exec(c)?.[0] ?? '';
  return `${letras}:${c.length}`;
}

/**
 * ¿El QR lleva un código **de la misma forma** que el impreso, pero distinto?
 *
 * Es la huella típica de una edición: se cambió el número impreso y se dejó el
 * QR original (que apunta a la credencial de otra persona). Se exige la misma
 * forma —mismas letras iniciales y mismo largo— y que compartan el comienzo,
 * para no confundir el número del certificado con otro identificador que
 * también viaja en el QR (por ejemplo, el UUID de una insignia de Credly).
 */
export function qrContradiceCodigo(
  codigosImpresos: (string | null | undefined)[],
  qrPayloads: string[],
): { impreso: string; enQr: string } | null {
  const impresos = codigosImpresos.map(normalizarCodigo).filter((c): c is string => !!c);
  if (impresos.length === 0 || qrPayloads.length === 0) return null;
  const qr = qrPayloads.join(' ');
  const qrPlano = qr.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Si el código impreso aparece en el QR, hay coherencia.
  if (impresos.some((c) => qrPlano.includes(c))) return null;
  const fichas = fichasDeCodigo(qr);
  for (const impreso of impresos) {
    const parecida = fichas.find((t) => t !== impreso && forma(t) === forma(impreso) && t.slice(0, 3) === impreso.slice(0, 3));
    if (parecida) return { impreso, enQr: parecida };
  }
  return null;
}

/**
 * Enlace comparable entre estudiantes: sin esquema, sin «www.», sin barra
 * final, sin fragmento y con el host en minúsculas. Solo enlaces que
 * identifican **una** credencial (con una ficha tipo código en la ruta o en la
 * consulta): la portada de un proveedor la comparten todos y no dice nada.
 */
export function enlaceDeCredencial(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const ruta = u.pathname.replace(/\/+$/, '');
    const consulta = [...u.searchParams.entries()]
      .filter(([k]) => !/^utm_|^ref$|^source$|^lang$|^locale$/i.test(k))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const clave = `${host}${ruta}${consulta ? `?${consulta}` : ''}`;
    return fichasDeCodigo(`${ruta} ${consulta}`).length > 0 ? clave.slice(0, 400) : null;
  } catch {
    return null;
  }
}

// ===========================================================================
//  Credly
// ===========================================================================

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const HOSTS_CREDLY = ['credly.com', 'youracclaim.com', 'acclaim.com'];

/** API pública Open Badges 2.0 de Credly: devuelve la aserción oficial en JSON. */
export const CREDLY_ASSERTION_API = 'https://api.credly.com/v1/obi/v2/badge_assertions/';

/** UUID de una insignia de Credly a partir de su enlace público, o null. */
export function credlyBadgeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase();
    if (!HOSTS_CREDLY.some((d) => host === d || host.endsWith(`.${d}`))) return null;
    if (!/\/(badges|badge_assertions|earned\/badge)\//i.test(u.pathname)) return null;
    const m = UUID.exec(u.pathname);
    return m ? m[0].toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Dirección de la aserción oficial para un enlace de Credly, o null si no lo es. */
export function credlyAssertionUrl(url: string | null | undefined): string | null {
  const id = credlyBadgeId(url);
  return id ? `${CREDLY_ASSERTION_API}${id}` : null;
}

/**
 * ¿La aserción que devolvió Credly es la de esa insignia? Su `id` puede venir
 * con la forma de la API o con la de la página pública; basta con que sea de
 * Credly y lleve el mismo UUID.
 */
export function credlyAssertionMatches(assertionId: unknown, badgeId: string): boolean {
  if (typeof assertionId !== 'string') return false;
  return credlyBadgeId(assertionId.replace('/v1/obi/v2/badge_assertions/', '/badges/')) === badgeId;
}

// ===========================================================================
//  Firmante del documento frente al emisor declarado
// ===========================================================================

/**
 * ¿El firmante del PDF es el emisor declarado? Por organización o nombre del
 * certificado (alguna palabra distintiva del emisor, de 4 letras o más: «Huawei
 * ICT Academy» frente a «Huawei Technologies Co., Ltd.») o por el dominio de
 * su correo frente a los dominios oficiales del emisor.
 *
 * Es tolerante a propósito porque solo se consulta cuando la cadena del
 * firmante ya llegó a una raíz pública: esa autoridad comprobó la
 * organización, así que nadie consigue un certificado «Huawei» de confianza.
 */
export function firmanteEsEmisor(
  firmante: { organization: string | null; name: string | null; email: string | null },
  emisorDeclarado: string | null,
  dominiosOficiales: string[] | null,
): boolean | null {
  if (!emisorDeclarado && !dominiosOficiales?.length) return null;
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const sujeto = norm(`${firmante.organization ?? ''} ${firmante.name ?? ''}`);
  if (emisorDeclarado) {
    const palabras = norm(emisorDeclarado).split(/[^a-z0-9]+/).filter((p) => p.length >= 4 && !RELLENO.has(p));
    if (palabras.some((p) => new RegExp(`\\b${p}\\b`).test(sujeto))) return true;
  }
  const dominio = firmante.email?.split('@')[1]?.toLowerCase() ?? null;
  if (dominio && dominiosOficiales?.some((d) => dominio === d || dominio.endsWith(`.${d}`))) return true;
  return false;
}

const RELLENO = new Set(['the', 'inc', 'ltd', 'llc', 'corp', 'corporation', 'company', 'academy', 'academia', 'universidad', 'university', 'institute', 'instituto', 'de', 'del', 'and', 'for']);
