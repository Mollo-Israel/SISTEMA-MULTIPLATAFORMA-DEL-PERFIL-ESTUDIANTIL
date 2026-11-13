/**
 * pageRecipientName ahora lee la página por pasos (SonarQube S5843) y debe
 * dar exactamente lo mismo que la expresión única que reemplaza. Se comparan
 * ambas sobre miles de entradas armadas con etiquetas, nombres, partículas,
 * separadores y letras fuera del plano básico, además de casos escritos a mano.
 */
import { pageRecipientName } from '../../../src/validation/credential-check.rules';

const ORIGINAL = (text: string): string | null => {
  const m = text.match(
    /(?:[Ii]ssued to|[Aa]warded to|[Ee]arned by|[Pp]resented to|[Gg]ranted to|[Oo]torgad[oa] a|[Ee]mitid[oa] a|[Ee]xpedid[oa] a|[Cc]onferid[oa] a)(?:\s*:\s+|\s+)(\p{Lu}[\p{L}'’-]+(?:\s+(?:de\s+(?:la\s+)?|del\s+)?\p{Lu}[\p{L}'’-]+){1,4})/u,
  );
  return m ? m[1].trim() : null;
};

function generador(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function combinar(piezas: string[], cantidad: number, largoMax: number, semilla: number, union = ''): string[] {
  const azar = generador(semilla);
  const salida: string[] = [];
  for (let i = 0; i < cantidad; i += 1) {
    const largo = Math.floor(azar() * (largoMax + 1));
    const partes: string[] = [];
    for (let k = 0; k < largo; k += 1) partes.push(piezas[Math.floor(azar() * piezas.length)]);
    salida.push(partes.join(union));
  }
  return salida;
}

// Letras fuera del plano básico: mayúscula y minúscula matemáticas, y una
// letra de título (ǅ), que es letra pero no mayúscula.
const MAYUSCULA_ASTRAL = String.fromCodePoint(0x1d400);
const MINUSCULA_ASTRAL = String.fromCodePoint(0x1d41a);
const TITULO = String.fromCodePoint(0x01c5);

const ETIQUETAS = [
  'issued to', 'Issued to', 'ISSUED TO', 'awarded to', 'Awarded to', 'Earned by', 'earned by', 'presented to',
  'Granted to', 'otorgado a', 'Otorgada a', 'otorgadx a', 'emitido a', 'Emitida a', 'Expedido a', 'expedida a',
  'conferido a', 'Conferida a', 'reissued to', 'issued  to', 'issued to:',
];
const PALABRAS = [
  'Juan', 'Ana', 'María', 'José-Luis', "O'Brien", 'D’Angelo', 'Ñu', 'É', 'A', 'CCNA', 'juan', 'for', 'por',
  'de', 'la', 'del', 'De', 'La', 'Del', 'de la', 'del la', `${MAYUSCULA_ASTRAL}${MINUSCULA_ASTRAL}`,
  `${MAYUSCULA_ASTRAL}x`, `x${MAYUSCULA_ASTRAL}`, `${TITULO}a`, 'Üz', "'", '-', '.', ',',
];
const SEPARADORES = [' ', '  ', '\t', '\n', ':', ' : ', ': ', ' :', '\u00a0', ''];

describe('pageRecipientName equivale a la expresión única que reemplaza', () => {
  it('casos escritos a mano', () => {
    const casos = [
      'Credential AB-77 issued to Persona Distinta for CCNA',
      'Certificado otorgado a Juan de la Cruz por el curso',
      'Curso CCNA sin titular visible',
      'Issued to: María José Pérez del Castillo de la Vega Ruiz',
      'awarded to  Ana  ',
      'Presented to : Ana Lucía',
      'Granted to:Ana Lucía',
      'emitida a\nJuan\nPérez',
      'Expedido a JUAN PÉREZ',
      'conferido a Juan de la casa y luego otorgado a Pedro Gómez',
      `Issued to ${MAYUSCULA_ASTRAL}${MINUSCULA_ASTRAL} Pérez`,
      'reissued to Ana Bea',
      'Earned by Ana De la Cruz',
      '',
    ];
    for (const t of casos) expect(pageRecipientName(t)).toBe(ORIGINAL(t));
    expect(pageRecipientName('Certificado otorgado a Juan de la Cruz por el curso')).toBe('Juan de la Cruz');
  });

  it('etiqueta, separador y nombre combinados al azar', () => {
    const azar = generador(21);
    const elegir = (lista: string[]) => lista[Math.floor(azar() * lista.length)];
    for (let i = 0; i < 20000; i += 1) {
      const palabras = Array.from({ length: Math.floor(azar() * 8) }, () => elegir(PALABRAS));
      const unir = () => elegir(SEPARADORES);
      const t = `${elegir(PALABRAS)}${unir()}${elegir(ETIQUETAS)}${unir()}${palabras.map((p) => p + unir()).join('')}`;
      expect(pageRecipientName(t)).toBe(ORIGINAL(t));
    }
  });

  it('piezas sueltas en cualquier orden', () => {
    const piezas = [...ETIQUETAS, ...PALABRAS, ...SEPARADORES];
    for (const t of combinar(piezas, 20000, 12, 22)) expect(pageRecipientName(t)).toBe(ORIGINAL(t));
    for (const t of combinar(piezas, 10000, 12, 23, ' ')) expect(pageRecipientName(t)).toBe(ORIGINAL(t));
  });
});
