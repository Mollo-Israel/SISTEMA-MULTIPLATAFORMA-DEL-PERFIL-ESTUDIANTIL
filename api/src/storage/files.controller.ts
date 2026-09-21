import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import * as path from 'path';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { LocalStorageDriver } from './local-storage.driver';
import { FileAccessService } from './file-access.service';

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

    // Nunca en línea: un HTML o un SVG servido desde el mismo origen podría
    // ejecutar script en el contexto de la aplicación.
    res.setHeader('Content-Disposition', `attachment; filename="${this.asciiName(resolved.downloadName)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');

    createReadStream(absolute).pipe(res);
  }

  /** Nombre seguro para la cabecera: sin comillas, saltos ni caracteres de control. */
  private asciiName(name: string): string {
    return name.replace(/[^\w .()-]+/g, '_').slice(0, 120) || 'archivo';
  }
}
