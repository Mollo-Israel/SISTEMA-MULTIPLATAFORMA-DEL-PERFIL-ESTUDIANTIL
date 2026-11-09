import { randomUUID } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'node:stream';
import { extensionFor, FILES_ROUTE, safeDisplayName } from './storage-names';
import { StoragePort, StoredFile } from './storage.port';

export { FILES_ROUTE };

/**
 * Driver de disco local. Es el que permite que el sistema funcione completo sin
 * depender de ningun servicio externo.
 */
@Injectable()
export class LocalStorageDriver implements StoragePort, OnModuleInit {
  private readonly logger = new Logger(LocalStorageDriver.name);
  private readonly root: string;

  constructor(private readonly config: ConfigService) {
    const configured = config.get<string>('STORAGE_LOCAL_PATH', './uploads');
    this.root = path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }

  async onModuleInit(): Promise<void> {
    // Con otro driver esta clase ni se usa: no se crea ninguna carpeta.
    if ((this.config.get<string>('STORAGE_DRIVER') ?? 'local').trim().toLowerCase() === 'r2') return;
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
    const id = `${randomUUID()}${extensionFor(file.mimeType)}`;
    await fs.mkdir(this.root, { recursive: true });
    await fs.writeFile(path.join(this.root, id), file.buffer);

    return {
      id,
      url: `${FILES_ROUTE}/${id}`,
      originalName: safeDisplayName(file.originalName),
      mimeType: file.mimeType,
      size: file.size,
    };
  }

  async read(storageKey: string): Promise<Buffer | null> {
    const id = path.basename(storageKey);
    // basename descarta cualquier intento de recorrido de rutas; ademas se
    // comprueba que no quede nada raro.
    if (!id || id.includes('..') || id !== path.basename(id)) return null;
    try {
      return await fs.readFile(path.join(this.root, id));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        this.logger.warn(`No se pudo leer ${id}: ${String(error)}`);
      }
      return null;
    }
  }

  async stream(storageKey: string): Promise<Readable | null> {
    const id = path.basename(storageKey);
    if (!id || id.includes('..') || id !== path.basename(id)) return null;
    const ruta = path.join(this.root, id);
    try {
      await fs.stat(ruta);
    } catch {
      return null;
    }
    return createReadStream(ruta);
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
}
