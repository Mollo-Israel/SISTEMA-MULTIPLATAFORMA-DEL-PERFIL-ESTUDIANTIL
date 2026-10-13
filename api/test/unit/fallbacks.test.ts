/**
 * V3.2 BATCH 21: respaldo del OCR (§29). Sin motor, o con un tipo que no
 * reconoce, el adaptador dice «no disponible» y nunca lanza: el documento
 * queda INCONCLUSIVE (e2e B3.32), no FAILED.
 *
 *   npm --prefix api run test:unit
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { TesseractOcrAdapter } from '../../src/validation/ocr.port';
import { DocumentExtractionService } from '../../src/validation/document-extraction.service';
import { readMailSettings } from '../../src/mail/mail.settings';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('V3.2 B21 respaldo del OCR', () => {
  it('desactivado: no disponible, sin texto', async () => {
    const r = await new TesseractOcrAdapter(new ConfigService({ OCR_ENABLED: 'false' })).recognize(PNG_1X1, 'image/png');
    assert.deepEqual(r, { text: '', confidence: null, available: false });
  });

  it('un PDF no se rasteriza: no disponible', async () => {
    const r = await new TesseractOcrAdapter(new ConfigService({})).recognize(Buffer.from('%PDF-1.4'), 'application/pdf');
    assert.equal(r.available, false);
  });

  it('sin el paquete del motor no lanza: devuelve no disponible', async () => {
    let instalado = true;
    try { require.resolve('tesseract.js'); } catch { instalado = false; }
    const r = await new TesseractOcrAdapter(new ConfigService({})).recognize(PNG_1X1, 'image/png');
    if (!instalado) assert.equal(r.available, false);
    assert.equal(typeof r.text, 'string');
  });

  it('la extracción sigue sin OCR: fuente «none», sin texto ni excepción', async () => {
    const sinMotor = { recognize: async () => ({ text: '', confidence: null, available: false }) };
    const r = await new DocumentExtractionService(sinMotor).extractFull(PNG_1X1, 'image/png');
    assert.equal(r.data.source, 'none');
    assert.equal(r.data.textLength, 0);
  });
});

describe('V3.2 B21 respaldo del correo', () => {
  const leer = (env: Record<string, string>) => readMailSettings(new ConfigService(env));

  it('sin SMTP_HOST, «auto» simula el envío en vez de fallar', () => {
    const s = leer({ MAIL_TRANSPORT: 'auto' });
    assert.equal(s.transport, 'console');
    assert.equal(s.smtp, null);
    assert.deepEqual(s.problems, []);
  });

  it('SMTP pedido sin servidor: se explica el problema, no se envía a ciegas', () => {
    const s = leer({ MAIL_TRANSPORT: 'smtp' });
    assert.equal(s.transport, 'smtp');
    assert.ok(s.problems.some((p) => p.includes('SMTP_HOST')));
  });

  it('un valor desconocido avisa y cae en «auto»', () => {
    const s = leer({ MAIL_TRANSPORT: 'carrier-pigeon' });
    assert.equal(s.transport, 'console');
    assert.ok(s.warnings.some((w) => w.includes('auto')));
  });
});
