import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V4.1 BATCH 7 · Gamificación por criterios (A41-016, §9, A.10).
 *
 * Aditiva:
 * - `gamification_criteria`: vigencia (`valid_from`, `valid_until`) y
 *   `is_bonus` para los extras de temporada por área. Los criterios
 *   existentes quedan como antes (sin vigencia, no son bonos).
 * - `gamification_proposals`: lo que un docente propone premiar (un proyecto
 *   de un estudiante de su alcance) y la decisión de Dirección. Un mismo
 *   criterio sobre el mismo proyecto y estudiante no se propone dos veces
 *   mientras no se haya rechazado.
 *
 * Retos, recompensas e insignias no se tocan: su historia se conserva.
 */
export class V41GamificationCriteria1780730000000 implements MigrationInterface {
  name = 'V41GamificationCriteria1780730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "gamification_criteria" ADD "valid_from" date NULL`);
    await queryRunner.query(`ALTER TABLE "gamification_criteria" ADD "valid_until" date NULL`);
    await queryRunner.query(`ALTER TABLE "gamification_criteria" ADD "is_bonus" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`
      ALTER TABLE "gamification_criteria" ADD CONSTRAINT "CHK_gamification_criteria_vigencia"
        CHECK ("valid_from" IS NULL OR "valid_until" IS NULL OR "valid_until" >= "valid_from")`);
    await queryRunner.query(`
      CREATE TABLE "gamification_proposals" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "criterion_id" uuid NOT NULL,
        "source_type" varchar(20) NOT NULL,
        "source_id" uuid NOT NULL,
        "student_profile_id" uuid NOT NULL,
        "proposed_by" uuid NOT NULL,
        "reason" varchar(500) NOT NULL,
        "status" varchar(12) NOT NULL DEFAULT 'pending',
        "review_comment" varchar(500) NULL,
        "reviewed_by" uuid NULL,
        "reviewed_at" TIMESTAMP WITH TIME ZONE NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gamification_proposals" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_gamification_proposals_status" CHECK ("status" IN ('pending', 'approved', 'rejected')),
        CONSTRAINT "CHK_gamification_proposals_source" CHECK ("source_type" IN ('project')),
        CONSTRAINT "FK_gp_criterion" FOREIGN KEY ("criterion_id") REFERENCES "gamification_criteria"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_gp_profile" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_gp_proposed_by" FOREIGN KEY ("proposed_by") REFERENCES "users"("id") ON DELETE RESTRICT
      )`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_gamification_proposals_vigente"
        ON "gamification_proposals" ("criterion_id", "source_type", "source_id", "student_profile_id")
        WHERE "status" <> 'rejected'`);
    await queryRunner.query(`CREATE INDEX "IDX_gamification_proposals_status" ON "gamification_proposals" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "gamification_proposals"`);
    await queryRunner.query(`ALTER TABLE "gamification_criteria" DROP CONSTRAINT IF EXISTS "CHK_gamification_criteria_vigencia"`);
    await queryRunner.query(`ALTER TABLE "gamification_criteria" DROP COLUMN IF EXISTS "is_bonus"`);
    await queryRunner.query(`ALTER TABLE "gamification_criteria" DROP COLUMN IF EXISTS "valid_until"`);
    await queryRunner.query(`ALTER TABLE "gamification_criteria" DROP COLUMN IF EXISTS "valid_from"`);
  }
}
