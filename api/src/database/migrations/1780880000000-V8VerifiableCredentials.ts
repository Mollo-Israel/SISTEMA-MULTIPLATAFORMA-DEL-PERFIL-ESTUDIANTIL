import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V8 · Registros verificables (Open Badges 3.0 / 2.0) y bitácora de transparencia.
 *
 * Es aditiva: cuatro tablas nuevas y ningún cambio en las existentes.
 *
 * La integridad la protege también la base, no solo la API:
 * - `credential_ledger` no admite UPDATE, DELETE ni TRUNCATE (trigger).
 * - En `verifiable_credentials`, lo firmado no se puede cambiar, y una
 *   revocación no se puede deshacer (trigger).
 */
export class V8VerifiableCredentials1780880000000 implements MigrationInterface {
  name = 'V8VerifiableCredentials1780880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "credential_issuance_policies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "enabled" boolean NOT NULL,
        "justification" character varying(500) NOT NULL,
        "decided_by" uuid NOT NULL,
        "decided_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_credential_issuance_policies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_credential_issuance_policies_user" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE RESTRICT
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_credential_issuance_policies_decided" ON "credential_issuance_policies" ("decided_at")`);

    await queryRunner.query(`
      CREATE TABLE "credential_signing_keys" (
        "id" character varying(40) NOT NULL,
        "algorithm" character varying(20) NOT NULL DEFAULT 'Ed25519',
        "public_key_multibase" character varying(80) NOT NULL,
        "origin" character varying(20) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "last_used_at" TIMESTAMP WITH TIME ZONE NULL,
        CONSTRAINT "PK_credential_signing_keys" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_credential_signing_keys_origin" CHECK ("origin" IN ('configured', 'derived'))
      )`);

    await queryRunner.query(`
      CREATE TABLE "verifiable_credentials" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "public_code" character varying(20) NOT NULL,
        "source_type" character varying(30) NOT NULL,
        "source_id" uuid NOT NULL,
        "student_profile_id" uuid NOT NULL,
        "activity_id" uuid NULL,
        "achievement_name" character varying(300) NOT NULL,
        "holder_name" character varying(200) NOT NULL,
        "issuer_name" character varying(200) NOT NULL,
        "document_issuer" character varying(200) NULL,
        "document_sha256" character(64) NULL,
        "occurred_at" TIMESTAMP WITH TIME ZONE NULL,
        "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "credential_json" jsonb NOT NULL,
        "credential_jwt" text NOT NULL,
        "payload_sha256" character(64) NOT NULL,
        "key_id" character varying(40) NOT NULL,
        "status_index" integer NOT NULL,
        "recipient_salt" character varying(32) NOT NULL,
        "recipient_hash" character varying(80) NOT NULL,
        "suspended_at" TIMESTAMP WITH TIME ZONE NULL,
        "suspended_by" uuid NULL,
        "suspension_reason" character varying(500) NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE NULL,
        "revoked_by" uuid NULL,
        "revocation_reason" character varying(500) NULL,
        "issued_by" uuid NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_verifiable_credentials" PRIMARY KEY ("id"),
        CONSTRAINT "FK_verifiable_credentials_profile" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_verifiable_credentials_key" FOREIGN KEY ("key_id") REFERENCES "credential_signing_keys"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_verifiable_credentials_source" CHECK ("source_type" IN ('participation', 'institution_certificate', 'internal_constancy')),
        CONSTRAINT "CHK_verifiable_credentials_code" CHECK ("public_code" ~ '^AF-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{5}$'),
        CONSTRAINT "CHK_verifiable_credentials_index" CHECK ("status_index" >= 0 AND "status_index" < 131072),
        CONSTRAINT "CHK_verifiable_credentials_sha" CHECK ("payload_sha256" ~ '^[0-9a-f]{64}$')
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_verifiable_credentials_code" ON "verifiable_credentials" ("public_code")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_verifiable_credentials_source" ON "verifiable_credentials" ("source_type", "source_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_verifiable_credentials_status_index" ON "verifiable_credentials" ("status_index")`);
    await queryRunner.query(`CREATE INDEX "IDX_verifiable_credentials_profile" ON "verifiable_credentials" ("student_profile_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_verifiable_credentials_document" ON "verifiable_credentials" ("document_sha256") WHERE "document_sha256" IS NOT NULL`);

