/**
 * Lee el contenido de un QR en una imagen PNG o JPG (para el verificador de
 * archivos). Usa los mismos paquetes que el lector de certificados.
 */
const MAX_PIXELS = 25_000_000;

export function readQrFromImage(buffer: Buffer, mime: 'image/png' | 'image/jpeg'): string | null {
  try {
    let data: Uint8ClampedArray;
    let width: number;
    let height: number;
    if (mime === 'image/png') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const { PNG } = require('pngjs');
      const png = PNG.sync.read(buffer);
      if (png.width * png.height > MAX_PIXELS) return null;
      ({ width, height } = png);
      data = new Uint8ClampedArray(png.data);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const jpeg = require('jpeg-js');
      const img = jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 200 });
      if (img.width * img.height > MAX_PIXELS) return null;
      ({ width, height } = img);
      data = new Uint8ClampedArray(img.data);
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const jsQR = require('jsqr').default ?? require('jsqr');
    const r = jsQR(data, width, height);
    return r?.data ? String(r.data).slice(0, 1000) : null;
  } catch {
    return null;
  }
}
