import {
  BadRequestException,
  Controller,
  Inject,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { STORAGE_PORT, StoragePort, StoredFile } from './storage.port';

/** Tipos aceptados para evidencias y certificados. */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const HUMAN_TYPES = 'PDF, PNG, JPG o WEBP';

/**
 * Subida de archivos de evidencia (RF11).
 *
 * Se sube primero y se obtiene una referencia; luego esa referencia se adjunta a
 * la evidencia o al certificado. Asi el archivo y su metadato viajan por separado
 * y el mismo endpoint sirve a ambos casos.
 */
@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(@Inject(STORAGE_PORT) private readonly storage: StoragePort) {}

  @Post()
  @Roles(RolNombre.STUDENT, RolNombre.ADMIN)
  @ApiOperation({
    summary: `Subir un archivo de evidencia. Máximo 5 MB. Formatos: ${HUMAN_TYPES}.`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_BYTES, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(
            new BadRequestException(
              `Formato no permitido. Se aceptan archivos ${HUMAN_TYPES}.`,
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(@UploadedFile() file?: Express.Multer.File): Promise<StoredFile> {
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo en el campo "file".');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('El archivo supera el máximo de 5 MB.');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Formato no permitido. Se aceptan archivos ${HUMAN_TYPES}.`);
    }
    return this.storage.save({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });
  }
}
