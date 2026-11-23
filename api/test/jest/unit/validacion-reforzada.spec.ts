/**
 * V9 · Validación reforzada de credenciales externas (reglas puras).
 *
 * Cada caso fabrica el archivo que imita una trampa concreta —un PDF
 * retocado después de firmado, una imagen pasada por Photoshop, otra
 * generada con IA, un QR que no corresponde al código impreso— y comprueba
 * que el sistema lo detecta. También lo contrario: que un documento limpio
 * y legítimo no se acusa.
 */
import { webcrypto } from 'node:crypto';
import { crc32 } from 'node:zlib';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';
import { CredentialCheckStatus, LinkCheckStatus } from '@perfil/shared';
import { analyzePdf, contarRevisiones, esAgregadoBenigno, fechaPdf, valoresDeClave } from '../../../src/validation/forensics/pdf-forensics';
import { verifyPdfSignature } from '../../../src/validation/forensics/pdf-signature';
import { analyzeImage, dHashDeImagen, hamming } from '../../../src/validation/forensics/image-forensics';
import { ForensicsService, firmadoPorElEmisor } from '../../../src/validation/forensics/forensics.service';
import { clasificarPrograma, fuenteIa, generadorIa } from '../../../src/validation/forensics/forensic-report';
import {
  credlyAssertionMatches,
  credlyAssertionUrl,
  credlyBadgeId,
  enlaceDeCredencial,
  firmanteEsEmisor,
  normalizarCodigo,
  qrContradiceCodigo,
} from '../../../src/validation/credential-integrity.rules';
import { decideCredentialCheck, providerSupportFor } from '../../../src/validation/credential-check.rules';
import { CredentialVerifierService, emisorCoincide } from '../../../src/validation/credential-verifier.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PNG } = require('pngjs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jpeg = require('jpeg-js');

pkijs.setEngine('node', new pkijs.CryptoEngine({ name: 'node', crypto: webcrypto as unknown as Crypto }));

// ===========================================================================
//  Fabricación de archivos
// ===========================================================================

/** PDF mínimo con un /Info y, opcionalmente, un XMP. */
function pdfSimple(info: string, extra = ''): Buffer {
  const contenido = 'BT /F1 12 Tf 20 100 Td (Certificado otorgado a Ana Quispe) Tj ET';
  return Buffer.from([
    '%PDF-1.7',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R >> endobj',
    `4 0 obj << /Length ${contenido.length} >> stream\n${contenido}\nendstream endobj`,
    `5 0 obj << ${info} >> endobj`,
    extra,
    'trailer << /Root 1 0 R /Info 5 0 R >>',
    '%%EOF',
    '',
  ].join('\n'), 'latin1');
}

