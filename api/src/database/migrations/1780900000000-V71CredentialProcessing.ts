import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V7.1 · BATCH V7-3 · Credenciales: origen, procesamiento técnico y modelo versionado.
 *
 * Aditiva. No modifica ni borra datos existentes:
 *  - `validation_status_enum` gana `not_applicable`: una histórica, o una
 *    vinculada sin certificado modelo, no se procesa y va directo a Dirección
 *    (§5.2–§5.3). Es una omisión, no un fallo.
 *  - `validation_records` guarda el hash del archivo evaluado, por qué se
 *    omitieron las fases técnicas, la versión del modelo usada y los intentos
 *    anteriores. Un resultado nuevo archiva el anterior; no lo pisa (§5.3).
 *  - `validation_reference_versions`: versiones del certificado modelo (D03),
 *    con hash, autor, fecha, origen y motivo.
 */
export class V71CredentialProcessing1780900000000 implements MigrationInterface {
  name = 'V71CredentialProcessing1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL ≥ 12 admite agregar el valor dentro de la transacción; esta
    // migración no lo usa, así que no hace falta confirmarlo antes.
    await queryRunner.query(`ALTER TYPE "validation_status_enum" ADD VALUE IF NOT EXISTS 'not_applicable'`);

    await queryRunner.query(`
      CREATE TABLE "validation_reference_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "activity_id" uuid NOT NULL,
        "version" smallint NOT NULL,
        "stored_file_id" uuid NULL,
        "file_sha256" char(64) NULL,
        "file_name" varchar(160) NULL,
        "origin" varchar(20) NOT NULL,
        "reason" varchar(500) NULL,
        "created_by" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_validation_reference_versions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_validation_reference_versions_version" UNIQUE ("activity_id", "version"),
        CONSTRAINT "FK_validation_reference_versions_activity" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_validation_reference_versions_file" FOREIGN KEY ("stored_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_validation_reference_versions_author" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "CK_validation_reference_versions_origin" CHECK ("origin" IN ('responsable', 'direccion', 'previo'))
      )`);

    await queryRunner.query(`
      ALTER TABLE "validation_records"
        ADD COLUMN IF NOT EXISTS "file_sha256" char(64) NULL,
        ADD COLUMN IF NOT EXISTS "skipped_reason" varchar(40) NULL,
        ADD COLUMN IF NOT EXISTS "reference_version_id" uuid NULL,
        ADD COLUMN IF NOT EXISTS "previous_results" jsonb NOT NULL DEFAULT '[]'::jsonb`);
    await queryRunner.query(`
      ALTER TABLE "validation_records"
        ADD CONSTRAINT "FK_validation_records_reference_version"
        FOREIGN KEY ("reference_version_id") REFERENCES "validation_reference_versions"("id") ON DELETE SET NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "validation_records" DROP CONSTRAINT IF EXISTS "FK_validation_records_reference_version"`);
    await queryRunner.query(`
      ALTER TABLE "validation_records"
        DROP COLUMN IF EXISTS "previous_results",
        DROP COLUMN IF EXISTS "reference_version_id",
        DROP COLUMN IF EXISTS "skipped_reason",
        DROP COLUMN IF EXISTS "file_sha256"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "validation_reference_versions"`);
    // PostgreSQL no quita valores de un enum. 'not_applicable' queda definido,
    // y con el código anterior ninguna fila nueva lo usa.
  }
}
