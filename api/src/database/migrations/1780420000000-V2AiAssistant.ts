import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Asistente de IA y moderación de nombres de equipo (especificación V2 §43, §44).
 *
 * - `ai_assistance_runs`: cada ejecución con proveedor, modelo, tarea, huella
 *   de la entrada (no la entrada), resultado y quién lo aceptó.
 * - `teams.name_status`: un nombre que la IA marcó como ambiguo no se comparte
 *   hasta corregirlo. Los equipos existentes quedan `ok`: pasaron la regla de
 *   su momento y la moderación nueva se aplica al crearlos o renombrarlos.
 */
export class V2AiAssistant1780420000000 implements MigrationInterface {
  name = 'V2AiAssistant1780420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ai_assistance_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "provider" varchar(40) NOT NULL,
        "model" varchar(120),
        "task_type" varchar(40) NOT NULL,
        "input_fingerprint" char(64) NOT NULL,
        "result" jsonb,
        "status" varchar(20) NOT NULL,
        "error_message" varchar(300),
        "latency_ms" int,
        "target_type" varchar(40),
        "target_id" uuid,
        "requested_by" uuid,
        "accepted_by" uuid,
        "accepted_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_ai_assistance_runs" PRIMARY KEY ("id"),
        CONSTRAINT "ck_ai_run_status" CHECK ("status" IN ('completed', 'failed')),
        CONSTRAINT "ck_ai_run_task" CHECK ("task_type" IN (
          'TAG_SUGGESTION', 'EVIDENCE_SUMMARY', 'INCONSISTENCY_EXPLANATION',
          'CV_TEXT_ASSIST', 'ANALYTICS_NARRATIVE', 'CONTENT_MODERATION_FLAG')),
        CONSTRAINT "ck_ai_run_accepted" CHECK (("accepted_by" IS NULL) = ("accepted_at" IS NULL)),
        CONSTRAINT "fk_ai_run_requested_by" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_ai_run_accepted_by" FOREIGN KEY ("accepted_by") REFERENCES "users"("id") ON DELETE SET NULL
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_ai_runs_requested" ON "ai_assistance_runs" ("requested_by", "created_at")`,
    );
    await queryRunner.query(`
      ALTER TABLE "teams"
        ADD "name_status" varchar(20) NOT NULL DEFAULT 'ok',
        ADD "name_flag_reason" varchar(300),
        ADD CONSTRAINT "ck_team_name_status" CHECK ("name_status" IN ('ok', 'flagged'))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teams"
        DROP CONSTRAINT "ck_team_name_status",
        DROP COLUMN "name_flag_reason",
        DROP COLUMN "name_status"`);
    await queryRunner.query(`DROP TABLE "ai_assistance_runs"`);
  }
}
