import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ExtractedDocumentData } from '../entities/validation-record.entity';
import { extractMetadata } from './metadata.extractor';
import { extractPdfText, MIN_USEFUL_TEXT, normalizar } from './pdf-text';
import { OCR_PORT, OcrPort } from './ocr.port';

/**
 * Extracción documental (especificacion §29).
 *
 * El orden lo fija la propia especificación y no es arbitrario: el texto nativo
 * de un PDF es exacto, el OCR es una aproximación y el QR es una tercera
 * fuente que puede corroborar lo que las otras dos dijeron. Se empieza por lo
 * fiable y solo se baja un escalón cuando el anterior no dio lo suficiente.
 *
 *   1. texto nativo del PDF;
 *   2. si no hay texto suficiente, OCR;
 *   3. detección de QR;
 *   4. normalización;
 *   5. candidatos de metadata.
 *
 * Nada de esto afirma que el documento sea auténtico. Determina qué puede
 * corroborarse técnicamente, que es la responsabilidad del Motor de Validación
 * y no la del de Afinidad (§26).
 */
@Injectable()
export class DocumentExtractionService {
  private readonly logger = new Logger(DocumentExtractionService.name);

  constructor(@Inject(OCR_PORT) private readonly ocr: OcrPort) {}

  async extract(buffer: Buffer, mimeType: string): Promise<ExtractedDocumentData> {
    let texto = '';
    let origen: ExtractedDocumentData['source'] = 'none';
    let enlaces: string[] = [];

    // ------------------------------------------------------------- 1. PDF
    if (mimeType === 'application/pdf') {
      const pdf = extractPdfText(buffer);
      enlaces = pdf.links;
      if (pdf.text.length >= MIN_USEFUL_TEXT) {
        texto = pdf.text;
        origen = 'pdf_text';
      } else {
        this.logger.debug(
          `PDF con texto insuficiente (${pdf.text.length} caracteres, `
          + `${pdf.streams} flujos legibles).`,
        );
        // Se conserva lo poco que hubiera: es mejor que nada si el QR falla.
        texto = pdf.text;
      }
    }

    // ------------------------------------------------------------- 2. OCR
    if (texto.length < MIN_USEFUL_TEXT) {
      const resultado = await this.ocr.recognize(buffer, mimeType);
      const reconocido = normalizar(resultado.text);
      if (reconocido.length >= MIN_USEFUL_TEXT) {
        texto = reconocido;
        origen = 'ocr';
      }
    }

    // -------------------------------------------------------------- 3. QR
    const qrPayloads = await this.readQr(buffer, mimeType);
    if (texto.length < MIN_USEFUL_TEXT && qrPayloads.length > 0) {
      // Un QR legible en un documento por lo demás ilegible sigue siendo una
      // fuente: lleva la URL de verificación, que es lo que más corrobora.
      origen = 'qr';
    }

    // --------------------------------------------------- 4 y 5. normalizar
    const limpio = normalizar(texto);
    const metadata = extractMetadata(limpio, { links: enlaces, qrPayloads });

    return {
      ...metadata,
      source: origen,
      textLength: limpio.length,
      qrPayloads: qrPayloads.length > 0 ? qrPayloads : undefined,
    };
  }

  /**
   * Códigos QR presentes en la imagen (§29, paso 3).
   *
   * Solo sobre PNG y JPG: leer un QR de un PDF exigiría rasterizarlo, que es
   * otra dependencia pesada. §128 pide el QR «si es viable», y sobre imagen lo
   * es con tres paquetes pequeños; sobre PDF no, y se dice en lugar de
   * simularlo.
   */
  private async readQr(buffer: Buffer, mimeType: string): Promise<string[]> {
    if (mimeType !== 'image/png' && mimeType !== 'image/jpeg') return [];

    try {
      const pixeles = this.decodeImage(buffer, mimeType);
      if (!pixeles) return [];

      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const jsQR = require('jsqr').default ?? require('jsqr');
      const encontrado = jsQR(pixeles.data, pixeles.width, pixeles.height);
      if (!encontrado?.data) return [];
      return [String(encontrado.data).slice(0, 500)];
    } catch (error) {
      this.logger.debug(`No se pudo leer el QR: ${String(error)}`);
      return [];
    }
  }

  /** Imagen a píxeles RGBA, que es lo que espera el lector de QR. */
  private decodeImage(
    buffer: Buffer,
    mimeType: string,
  ): { data: Uint8ClampedArray; width: number; height: number } | null {
    // Tope de tamaño: una imagen enorme convertida a RGBA ocupa cuatro bytes
    // por píxel y podría agotar la memoria del proceso.
    const MAX_PIXELS = 40_000_000;

    if (mimeType === 'image/png') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const { PNG } = require('pngjs');
      const png = PNG.sync.read(buffer);
      if (png.width * png.height > MAX_PIXELS) return null;
      return {
        data: new Uint8ClampedArray(png.data),
        width: png.width,
        height: png.height,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const jpeg = require('jpeg-js');
    const img = jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 256 });
    if (img.width * img.height > MAX_PIXELS) return null;
    return {
      data: new Uint8ClampedArray(img.data),
      width: img.width,
      height: img.height,
    };
  }
}
