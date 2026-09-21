import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Reconocimiento óptico de caracteres (especificacion §29, paso 2).
 *
 * Es un puerto, como el almacenamiento y el correo, porque el OCR es lo más
 * pesado y lo más reemplazable de todo el pipeline: hoy se resuelve con
 * `tesseract.js`, mañana puede ser un servicio externo, y el resto del motor
 * no debería enterarse.
 */
export const OCR_PORT = Symbol('OCR_PORT');

export interface OcrResult {
  text: string;
  /** Confianza media, de 0 a 100, cuando el motor la reporta. */
  confidence: number | null;
  /** `false` cuando no hay motor disponible: lleva a INCONCLUSIVE, no a FAILED. */
  available: boolean;
}

export interface OcrPort {
  recognize(buffer: Buffer, mimeType: string): Promise<OcrResult>;
}

/**
 * Adaptador sobre `tesseract.js`, cargado de forma perezosa.
 *
 * No es dependencia declarada del proyecto a propósito: el paquete descarga en
 * su primer uso unos 15 MB de modelo de idioma, y eso no puede ser un
 * requisito para clonar el repositorio y levantar la API. Quien quiera OCR
 * real instala `tesseract.js` y esta clase lo detecta sola.
 *
 * Sin el paquete, `available` es `false` y el recurso queda `INCONCLUSIVE`, que
 * es exactamente lo que §29 manda hacer cuando el OCR no puede ejecutarse: el
 * recurso se conserva y nadie afirma nada sobre él.
 */
@Injectable()
export class TesseractOcrAdapter implements OcrPort {
  private readonly logger = new Logger(TesseractOcrAdapter.name);
  private readonly enabled: boolean;
  private readonly languages: string;
  private advertido = false;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('OCR_ENABLED', 'true') !== 'false';
    this.languages = config.get<string>('OCR_LANGUAGES', 'spa+eng');
  }

  async recognize(buffer: Buffer, mimeType: string): Promise<OcrResult> {
    const vacio: OcrResult = { text: '', confidence: null, available: false };
    if (!this.enabled) return vacio;
    // El OCR trabaja sobre imagenes. Un PDF sin texto tendria que rasterizarse
    // primero, que es otra dependencia pesada; se deja fuera y el documento
    // queda INCONCLUSIVE.
    if (!mimeType.startsWith('image/')) return vacio;

    let tesseract: { recognize: Function } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      tesseract = require('tesseract.js');
    } catch {
      if (!this.advertido) {
        this.logger.log(
          'OCR no disponible: falta el paquete tesseract.js. Los documentos sin texto '
          + 'legible quedarán como INCONCLUSIVE (§29). Instálelo para activarlo.',
        );
        this.advertido = true;
      }
      return vacio;
    }

    try {
      const { data } = await tesseract!.recognize(buffer, this.languages);
      return {
        text: String(data?.text ?? ''),
        confidence: typeof data?.confidence === 'number' ? data.confidence : null,
        available: true,
      };
    } catch (error) {
      this.logger.warn(`El OCR falló: ${String(error)}`);
      // Disponible pero sin resultado: tambien INCONCLUSIVE, no FAILED. Que un
      // documento sea ilegible no es un error del sistema.
      return { text: '', confidence: null, available: true };
    }
  }
}
