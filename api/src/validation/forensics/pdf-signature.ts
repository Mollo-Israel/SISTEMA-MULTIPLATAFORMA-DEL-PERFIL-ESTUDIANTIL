import { webcrypto, X509Certificate } from 'node:crypto';
import { rootCertificates } from 'node:tls';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';
import type { DocumentSignatureReport } from './forensic-report';
import type { PdfSignatureLocation } from './pdf-forensics';

/**
 * V9 · Verificación criptográfica de la firma digital de un PDF (PAdES /
 * adbe.pkcs7.detached).
 *
 * Tres preguntas, por separado y en este orden:
 *
 *  1. **Integridad**: ¿el resumen que se firmó corresponde a los bytes que
 *     cubre /ByteRange? Si no, alguien cambió el documento firmado.
 *  2. **Firma**: ¿la firma del firmante sobre ese resumen es válida?
 *  3. **Confianza**: ¿el certificado del firmante lleva a una raíz pública
 *     (el almacén de Mozilla que trae Node)? Un certificado autofirmado puede
 *     llamarse «Huawei» y no prueba nada.
 *
 * Solo las tres juntas, con el firmante correspondiente al emisor declarado,
 * permiten decir que el documento salió del emisor. Muchas firmas
 * institucionales encadenan a la lista de Adobe (AATL), que no es pública en
 * Node: esas quedan «sin confianza verificable», nunca «falsas».
 */

let motorListo = false;
function motor(): void {
  if (motorListo) return;
  pkijs.setEngine('node', new pkijs.CryptoEngine({ name: 'node', crypto: webcrypto as unknown as Crypto }));
  motorListo = true;
}

let raices: pkijs.Certificate[] | null = null;
function raicesDeConfianza(): pkijs.Certificate[] {
  if (raices) return raices;
  raices = [];
  for (const pem of rootCertificates) {
    try {
      const der = Buffer.from(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''), 'base64');
      raices.push(pkijs.Certificate.fromBER(toArrayBuffer(der)));
    } catch {
      // Una raíz que pkijs no entiende se omite; no cambia el resultado de las demás.
    }
  }
  return raices;
}

const OID_SIGNING_TIME = '1.2.840.113549.1.9.5';

function toArrayBuffer(b: Buffer): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

export interface SignatureCheckOptions {
  /** Ahora, para la cadena. Se usa la fecha de firma si el certificado ya venció. */
  now?: Date;
  /** Raíces adicionales (solo pruebas). */
  extraTrustedRoots?: Buffer[];
}

export async function verifyPdfSignature(
  pdf: Buffer,
  firma: PdfSignatureLocation,
  coversWholeFile: boolean,
  opts: SignatureCheckOptions = {},
): Promise<DocumentSignatureReport> {
  const informe: DocumentSignatureReport = {
    present: true,
    subFilter: firma.subFilter,
    coversWholeFile,
    integrity: null,
    signatureValid: null,
    trusted: null,
    signerName: null,
    signerOrganization: null,
    signerEmail: null,
    signingTime: null,
    issuerMatches: null,
    error: null,
  };

  if (firma.subFilter && /sha1$/i.test(firma.subFilter)) {
    // adbe.pkcs7.sha1 firma un SHA-1 incrustado, no los bytes: obsoleto e inseguro.
    informe.error = 'Formato de firma obsoleto (adbe.pkcs7.sha1): no se evalúa.';
    return informe;
  }

  try {
    motor();
    const [a, b, c, d] = firma.byteRange;
    const firmado = Buffer.concat([pdf.subarray(a, a + b), pdf.subarray(c, c + d)]);

    const asn1 = asn1js.fromBER(toArrayBuffer(firma.contents));
    if (asn1.offset === -1) throw new Error('El contenido de la firma no es ASN.1 válido.');
    const info = new pkijs.ContentInfo({ schema: asn1.result });
    if (info.contentType !== pkijs.ContentInfo.SIGNED_DATA) throw new Error('La firma no es un SignedData CMS.');
    const sd = new pkijs.SignedData({ schema: info.content });

    const firmante = sd.signerInfos[0];
    if (!firmante) throw new Error('La firma no trae firmante.');
    const hora = firmante.signedAttrs?.attributes.find((x) => x.type === OID_SIGNING_TIME);
    if (hora?.values?.[0]) {
      const t = (hora.values[0] as asn1js.UTCTime | asn1js.GeneralizedTime).toDate?.();
      if (t && !Number.isNaN(t.getTime())) informe.signingTime = t.toISOString();
    }

    // 1 y 2: pkijs compara el messageDigest firmado con el resumen de los
    // bytes y luego comprueba la firma sobre los atributos firmados.
    let cert: pkijs.Certificate | undefined;
    try {
      const r = await sd.verify({ signer: 0, data: toArrayBuffer(firmado), checkChain: false, extendedMode: true });
      // Llegar aquí significa que el resumen coincidió; queda la firma en sí.
      informe.integrity = true;
      informe.signatureValid = r.signatureVerified === true;
      cert = r.signerCertificate as pkijs.Certificate | undefined;
    } catch (e) {
      const err = e as { message?: string; signerCertificate?: pkijs.Certificate };
      cert = err.signerCertificate;
      if (/digest doesn't match/i.test(err.message ?? '')) {
        informe.integrity = false;
        informe.signatureValid = false;
      } else {
        throw e;
      }
    }

    if (cert) {
      const x = new X509Certificate(Buffer.from(cert.toSchema().toBER(false)));
      informe.signerName = atributo(cert, '2.5.4.3');
      informe.signerOrganization = atributo(cert, '2.5.4.10');
      informe.signerEmail = atributo(cert, '1.2.840.113549.1.9.1') ?? correoDeSan(x.subjectAltName);

      // 3: cadena hasta una raíz pública.
      const certs = (sd.certificates ?? []).filter((c2): c2 is pkijs.Certificate => c2 instanceof pkijs.Certificate);
      const extra = (opts.extraTrustedRoots ?? []).map((der) => pkijs.Certificate.fromBER(toArrayBuffer(der)));
      const vencido = new Date(x.validTo).getTime() < (opts.now ?? new Date()).getTime();
      const fecha = vencido && informe.signingTime ? new Date(informe.signingTime) : (opts.now ?? new Date());
      const motorCadena = new pkijs.CertificateChainValidationEngine({
        trustedCerts: [...raicesDeConfianza(), ...extra],
        certs: [cert, ...certs.filter((c2) => c2 !== cert)],
        checkDate: fecha,
      });
      const cadena = await motorCadena.verify();
      informe.trusted = cadena.result === true;
    }
  } catch (e) {
    informe.error = (e as Error).message?.slice(0, 200) ?? 'No se pudo leer la firma.';
  }
  return informe;
}

/**
 * Valor de un atributo del sujeto (CN, O, correo), leído de la estructura y
 * no del texto: así da igual si el emisor los puso en RDN separados o en uno
 * solo con varios valores, y no hay escapes que deshacer.
 */
function atributo(cert: pkijs.Certificate, oid: string): string | null {
  for (const tv of cert.subject.typesAndValues) {
    if (tv.type !== oid) continue;
    const v = (tv.value as { valueBlock?: { value?: unknown } })?.valueBlock?.value;
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 160);
  }
  return null;
}

function correoDeSan(san: string | undefined): string | null {
  const m = san ? /email:([^,\s]+)/.exec(san) : null;
  return m ? m[1].slice(0, 160) : null;
}