    await queryRunner.query(`
      CREATE TABLE "credential_ledger" (
        "seq" bigint NOT NULL,
        "event" character varying(30) NOT NULL,
        "public_code" character varying(20) NULL,
        "data" jsonb NOT NULL,
        "prev_hash" character(64) NOT NULL,
        "entry_hash" character(64) NOT NULL,
        "actor_user_id" uuid NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_credential_ledger" PRIMARY KEY ("seq"),
        CONSTRAINT "CHK_credential_ledger_seq" CHECK ("seq" >= 1),
        CONSTRAINT "UQ_credential_ledger_hash" UNIQUE ("entry_hash")
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_credential_ledger_code" ON "credential_ledger" ("public_code")`);

    // La bitácora solo crece.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION afinia_credential_ledger_append_only() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'La bitácora de credenciales es de solo anexado: no se puede % una entrada.', lower(TG_OP)
          USING ERRCODE = 'integrity_constraint_violation';
      END;
      $$ LANGUAGE plpgsql`);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_credential_ledger_no_update_delete"
        BEFORE UPDATE OR DELETE ON "credential_ledger"
        FOR EACH ROW EXECUTE FUNCTION afinia_credential_ledger_append_only()`);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_credential_ledger_no_truncate"
        BEFORE TRUNCATE ON "credential_ledger"
        FOR EACH STATEMENT EXECUTE FUNCTION afinia_credential_ledger_append_only()`);

    // Lo firmado no cambia; la revocación es definitiva.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION afinia_verifiable_credential_guard() RETURNS trigger AS $$
      BEGIN
        IF NEW.public_code IS DISTINCT FROM OLD.public_code
          OR NEW.source_type IS DISTINCT FROM OLD.source_type
          OR NEW.source_id IS DISTINCT FROM OLD.source_id
          OR NEW.student_profile_id IS DISTINCT FROM OLD.student_profile_id
          OR NEW.activity_id IS DISTINCT FROM OLD.activity_id
          OR NEW.achievement_name IS DISTINCT FROM OLD.achievement_name
          OR NEW.holder_name IS DISTINCT FROM OLD.holder_name
          OR NEW.issuer_name IS DISTINCT FROM OLD.issuer_name
          OR NEW.document_issuer IS DISTINCT FROM OLD.document_issuer
          OR NEW.document_sha256 IS DISTINCT FROM OLD.document_sha256
          OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
          OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
          OR NEW.credential_json IS DISTINCT FROM OLD.credential_json
          OR NEW.credential_jwt IS DISTINCT FROM OLD.credential_jwt
          OR NEW.payload_sha256 IS DISTINCT FROM OLD.payload_sha256
          OR NEW.key_id IS DISTINCT FROM OLD.key_id
          OR NEW.status_index IS DISTINCT FROM OLD.status_index
          OR NEW.recipient_salt IS DISTINCT FROM OLD.recipient_salt
          OR NEW.recipient_hash IS DISTINCT FROM OLD.recipient_hash
          OR NEW.issued_by IS DISTINCT FROM OLD.issued_by
        THEN
          RAISE EXCEPTION 'Un registro verificable firmado no se puede modificar.'
            USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        IF OLD.revoked_at IS NOT NULL AND (
          NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
          OR NEW.revoked_by IS DISTINCT FROM OLD.revoked_by
          OR NEW.revocation_reason IS DISTINCT FROM OLD.revocation_reason)
        THEN
          RAISE EXCEPTION 'Una revocación es definitiva.' USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql`);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_verifiable_credentials_guard"
        BEFORE UPDATE ON "verifiable_credentials"
        FOR EACH ROW EXECUTE FUNCTION afinia_verifiable_credential_guard()`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_verifiable_credentials_guard" ON "verifiable_credentials"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS afinia_verifiable_credential_guard()`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credential_ledger"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS afinia_credential_ledger_append_only()`);
    await queryRunner.query(`DROP TABLE IF EXISTS "verifiable_credentials"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credential_signing_keys"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credential_issuance_policies"`);
  }
}
