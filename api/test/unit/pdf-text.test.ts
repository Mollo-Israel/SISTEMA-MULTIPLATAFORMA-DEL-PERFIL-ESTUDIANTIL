/**
 * Extracción de texto de un PDF (§29): lo que se compara con lo que declara el
 * estudiante. Se arman PDF mínimos en memoria; no hace falta ningún archivo.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { esPdf, extractPdfText, normalizar } from '../../src/validation/pdf-text';

const CONTENIDO = String.raw`BT
(Certificado de) Tj
[(Ana)-300(P\351rez)] TJ
[(Cur)-50(so)] TJ
(Taller \(IA\)) '
<48 6F 6C 61> Tj
ET`;

/** Un PDF con un flujo de contenido (comprimido o no) y, si se pide, enlaces e imagen. */
function pdf(opciones: { comprimido?: boolean; enlaces?: string[]; imagen?: boolean } = {}): Buffer {
  const datos = opciones.comprimido ? deflateSync(Buffer.from(CONTENIDO, 'latin1')) : Buffer.from(CONTENIDO, 'latin1');
  const filtro = opciones.comprimido ? ' /Filter /FlateDecode' : '';
  const partes: Buffer[] = [
    Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${datos.length}${filtro} >>\nstream\n`, 'latin1'),
    datos,
    Buffer.from('\nendstream\nendobj\n', 'latin1'),
  ];
  if (opciones.imagen) {
    partes.push(Buffer.from('2 0 obj\n<< /Filter /DCTDecode /Length 4 >>\nstream\n\xff\xd8\xff\xe0\nendstream\nendobj\n', 'latin1'));
  }
  for (const url of opciones.enlaces ?? []) {
    partes.push(Buffer.from(`<< /Type /Annot /Subtype /Link /A << /S /URI /URI (${url}) >> >>\n`, 'latin1'));
  }
  partes.push(Buffer.from('%%EOF\n', 'latin1'));
  return Buffer.concat(partes);
}

const ESPERADO = 'Certificado de\nAna Pérez\nCurso\nTaller (IA)\nHola';

describe('Texto de un PDF', () => {
  it('reconoce un PDF por su cabecera', () => {
    assert.equal(esPdf(pdf()), true);
    assert.equal(esPdf(Buffer.from('hola, no soy un PDF')), false);
    assert.deepEqual(extractPdfText(Buffer.from('<html></html>')), { text: '', streams: 0, links: [] });
  });

  it('lee Tj, comilla y TJ: un ajuste grande separa palabras, uno chico no', () => {
    const r = extractPdfText(pdf());
    assert.equal(r.text, ESPERADO);
    assert.equal(r.streams, 1);
  });

  it('lee igual un flujo comprimido con FlateDecode', () => {
    assert.equal(extractPdfText(pdf({ comprimido: true })).text, ESPERADO);
  });

  it('las imágenes no se decodifican ni cuentan como flujo de texto', () => {
    const r = extractPdfText(pdf({ imagen: true }));
    assert.equal(r.streams, 1);
    assert.equal(r.text, ESPERADO);
  });

  it('devuelve los enlaces http(s) de las anotaciones, sin repetir', () => {
    const r = extractPdfText(pdf({ enlaces: ['https://verifica.org/c/123', 'javascript:alert(1)', 'https://verifica.org/c/123'] }));
    assert.deepEqual(r.links, ['https://verifica.org/c/123']);
  });

  it('normaliza espacios, saltos y caracteres de control', () => {
    assert.equal(normalizar('  Ana \t  Pérez \r\n\n\n\nCurso\u0007 '), 'Ana Pérez\n\nCurso');
  });
});
