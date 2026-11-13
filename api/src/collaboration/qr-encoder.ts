/**
 * Codificador de códigos QR (especificación §43).
 *
 * §43 pide que el QR contenga **únicamente** una URL al perfil compartible. Esa
 * es una propiedad del contenido, no del dibujo, así que el código se genera
 * aquí y no en el navegador: en un solo sitio, comprobable, y sin que la web y
 * el móvil tengan que ponerse de acuerdo sobre qué meten dentro.
 *
 * ## Por qué escrito y no una dependencia
 *
 * La API ya trae `jsqr` —un **decodificador**, del lector de certificados del
 * BATCH 3—, así que este codificador se puede verificar de verdad: la suite
 * genera un QR, lo dibuja y lo vuelve a leer. Un codificador que no se puede
 * releer produce códigos que nadie escanea y que ninguna prueba detecta; con el
 * decodificador ya disponible, ese riesgo desaparece y la dependencia deja de
 * pagarse sola.
 *
 * ## Alcance
 *
 * Modo byte, nivel de corrección M, versiones 1 a 10. Da para 213 bytes: la
 * versión 10 tiene 216 codewords de datos, y tres se van en el indicador de
 * modo y la longitud. Una URL de perfil ronda los 60 caracteres, así que
 * sobra. Pasado ese límite se lanza un error en vez de generar algo que no se
 * pueda leer.
 */

/** Nivel de corrección M: equilibrio entre tamaño y tolerancia a suciedad. */
const ECC_LEVEL_BITS = 0b00;

/**
 * Por versión: [codewords de datos, ECC por bloque, bloques del grupo 1,
 * datos por bloque del grupo 1, bloques del grupo 2, datos por bloque del
 * grupo 2]. Son las tablas del estándar para el nivel M.
 */
const VERSIONS: Record<number, [number, number, number, number, number, number]> = {
  1: [16, 10, 1, 16, 0, 0],
  2: [28, 16, 1, 28, 0, 0],
  3: [44, 26, 1, 44, 0, 0],
  4: [64, 18, 2, 32, 0, 0],
  5: [86, 24, 2, 43, 0, 0],
  6: [108, 16, 4, 27, 0, 0],
  7: [124, 18, 4, 31, 0, 0],
  8: [154, 22, 2, 38, 2, 39],
  9: [182, 22, 3, 36, 2, 37],
  10: [216, 26, 4, 43, 1, 44],
};

/** Centros de los patrones de alineación, por versión. */
const ALIGNMENT: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

// ---------------------------------------------------------------------------
// Aritmética en GF(256), para Reed-Solomon
// ---------------------------------------------------------------------------

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    // Polinomio primitivo del estándar: x^8 + x^4 + x^3 + x^2 + 1.
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const mul = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];

/** Polinomio generador de grado `grado`. */
function generador(grado: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < grado; i++) {
    const siguiente = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      siguiente[j] ^= poly[j];
      siguiente[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = siguiente;
  }
  return poly;
}

/** Codewords de corrección de un bloque de datos. */
function ecc(datos: Uint8Array, cantidad: number): Uint8Array {
  const gen = generador(cantidad);
  const resto = new Uint8Array(datos.length + cantidad);
  resto.set(datos);
  for (let i = 0; i < datos.length; i++) {
    const factor = resto[i];
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j++) {
      resto[i + j] ^= mul(gen[j], factor);
    }
  }
  return resto.slice(datos.length);
}

// ---------------------------------------------------------------------------
// Flujo de bits
// ---------------------------------------------------------------------------

class BitStream {
  private readonly bits: number[] = [];

  escribir(valor: number, longitud: number): void {
    for (let i = longitud - 1; i >= 0; i--) {
      this.bits.push((valor >> i) & 1);
    }
  }

  get length(): number {
    return this.bits.length;
  }

  /** Completa hasta `codewords` bytes con el relleno que fija el estándar. */
  toCodewords(codewords: number): Uint8Array {
    const total = codewords * 8;
    // Terminador: hasta cuatro ceros, o menos si ya no cabe.
    for (let i = 0; i < 4 && this.bits.length < total; i++) this.bits.push(0);
    while (this.bits.length % 8 !== 0) this.bits.push(0);

    const salida = new Uint8Array(codewords);
    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | this.bits[i + j];
      salida[i / 8] = byte;
    }
    // Bytes de relleno alternos, tal como los define el estándar.
    const relleno = [0xec, 0x11];
    for (let i = this.bits.length / 8, k = 0; i < codewords; i++, k++) {
      salida[i] = relleno[k % 2];
    }
    return salida;
  }
}

