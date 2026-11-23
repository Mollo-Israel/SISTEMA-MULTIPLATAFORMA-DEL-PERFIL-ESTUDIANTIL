import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ValidationRecord } from '../entities/validation-record.entity';
import { StoredFileRecord } from '../entities/stored-file.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { ExternalOpportunityValidationReference } from '../entities/external-opportunity-validation-reference.entity';
import { CredentialVerifierService } from './credential-verifier.service';
import { ProofVerifierService } from '../verifiable-credentials/proof-verifier.service';
import { StorageModule } from '../storage/storage.module';
import { TrajectoryModule } from '../trajectory/trajectory.module';
import { OCR_PORT, TesseractOcrAdapter } from './ocr.port';
import { DocumentExtractionService } from './document-extraction.service';
import { LinkCheckerService } from './link-checker.service';
import { ValidationService } from './validation.service';
import { ValidationWorker } from './validation.worker';
import { ValidationController } from './validation.controller';
import { StudentVerifiedEmail } from '../entities/verified-email.entity';
import { User } from '../entities/user.entity';
import { ForensicsService } from './forensics/forensics.service';
import { SharedCredentialService } from './fraud/shared-credential.service';
import { VerifiedEmailsService } from './verified-emails.service';
import { VerifiedEmailsController } from './verified-emails.controller';

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
      ExternalOpportunityValidationReference,
      // V9: correos personales comprobados.
      StudentVerifiedEmail,
      User,
    ]),
    StorageModule,
    TrajectoryModule,
  ],
  controllers: [ValidationController, VerifiedEmailsController],
  providers: [
    {
      provide: OCR_PORT,
      useFactory: (config: ConfigService) => new TesseractOcrAdapter(config),
      inject: [ConfigService],
    },
    DocumentExtractionService,
    LinkCheckerService,
    CredentialVerifierService,
    // V8: comprobación de firmas de insignias externas (sin claves propias).
    ProofVerifierService,
    ValidationService,
    ValidationWorker,
    // V9: validación reforzada (forense, antifraude entre estudiantes, correos comprobados).
    ForensicsService,
    SharedCredentialService,
    VerifiedEmailsService,
  ],
  exports: [ValidationService, ValidationWorker, DocumentExtractionService, LinkCheckerService],
})
export class ValidationModule {}
