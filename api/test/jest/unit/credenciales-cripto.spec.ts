/**
 * V8 · Núcleo criptográfico de los registros verificables, sin base de datos.
 *
 * Vectores oficiales: RFC 8032 (Ed25519), RFC 8785 (JCS), base58 y CRC-32
 * conocidos. Lo demás comprueba que cualquier manipulación se detecta.
 */
import { createHash } from 'node:crypto';
import { base58btcDecode, base58btcEncode, crc32 } from '../../../src/verifiable-credentials/crypto/codec';
import { canonicalize } from '../../../src/verifiable-credentials/crypto/jcs';
import {
  deriveSeed, ed25519FromSeed, ed25519Sign, fromMultikey, keyIdOf, parseSeed, toDidKey, toMultikey,
} from '../../../src/verifiable-credentials/crypto/keys';
import { createProof, verifyProof } from '../../../src/verifiable-credentials/crypto/data-integrity';
import { decodeJws, signJwsEdDSA, verifyJws } from '../../../src/verifiable-credentials/crypto/jws';
import { STATUS_LIST_SIZE, decodeStatusList, encodeStatusList, statusBit } from '../../../src/verifiable-credentials/crypto/status-list';
import { checkSymbol, generatePublicCode, normalizePublicCode, PUBLIC_CODE_PATTERN } from '../../../src/verifiable-credentials/public-code';
import { GENESIS_HASH, ledgerEntryHash } from '../../../src/verifiable-credentials/credential-ledger.service';
import { badgeSvg, bakedBadgePng, readBakedCredential } from '../../../src/verifiable-credentials/render/badge-image';
import { readRecordPdfMarker, renderRecordPdf } from '../../../src/verifiable-credentials/render/record-pdf';
import { readQrFromImage } from '../../../src/verifiable-credentials/render/image-qr';
import { buildOb3Credential, hashIdentity } from '../../../src/verifiable-credentials/open-badges';
import { extractPdfText } from '../../../src/validation/pdf-text';
import { encodeQr } from '../../../src/collaboration/qr-encoder';

const RFC8032_SEED = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';

describe('V8 · Ed25519 y claves', () => {
  it('RFC 8032, prueba 1: clave pública y firma del mensaje vacío', () => {
    const kp = ed25519FromSeed(Buffer.from(RFC8032_SEED, 'hex'));
    expect(kp.publicRaw.toString('hex')).toBe('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');
    expect(ed25519Sign(kp.privateKey, Buffer.alloc(0)).toString('hex')).toBe(
      'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b',
    );
  });

  it('Multikey y did:key de Ed25519 empiezan por z6Mk y van y vuelven', () => {
    const kp = ed25519FromSeed(Buffer.from(RFC8032_SEED, 'hex'));
    const mk = toMultikey(kp.publicRaw);
    expect(mk.startsWith('z6Mk')).toBe(true);
    expect(toDidKey(kp.publicRaw)).toBe(`did:key:${mk}`);
    expect(fromMultikey(mk).equals(kp.publicRaw)).toBe(true);
    expect(() => fromMultikey('zQ3s')).toThrow();
  });

  it('la semilla derivada es estable y distinta por contexto; la configurada acepta hex y base64url', () => {
    expect(deriveSeed('secreto-largo-de-prueba', 'a').equals(deriveSeed('secreto-largo-de-prueba', 'a'))).toBe(true);
    expect(deriveSeed('secreto-largo-de-prueba', 'a').equals(deriveSeed('secreto-largo-de-prueba', 'b'))).toBe(false);
    const hex = parseSeed(RFC8032_SEED);
    expect(parseSeed(hex.toString('base64url')).equals(hex)).toBe(true);
    expect(() => parseSeed('corta')).toThrow();
    expect(keyIdOf(hex)).toMatch(/^key-[A-Za-z0-9_-]{16}$/);
  });
});

describe('V8 · Codificaciones', () => {
  it('RFC 8785: números, escapes y orden de claves por unidades UTF-16', () => {
    expect(canonicalize({ numbers: [333333333.33333329, 1e30, 4.5, 2e-3, 0.000000000000000000000000001], literals: [null, true, false] }))
      .toBe('{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27]}');
    expect(canonicalize({ '\u20ac': 1, '\r': 2, '\ufb33': 3, '1': 4, '\ud83d\ude00': 5, '\u0080': 6, 'ö': 7 }))
      .toBe('{"\\r":2,"1":4,"\u0080":6,"\u00f6":7,"\u20ac":1,"\ud83d\ude00":5,"\ufb33":3}');
    expect(() => canonicalize({ x: Number.NaN })).toThrow();
  });

  it('base58btc y CRC-32 con vectores conocidos', () => {
    expect(base58btcEncode(Buffer.from('Hello World!'))).toBe('2NEpo7TZRRrLZSi2U');
    expect(Buffer.from(base58btcDecode('2NEpo7TZRRrLZSi2U')).toString()).toBe('Hello World!');
    expect(base58btcEncode(Buffer.from([0, 0, 1]))).toBe('112');
    expect(crc32(Buffer.from('123456789')).toString(16)).toBe('cbf43926');
  });
});