// ---------------------------------------------------------------------------
// Matriz
// ---------------------------------------------------------------------------

/** -1 sin asignar, 0 claro, 1 oscuro. `reservado` marca lo que no es dato. */
interface Lienzo {
  size: number;
  modulos: Int8Array;
  reservado: Uint8Array;
}

const idx = (l: Lienzo, fila: number, col: number) => fila * l.size + col;

function set(l: Lienzo, y: number, x: number, valor: number, reserva = true): void {
  l.modulos[idx(l, y, x)] = valor;
  if (reserva) l.reservado[idx(l, y, x)] = 1;
}

function dibujarPatronesFijos(l: Lienzo, version: number): void {
  const n = l.size;
  // Buscadores y separadores, en las tres esquinas.
  dibujarBuscador(l, 0, 0);
  dibujarBuscador(l, 0, n - 7);
  dibujarBuscador(l, n - 7, 0);
  dibujarTemporizadores(l);
  dibujarAlineacion(l, version);
  // Módulo oscuro fijo.
  set(l, n - 8, 8, 1);
  reservarFormato(l);
  if (version >= 7) reservarVersion(l);
}

/** Un buscador de 7×7 con su separador, con la esquina superior izquierda en (fila, col). */
function dibujarBuscador(l: Lienzo, fila: number, col: number): void {
  const n = l.size;
  for (let i = -1; i <= 7; i++) {
    for (let j = -1; j <= 7; j++) {
      const f = fila + i;
      const c = col + j;
      if (f < 0 || f >= n || c < 0 || c >= n) continue;
      const enBorde = i === -1 || i === 7 || j === -1 || j === 7;
      const enAnillo = i === 0 || i === 6 || j === 0 || j === 6;
      const enCentro = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      const oscuro = !enBorde && (enAnillo || enCentro);
      set(l, f, c, oscuro ? 1 : 0);
    }
  }
}

/** Temporizadores: la fila y la columna 6 alternan claro y oscuro. */
function dibujarTemporizadores(l: Lienzo): void {
  const n = l.size;
  for (let i = 8; i < n - 8; i++) {
    const valor = i % 2 === 0 ? 1 : 0;
    set(l, 6, i, valor);
    set(l, i, 6, valor);
  }
}

/** Patrones de alineación, salvo donde chocarían con un buscador. */
function dibujarAlineacion(l: Lienzo, version: number): void {
  const n = l.size;
  const centros = ALIGNMENT[version];
  for (const fila of centros) {
    for (const col of centros) {
      const esquinaBuscador =
        (fila === 6 && col === 6)
        || (fila === 6 && col === n - 7)
        || (fila === n - 7 && col === 6);
      if (!esquinaBuscador) dibujarPatronDeAlineacion(l, fila, col);
    }
  }
}

function dibujarPatronDeAlineacion(l: Lienzo, fila: number, col: number): void {
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      const anillo = Math.abs(i) === 2 || Math.abs(j) === 2;
      set(l, fila + i, col + j, anillo || (i === 0 && j === 0) ? 1 : 0);
    }
  }
}

/** Zonas reservadas para el formato. */
function reservarFormato(l: Lienzo): void {
  const n = l.size;
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      l.reservado[idx(l, 8, i)] = 1;
      l.reservado[idx(l, i, 8)] = 1;
    }
  }
  for (let i = 0; i < 8; i++) {
    l.reservado[idx(l, 8, n - 1 - i)] = 1;
    l.reservado[idx(l, n - 1 - i, 8)] = 1;
  }
}

/** Zonas reservadas para la versión, a partir de la 7. */
function reservarVersion(l: Lienzo): void {
  const n = l.size;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      l.reservado[idx(l, i, n - 11 + j)] = 1;
      l.reservado[idx(l, n - 11 + j, i)] = 1;
    }
  }
}

/** Recorrido en zigzag de dos columnas, de abajo a la derecha hacia arriba. */
function colocarDatos(l: Lienzo, datos: Uint8Array): void {
  const n = l.size;
  let bit = 0;
  let haciaArriba = true;

  for (let col = n - 1; col > 0; col -= 2) {
    // La columna del temporizador vertical no participa del recorrido.
    if (col === 6) col--;
    bit = colocarParDeColumnas(l, datos, col, haciaArriba, bit);
    haciaArriba = !haciaArriba;
  }
}

