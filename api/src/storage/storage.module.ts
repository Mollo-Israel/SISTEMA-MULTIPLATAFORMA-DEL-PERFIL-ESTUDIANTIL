import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { memoryStorage } from 'multer';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AccessModule } from '../access/access.module';
import { LocalStorageDriver } from './local-storage.driver';
import { UploadsController } from './uploads.controller';
import { FilesController } from './files.controller';
import { FileAccessService } from './file-access.service';
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
    ]),
    AccessModule,
  ],
  controllers: [UploadsController, FilesController],
  providers: [
    LocalStorageDriver,
    FileAccessService,
    { provide: STORAGE_PORT, useExisting: LocalStorageDriver },
  ],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
