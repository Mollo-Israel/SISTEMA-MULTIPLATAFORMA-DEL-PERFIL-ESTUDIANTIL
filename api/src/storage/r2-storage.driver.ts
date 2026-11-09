import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { extensionFor, FILES_ROUTE, safeDisplayName } from './storage-names';
import { StoragePort, StoredFile } from './storage.port';

/** Cliente mínimo que usa el driver; permite probarlo sin red. */
export type R2Client = Pick<S3Client, 'send'>;

export interface R2Settings {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Variables que `STORAGE_DRIVER=r2` necesita. `R2_ENDPOINT` sustituye a la cuenta. */
export function readR2Settings(config: Pick<ConfigService, 'get'>): { settings: R2Settings; missing: string[] } {
  const get = (k: string) => config.get<string>(k)?.trim() ?? '';
  const accountId = get('R2_ACCOUNT_ID');
  const endpoint = get('R2_ENDPOINT') || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
  const settings = {
    endpoint,
    bucket: get('R2_BUCKET'),
    accessKeyId: get('R2_ACCESS_KEY_ID'),
    secretAccessKey: get('R2_SECRET_ACCESS_KEY'),
  };
  const missing = [
    ...(endpoint ? [] : ['R2_ACCOUNT_ID']),
    ...(settings.bucket ? [] : ['R2_BUCKET']),
    ...(settings.accessKeyId ? [] : ['R2_ACCESS_KEY_ID']),
    ...(settings.secretAccessKey ? [] : ['R2_SECRET_ACCESS_KEY']),
  ];
  return { settings, missing };
}

/**
 * Driver de Cloudflare R2, por su API compatible con S3.
 *
 * El bucket es privado: nadie llega a él directamente. La descarga sigue
 * pasando por FilesController, así que los permisos son los mismos que con el
 * disco local (§83).
 */
export class R2StorageDriver implements StoragePort {
  private readonly logger = new Logger(R2StorageDriver.name);

  constructor(
    private readonly settings: R2Settings,
    private readonly client: R2Client = new S3Client({
      region: 'auto',
      endpoint: settings.endpoint,
      forcePathStyle: true,
      // R2 no admite todas las sumas de verificación que este SDK agrega por omisión.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
    }),
  ) {
    this.logger.log(`Almacenamiento en R2, bucket ${settings.bucket}`);
  }

  async save(file: { buffer: Buffer; originalName: string; mimeType: string; size: number }): Promise<StoredFile> {
    const id = `${randomUUID()}${extensionFor(file.mimeType)}`;
    await this.client.send(
      new PutObjectCommand({ Bucket: this.settings.bucket, Key: id, Body: file.buffer, ContentType: file.mimeType }),
    );
    return {
      id,
      url: `${FILES_ROUTE}/${id}`,
      originalName: safeDisplayName(file.originalName),
      mimeType: file.mimeType,
      size: file.size,
    };
  }

  async read(storageKey: string): Promise<Buffer | null> {
    const body = await this.body(storageKey);
    if (!body) return null;
    const trozos: Buffer[] = [];
    for await (const trozo of body) trozos.push(Buffer.from(trozo as Uint8Array));
    return Buffer.concat(trozos);
  }

  async stream(storageKey: string): Promise<Readable | null> {
    return this.body(storageKey);
  }

  async remove(fileUrl: string): Promise<void> {
    const id = this.clave(fileUrl);
    if (!id) return;
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: id }));
    } catch (error) {
      this.logger.warn(`No se pudo eliminar ${id}: ${String(error)}`);
    }
  }

  private async body(storageKey: string): Promise<Readable | null> {
    const id = this.clave(storageKey);
    if (!id) return null;
    try {
      const salida = await this.client.send(new GetObjectCommand({ Bucket: this.settings.bucket, Key: id }));
      return (salida.Body as Readable | undefined) ?? null;
    } catch (error) {
      const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (e.name !== 'NoSuchKey' && e.$metadata?.httpStatusCode !== 404) {
        this.logger.warn(`No se pudo leer ${id}: ${String(error)}`);
      }
      return null;
    }
  }

  /** Solo el nombre: basename descarta cualquier intento de recorrido de rutas. */
  private clave(valor: string): string | null {
    const id = path.basename(valor);
    return !id || id.includes('..') ? null : id;
  }
}
