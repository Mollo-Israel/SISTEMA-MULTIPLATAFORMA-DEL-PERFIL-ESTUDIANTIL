import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { LocalStorageDriver } from './local-storage.driver';
import { UploadsController } from './uploads.controller';
import { STORAGE_PORT } from './storage.port';

/**
 * Almacenamiento de archivos de evidencia.
 *
 * El driver concreto se resuelve aqui: hoy siempre el disco local, para que el
 * sistema funcione completo sin depender de un servicio externo. Agregar un
 * proveedor remoto es sustituir el useClass de STORAGE_PORT por otra
 * implementacion del mismo puerto.
 *
 * Se usa memoryStorage porque el archivo se valida antes de escribirlo: multer
 * no toca el disco hasta que el driver decide donde y con que nombre guardarlo.
 */
@Module({
  imports: [MulterModule.register({ storage: memoryStorage() })],
  controllers: [UploadsController],
  providers: [LocalStorageDriver, { provide: STORAGE_PORT, useExisting: LocalStorageDriver }],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
