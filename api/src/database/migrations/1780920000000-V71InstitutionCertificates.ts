import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V7.1 · BATCH V7-5 · Documentos institucionales (D04, D05).
 *
 * Aditiva. No modifica filas:
 *  - `activities.certificate_mode`: GENERAL o INDIVIDUAL, solo cuando el
 *    resultado es «certificado institucional». `null` en lo existente: conserva
 *    el comportamiento anterior.
 *  - `activities.general_certificate_file_id`: el archivo real común, privado
 *    hasta que se entrega.
 *  - `internal_constancies`: versión, versiones anteriores (reemplazo
 *    excepcional con motivo) y fecha de entrega.
 */
export class V71InstitutionCertificates1780920000000 implements MigrationInterface {
  name = 'V71InstitutionCertificates1780920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "activities"
        ADD COLUMN IF NOT EXISTS "certificate_mode" varchar(12) NULL,
        ADD COLUMN IF NOT EXISTS "general_certificate_file_id" uuid NULL`);
    await queryRunner.query(`
      ALTER TABLE "activities"
        ADD CONSTRAINT "CK_activities_certificate_mode" CHECK ("certificate_mode" IS NULL OR "certificate_mode" IN ('general', 'individual')),
        ADD CONSTRAINT "FK_activities_general_certificate_file" FOREIGN KEY ("general_certificate_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL`);
    await queryRunner.query(`
      ALTER TABLE "internal_constancies"
        ADD COLUMN IF NOT EXISTS "version" smallint NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "previous_versions" jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "delivered_at" timestamptz NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "internal_constancies"
        DROP COLUMN IF EXISTS "delivered_at",
        DROP COLUMN IF EXISTS "previous_versions",
        DROP COLUMN IF EXISTS "version"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP CONSTRAINT IF EXISTS "FK_activities_general_certificate_file"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP CONSTRAINT IF EXISTS "CK_activities_certificate_mode"`);
    await queryRunner.query(`
      ALTER TABLE "activities"
        DROP COLUMN IF EXISTS "general_certificate_file_id",
        DROP COLUMN IF EXISTS "certificate_mode"`);
  }
}