function xmp(cuerpo: string): string {
  const x = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description ${cuerpo}/></rdf:RDF></x:xmpmeta>`;
  return `6 0 obj << /Type /Metadata /Subtype /XML /Length ${x.length} >> stream\n${x}\nendstream endobj`;
}

interface Autofirmado { cert: pkijs.Certificate; claves: CryptoKeyPair; der: Buffer }

async function certificado(cn: string, org: string): Promise<Autofirmado> {
  const claves = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const cert = new pkijs.Certificate();
  cert.version = 2;
  cert.serialNumber = new asn1js.Integer({ value: Date.now() % 1_000_000 });
  for (const nombre of [cert.issuer, cert.subject]) {
    nombre.typesAndValues.push(new pkijs.AttributeTypeAndValue({ type: '2.5.4.3', value: new asn1js.Utf8String({ value: cn }) }));
    nombre.typesAndValues.push(new pkijs.AttributeTypeAndValue({ type: '2.5.4.10', value: new asn1js.Utf8String({ value: org }) }));
  }
  cert.notBefore.value = new Date(Date.now() - 86_400_000);
  cert.notAfter.value = new Date(Date.now() + 365 * 86_400_000);
  const bc = new pkijs.BasicConstraints({ cA: true });
  cert.extensions = [new pkijs.Extension({ extnID: '2.5.29.19', critical: true, extnValue: bc.toSchema().toBER(false), parsedValue: bc })];
  await cert.subjectPublicKeyInfo.importKey(claves.publicKey);
  await cert.sign(claves.privateKey, 'SHA-256');
  return { cert, claves, der: Buffer.from(cert.toSchema(true).toBER(false)) };
}

const HUECO = 8192; // caracteres hex reservados para la firma

/** PDF firmado (adbe.pkcs7.detached) por `firmante`. */
async function pdfFirmado(firmante: Autofirmado, titular = 'Ana Quispe'): Promise<Buffer> {
  const contenido = `BT /F1 12 Tf 20 100 Td (Certificado otorgado a ${titular}) Tj ET`;
  const plantilla = [
    '%PDF-1.7',
    '1 0 obj << /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [5 0 R] /SigFlags 3 >> >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R >> endobj',
    `4 0 obj << /Length ${contenido.length} >> stream\n${contenido}\nendstream endobj`,
    '5 0 obj << /FT /Sig /T (Firma) /V 6 0 R >> endobj',
    `6 0 obj << /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /ByteRange [0 ########## ########## ##########] /Contents <${'0'.repeat(HUECO)}> >> endobj`,
    '7 0 obj << /Producer (Sistema de certificados) /CreationDate (D:20250827120000Z) >> endobj',
    'trailer << /Root 1 0 R /Info 7 0 R >>',
    '%%EOF',
    '',
  ].join('\n');
  const b = plantilla.indexOf('/Contents <') + '/Contents '.length;
  const c = b + HUECO + 2;
  const largo = Buffer.byteLength(plantilla, 'latin1');
  const pad = (n: number) => String(n).padEnd(10, ' ');
  const conRango = plantilla.replace('########## ########## ##########', `${pad(b)} ${pad(c)} ${pad(largo - c)}`);
  const pdf = Buffer.from(conRango, 'latin1');
  const firmado = Buffer.concat([pdf.subarray(0, b), pdf.subarray(c)]);

  const resumen = await webcrypto.subtle.digest('SHA-256', firmado);
  const sd = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: '1.2.840.113549.1.7.1' }),
    signerInfos: [new pkijs.SignerInfo({
      version: 1,
      sid: new pkijs.IssuerAndSerialNumber({ issuer: firmante.cert.issuer, serialNumber: firmante.cert.serialNumber }),
    })],
    certificates: [firmante.cert],
  });
  sd.signerInfos[0].signedAttrs = new pkijs.SignedAndUnsignedAttributes({
    type: 0,
    attributes: [
      new pkijs.Attribute({ type: '1.2.840.113549.1.9.3', values: [new asn1js.ObjectIdentifier({ value: '1.2.840.113549.1.7.1' })] }),
      new pkijs.Attribute({ type: '1.2.840.113549.1.9.5', values: [new asn1js.UTCTime({ valueDate: new Date() })] }),
      new pkijs.Attribute({ type: '1.2.840.113549.1.9.4', values: [new asn1js.OctetString({ valueHex: resumen })] }),
    ],
  });
  await sd.sign(firmante.claves.privateKey, 0, 'SHA-256');
  const ci = new pkijs.ContentInfo({ contentType: '1.2.840.113549.1.7.2', content: sd.toSchema(true) });
  const hex = Buffer.from(ci.toSchema().toBER(false)).toString('hex').toUpperCase();
  if (hex.length > HUECO) throw new Error('La firma no entra en el hueco.');
  Buffer.from(hex.padEnd(HUECO, '0'), 'latin1').copy(pdf, b + 1);
  return pdf;
}

function bloquePng(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const td = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([largo, td, crc]);
}

/** PNG de 64×48 con un patrón (semilla) y bloques de metadatos extra. */
function png(semilla: number, bloques: Buffer[] = []): Buffer {
  const img = new PNG({ width: 64, height: 48 });
  for (let y = 0; y < 48; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      const i = (y * 64 + x) * 4;
      const v = ((x * semilla + y * (semilla + 3)) % 256);
      img.data[i] = v; img.data[i + 1] = (v * 3) % 256; img.data[i + 2] = 255 - v; img.data[i + 3] = 255;
    }
  }
  const base: Buffer = PNG.sync.write(img);
  const iend = base.length - 12;
  return Buffer.concat([base.subarray(0, iend), ...bloques, base.subarray(iend)]);
}

