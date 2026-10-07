import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3 BATCH 17 · Necesidades con semestres objetivo y postulaciones (§31, §55).
 *
 *   - `team_needs.target_semesters`: qué semestres pueden ver y postular.
 *     Vacío = cualquiera; las necesidades existentes quedan así, sin cambio de
 *     comportamiento.
 *   - `team_applications`: el estudiante postula y el responsable acepta o
 *     rechaza con un motivo predefinido y un comentario breve opcional. Una
 *     fila por (necesidad, estudiante): insistir no crea filas nuevas.
 */
export class V3TeamApplications1780590000000 implements MigrationInterface {
  name = 'V3TeamApplications1780590000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "team_needs" ADD "target_semesters" SMALLINT[] NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`
      CREATE TYPE "team_application_status_enum" AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn')`);
    await queryRunner.query(`
      CREATE TABLE "team_applications" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "team_need_id" UUID NOT NULL REFERENCES "team_needs"("id") ON DELETE CASCADE,
        "applicant_profile_id" UUID NOT NULL REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        "message" VARCHAR(300) NULL,
        "status" "team_application_status_enum" NOT NULL DEFAULT 'pending',
        "rejection_reason" VARCHAR(40) NULL,
        "rejection_comment" VARCHAR(200) NULL,
        "decided_at" TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_team_application" UNIQUE ("team_need_id", "applicant_profile_id"),
        CONSTRAINT "chk_team_application_motivo" CHECK ("status" <> 'rejected' OR "rejection_reason" IS NOT NULL)
      )`);
    await queryRunner.query(`
      CREATE INDEX "idx_team_applications_necesidad" ON "team_applications" ("team_need_id", "status")`);
    await queryRunner.query(`
      CREATE INDEX "idx_team_applications_postulante" ON "team_applications" ("applicant_profile_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "team_applications"`);
    await queryRunner.query(`DROP TYPE "team_application_status_enum"`);
    await queryRunner.query(`ALTER TABLE "team_needs" DROP COLUMN "target_semesters"`);
  }
}
