import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ValidationRecord } from '../entities/validation-record.entity';
import { StoredFileRecord } from '../entities/stored-file.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { StorageModule } from '../storage/storage.module';
import { OCR_PORT, TesseractOcrAdapter } from './ocr.port';
import { DocumentExtractionService } from './document-extraction.service';
import { LinkCheckerService } from './link-checker.service';
import { ValidationService } from './validation.service';
import { ValidationWorker } from './validation.worker';
import { ValidationController } from './validation.controller';

/**
 * Motor de Validación y Respaldo (especificacion §26).
 *
 * Es global porque lo consumen evidencias, certificados y, más adelante,
 * proyectos: todos necesitan encolar y consultar veredictos, y pasarlo por
 * imports encadenados solo añadiría ruido.
 *
 * Es independiente del Motor de Afinidad, como exige §26: este decide qué
 * puede corroborarse técnicamente, aquel decide qué áreas son afines. Que
 * compartan datos no los convierte en el mismo motor.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ValidationRecord,
      StoredFileRecord,
      ProjectEvidence,
      ExternalCertificate,
      StudentProfile,
    ]),
    StorageModule,
  ],
  controllers: [ValidationController],
  providers: [
    {
      provide: OCR_PORT,
      useFactory: (config: ConfigService) => new TesseractOcrAdapter(config),
      inject: [ConfigService],
    },
    DocumentExtractionService,
    LinkCheckerService,
    ValidationService,
    ValidationWorker,
  ],
  exports: [ValidationService, ValidationWorker, DocumentExtractionService, LinkCheckerService],
})
export class ValidationModule {}
