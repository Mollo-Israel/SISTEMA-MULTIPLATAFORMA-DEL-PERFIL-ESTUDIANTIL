import { gunzipSync, gzipSync } from 'node:zlib';
import { base64urlDecode, base64urlEncode } from './codec';

/**
 * Lista de estado de bits (W3C Bitstring Status List v1.0).
 *
 * Cada credencial ocupa una posición de una cadena de bits. Un 1 significa
 * revocada (o suspendida, en la lista de suspensión). La lista se publica
 * comprimida con GZIP y en multibase base64url («u…»).
 *
 * El tamaño mínimo es de 131 072 bits (16 KB). Así una consulta no revela
 * qué credencial se está verificando, porque todas comparten la misma lista
 * (privacidad de grupo, §6.1 de la recomendación).
 */
export const STATUS_LIST_SIZE = 131_072;

export function encodeStatusList(indicesEnUno: Iterable<number>, tamano = STATUS_LIST_SIZE): string {
  const bytes = Buffer.alloc(Math.ceil(tamano / 8));
  for (const i of indicesEnUno) {
    if (!Number.isInteger(i) || i < 0 || i >= tamano) continue;
    // El índice 0 es el bit más significativo del primer byte (§4.1).
    bytes[i >> 3] |= 0x80 >> (i & 7);
  }
  return `u${base64urlEncode(gzipSync(bytes, { level: 9 }))}`;
}

/** Hasta 16 MB descomprimidos: una lista más grande es un abuso, no una lista. */
const MAX_DESCOMPRIMIDO = 16 * 1024 * 1024;

export function decodeStatusList(encodedList: string): Buffer {
  if (!encodedList.startsWith('u')) throw new Error('La lista de estado debe venir en multibase base64url («u»).');
  return gunzipSync(base64urlDecode(encodedList.slice(1)), { maxOutputLength: MAX_DESCOMPRIMIDO });
}

export function statusBit(lista: Buffer, indice: number): boolean {
  if (!Number.isInteger(indice) || indice < 0 || indice >= lista.length * 8) {
    throw new Error('El índice de estado está fuera de la lista.');
  }
  return (lista[indice >> 3] & (0x80 >> (indice & 7))) !== 0;
}
