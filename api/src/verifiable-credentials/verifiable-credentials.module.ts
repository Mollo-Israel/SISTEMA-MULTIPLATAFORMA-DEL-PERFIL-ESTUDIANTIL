import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerifiableCredential } from '../entities/verifiable-credential.entity';
import { CredentialLedgerEntry } from '../entities/credential-ledger-entry.entity';
import { CredentialSigningKey } from '../entities/credential-signing-key.entity';
import { CredentialIssuancePolicy } from '../entities/credential-issuance-policy.entity';
import { RetiredCredentialsController } from './retired-credentials.controller';

/**
 * Registros verificables (V8) — **retirados en V7.1 §7**.
 *
 * Afinia ya no emite documentos propios ni ofrece un verificador público. El
 * módulo ya no registra la emisión, la política, las descargas, el verificador
 * ni la preparación de la clave de firma al arrancar. Solo responde 410 neutro
 * en las rutas que existieron, para que un enlace compartido antes no
 * muestre nada.
 *
 * Se conservan las tablas (`verifiable_credentials`, `credential_ledger`,
 * `credential_signing_keys`, `credential_issuance_policies`), sus datos y sus
 * migraciones como histórico interno restringido. `ProofVerifierService` y
 * `crypto/` siguen en el código porque el Motor de Validación los usa para
 * leer insignias de **otros** emisores (V9).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([VerifiableCredential, CredentialLedgerEntry, CredentialSigningKey, CredentialIssuancePolicy]),
  ],
  controllers: [RetiredCredentialsController],
})
export class VerifiableCredentialsModule {}
