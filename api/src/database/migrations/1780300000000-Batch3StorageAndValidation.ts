import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BATCH 3 — Storage y validación (especificacion §26 a §31, §73.5, §76).
 *
 * Dos tablas nuevas y una columna en cada tabla que puede llevar archivo.
 * Nada se reescribe: las columnas `file_url`, `file_name`, `mime_type` y
 * `file_size` que ya existían se conservan y se siguen rellenando, de modo que
 * las evidencias y los certificados anteriores siguen funcionando igual.
 *
 * Lo que sí cambia es de dónde viene la autoridad: a partir de ahora el
 * archivo es una fila de `stored_files` con dueño y huella, y adjuntarlo exige
 * ser ese dueño.
 */
export class Batch3StorageAndValidation1780300000000 implements MigrationInterface {
  name = 'Batch3StorageAndValidation1780300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================= §27.2
    await queryRunner.query(`
      CREATE TABLE "stored_files" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "storage_key" character varying(200) NOT NULL,
        "original_filename" character varying(160) NOT NULL,
        "mime_type_declared" character varying(120) NOT NULL,
        "mime_type_detected" character varying(120) NOT NULL,
        "size_bytes" integer NOT NULL,
        "sha256" character(64) NOT NULL,
        "uploaded_by_user_id" uuid NOT NULL,
        "duplicate_of_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stored_files" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stored_files_user" FOREIGN KEY ("uploaded_by_user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_stored_files_duplicate" FOREIGN KEY ("duplicate_of_id")
          REFERENCES "stored_files"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_stored_files_storage_key" ON "stored_files" ("storage_key")
    `);
    // §28: la deduplicacion consulta por huella y por dueno, siempre juntas.
    await queryRunner.query(`
      CREATE INDEX "IDX_stored_files_sha_owner"
        ON "stored_files" ("sha256", "uploaded_by_user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_stored_files_owner" ON "stored_files" ("uploaded_by_user_id")
    `);

    // ============================================================= §73.5
    await queryRunner.query(`
      CREATE TYPE "validation_resource_type_enum" AS ENUM (
        'project_evidence', 'external_certificate', 'activity_evidence'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "validation_status_enum" AS ENUM (
        'pending', 'processing', 'completed', 'inconclusive', 'failed'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "validation_backing_tier_enum" AS ENUM (
        'declared', 'supported', 'corroborated'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "validation_identity_match_enum" AS ENUM (
        'match', 'partial_match', 'mismatch', 'unknown'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "validation_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "resource_type" "validation_resource_type_enum" NOT NULL,
        "resource_id" uuid NOT NULL,
        "status" "validation_status_enum" NOT NULL DEFAULT 'pending',
        "backing_tier" "validation_backing_tier_enum" NOT NULL DEFAULT 'declared',
        "extracted_data" jsonb,
        "identity_match_status" "validation_identity_match_enum" NOT NULL DEFAULT 'unknown',
        "link_check" jsonb,
        "duplicate_of_id" uuid,
        "validator_version" smallint NOT NULL DEFAULT 1,
        "attempts" smallint NOT NULL DEFAULT 0,
        "next_attempt_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "claimed_by" character varying(80),
        "started_at" TIMESTAMP WITH TIME ZONE,
        "finished_at" TIMESTAMP WITH TIME ZONE,
        "error_code" character varying(80),
        "error_detail" character varying(400),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_validation_records" PRIMARY KEY ("id")
      )
    `);
    // Un recurso, un veredicto. Es lo que hace idempotente encolar dos veces.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_validation_records_recurso"
        ON "validation_records" ("resource_type", "resource_id")
    `);
    // El worker pregunta siempre lo mismo: que hay pendiente y ya vencido.
    await queryRunner.query(`
      CREATE INDEX "IDX_validation_records_cola"
        ON "validation_records" ("status", "next_attempt_at")
    `);

    // ================================================== enlace con archivos
    await queryRunner.query(`
      ALTER TABLE "project_evidences" ADD COLUMN "stored_file_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "project_evidences"
        ADD CONSTRAINT "FK_project_evidences_stored_file"
        FOREIGN KEY ("stored_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_project_evidences_stored_file"
        ON "project_evidences" ("stored_file_id")
    `);

    // §30: el identificador de credencial es uno de los campos que el
    // validador compara con lo que dice el documento.
    await queryRunner.query(`
      ALTER TABLE "external_certificates" ADD COLUMN "credential_id" character varying(80)
    `);
    await queryRunner.query(`
      ALTER TABLE "external_certificates" ADD COLUMN "stored_file_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "external_certificates"
        ADD CONSTRAINT "FK_external_certificates_stored_file"
        FOREIGN KEY ("stored_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_external_certificates_stored_file"
        ON "external_certificates" ("stored_file_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "external_certificates"
        DROP CONSTRAINT IF EXISTS "FK_external_certificates_stored_file"
    `);
    await queryRunner.query(`
      ALTER TABLE "external_certificates" DROP COLUMN IF EXISTS "stored_file_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "external_certificates" DROP COLUMN IF EXISTS "credential_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "project_evidences"
        DROP CONSTRAINT IF EXISTS "FK_project_evidences_stored_file"
    `);
    await queryRunner.query(`
      ALTER TABLE "project_evidences" DROP COLUMN IF EXISTS "stored_file_id"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "validation_records"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "validation_identity_match_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "validation_backing_tier_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "validation_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "validation_resource_type_enum"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "stored_files"`);
  }
}
