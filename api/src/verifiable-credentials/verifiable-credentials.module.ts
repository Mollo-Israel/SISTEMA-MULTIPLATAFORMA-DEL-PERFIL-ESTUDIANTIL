import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerifiableCredential } from '../entities/verifiable-credential.entity';
import { CredentialLedgerEntry } from '../entities/credential-ledger-entry.entity';
import { CredentialSigningKey } from '../entities/credential-signing-key.entity';
import { CredentialIssuancePolicy } from '../entities/credential-issuance-policy.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { CredentialLedgerService } from './credential-ledger.service';
import { CredentialKeysService } from './credential-keys.service';
import { ProofVerifierService } from './proof-verifier.service';
import { VerifiableCredentialsService } from './verifiable-credentials.service';
import { CredentialVerificationService } from './credential-verification.service';
import { CredentialsController } from './credentials.controller';
import { PublicCredentialsController } from './public-credentials.controller';

/**
 * Registros verificables (V8): Open Badges 3.0 y 2.0, listas de estado,
 * bitácora de transparencia y verificador público.
 *
 * Usa el verificador de enlaces del Motor de Validación (global) para
 * resolver claves y listas de otros emisores con protección SSRF.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      VerifiableCredential, CredentialLedgerEntry, CredentialSigningKey, CredentialIssuancePolicy, StudentProfile,
    ]),
  ],
  controllers: [PublicCredentialsController, CredentialsController],
  providers: [
    CredentialLedgerService,
    CredentialKeysService,
    ProofVerifierService,
    VerifiableCredentialsService,
    CredentialVerificationService,
  ],
  exports: [ProofVerifierService, VerifiableCredentialsService],
})
export class VerifiableCredentialsModule {}
