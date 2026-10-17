import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V4.1 BATCH 5 · Propuesta de recursos por docentes y revisión de Dirección
 * (A41-014, §7).
 *
 * Aditiva:
 * - `review_status`: `not_required` (lo crean Dirección o Administración;
 *   todos los existentes quedan así) o `pending` / `observed` / `approved` /
 *   `rejected` para lo que propone un docente. Solo `not_required` y
 *   `approved` llegan a la Biblioteca.
 * - `semester_scope`: semestres a los que va dirigido (vacío = toda la carrera).
 * - quién revisó, cuándo y con qué comentario.
 */
export class V41ResourceReview1780720000000 implements MigrationInterface {
  name = 'V41ResourceReview1780720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "learning_resources" ADD "review_status" varchar(16) NOT NULL DEFAULT 'not_required'`);
    await queryRunner.query(`
      ALTER TABLE "learning_resources" ADD CONSTRAINT "CHK_learning_resources_review"
        CHECK ("review_status" IN ('not_required', 'pending', 'observed', 'approved', 'rejected'))`);
    await queryRunner.query(`ALTER TABLE "learning_resources" ADD "semester_scope" smallint[] NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`ALTER TABLE "learning_resources" ADD "review_comment" varchar(500) NULL`);
    await queryRunner.query(`ALTER TABLE "learning_resources" ADD "reviewed_by" uuid NULL`);
    await queryRunner.query(`ALTER TABLE "learning_resources" ADD "reviewed_at" TIMESTAMP WITH TIME ZONE NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_learning_resources_review" ON "learning_resources" ("review_status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_learning_resources_review"`);
    await queryRunner.query(`ALTER TABLE "learning_resources" DROP COLUMN IF EXISTS "reviewed_at"`);
    await queryRunner.query(`ALTER TABLE "learning_resources" DROP COLUMN IF EXISTS "reviewed_by"`);
    await queryRunner.query(`ALTER TABLE "learning_resources" DROP COLUMN IF EXISTS "review_comment"`);
    await queryRunner.query(`ALTER TABLE "learning_resources" DROP COLUMN IF EXISTS "semester_scope"`);
    await queryRunner.query(`ALTER TABLE "learning_resources" DROP CONSTRAINT IF EXISTS "CHK_learning_resources_review"`);
    await queryRunner.query(`ALTER TABLE "learning_resources" DROP COLUMN IF EXISTS "review_status"`);
  }
}
