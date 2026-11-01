import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import * as path from 'path';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { LocalStorageDriver } from './local-storage.driver';
import { FileAccessService } from './file-access.service';
import { StoredFileRecord } from '../entities/stored-file.entity';

/**
 * V6 §7.7 (V6-PROJ-06): tipos que se entregan con su Content-Type y se pueden
 * ver en el visor del navegador. Antes el archivo llegaba sin tipo y el visor
 * no lo reconocía como imagen (el «XML» del informe). Cualquier otro tipo se
 * entrega como binario y se descarga: nunca se interpreta (HTML, SVG…).
 */
const MOSTRABLES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']);
const POR_EXTENSION: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf',
};

/**
 * Descarga autorizada de archivos (especificación §27.1 y §83).
 *
 * Sustituye al servidor de estáticos anterior. La ruta es la misma
 * (`/api/files/:key`) para que las referencias ya guardadas en base de datos
 * sigan siendo válidas, pero ahora exige sesión y comprueba la autorización
 * sobre la entidad que contiene el archivo.
 */
@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(
    private readonly access: FileAccessService,
    private readonly config: ConfigService,
    @InjectRepository(StoredFileRecord) private readonly archivos: Repository<StoredFileRecord>,
  ) {}

  @Get(':key')
  @ApiOperation({
    summary: 'Descargar un archivo de evidencia o certificado.',
    description:
      'Requiere sesión. Solo lo obtiene quien puede ver la entidad que lo contiene: '
      + 'su titular, un integrante aceptado del proyecto, el administrador o un docente '
      + 'con el proyecto visible dentro de su alcance académico.',
  })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Res() res: Response,
  ): Promise<void> {
    const resolved = await this.access.authorize(user, key);

    const root = LocalStorageDriver.resolveRoot(this.config);
    const absolute = path.join(root, resolved.storageKey);

    // Defensa en profundidad: aunque la clave ya se validó, se confirma que la
    // ruta resuelta sigue dentro de la carpeta de almacenamiento.
    if (!absolute.startsWith(path.resolve(root) + path.sep)) {
      throw new NotFoundException('Archivo no encontrado.');
    }

    try {
      await stat(absolute);
    } catch {
      throw new NotFoundException('Archivo no encontrado.');
    }

    // V6 §7.7: el tipo real, detectado por contenido al subirlo (no por el
    // nombre). Imágenes y PDF se ven en línea; lo demás se descarga. Un HTML o
    // un SVG nunca se sirve en línea: podría ejecutar script en este origen.
    const tipo = await this.tipoDe(resolved.storageKey);
    const enLinea = MOSTRABLES.has(tipo);
    res.setHeader('Content-Type', enLinea ? tipo : 'application/octet-stream');
    res.setHeader('Content-Disposition', `${enLinea ? 'inline' : 'attachment'}; filename="${this.asciiName(resolved.downloadName)}"`);
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');

    createReadStream(absolute).pipe(res);
  }

  /** Tipo detectado al subir; un archivo anterior al registro de subidas, por su extensión. */
  private async tipoDe(storageKey: string): Promise<string> {
    const fila = await this.archivos.findOne({ where: { storageKey }, select: { id: true, mimeTypeDetected: true } });
    if (fila?.mimeTypeDetected) return fila.mimeTypeDetected.toLowerCase();
    return POR_EXTENSION[path.extname(storageKey).toLowerCase()] ?? 'application/octet-stream';
  }

  /** Nombre seguro para la cabecera: sin comillas, saltos ni caracteres de control. */
  private asciiName(name: string): string {
    return name.replace(/[^\w .()-]+/g, '_').slice(0, 120) || 'archivo';
  }
}
