import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3 BATCH 9 · Validación escalonada de credenciales externas (§18, §19, §20).
 *
 * - El respaldo gana el nivel FLAGGED (contradicción significativa).
 * - `credential_check`: lo que se averiguó en la fuente oficial (estado,
 *   dominio, QR, insignia, contradicciones). Solo en credenciales.
 * - Revisión manual excepcional de Dirección para históricas sin verificador.
 *
 * No toca los veredictos existentes: se vuelven a validar con la versión
 * nueva del validador desde `POST /validation/reprocess-outdated`.
 */
export class V3CredentialValidation1780520000000 implements MigrationInterface {
  name = 'V3CredentialValidation1780520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "validation_backing_tier_enum" ADD VALUE IF NOT EXISTS 'flagged'`);
    await queryRunner.query(`
      CREATE TYPE "validation_manual_review_enum" AS ENUM ('requested', 'corroborated', 'not_corroborated')`);
    await queryRunner.query(`
      ALTER TABLE "validation_records"
        ADD COLUMN "credential_check" JSONB NULL,
        ADD COLUMN "manual_review_status" "validation_manual_review_enum" NULL,
        ADD COLUMN "manual_review_note" VARCHAR(300) NULL,
        ADD COLUMN "manual_review_requested_at" TIMESTAMPTZ NULL,
        ADD COLUMN "manual_reviewer_id" UUID NULL
          CONSTRAINT "fk_validation_manual_reviewer" REFERENCES "users"("id") ON DELETE SET NULL,
        ADD COLUMN "manual_reviewed_at" TIMESTAMPTZ NULL,
        ADD COLUMN "manual_review_reason" VARCHAR(500) NULL`);
    await queryRunner.query(`
      CREATE INDEX "idx_validation_manual_review" ON "validation_records" ("manual_review_status")
        WHERE "manual_review_status" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_validation_manual_review"`);
    await queryRunner.query(`
      ALTER TABLE "validation_records"
        DROP COLUMN "manual_review_reason",
        DROP COLUMN "manual_reviewed_at",
        DROP COLUMN "manual_reviewer_id",
        DROP COLUMN "manual_review_requested_at",
        DROP COLUMN "manual_review_note",
        DROP COLUMN "manual_review_status",
        DROP COLUMN "credential_check"`);
    await queryRunner.query(`DROP TYPE "validation_manual_review_enum"`);

    // Postgres no quita valores de un enum: se recrea sin `flagged`. Una
    // credencial señalada vuelve a «declarada», el nivel que no suma.
    await queryRunner.query(`UPDATE "validation_records" SET "backing_tier" = 'declared' WHERE "backing_tier" = 'flagged'`);
    await queryRunner.query(`ALTER TABLE "validation_records" ALTER COLUMN "backing_tier" DROP DEFAULT`);
    await queryRunner.query(`ALTER TYPE "validation_backing_tier_enum" RENAME TO "validation_backing_tier_enum_old"`);
    await queryRunner.query(`CREATE TYPE "validation_backing_tier_enum" AS ENUM ('declared', 'supported', 'corroborated')`);
    await queryRunner.query(`
      ALTER TABLE "validation_records" ALTER COLUMN "backing_tier"
        TYPE "validation_backing_tier_enum" USING "backing_tier"::text::"validation_backing_tier_enum"`);
    await queryRunner.query(`ALTER TABLE "validation_records" ALTER COLUMN "backing_tier" SET DEFAULT 'declared'`);
    await queryRunner.query(`DROP TYPE "validation_backing_tier_enum_old"`);
  }
}