/** Llena el par de columnas `col` y `col - 1` en una dirección; devuelve el siguiente bit. */
function colocarParDeColumnas(l: Lienzo, datos: Uint8Array, col: number, haciaArriba: boolean, desde: number): number {
  const n = l.size;
  let bit = desde;
  for (let paso = 0; paso < n; paso++) {
    const fila = haciaArriba ? n - 1 - paso : paso;
    for (const c of [col, col - 1]) {
      if (l.reservado[idx(l, fila, c)]) continue;
      const byte = datos[bit >> 3];
      const valor = byte === undefined ? 0 : (byte >> (7 - (bit & 7))) & 1;
      l.modulos[idx(l, fila, c)] = valor;
      bit++;
    }
  }
  return bit;
}

const MASKS: ((i: number, j: number) => boolean)[] = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (_i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

/**
 * Penalización de una máscara, con las cuatro reglas del estándar.
 *
 * Existe para que el código no acabe con zonas grandes de un solo color ni con
 * dibujos que se parezcan a un buscador: un lector se confundiría.
 */
function penalizacion(l: Lienzo): number {
  return penalizarRachas(l) + penalizarBloques(l) + penalizarFalsosBuscadores(l) + penalizarDesequilibrio(l);
}

const modulo = (l: Lienzo) => (y: number, x: number) => l.modulos[idx(l, y, x)];

/** Puntos por una racha de `racha` módulos iguales: 3 desde cinco, uno más por cada extra. */
const puntosDeRacha = (racha: number) => (racha >= 5 ? 3 + (racha - 5) : 0);

/** 1. Cinco o más módulos iguales seguidos, en filas y columnas. */
function penalizarRachas(l: Lienzo): number {
  let total = 0;
  for (let f = 0; f < l.size; f++) total += rachasEnLinea(l, f, true) + rachasEnLinea(l, f, false);
  return total;
}

/** Puntos por rachas en la fila `f` (o en la columna `f` si `porFila` es falso). */
function rachasEnLinea(l: Lienzo, f: number, porFila: boolean): number {
  const n = l.size;
  const at = modulo(l);
  const valor = (c: number) => (porFila ? at(f, c) : at(c, f));
  let total = 0;
  let racha = 1;
  for (let c = 1; c < n; c++) {
    if (valor(c) === valor(c - 1)) {
      racha++;
    } else {
      total += puntosDeRacha(racha);
      racha = 1;
    }
  }
  return total + puntosDeRacha(racha);
}

/** 2. Bloques de 2x2 del mismo color. */
function penalizarBloques(l: Lienzo): number {
  const n = l.size;
  const at = modulo(l);
  let total = 0;
  for (let f = 0; f < n - 1; f++) {
    for (let c = 0; c < n - 1; c++) {
      const v = at(f, c);
      if (v === at(f, c + 1) && v === at(f + 1, c) && v === at(f + 1, c + 1)) total += 3;
    }
  }
  return total;
}

const PATRON_BUSCADOR = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
const PATRON_BUSCADOR_INVERTIDO = [...PATRON_BUSCADOR].reverse();
const coincideEn = (linea: number[], desde: number, ref: number[]) => ref.every((v, k) => linea[desde + k] === v);
const pareceBuscador = (linea: number[], desde: number) =>
  coincideEn(linea, desde, PATRON_BUSCADOR) || coincideEn(linea, desde, PATRON_BUSCADOR_INVERTIDO);

/** 3. El dibujo 1:1:3:1:1 con cuatro claros a un lado, que imita un buscador. */
function penalizarFalsosBuscadores(l: Lienzo): number {
  const n = l.size;
  const at = modulo(l);
  let total = 0;
  for (let f = 0; f < n; f++) {
    const fila: number[] = [];
    const columna: number[] = [];
    for (let c = 0; c < n; c++) {
      fila.push(at(f, c));
      columna.push(at(c, f));
    }
    for (let c = 0; c + PATRON_BUSCADOR.length <= n; c++) {
      if (pareceBuscador(fila, c)) total += 40;
      if (pareceBuscador(columna, c)) total += 40;
    }
  }
  return total;
}

/** 4. Desequilibrio entre claros y oscuros. */
function penalizarDesequilibrio(l: Lienzo): number {
  let oscuros = 0;
  for (const m of l.modulos) oscuros += m === 1 ? 1 : 0;
  const porcentaje = (oscuros * 100) / l.modulos.length;
  return Math.floor(Math.abs(porcentaje - 50) / 5) * 10;
}

/** 15 bits de formato: nivel de corrección, máscara y su BCH. */
function bitsDeFormato(mascara: number): number {
  const datos = (ECC_LEVEL_BITS << 3) | mascara;
  let resto = datos << 10;
  for (let i = 14; i >= 10; i--) {
    if ((resto >> i) & 1) resto ^= 0b10100110111 << (i - 10);
  }
  return ((datos << 10) | resto) ^ 0b101010000010010;
}

/** 18 bits de versión, a partir de la 7. */
function bitsDeVersion(version: number): number {
  let resto = version << 12;
  for (let i = 17; i >= 12; i--) {
    if ((resto >> i) & 1) resto ^= 0b1111100100101 << (i - 12);
  }
  return (version << 12) | resto;
}

/**
 * Escribe las dos copias de los 15 bits de formato.
 *
 * Las posiciones van explícitas, en el orden del estándar y empezando por el
 * bit más significativo. Escribirlas con bucles aritméticos es donde se cuela
 * el error: hay dos convenciones de numeración dando vueltas y con la
 * equivocada el código sale perfecto a la vista y no lo lee nadie.
 *
 * La segunda copia son **siete** módulos en la columna 8 y ocho en la fila 8,
 * no ocho y siete: el que falta es el módulo oscuro fijo, que no forma parte
 * del formato.
 */
function escribirFormato(l: Lienzo, mascara: number): void {
  const n = l.size;
  const bits = bitsDeFormato(mascara);
  /** k = 0 es el bit más significativo de los quince. */
  const bit = (k: number) => (bits >> (14 - k)) & 1;

  const copia1: [number, number][] = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  copia1.forEach(([f, c], k) => set(l, f, c, bit(k)));

  const copia2: [number, number][] = [
    [n - 1, 8], [n - 2, 8], [n - 3, 8], [n - 4, 8], [n - 5, 8], [n - 6, 8], [n - 7, 8],
    [8, n - 8], [8, n - 7], [8, n - 6], [8, n - 5], [8, n - 4], [8, n - 3], [8, n - 2],
    [8, n - 1],
  ];
  copia2.forEach(([f, c], k) => set(l, f, c, bit(k)));
}

function escribirVersion(l: Lienzo, version: number): void {
  if (version < 7) return;
  const n = l.size;
  const bits = bitsDeVersion(version);
  for (let i = 0; i < 18; i++) {
    const v = (bits >> i) & 1;
    const fila = Math.floor(i / 3);
    const col = (i % 3) + n - 11;
    set(l, fila, col, v);
    set(l, col, fila, v);
  }
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export interface QrCode {
  /** Lado de la matriz, sin margen. */
  size: number;
  /** `true` = módulo oscuro. Una fila por elemento externo. */
  modules: boolean[][];
  version: number;
}

/**
 * Codifica un texto en una matriz QR.
 *
 * El texto viaja tal cual: lo que se encode aquí es exactamente lo que leerá
 * quien escanee, que es lo que §43 exige poder afirmar.
 */
/** La versión más chica (1 a 10) donde caben los datos; 0 si no cabe en ninguna. */
function versionParaBytes(bytes: number): number {
  return Number(
    Object.keys(VERSIONS).find((v) => {
      const [capacidad] = VERSIONS[Number(v)];
      const indicador = Number(v) >= 10 ? 16 : 8;
      // 4 bits de modo + el indicador de longitud + los datos.
      return capacidad * 8 >= 4 + indicador + bytes * 8;
    }) ?? 0,
  );
}

/** Corta los codewords en bloques (dos grupos) y calcula la corrección de cada uno. */
function dividirEnBloques(codewords: Uint8Array, version: number): { datos: Uint8Array[]; ecc: Uint8Array[] } {
  const [, eccPorBloque, bloques1, datos1, bloques2, datos2] = VERSIONS[version];
  const datos: Uint8Array[] = [];
  const correccion: Uint8Array[] = [];
  let desde = 0;
  for (const [cantidad, largo] of [[bloques1, datos1], [bloques2, datos2]]) {
    for (let i = 0; i < cantidad; i++) {
      const bloque = codewords.slice(desde, desde + largo);
      desde += largo;
      datos.push(bloque);
      correccion.push(ecc(bloque, eccPorBloque));
    }
  }
  return { datos, ecc: correccion };
}

/** Entrelaza: primero los datos de todos los bloques, columna por columna; después la corrección. */
function entrelazar(datos: Uint8Array[], correccion: Uint8Array[], version: number): number[] {
  const [, eccPorBloque, , datos1, , datos2] = VERSIONS[version];
  const salida: number[] = [];
  const maxDatos = Math.max(datos1, datos2);
  for (let i = 0; i < maxDatos; i++) {
    for (const bloque of datos) {
      if (i < bloque.length) salida.push(bloque[i]);
    }
  }
  for (let i = 0; i < eccPorBloque; i++) {
    for (const bloque of correccion) salida.push(bloque[i]);
  }
  return salida;
}

/** Copia del lienzo con la máscara `m` aplicada fuera de las zonas reservadas y su formato escrito. */
function conMascara(base: Lienzo, m: number): Lienzo {
  const size = base.size;
  const candidato: Lienzo = { size, modulos: Int8Array.from(base.modulos), reservado: base.reservado };
  for (let f = 0; f < size; f++) {
    for (let c = 0; c < size; c++) {
      if (!candidato.reservado[idx(candidato, f, c)] && MASKS[m](f, c)) candidato.modulos[idx(candidato, f, c)] ^= 1;
    }
  }
  escribirFormato(candidato, m);
  return candidato;
}

/** Se prueban las ocho máscaras y gana la de menor penalización (la primera, si empatan). */
function mejorMascara(base: Lienzo): Lienzo {
  let mejor = conMascara(base, 0);
  let mejorPuntaje = penalizacion(mejor);
  for (let m = 1; m < 8; m++) {
    const candidato = conMascara(base, m);
    const puntaje = penalizacion(candidato);
    if (puntaje < mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = candidato;
    }
  }
  return mejor;
}

export function encodeQr(texto: string): QrCode {
  const datos = Buffer.from(texto, 'utf8');
  const version = versionParaBytes(datos.length);
  if (!version) {
    throw new Error(
      `El texto no cabe en un código QR de hasta versión 10 (${datos.length} bytes).`,
    );
  }

  const [totalDatos] = VERSIONS[version];
  const flujo = new BitStream();
  flujo.escribir(0b0100, 4);
  flujo.escribir(datos.length, version >= 10 ? 16 : 8);
  for (const byte of datos) flujo.escribir(byte, 8);
  const codewords = flujo.toCodewords(totalDatos);

  // Bloques, con su corrección, y entrelazado.
  const bloques = dividirEnBloques(codewords, version);
  const entrelazado = entrelazar(bloques.datos, bloques.ecc, version);

  const size = 17 + version * 4;
  const base: Lienzo = {
    size,
    modulos: new Int8Array(size * size).fill(0),
    reservado: new Uint8Array(size * size),
  };
  dibujarPatronesFijos(base, version);
  escribirVersion(base, version);
  colocarDatos(base, new Uint8Array(entrelazado));

  const elegido = mejorMascara(base);
  const modules: boolean[][] = [];
  for (let f = 0; f < size; f++) {
    const fila: boolean[] = [];
    for (let c = 0; c < size; c++) fila.push(elegido.modulos[idx(elegido, f, c)] === 1);
    modules.push(fila);
  }
  return { size, modules, version };
}

/**
 * Dibuja la matriz como SVG.
 *
 * El margen de cuatro módulos no es decorativo: sin él, muchos lectores no
 * encuentran el código.
 */
export function qrToSvg(qr: QrCode, modulo = 4, margen = 4): string {
  const lado = (qr.size + margen * 2) * modulo;
  const partes: string[] = [];
  for (let f = 0; f < qr.size; f++) {
    for (let c = 0; c < qr.size; c++) {
      if (!qr.modules[f][c]) continue;
      partes.push(
        `M${(c + margen) * modulo} ${(f + margen) * modulo}h${modulo}v${modulo}h-${modulo}z`,
      );
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" `
    + `viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges" role="img" `
    + `aria-label="Código QR del perfil compartible">`
    + `<rect width="${lado}" height="${lado}" fill="#ffffff"/>`
    + `<path d="${partes.join('')}" fill="#000000"/>`
    + `</svg>`
  );
}
