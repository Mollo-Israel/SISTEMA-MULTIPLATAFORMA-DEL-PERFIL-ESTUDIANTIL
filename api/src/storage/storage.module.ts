import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { memoryStorage } from 'multer';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { ExternalOpportunityValidationReference } from '../entities/external-opportunity-validation-reference.entity';
import { ValidationRecord } from '../entities/validation-record.entity';
import { StoredFileRecord } from '../entities/stored-file.entity';
import { AccessModule } from '../access/access.module';
import { LocalStorageDriver } from './local-storage.driver';
import { UploadsController } from './uploads.controller';
import { FilesController } from './files.controller';
import { FileAccessService } from './file-access.service';
import { UploadsService } from './uploads.service';
import { OrphanFilesService } from './orphan-files.service';
import { STORAGE_PORT } from './storage.port';
import { storageDriverFactory } from './storage-driver.factory';

/**
 * Almacenamiento de archivos de evidencia.
 *
 * El driver concreto se resuelve aqui segun `STORAGE_DRIVER`. Hoy el unico es
 * `local` (disco), para que el sistema funcione completo sin depender de un
 * servicio externo. Un valor desconocido detiene el arranque: ignorarlo en
 * silencio guardaria los archivos donde nadie espera. Agregar un proveedor
 * remoto es sumar otra implementacion del mismo puerto en `storageDriverFactory`.
 *
 * Se usa memoryStorage porque el archivo se valida antes de escribirlo: multer
 * no toca el disco hasta que el driver decide donde y con que nombre guardarlo.
 *
 * La descarga es responsabilidad de FilesController, no de un servidor de
 * estaticos: §83 exige que conocer la URL no baste para bajar un archivo.
 */
@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
    TypeOrmModule.forFeature([
      ProjectEvidence,
      ExternalCertificate,
      Project,
      ProjectMember,
      StudentProfile,
      StoredFileRecord,
      ExternalOpportunityValidationReference,
      ValidationRecord,
    ]),
    AccessModule,
  ],
  controllers: [UploadsController, FilesController],
  providers: [
    LocalStorageDriver,
    FileAccessService,
    UploadsService,
    OrphanFilesService,
    { provide: STORAGE_PORT, useFactory: storageDriverFactory, inject: [ConfigService, LocalStorageDriver] },
  ],
  exports: [STORAGE_PORT, UploadsService],
})
export class StorageModule {}
