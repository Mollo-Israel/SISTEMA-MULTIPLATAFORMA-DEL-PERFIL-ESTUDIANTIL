import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoredFileRecord } from '../entities/stored-file.entity';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { STORAGE_PORT, StoragePort } from './storage.port';
import {
  ACCEPTED_MIME_TYPES,
  detectMimeType,
  HUMAN_ACCEPTED,
  mimeMatches,
} from './file-signature';

/** Tope por archivo (§27.3). Configurable, 10 MB por defecto. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface UploadedFileView {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  /** Id del archivo idéntico que ya había subido esta persona, si lo hay (§28). */
  duplicateOfId: string | null;
  createdAt: Date;
}

/**
 * Registro de archivos subidos (§27.2, §28).
 *
 * El archivo deja de ser una URL que el cliente pasea de un endpoint a otro y
 * pasa a ser una entidad con dueño. Adjuntarlo a una evidencia consiste en
 * nombrar su identificador, y solo quien lo subió puede hacerlo.
 */
@Injectable()
export class UploadsService {
  constructor(
    @InjectRepository(StoredFileRecord) private readonly files: Repository<StoredFileRecord>,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly audit: AuditService,
  ) {}

  /**
   * Valida, calcula la huella y guarda.
   *
   * El orden importa: primero se comprueba **qué es** el archivo de verdad y
   * solo después se escribe en disco. Al revés se estaría almacenando lo que
   * luego se rechaza.
   */
  async store(
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ): Promise<UploadedFileView> {
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('El archivo está vacío.');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException(
        `El archivo supera el máximo de ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB.`,
      );
    }

    const detectado = detectMimeType(file.buffer);
    if (!detectado || !ACCEPTED_MIME_TYPES.includes(detectado)) {
      throw new BadRequestException(
        `El contenido del archivo no corresponde a ningún formato aceptado. Se admiten ${HUMAN_ACCEPTED}.`,
      );
    }
    if (!mimeMatches(file.mimetype, detectado)) {
      // El archivo dice ser una cosa y es otra. Se rechaza sin más: no hay
      // motivo legitimo para que eso ocurra.
      throw new BadRequestException(
        `El archivo se declaró como ${file.mimetype} pero su contenido es ${detectado}.`,
      );
    }

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');

    // §28: el mismo contenido de la misma persona. No se rechaza —la misma
    // constancia puede respaldar dos cosas distintas—, se anota, que es lo que
    // permite despues no contarlo dos veces.
    const gemelo = await this.files.findOne({
      where: { sha256, uploadedByUserId: userId },
      order: { createdAt: 'ASC' },
    });

    const guardado = await this.storage.save({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: detectado,
      size: file.size,
    });

    const registro = await this.files.save(
      this.files.create({
        storageKey: guardado.id,
        originalFilename: guardado.originalName,
        mimeTypeDeclared: file.mimetype,
        mimeTypeDetected: detectado,
        sizeBytes: file.buffer.length,
        sha256,
        uploadedByUserId: userId,
        duplicateOfId: gemelo?.id ?? null,
      }),
    );

    await this.audit.record({
      actorUserId: userId,
      eventType: AuditEventType.FILE_UPLOADED,
      entityType: 'stored_file',
      entityId: registro.id,
      metadata: {
        mimeType: detectado,
        sizeBytes: registro.sizeBytes,
        duplicate: !!gemelo,
      },
    });

    return this.toView(registro);
  }

  /**
   * Comprueba que el archivo exista y sea de quien dice adjuntarlo.
   *
   * Este es el punto que cierra el agujero anterior: antes se enviaba una
   * `fileUrl` cualquiera y nada verificaba su procedencia, de modo que se podía
   * adjuntar el archivo de otra persona a una evidencia propia y, como la
   * autorización de descarga se resuelve mirando de quién es la evidencia,
   * quedar autorizado para leerlo.
   */
  async requireOwned(userId: string, storedFileId: string): Promise<StoredFileRecord> {
    const registro = await this.files.findOne({ where: { id: storedFileId } });
    if (!registro) throw new NotFoundException('El archivo no existe o ya fue eliminado.');
    if (registro.uploadedByUserId !== userId) {
      throw new ForbiddenException('Solo puede adjuntar archivos que usted haya subido.');
    }
    return registro;
  }

  async findById(storedFileId: string): Promise<StoredFileRecord | null> {
    return this.files.findOne({ where: { id: storedFileId } });
  }

  /**
   * Borra el registro y su archivo.
   *
   * Si otro registro comparte el mismo contenido se conserva el archivo en
   * disco: borrarlo dejaría al gemelo apuntando a nada.
   */
  async remove(storedFileId: string): Promise<void> {
    const registro = await this.files.findOne({ where: { id: storedFileId } });
    if (!registro) return;

    const compartido = await this.files.count({ where: { storageKey: registro.storageKey } });
    await this.files.delete({ id: registro.id });
    if (compartido <= 1) {
      await this.storage.remove(registro.storageKey);
    }
  }

  toView(registro: StoredFileRecord): UploadedFileView {
    return {
      id: registro.id,
      originalFilename: registro.originalFilename,
      mimeType: registro.mimeTypeDetected,
      sizeBytes: registro.sizeBytes,
      sha256: registro.sha256,
      duplicateOfId: registro.duplicateOfId,
      createdAt: registro.createdAt,
    };
  }
}