const tEXt = (clave: string, valor: string) => bloquePng('tEXt', Buffer.concat([Buffer.from(clave, 'latin1'), Buffer.from([0]), Buffer.from(valor, 'latin1')]));
const iTXt = (clave: string, valor: string) => bloquePng('iTXt', Buffer.concat([Buffer.from(clave, 'latin1'), Buffer.from([0, 0, 0, 0, 0]), Buffer.from(valor, 'utf8')]));

/** JPEG con un APP1 EXIF que declara `software`. */
function jpegConSoftware(semilla: number, software: string | null, app13 = false): Buffer {
  const w = 64; const h = 48;
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i += 1) { data[i * 4] = (i * semilla) % 256; data[i * 4 + 1] = (i * 7) % 256; data[i * 4 + 2] = 128; data[i * 4 + 3] = 255; }
  const base: Buffer = jpeg.encode({ data, width: w, height: h }, 90).data;
  const segmentos: Buffer[] = [];
  if (software) {
    const s = Buffer.from(`${software}\0`, 'latin1');
    const tiff = Buffer.alloc(26 + s.length);
    tiff.write('II', 0, 'latin1'); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4);
    tiff.writeUInt16LE(1, 8); // una entrada
    tiff.writeUInt16LE(0x0131, 10); tiff.writeUInt16LE(2, 12); tiff.writeUInt32LE(s.length, 14); tiff.writeUInt32LE(26, 18);
    tiff.writeUInt32LE(0, 22);
    s.copy(tiff, 26);
    const cuerpo = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
    const cab = Buffer.from([0xff, 0xe1, 0, 0]); cab.writeUInt16BE(cuerpo.length + 2, 2);
    segmentos.push(cab, cuerpo);
  }
  if (app13) {
    const cuerpo = Buffer.concat([Buffer.from('Photoshop 3.0', 'latin1'), Buffer.from([0]), Buffer.from('8BIM', 'latin1'), Buffer.from([4, 4, 0, 0, 0, 0, 0, 0])]);
    const cab = Buffer.from([0xff, 0xed, 0, 0]); cab.writeUInt16BE(cuerpo.length + 2, 2);
    segmentos.push(cab, cuerpo);
  }
  return Buffer.concat([base.subarray(0, 2), ...segmentos, base.subarray(2)]);
}

const codigos = (r: { signals: { code: string }[] }) => r.signals.map((s) => s.code);

// ===========================================================================
//  PDF
// ===========================================================================

