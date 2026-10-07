import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3 BATCH 8 · Oportunidades externas y credenciales (§15, §16, §17).
 *
 * - La inscripción a una externa gana el estado `accepted`: el responsable
 *   registra que el proveedor aceptó al estudiante. Aceptado no es haber
 *   obtenido la credencial (§15).
 * - Cada credencial dice de dónde viene: de una oportunidad en la que
 *   participó o histórica (§16). Las que ya existen son históricas: ninguna
 *   pasó por una oportunidad de Afinia.
 * - Referencia de validación de una oportunidad externa (§17).
 */
export class V3ExternalCredentials1780510000000 implements MigrationInterface {
  name = 'V3ExternalCredentials1780510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "activity_registrations_status_enum" ADD VALUE IF NOT EXISTS 'accepted' AFTER 'registered'`);
    await queryRunner.query(`ALTER TABLE "activity_registrations" ADD COLUMN "accepted_at" TIMESTAMPTZ NULL`);

    await queryRunner.query(`
      CREATE TYPE "external_credential_source_enum" AS ENUM ('opportunity', 'historical_external')`);
    await queryRunner.query(`
      ALTER TABLE "external_certificates"
        ADD COLUMN "source" "external_credential_source_enum" NOT NULL DEFAULT 'historical_external',
        ADD COLUMN "activity_id" UUID NULL
          CONSTRAINT "fk_external_certificate_activity" REFERENCES "activities"("id") ON DELETE SET NULL`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_external_certificate_activity"
        ON "external_certificates" ("student_profile_id", "activity_id")
        WHERE "activity_id" IS NOT NULL`);
    await queryRunner.query(`
      CREATE INDEX "idx_external_certificate_activity" ON "external_certificates" ("activity_id")`);

    await queryRunner.query(`
      CREATE TABLE "external_opportunity_validation_references" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "activity_id" UUID NOT NULL UNIQUE
          REFERENCES "activities"("id") ON DELETE CASCADE,
        "expected_course_name" VARCHAR(200) NULL,
        "credential_id_pattern" VARCHAR(80) NULL,
        "sample_stored_file_id" UUID NULL
          REFERENCES "stored_files"("id") ON DELETE SET NULL,
        "notes" VARCHAR(300) NULL,
        "updated_by" UUID NULL REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "external_opportunity_validation_references"`);
    await queryRunner.query(`DROP INDEX "idx_external_certificate_activity"`);
    await queryRunner.query(`DROP INDEX "uq_external_certificate_activity"`);
    await queryRunner.query(`
      ALTER TABLE "external_certificates" DROP COLUMN "activity_id", DROP COLUMN "source"`);
    await queryRunner.query(`DROP TYPE "external_credential_source_enum"`);

    // Postgres no quita valores de un enum: se recrea el tipo sin `accepted`.
    // Una aceptación vuelve a ser una inscripción, que es lo que era antes.
    await queryRunner.query(`ALTER TABLE "activity_registrations" DROP COLUMN "accepted_at"`);
    await queryRunner.query(`UPDATE "activity_registrations" SET "status" = 'registered' WHERE "status" = 'accepted'`);
    await queryRunner.query(`ALTER TABLE "activity_registrations" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(`ALTER TYPE "activity_registrations_status_enum" RENAME TO "activity_registrations_status_enum_old"`);
    await queryRunner.query(`
      CREATE TYPE "activity_registrations_status_enum"
        AS ENUM ('interested', 'registered', 'confirmed', 'absent', 'cancelled')`);
    await queryRunner.query(`
      ALTER TABLE "activity_registrations" ALTER COLUMN "status"
        TYPE "activity_registrations_status_enum" USING "status"::text::"activity_registrations_status_enum"`);
    await queryRunner.query(`ALTER TABLE "activity_registrations" ALTER COLUMN "status" SET DEFAULT 'interested'`);
    await queryRunner.query(`DROP TYPE "activity_registrations_status_enum_old"`);
  }
}
