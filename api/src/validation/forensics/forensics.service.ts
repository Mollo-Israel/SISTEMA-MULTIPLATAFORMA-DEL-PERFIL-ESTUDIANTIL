import { Injectable, Logger } from '@nestjs/common';
import { firmanteEsEmisor } from '../credential-integrity.rules';
import { ForensicReport, agregarSenal, emptyReport } from './forensic-report';
import { analyzeImage } from './image-forensics';
import { analyzePdf } from './pdf-forensics';
import { SignatureCheckOptions, verifyPdfSignature } from './pdf-signature';

export interface ForensicsContext {
  /** Emisor declarado por el estudiante, para juzgar al firmante del PDF. */
  issuer: string | null;
  /** Dominios oficiales del emisor, si se conocen. */
  officialDomains: string[] | null;
}

/**
 * V9 · Orquesta el análisis forense de un archivo de credencial.
 *
 * Nunca lanza: si algo no se puede leer, el informe queda vacío y el resto
 * de la validación sigue. Un archivo raro no debe tumbar al worker ni, peor,
 * hacer que una credencial quede sin evaluar.
 */
@Injectable()
export class ForensicsService {
  private readonly logger = new Logger(ForensicsService.name);

  /** Solo pruebas: raíces adicionales para la cadena de confianza. */
  signatureOptions: SignatureCheckOptions = {};

  async analyze(buffer: Buffer, mimeType: string, ctx: ForensicsContext): Promise<ForensicReport> {
    try {
      if (mimeType === 'application/pdf') return await this.pdf(buffer, ctx);
      if (mimeType === 'image/png' || mimeType === 'image/jpeg') return analyzeImage(buffer, mimeType);
    } catch (e) {
      this.logger.warn(`Análisis forense incompleto: ${(e as Error).message}`);
    }
    return emptyReport('other');
  }

  private async pdf(buffer: Buffer, ctx: ForensicsContext): Promise<ForensicReport> {
    const { report, signatures } = analyzePdf(buffer);
    if (signatures.length === 0) return report;

    // Se evalúa la firma que cubre más documento (la última, si hay varias).
    const principal = signatures.reduce((a, s) => (s.end > a.end ? s : a));
    const resto = buffer.subarray(principal.end).toString('latin1').trim();
    const firma = await verifyPdfSignature(buffer, principal, resto.length === 0, this.signatureOptions);

    if (firma.integrity === false || firma.signatureValid === false) {
      agregarSenal(report.signals, {
        code: 'signature_broken',
        severity: 'critical',
        detail: firma.integrity === false ? 'el resumen firmado no coincide con el contenido' : 'la firma del firmante no es válida',
      });
    }
    if (firma.signatureValid && firma.trusted === false) {
      agregarSenal(report.signals, {
        code: 'signature_untrusted',
        severity: 'info',
        detail: firma.signerOrganization ?? firma.signerName ?? 'firmante sin identificar',
      });
    }
    if (firma.signatureValid && firma.trusted) {
      firma.issuerMatches = firmanteEsEmisor(
        { organization: firma.signerOrganization, name: firma.signerName, email: firma.signerEmail },
        ctx.issuer,
        ctx.officialDomains,
      );
    }
    report.signature = firma;
    return report;
  }
}

/**
 * ¿El documento está firmado por el emisor de forma verificable de punta a
 * punta? Integridad, firma válida, raíz pública, firmante = emisor y nada
 * agregado después de firmar.
 */
export function firmadoPorElEmisor(r: ForensicReport | null): boolean {
  const f = r?.signature;
  return !!f && f.integrity === true && f.signatureValid === true && f.trusted === true
    && f.issuerMatches === true && !r!.signals.some((s) => s.code === 'modified_after_signature');
}