describe('V9 · Forense de PDF', () => {
  it('un PDF limpio de un sistema de certificados no tiene señales', () => {
    const { report, signatures } = analyzePdf(pdfSimple('/Producer (Huawei Certificate System) /CreationDate (D:20250827120000Z)'));
    expect(report.producer).toBe('Huawei Certificate System');
    expect(report.revisions).toBe(1);
    expect(report.signals).toEqual([]);
    expect(signatures).toEqual([]);
  });

  it('detecta Photoshop y Canva como editores, también en UTF-16 hexadecimal', () => {
    expect(codigos(analyzePdf(pdfSimple('/Producer (Adobe Photoshop 25.1 \\(Windows\\))')).report)).toContain('image_editor');
    const canvaUtf16 = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from('Canva', 'utf16le').swap16()]).toString('hex');
    const r = analyzePdf(pdfSimple(`/Creator <${canvaUtf16}>`)).report;
    expect(r.creator).toBe('Canva');
    expect(codigos(r)).toContain('online_editor');
  });

  it('marca «Microsoft Print to PDF» solo como información (reimpresión)', () => {
    const r = analyzePdf(pdfSimple('/Producer (Microsoft: Print To PDF)')).report;
    expect(r.signals).toEqual([expect.objectContaining({ code: 'reprinted', severity: 'info' })]);
  });

  it('un XMP con IPTC trainedAlgorithmicMedia es contenido generado por IA (crítico)', () => {
    const pdf = pdfSimple('/Producer (X)', xmp('xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"'));
    expect(analyzePdf(pdf).report.signals).toContainEqual(expect.objectContaining({ code: 'ai_generated', severity: 'critical' }));
  });

  it('el historial XMP delata el editor aunque /Producer diga otra cosa', () => {
    const pdf = pdfSimple('/Producer (Sistema del emisor)', xmp('xmlns:stEvt="http://ns.adobe.com/xap/1.0/sType/ResourceEvent#" stEvt:softwareAgent="Adobe Photoshop 2024"'));
    expect(codigos(analyzePdf(pdf).report)).toContain('image_editor');
  });

  it('un certificado sobre «Generative AI with Gemini» NO se marca como generado por IA', () => {
    const pdf = pdfSimple('/Title (Generative AI with Gemini) /Producer (Coursera)', xmp('xmlns:dc="http://purl.org/dc/elements/1.1/" dc:title="Generative AI with Gemini"'));
    expect(codigos(analyzePdf(pdf).report)).not.toContain('ai_generated');
  });

  it('fechas: modificado días después de creado y fecha futura', () => {
    const r = analyzePdf(pdfSimple('/CreationDate (D:20250827120000Z) /ModDate (D:20251020093000-04\'00\')'), new Date('2026-01-01')).report;
    expect(codigos(r)).toContain('modified_later');
    const f = analyzePdf(pdfSimple('/CreationDate (D:20300101000000Z)'), new Date('2026-11-23')).report;
    expect(codigos(f)).toContain('future_date');
    expect(fechaPdf("D:20250827120000-04'00'")?.toISOString()).toBe('2025-08-27T16:00:00.000Z');
  });

  it('un PDF sin firma guardado dos veces sobre sí mismo tiene ediciones sucesivas', () => {
    const base = pdfSimple('/Producer (Emisor)');
    const editado = Buffer.concat([base, Buffer.from('7 0 obj << /Producer (Emisor) >> endobj\ntrailer << /Root 1 0 R /Prev 0 >>\n%%EOF\n', 'latin1')]);
    expect(contarRevisiones(editado)).toBe(2);
    expect(codigos(analyzePdf(editado).report)).toContain('incremental_edits');
  });

  it('un PDF linealizado no cuenta su segunda marca %%EOF como edición', () => {
    const lin = Buffer.concat([Buffer.from('%PDF-1.7\n1 0 obj << /Linearized 1 /L 999 >> endobj\n%%EOF\n', 'latin1'), pdfSimple('/Producer (X)').subarray(9)]);
    expect(contarRevisiones(lin)).toBe(1);
  });

  it('lee cadenas con paréntesis anidados y escapes octales', () => {
    expect(valoresDeClave('/Producer (Hola \\(mundo\\) \\341rbol)', 'Producer')).toEqual(['Hola (mundo) árbol']);
  });
});

