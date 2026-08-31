import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StoragePort, StoredFile } from './storage.port';

/** Prefijo publico bajo el que se sirven los archivos guardados. */
export const FILES_ROUTE = '/api/files';

/** Caracteres de control ASCII y DEL, que no deben quedar en un nombre visible. */
const CONTROL_CHARS = new RegExp('[\u0000-\u001f\u007f]', 'g');

/** Extension segura por tipo aceptado. Nunca se usa la del nombre original. */
const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

/**
 * Driver de disco local. Es el que permite que el sistema funcione completo sin
 * depender de ningun servicio externo.
 */
@Injectable()
export class LocalStorageDriver implements StoragePort, OnModuleInit {
  private readonly logger = new Logger(LocalStorageDriver.name);
  private readonly root: string;

  constructor(config: ConfigService) {
    const configured = config.get<string>('STORAGE_LOCAL_PATH', './uploads');
    this.root = path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }

  static resolveRoot(config: ConfigService): string {
    const configured = config.get<string>('STORAGE_LOCAL_PATH', './uploads');
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
  }

  async onModuleInit(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    this.logger.log(`Almacenamiento local de evidencias en ${this.root}`);
  }

  async save(file: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    size: number;
  }): Promise<StoredFile> {
    // El nombre en disco lo genera el sistema: no se usa nada que venga del
    // cliente, de modo que no hay forma de escribir fuera de la carpeta.
    const extension = EXTENSION_BY_MIME[file.mimeType] ?? '.bin';
    const id = `${randomUUID()}${extension}`;
    await fs.mkdir(this.root, { recursive: true });
    await fs.writeFile(path.join(this.root, id), file.buffer);

    return {
      id,
      url: `${FILES_ROUTE}/${id}`,
      originalName: this.safeDisplayName(file.originalName),
      mimeType: file.mimeType,
      size: file.size,
    };
  }

  async remove(fileUrl: string): Promise<void> {
    const id = path.basename(fileUrl);
    // basename descarta cualquier intento de recorrido de rutas.
    if (!id || id.includes('..') || id !== path.basename(id)) return;
    try {
      await fs.unlink(path.join(this.root, id));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        this.logger.warn(`No se pudo eliminar ${id}: ${String(error)}`);
      }
    }
  }

  /** Nombre visible saneado: sin rutas ni caracteres de control. */
  private safeDisplayName(name: string): string {
    const base = path.basename(name).replace(CONTROL_CHARS, '').trim();
    return (base || 'archivo').slice(0, 120);
  }
}