describe('V8 · Data Integrity eddsa-jcs-2022', () => {
  const kp = ed25519FromSeed(Buffer.from(RFC8032_SEED, 'hex'));
  const doc = { '@context': ['https://www.w3.org/ns/credentials/v2'], type: ['VerifiableCredential'], name: 'Participación en «Ñandú»' };
  const firmado = createProof(doc, kp.privateKey, { verificationMethod: 'https://x/issuer#key', created: '2026-11-18T00:00:00Z' });

  it('firma y verifica; el orden de las claves no importa', () => {
    expect(verifyProof(firmado, kp.publicKey).ok).toBe(true);
    const reordenado = JSON.parse(JSON.stringify({ proof: firmado.proof, name: doc.name, type: doc.type, '@context': doc['@context'] }));
    expect(verifyProof(reordenado, kp.publicKey).ok).toBe(true);
  });

  it('detecta un cambio en el contenido, en la prueba o en la clave', () => {
    expect(verifyProof({ ...firmado, name: 'Participación en «Nandu»' }, kp.publicKey).ok).toBe(false);
    const proof = firmado.proof as Record<string, unknown>;
    expect(verifyProof({ ...firmado, proof: { ...proof, created: '2030-01-01T00:00:00Z' } }, kp.publicKey).ok).toBe(false);
    expect(verifyProof({ ...firmado, proof: { ...proof, verificationMethod: 'https://otro/issuer#key' } }, kp.publicKey).ok).toBe(false);
    const otra = ed25519FromSeed(Buffer.alloc(32, 7));
    expect(verifyProof(firmado, otra.publicKey).ok).toBe(false);
    expect(verifyProof({ ...firmado, proof: { ...proof, cryptosuite: 'eddsa-rdfc-2022' } }, kp.publicKey).ok).toBe(false);
  });

  it('VC-JWT EdDSA: verifica y rechaza alg none y la carga cambiada', () => {
    const jwt = signJwsEdDSA({ kid: 'k' }, { a: 1 }, kp.privateKey);
    expect(verifyJws(decodeJws(jwt), kp.publicKey)).toBe(true);
    const [h, , s] = jwt.split('.');
    const cambiado = `${h}.${Buffer.from(JSON.stringify({ a: 2 })).toString('base64url')}.${s}`;
    expect(verifyJws(decodeJws(cambiado), kp.publicKey)).toBe(false);
    const none = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${jwt.split('.')[1]}.${s}`;
    expect(verifyJws(decodeJws(none), kp.publicKey)).toBe(false);
  });
});

describe('V8 · Lista de estado y bitácora', () => {
  it('Bitstring Status List: 131 072 bits, el índice 0 es el bit alto del primer byte', () => {
    const lista = decodeStatusList(encodeStatusList([0, 9, STATUS_LIST_SIZE - 1]));
    expect(lista.length * 8).toBe(STATUS_LIST_SIZE);
    expect(lista[0]).toBe(0x80);
    expect([0, 1, 9, STATUS_LIST_SIZE - 1].map((i) => statusBit(lista, i))).toEqual([true, false, true, true]);
    expect(encodeStatusList([]).startsWith('u')).toBe(true);
  });

  it('cada eslabón depende del anterior: cambiar uno rompe la cadena', () => {
    const h1 = ledgerEntryHash(GENESIS_HASH, 1, 'ISSUED', 'AF-X', { a: 1 });
    const h2 = ledgerEntryHash(h1, 2, 'REVOKED', 'AF-X', { b: 2 });
    expect(ledgerEntryHash(GENESIS_HASH, 1, 'ISSUED', 'AF-X', { a: 1 })).toBe(h1);
    expect(ledgerEntryHash(GENESIS_HASH, 1, 'ISSUED', 'AF-X', { a: 2 })).not.toBe(h1);
    expect(ledgerEntryHash(ledgerEntryHash(GENESIS_HASH, 1, 'ISSUED', 'AF-X', { a: 2 }), 2, 'REVOKED', 'AF-X', { b: 2 })).not.toBe(h2);
  });
});

describe('V8 · Código público', () => {
  it('formato, control Luhn mod 32 y normalización de lo que escribe una persona', () => {
    for (let i = 0; i < 200; i += 1) {
      const c = generatePublicCode();
      expect(c).toMatch(PUBLIC_CODE_PATTERN);
      expect(normalizePublicCode(c)).toBe(c);
      expect(normalizePublicCode(c.toLowerCase().replace(/-/g, ' '))).toBe(c);
    }
    const c = generatePublicCode();
    const cuerpo = c.replace(/^AF-/, '').replace(/-/g, '');
    expect(checkSymbol(cuerpo.slice(0, 12))).toBe(cuerpo[12]);
  });

  it('detecta todo error de un solo carácter', () => {
    const ALFA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const c = generatePublicCode();
    const t = c.replace(/^AF-/, '').replace(/-/g, '');
    let detectados = 0;
    let total = 0;
    for (let i = 0; i < t.length; i += 1) {
      for (const x of ALFA) {
        if (x === t[i]) continue;
        total += 1;
        if (normalizePublicCode(`AF${t.slice(0, i)}${x}${t.slice(i + 1)}`) === null) detectados += 1;
      }
    }
    expect(detectados).toBe(total);
    expect(normalizePublicCode('AF-0000-0000-0000')).toBeNull();
    expect(normalizePublicCode(123 as unknown as string)).toBeNull();
  });
});

describe('V8 · Insignias horneadas, PDF y QR', () => {
  const kp = ed25519FromSeed(Buffer.from(RFC8032_SEED, 'hex'));
  const credencial = createProof(buildOb3Credential({
    code: 'AF-0000-0000-0000X', sourceType: 'participation', achievementName: 'Participación en «Taller»', activityTitle: 'Taller',
    holderName: 'Ana Quispe', recipientHash: hashIdentity('ana@est.univalle.edu', 'sal'), recipientSalt: 'sal', issuerName: 'Afinia',
    documentIssuer: null, documentSha256: null, occurredAt: new Date('2026-10-01T14:00:00Z'), activityEndAt: null,
    issuedAt: new Date('2026-11-18T12:00:00Z'), statusIndex: 42,
  }, { apiBase: 'http://localhost:3010/api', webBase: 'http://localhost:5173', issuerName: 'Afinia' }), kp.privateKey, {
    verificationMethod: 'http://localhost:3010/api/public/credentials/issuer#key', created: '2026-11-18T12:00:00Z',
  });
  const json = JSON.stringify(credencial);

  it('el PNG horneado lleva la credencial exacta y sigue siendo un PNG válido', () => {
    const png = bakedBadgePng('participation', json);
    expect(readBakedCredential(png)).toBe(json);
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { PNG } = require('pngjs');
    expect(PNG.sync.read(png).width).toBe(256);
  });

  it('el SVG horneado también, y escapa el título', () => {
    const svg = badgeSvg({ title: 'A <b> & "c"', sourceType: 'participation', code: 'AF-1' }, { credentialJson: json });
    expect(svg).toContain('A &lt;b&gt; &amp; &quot;c&quot;');
    expect(readBakedCredential(Buffer.from(svg))).toBe(json);
  });

  it('el PDF es determinista, lleva el código, el enlace y el adjunto, y un cambio cambia su huella', () => {
    const datos = {
      code: 'AF-0000-0000-0000X', sourceType: 'participation' as const, achievementName: 'Participación en «Taller de Desarrollo Web»',
      holderName: 'Ana Quispe Mamani', issuerName: 'Afinia', documentIssuer: null, documentSha256: null,
      occurredAt: new Date('2026-10-01T14:00:00Z'), issuedAt: new Date('2026-11-18T12:00:00Z'),
      narrative: 'El responsable confirmó la participación.', verifyUrl: 'http://localhost:5173/verificar/AF-0000-0000-0000X',
      payloadSha256: 'a'.repeat(64), keyId: 'key-abc', credentialJson: json,
    };
    const a = renderRecordPdf(datos);
    const b = renderRecordPdf(datos);
    expect(a.equals(b)).toBe(true);
    expect(readRecordPdfMarker(a)?.code).toBe('AF-0000-0000-0000X');
    expect(extractPdfText(a).links).toContain(datos.verifyUrl);
    expect(a.toString('latin1')).toContain('/EmbeddedFile');
    const c = renderRecordPdf({ ...datos, holderName: 'Ana Quispe Mamani.' });
    expect(createHash('sha256').update(c).digest('hex')).not.toBe(createHash('sha256').update(a).digest('hex'));
  });

  it('el QR de verificación se vuelve a leer con jsQR', () => {
    const url = 'http://localhost:5173/verificar/AF-7K2M-9QXD-4HP8R';
    const qr = encodeQr(url);
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { PNG } = require('pngjs');
    const escala = 6;
    const lado = (qr.size + 8) * escala;
    const png = new PNG({ width: lado, height: lado });
    for (let y = 0; y < lado; y += 1) {
      for (let x = 0; x < lado; x += 1) {
        const f = Math.floor(y / escala) - 4;
        const c = Math.floor(x / escala) - 4;
        const oscuro = f >= 0 && c >= 0 && f < qr.size && c < qr.size && qr.modules[f][c];
        const i = (y * lado + x) * 4;
        png.data[i] = png.data[i + 1] = png.data[i + 2] = oscuro ? 0 : 255;
        png.data[i + 3] = 255;
      }
    }
    expect(readQrFromImage(PNG.sync.write(png), 'image/png')).toBe(url);
  });
});