describe('V9 · Firma digital de PDF', () => {
  let huawei: Autofirmado;
  let pdf: Buffer;

  beforeAll(async () => {
    huawei = await certificado('Huawei Certificate Service', 'Huawei Technologies Co., Ltd.');
    pdf = await pdfFirmado(huawei);
  });

  it('localiza la firma y comprueba integridad y firma', async () => {
    const { signatures, report } = analyzePdf(pdf);
    expect(signatures).toHaveLength(1);
    expect(report.signals).toEqual([]);
    const r = await verifyPdfSignature(pdf, signatures[0], true);
    expect(r.integrity).toBe(true);
    expect(r.signatureValid).toBe(true);
    expect(r.signerOrganization).toBe('Huawei Technologies Co., Ltd.');
    expect(r.signingTime).toMatch(/^\d{4}-/);
    // Autofirmado: no llega a ninguna raíz pública.
    expect(r.trusted).toBe(false);
  });

  it('con la raíz en el almacén de confianza y el emisor declarado, el documento está firmado por el emisor', async () => {
    const svc = new ForensicsService();
    svc.signatureOptions = { extraTrustedRoots: [huawei.der] };
    const r = await svc.analyze(pdf, 'application/pdf', { issuer: 'Huawei ICT Academy', officialDomains: ['huawei.com'] });
    expect(r.signature?.trusted).toBe(true);
    expect(r.signature?.issuerMatches).toBe(true);
    expect(firmadoPorElEmisor(r)).toBe(true);
  });

  it('el mismo PDF declarado como de Cisco no está firmado por el emisor', async () => {
    const svc = new ForensicsService();
    svc.signatureOptions = { extraTrustedRoots: [huawei.der] };
    const r = await svc.analyze(pdf, 'application/pdf', { issuer: 'Cisco Networking Academy', officialDomains: ['cisco.com'] });
    expect(r.signature?.issuerMatches).toBe(false);
    expect(firmadoPorElEmisor(r)).toBe(false);
  });

  it('sin la raíz pública, la firma es válida pero «sin confianza» (información, no acusación)', async () => {
    const r = await new ForensicsService().analyze(pdf, 'application/pdf', { issuer: 'Huawei', officialDomains: null });
    expect(r.signals).toContainEqual(expect.objectContaining({ code: 'signature_untrusted', severity: 'info' }));
    expect(firmadoPorElEmisor(r)).toBe(false);
  });

  it('cambiar un solo byte firmado (el nombre) rompe la firma', async () => {
    const trucho = Buffer.from(pdf);
    const i = trucho.indexOf('Ana Quispe');
    trucho.write('Eva', i, 'latin1');
    const r = await new ForensicsService().analyze(trucho, 'application/pdf', { issuer: 'Huawei', officialDomains: null });
    expect(r.signature?.integrity).toBe(false);
    expect(r.signals).toContainEqual(expect.objectContaining({ code: 'signature_broken', severity: 'critical' }));
  });

  it('agregar una página después de firmar es una edición posterior (crítica)', async () => {
    const extra = Buffer.from('\n3 0 obj << /Type /Page /Parent 2 0 R /Contents 8 0 R >> endobj\n8 0 obj << /Length 10 >> stream\nBT (X) Tj\nendstream endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n', 'latin1');
    const editado = Buffer.concat([pdf, extra]);
    const r = analyzePdf(editado).report;
    expect(r.signals).toContainEqual(expect.objectContaining({ code: 'modified_after_signature', severity: 'critical' }));
  });

  it('redefinir el flujo de contenido existente después de firmar también se detecta', () => {
    const extra = Buffer.from('\n4 0 obj << /Length 20 >> stream\nBT (Eva Perez) Tj ET\nendstream endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n', 'latin1');
    expect(esAgregadoBenigno(extra, pdf)).toBe(false);
  });

  it('agregar solo datos de validación a largo plazo (DSS) es benigno', () => {
    const ltv = Buffer.from('\n9 0 obj << /Length 4 >> stream\nAAAA\nendstream endobj\n10 0 obj << /Certs [9 0 R] /VRI << >> >> endobj\n1 0 obj << /Type /Catalog /Pages 2 0 R /DSS 10 0 R >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n', 'latin1');
    expect(esAgregadoBenigno(ltv, pdf)).toBe(true);
    expect(codigos(analyzePdf(Buffer.concat([pdf, ltv])).report)).not.toContain('modified_after_signature');
  });
});

// ===========================================================================
//  Imágenes
// ===========================================================================

