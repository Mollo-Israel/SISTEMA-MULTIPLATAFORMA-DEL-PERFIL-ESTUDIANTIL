import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { HUMAN_ACCEPTED } from './file-signature';
import { MAX_FILE_BYTES, UploadedFileView, UploadsService } from './uploads.service';
import { OrphanFilesService } from './orphan-files.service';

/**
 * Subida de archivos (especificacion §27).
 *
 * Devuelve un identificador, no una URL. Antes devolvía la ruta pública y el
 * cliente la reenviaba al crear la evidencia; eso permitía adjuntar la ruta de
 * otra persona, que es justo el patrón contra el que advierte §27 —«evitar
 * confiar en una URL pública que el cliente devuelve luego al API»—.
 *
 * Ahora el archivo tiene dueño y adjuntarlo exige ser ese dueño.
 */
@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    private readonly orphans: OrphanFilesService,
  ) {}

  @Post()
  // V3 §17: los responsables suben el certificado de ejemplo de una
  // oportunidad externa. El archivo queda suyo y solo lo enlaza su dueño.
  @Roles(
    RolNombre.STUDENT,
    RolNombre.TEACHER,
    RolNombre.CAREER_DIRECTOR,
    RolNombre.SCIENTIFIC_SOCIETY,
    RolNombre.ADMIN,
  )
  @ApiOperation({
    summary: `Subir un archivo. Máximo ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB. Formatos: ${HUMAN_ACCEPTED}.`,
    description:
      'Devuelve el identificador del archivo, su huella SHA-256 y, si ya había subido '
      + 'ese mismo contenido, el identificador del original. El tipo se determina por la '
      + 'firma real del archivo, no por lo que declare el cliente.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } }))
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UploadedFileView> {
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo en el campo "file".');
    }
    return this.uploads.store(user.userId, file);
  }

  /**
   * Fuerza una vuelta de limpieza de huérfanos (§136).
   *
   * La limpieza corre sola cada pocas horas; esto existe para poder provocarla
   * —al liberar espacio, o al comprobar en una prueba que hace lo que dice— sin
   * esperar a que caiga la siguiente vuelta. Solo administración: es una tarea
   * de mantenimiento, no una función del producto.
   */
  @Post('cleanup-orphans')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Elimina los archivos subidos que nunca llegaron a adjuntarse (§136).',
    description:
      'Solo alcanza a los que superan el periodo de gracia y a los que no menciona '
      + 'ningún certificado, ninguna evidencia ni ningún duplicado.',
  })
  async cleanupOrphans(): Promise<{ removed: number }> {
    return { removed: await this.orphans.limpiarTanda() };
  }
}
