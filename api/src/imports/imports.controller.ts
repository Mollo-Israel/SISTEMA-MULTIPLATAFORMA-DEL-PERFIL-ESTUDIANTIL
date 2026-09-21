import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ImportsService } from './imports.service';

/** 5 MB de padron son decenas de miles de filas: de sobra y acotado. */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/**
 * Importacion de padron institucional (especificacion §10).
 *
 * Son dos pasos deliberadamente separados: primero se previsualiza y se ve
 * exactamente que va a pasar, despues se aplica. Nunca un unico POST que
 * escribe sin que nadie haya visto el resultado.
 */
@ApiTags('imports')
@ApiBearerAuth()
@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post('students/preview')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Analizar un CSV de padrón sin aplicar nada.',
    description:
      'Devuelve el veredicto por fila: NEW, UPDATE, UNCHANGED, CONFLICT o INVALID, '
      + 'con los conteos y el motivo de cada rechazo.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_BYTES, files: 1 } }))
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Debe adjuntar el archivo en el campo "file".');
    return this.imports.preview(user.userId, file);
  }

  @Post('students/:batchId/apply')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Aplicar una previsualización.',
    description:
      'Solo crea las filas NEW y actualiza las UPDATE. Es idempotente: un lote ya '
      + 'aplicado no vuelve a aplicarse, y una ausencia en el archivo no desactiva a nadie.',
  })
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ) {
    return this.imports.apply(user.userId, batchId);
  }

  @Post('students/:batchId/discard')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Descartar una previsualización sin aplicarla.' })
  discard(@Param('batchId', ParseUUIDPipe) batchId: string) {
    return this.imports.discard(batchId);
  }

  @Get('students')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Historial de importaciones.' })
  list(@Query('limit') limit?: string) {
    return this.imports.listBatches(limit ? Number(limit) : undefined);
  }

  @Get('students/:batchId')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Detalle de un lote, fila por fila.' })
  detail(@Param('batchId', ParseUUIDPipe) batchId: string) {
    return this.imports.getBatch(batchId);
  }
}
