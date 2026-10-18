import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V4.1 BATCH 10 · GitHub con procedencia y pedidos de tecnologías (A41-020, §11).
 *
 * Aditiva:
 * - `project_skills.provenance`: de dónde salió la afirmación («declarada» o
 *   «sugerida: requirements.txt (fastapi)»). La señal detectada y lo que el
 *   estudiante afirma son capas distintas (§11.3).
 * - `projects.dismissed_suggestions`: señales que el estudiante descartó, para
 *   no volver a sugerírselas.
 * - `skill_requests`: «Tecnología no catalogada» que un estudiante pide evaluar.
 *   No se crea ninguna tecnología sola (§11.4): la decide Administración.
 */
export class V41GithubProvenance1780750000000 implements MigrationInterface {
  name = 'V41GithubProvenance1780750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project_skills" ADD "provenance" varchar(160) NULL`);
    await queryRunner.query(`ALTER TABLE "projects" ADD "dismissed_suggestions" jsonb NOT NULL DEFAULT '[]'::jsonb`);
    await queryRunner.query(`
      CREATE TABLE "skill_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(80) NOT NULL,
        "source" varchar(160) NULL,
        "project_id" uuid NULL,
        "requested_by" uuid NOT NULL,
        "status" varchar(12) NOT NULL DEFAULT 'pending',
        "skill_id" uuid NULL,
        "decision_note" varchar(300) NULL,
        "decided_by" uuid NULL,
        "decided_at" TIMESTAMP WITH TIME ZONE NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_skill_requests" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_skill_requests_status" CHECK ("status" IN ('pending', 'added', 'rejected')),
        CONSTRAINT "FK_skill_requests_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_skill_requests_user" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_skill_requests_skill" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_skill_requests_status" ON "skill_requests" ("status")`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_skill_requests_pendiente"
        ON "skill_requests" (lower("name"), "requested_by") WHERE "status" = 'pending'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "skill_requests"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN IF EXISTS "dismissed_suggestions"`);
    await queryRunner.query(`ALTER TABLE "project_skills" DROP COLUMN IF EXISTS "provenance"`);
  }
}