describe('V9 · Forense de imágenes', () => {
  it('un PNG sin metadatos no tiene señales y tiene hash perceptual', () => {
    const r = analyzeImage(png(5), 'image/png');
    expect(r.signals).toEqual([]);
    expect(r.perceptualHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('PNG con Software = Photoshop → editor de imágenes', () => {
    expect(codigos(analyzeImage(png(5, [tEXt('Software', 'Adobe Photoshop 25.0 (Windows)')]), 'image/png'))).toContain('image_editor');
  });

  it('PNG de Stable Diffusion (AUTOMATIC1111) → IA', () => {
    const r = analyzeImage(png(5, [tEXt('parameters', 'certificate, award\nSteps: 20, Sampler: Euler a, CFG scale: 7, Seed: 1')]), 'image/png');
    expect(r.signals).toContainEqual(expect.objectContaining({ code: 'ai_generated', severity: 'critical' }));
  });

  it('un bloque «prompt» cualquiera no se confunde con ComfyUI', () => {
    expect(codigos(analyzeImage(png(5, [tEXt('prompt', 'nota del usuario')]), 'image/png'))).not.toContain('ai_generated');
  });

  it('PNG con XMP IPTC trainedAlgorithmicMedia → IA', () => {
    const x = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"/></rdf:RDF></x:xmpmeta>';
    expect(codigos(analyzeImage(png(5, [iTXt('XML:com.adobe.xmp', x)]), 'image/png'))).toContain('ai_generated');
  });

  it('PNG con manifiesto C2PA de ChatGPT → IA; de Photoshop → credenciales de contenido + editor', () => {
    const ia = analyzeImage(png(5, [bloquePng('caBX', Buffer.from('jumbc2pa...claim_generator\x6bChatGPT/1.0 c2pa-rs/0.31', 'latin1'))]), 'image/png');
    expect(codigos(ia)).toContain('ai_generated');
    const ps = analyzeImage(png(5, [bloquePng('caBX', Buffer.from('jumbc2pa...claim_generator\x70Adobe Photoshop 25.9', 'latin1'))]), 'image/png');
    expect(codigos(ps)).toEqual(expect.arrayContaining(['content_credentials', 'image_editor']));
  });

  it('JPEG con EXIF Software = GIMP → editor; con bloque Photoshop (APP13) → editor', () => {
    expect(codigos(analyzeImage(jpegConSoftware(3, 'GIMP 2.10.36'), 'image/jpeg'))).toContain('image_editor');
    expect(codigos(analyzeImage(jpegConSoftware(3, null, true), 'image/jpeg'))).toContain('image_editor');
    expect(analyzeImage(jpegConSoftware(3, 'Canon EOS R6'), 'image/jpeg').signals).toEqual([]);
  });

  it('el hash perceptual reconoce la misma imagen recomprimida y distingue otra', () => {
    const a = png(5);
    const pixeles = PNG.sync.read(a);
    const comoJpeg: Buffer = jpeg.encode({ data: pixeles.data, width: 64, height: 48 }, 70).data;
    const ha = dHashDeImagen(a, 'image/png')!;
    expect(hamming(ha, dHashDeImagen(comoJpeg, 'image/jpeg')!)).toBeLessThanOrEqual(6);
    expect(hamming(ha, dHashDeImagen(png(11), 'image/png')!)).toBeGreaterThan(20);
  });
});

describe('V9 · Programas y marcas', () => {
  it('clasifica programas', () => {
    expect(clasificarPrograma('Adobe Photoshop CC')?.code).toBe('image_editor');
    expect(clasificarPrograma('iLovePDF')?.code).toBe('online_editor');
    expect(clasificarPrograma('Skia/PDF m120')?.code).toBe('reprinted');
    expect(clasificarPrograma('Microsoft® Word 2019')).toBeNull();
  });
  it('solo marcas explícitas de IA', () => {
    expect(fuenteIa('...compositeWithTrainedAlgorithmicMedia...')).toMatch(/compositeWithTrainedAlgorithmicMedia/);
    expect(generadorIa('DALL·E 3')).toMatch(/Generador/);
    expect(generadorIa('Adobe Acrobat Pro')).toBeNull();
  });
});

// ===========================================================================
//  Reglas de integridad
// ===========================================================================

describe('V9 · QR frente al código impreso', () => {
  it('el código impreso dentro del QR es coherente', () => {
    expect(qrContradiceCodigo(['ICTCRA20250827001275'], ['https://e.huawei.com/cert?code=ICTCRA20250827001275'])).toBeNull();
  });
  it('mismo formato, distinto número: el código impreso se editó y el QR quedó', () => {
    expect(qrContradiceCodigo(['ICTCRA20250827001275'], ['https://e.huawei.com/cert?code=ICTCRA20250827009999']))
      .toEqual({ impreso: 'ICTCRA20250827001275', enQr: 'ICTCRA20250827009999' });
  });
  it('un UUID de insignia en el QR no se confunde con el número del certificado', () => {
    expect(qrContradiceCodigo(['ICTCRA20250827001275'], ['https://www.credly.com/badges/1b9e1a1e-5f6a-4c1b-9a7c-0d3e2b8f1c22'])).toBeNull();
  });
  it('sin código impreso o sin QR no hay nada que contradecir', () => {
    expect(qrContradiceCodigo([null], ['https://x.org/a1b2c3d4'])).toBeNull();
    expect(qrContradiceCodigo(['ABC123456'], [])).toBeNull();
  });
});

describe('V9 · Normalización para comparar entre estudiantes', () => {
  it('códigos', () => {
    expect(normalizarCodigo(' ictcra-2025 0827.001275 ')).toBe('ICTCRA20250827001275');
    expect(normalizarCodigo('AB-1')).toBeNull();
  });
  it('enlaces individuales sí, portadas no', () => {
    expect(enlaceDeCredencial('https://www.credly.com/badges/1b9e1a1e-5f6a-4c1b-9a7c-0d3e2b8f1c22/public_url/?utm_source=x'))
      .toBe('credly.com/badges/1b9e1a1e-5f6a-4c1b-9a7c-0d3e2b8f1c22/public_url');
    expect(enlaceDeCredencial('https://www.netacad.com/certificates')).toBeNull();
    expect(enlaceDeCredencial('https://coursera.org/verify/ABCD1234EFGH#top')).toBe('coursera.org/verify/ABCD1234EFGH');
    expect(enlaceDeCredencial('javascript:alert(1)')).toBeNull();
  });
});

describe('V9 · Conector de Credly', () => {
  const ID = '1b9e1a1e-5f6a-4c1b-9a7c-0d3e2b8f1c22';
  it('reconoce los enlaces públicos y arma la API oficial', () => {
    expect(credlyBadgeId(`https://www.credly.com/badges/${ID}/public_url`)).toBe(ID);
    expect(credlyBadgeId(`https://www.youracclaim.com/badges/${ID}`)).toBe(ID);
    expect(credlyBadgeId(`https://www.credly.com/users/ana/badges`)).toBeNull();
    expect(credlyBadgeId(`https://evilcredly.com/badges/${ID}`)).toBeNull();
    expect(credlyAssertionUrl(`https://www.credly.com/badges/${ID}`)).toBe(`https://api.credly.com/v1/obi/v2/badge_assertions/${ID}`);
  });
  it('la aserción debe ser la de esa insignia', () => {
    expect(credlyAssertionMatches(`https://api.credly.com/v1/obi/v2/badge_assertions/${ID}`, ID)).toBe(true);
    expect(credlyAssertionMatches(`https://api.credly.com/v1/obi/v2/badge_assertions/00000000-0000-0000-0000-000000000000`, ID)).toBe(false);
  });

  it('de punta a punta con respuestas simuladas: destinatario por correo comprobado y emisor IBM', async () => {
    const { createHash } = await import('node:crypto');
    const sal = 'sal123';
    const correo = 'ana.personal@gmail.com';
    const asercion = {
      '@context': 'https://w3id.org/openbadges/v2',
      type: 'Assertion',
      id: `https://api.credly.com/v1/obi/v2/badge_assertions/${ID}`,
      recipient: { type: 'email', hashed: true, salt: sal, identity: `sha256$${createHash('sha256').update(correo + sal).digest('hex')}` },
      badge: 'https://api.credly.com/v1/obi/v2/issuers/abc/badge_classes/def',
      verification: { type: 'hosted' },
      issuedOn: '2025-08-27',
    };
    const respuestas: Record<string, unknown> = {
      [`https://api.credly.com/v1/obi/v2/badge_assertions/${ID}`]: asercion,
      'https://api.credly.com/v1/obi/v2/issuers/abc/badge_classes/def': { type: 'BadgeClass', name: 'Cloud Computing Foundations', issuer: 'https://api.credly.com/v1/obi/v2/issuers/abc' },
      'https://api.credly.com/v1/obi/v2/issuers/abc': { type: 'Issuer', name: 'IBM', url: 'https://www.ibm.com' },
    };
    const links = {
      fetchPage: async (url: string) => {
        const cuerpo = respuestas[url];
        return {
          result: { status: cuerpo ? LinkCheckStatus.AVAILABLE : LinkCheckStatus.UNAVAILABLE, finalUrl: url, httpStatus: cuerpo ? 200 : 404, title: null, blockedReason: null, checkedAt: '' },
          body: cuerpo ? JSON.stringify(cuerpo) : null,
          contentType: 'application/json',
        };
      },
    };
    const verificador = new CredentialVerifierService(links as never);
    const base = {
      declaredUrl: `https://www.credly.com/badges/${ID}/public_url`, qrPayloads: [], documentUrl: null, bakedBadge: null,
      issuer: 'IBM', expectedDomains: [], holderName: 'Ana Quispe', credentialId: null, course: 'Cloud Computing Foundations',
    };

    const propio = await verificador.verify({ ...base, emails: ['ana.quispe@est.univalle.edu', correo] });
    expect(propio.check.openBadge).toEqual(expect.objectContaining({ provider: 'credly', hosted: true, recipientMatch: true, issuerName: 'IBM', issuerMatches: true }));
    expect(propio.check.status).toBe(CredentialCheckStatus.VERIFIED_MATCH);

    // Sin el correo personal comprobado, Afinia no puede reconocerla como suya.
    const sinCorreo = await verificador.verify({ ...base, emails: ['ana.quispe@est.univalle.edu'] });
    expect(sinCorreo.check.openBadge?.recipientMatch).toBe(false);
    expect(sinCorreo.check.status).toBe(CredentialCheckStatus.MISMATCH);

    // Declarada como de Cisco, pero la emitió IBM.
    const otroEmisor = await verificador.verify({ ...base, issuer: 'Cisco', emails: [correo] });
    expect(otroEmisor.check.openBadge?.issuerMatches).toBe(false);
  });
});

describe('V9 · Decisiones', () => {
  it('la firma digital del emisor corrobora aunque su página no responda; una contradicción oficial gana', () => {
    expect(decideCredentialCheck({ link: { status: LinkCheckStatus.UNAVAILABLE }, official: true, page: null, openBadge: null, signedDocument: true }))
      .toBe(CredentialCheckStatus.VERIFIED_MATCH);
    expect(decideCredentialCheck({ link: { status: LinkCheckStatus.BLOCKED }, official: false, page: null, openBadge: null, signedDocument: true }))
      .toBe(CredentialCheckStatus.MISMATCH);
    expect(decideCredentialCheck({ link: null, official: null, page: null, openBadge: null, signedDocument: false }))
      .toBe(CredentialCheckStatus.NO_VERIFIER);
  });

  it('firmante frente a emisor declarado', () => {
    expect(firmanteEsEmisor({ organization: 'Huawei Technologies Co., Ltd.', name: null, email: null }, 'Huawei ICT Academy', null)).toBe(true);
    expect(firmanteEsEmisor({ organization: 'Ana Quispe', name: 'Ana Quispe', email: 'ana@gmail.com' }, 'Huawei', ['huawei.com'])).toBe(false);
    expect(firmanteEsEmisor({ organization: null, name: 'Certificados', email: 'certs@netacad.com' }, 'Academia X', ['netacad.com'])).toBe(true);
  });

  it('emisor de una insignia: por nombre o por dominio propio, nunca por la plataforma', () => {
    expect(emisorCoincide('IBM', null, { issuer: 'IBM', expectedDomains: [] })).toBe(true);
    expect(emisorCoincide('Some Org', 'https://www.ibm.com', { issuer: 'IBM', expectedDomains: [] })).toBe(true);
    expect(emisorCoincide('Fake Cisco Training', 'https://www.credly.com/org/fake', { issuer: 'Cisco Networking Academy', expectedDomains: [] })).toBe(false);
    expect(emisorCoincide('Cualquiera', null, { issuer: null, expectedDomains: [] })).toBeNull();
  });

  it('el catálogo de proveedores dice qué está integrado', () => {
    expect(providerSupportFor('IBM', null)).toEqual(expect.objectContaining({ integrated: true }));
    expect(providerSupportFor('Huawei ICT Academy', null)).toEqual(expect.objectContaining({ integrated: false }));
    expect(providerSupportFor(null, 'https://ude.my/UC-123')).toEqual(expect.objectContaining({ provider: 'Udemy' }));
  });
});
