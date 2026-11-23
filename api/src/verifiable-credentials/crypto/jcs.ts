/**
 * JSON Canonicalization Scheme (RFC 8785).
 *
 * Dos documentos con el mismo contenido producen exactamente los mismos
 * bytes, sin importar el orden de las claves ni los espacios. Es lo que se
 * firma con `eddsa-jcs-2022` y lo que se encadena en la bitácora.
 *
 * - Claves ordenadas por unidades UTF-16 (el orden de `<` sobre strings en JS).
 * - Números con la serialización de ECMAScript, que es la que fija la RFC.
 * - Cadenas con el escape mínimo de `JSON.stringify`, también conforme.
 */
export function canonicalize(valor: unknown): string {
  if (valor === null) return 'null';
  switch (typeof valor) {
    case 'boolean':
      return valor ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(valor)) throw new Error('JCS no admite NaN ni infinitos.');
      return JSON.stringify(valor);
    case 'string':
      return JSON.stringify(valor);
    case 'object': {
      if (Array.isArray(valor)) return `[${valor.map((v) => canonicalize(v === undefined ? null : v)).join(',')}]`;
      const objeto = valor as Record<string, unknown>;
      const claves = Object.keys(objeto).filter((k) => objeto[k] !== undefined).sort(compararUtf16);
      return `{${claves.map((k) => `${JSON.stringify(k)}:${canonicalize(objeto[k])}`).join(',')}}`;
    }
    default:
      throw new Error(`JCS no admite valores de tipo ${typeof valor}.`);
  }
}

function compararUtf16(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
