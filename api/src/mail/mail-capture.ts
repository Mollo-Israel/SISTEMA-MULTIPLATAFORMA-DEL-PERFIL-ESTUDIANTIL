import { promises as fs } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { Logger } from '@nestjs/common';
import { MailMessage } from './mail.port';

/** Cuántos correos se conservan. Los más viejos se borran. */
const CONSERVAR = 400;

export interface CapturedMail extends MailMessage {
  capturedAt: string;
  transport: 'smtp' | 'console';
  delivered: boolean;
  error?: string;
}

/**
 * Copia local de los correos, solo fuera de producción.
 *
 * Sirve para dos cosas. En desarrollo, para ver exactamente qué recibiría el
 * estudiante —se puede abrir el `.html` en el navegador—. En las pruebas
 * automáticas, para leer el código de activación sin que el administrador lo
 * vea nunca: antes la API se lo devolvía al administrador para que las pruebas
 * pudieran activar cuentas, y eso es justo lo que no puede pasar.
 *
 * Un archivo por correo, en lugar de uno que crece: así escribir nunca compite
 * con leer, y podar es borrar archivos.
 */
export class MailCapture {
  private readonly logger = new Logger('MailCapture');
  private escritos = 0;
  private listo: Promise<void> | null = null;

  constructor(readonly dir: string) {}

  async write(registro: CapturedMail): Promise<void> {
    try {
      this.listo ??= fs.mkdir(this.dir, { recursive: true }).then(() => undefined);
      await this.listo;
      const base = `${Date.now()}-${randomBytes(4).toString('hex')}`;
      await fs.writeFile(join(this.dir, `${base}.json`), JSON.stringify(registro, null, 2), 'utf8');
      if (registro.html) {
        await fs.writeFile(join(this.dir, `${base}.html`), registro.html, 'utf8');
      }
      if (++this.escritos % 50 === 0) await this.podar();
    } catch (error) {
      // La copia es una ayuda, no una dependencia: si falla, el correo sigue.
      this.logger.warn(`No se pudo guardar la copia local del correo: ${String(error)}`);
    }
  }

  private async podar(): Promise<void> {
    // Los nombres empiezan por la fecha: orden de texto = orden cronológico.
    const archivos = (await fs.readdir(this.dir)).filter((f) => f.endsWith('.json')).sort((a, b) => a.localeCompare(b));
    const sobran = archivos.slice(0, Math.max(0, archivos.length - CONSERVAR));
    for (const f of sobran) {
      await fs.rm(join(this.dir, f), { force: true });
      await fs.rm(join(this.dir, f.replace(/\.json$/, '.html')), { force: true });
    }
  }
}
