import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3 BATCH 13 · Respaldo por tecnología del proyecto (§24.4, §29).
 *
 * Cada tecnología declarada guarda cómo se corroboró: por los lenguajes del
 * repositorio, por un manifiesto o por la revisión de un docente. Arranca
 * en DECLARED; la próxima comprobación del repositorio la pone al día.
 */
export class V3ProjectSkillEvidence1780560000000 implements MigrationInterface {
  name = 'V3ProjectSkillEvidence1780560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "project_skill_evidence_enum" AS ENUM (
        'declared', 'corroborated_by_github_language', 'corroborated_by_manifest', 'corroborated_by_academic_review')`);
    await queryRunner.query(`
      ALTER TABLE "project_skills"
        ADD COLUMN "evidence_status" "project_skill_evidence_enum" NOT NULL DEFAULT 'declared',
        ADD COLUMN "evidence_source" VARCHAR(200) NULL,
        ADD COLUMN "academic_reviewed_by" UUID NULL
          CONSTRAINT "fk_project_skill_reviewer" REFERENCES "users"("id") ON DELETE SET NULL,
        ADD COLUMN "academic_reviewed_at" TIMESTAMPTZ NULL,
        ADD COLUMN "academic_review_comment" VARCHAR(500) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_skills"
        DROP COLUMN "academic_review_comment",
        DROP COLUMN "academic_reviewed_at",
        DROP COLUMN "academic_reviewed_by",
        DROP COLUMN "evidence_source",
        DROP COLUMN "evidence_status"`);
    await queryRunner.query(`DROP TYPE "project_skill_evidence_enum"`);
  }
}
