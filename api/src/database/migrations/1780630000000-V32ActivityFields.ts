import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3.2 BATCH 5 · Campos y responsables de una actividad (§16–§22, §28).
 *
 * - `meeting_url`: el enlace de la reunión (virtual o híbrida), separado de
 *   `resource_links` (0..N: guía, material, sitio, patrocinador) y del
 *   `external_url` de una oportunidad externa (§18.2).
 * - `image_file_id`: una imagen ilustrativa opcional (§18.3).
 * - `cancellation_reason`: cancelar exige motivo (§21.6).
 * - `updated_by`: quién hizo el último cambio (§9).
 * - `search_keywords`: términos de búsqueda derivados de áreas y habilidades,
 *   nunca escritos a mano ni usados por los motores (§20).
 * - `activity_responsibles` (1..N) y `activity_contacts` (0..N): creador,
 *   responsable y contacto no son lo mismo (§16). Se rellenan con el
 *   responsable que ya tenía cada actividad; `responsible_user_id` se conserva
 *   como el responsable principal.
 * - Política de resultado: `participation_only` e
 *   `institution_issued_certificate` (§28).
 */
export class V32ActivityFields1780630000000 implements MigrationInterface {
  name = 'V32ActivityFields1780630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "activity_outcome_policy_enum" ADD VALUE IF NOT EXISTS 'participation_only'`);
    await queryRunner.query(`ALTER TYPE "activity_outcome_policy_enum" ADD VALUE IF NOT EXISTS 'institution_issued_certificate'`);

    await queryRunner.query(`ALTER TABLE "activities" ADD "meeting_url" varchar(500) NULL`);
    await queryRunner.query(`ALTER TABLE "activities" ADD "resource_links" jsonb NOT NULL DEFAULT '[]'`);
    await queryRunner.query(`ALTER TABLE "activities" ADD "image_file_id" uuid NULL`);
    await queryRunner.query(`
      ALTER TABLE "activities" ADD CONSTRAINT "FK_activities_image_file"
        FOREIGN KEY ("image_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE "activities" ADD "cancellation_reason" varchar(500) NULL`);
    await queryRunner.query(`ALTER TABLE "activities" ADD "cancelled_at" TIMESTAMP WITH TIME ZONE NULL`);
    await queryRunner.query(`ALTER TABLE "activities" ADD "updated_by" uuid NULL`);
    await queryRunner.query(`
      ALTER TABLE "activities" ADD CONSTRAINT "FK_activities_updated_by"
        FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE "activities" ADD "search_keywords" text[] NOT NULL DEFAULT '{}'`);

    await queryRunner.query(`
      CREATE TABLE "activity_responsibles" (
        "activity_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_responsibles" PRIMARY KEY ("activity_id", "user_id"),
        CONSTRAINT "FK_activity_responsibles_activity" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_activity_responsibles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_activity_responsibles_user" ON "activity_responsibles" ("user_id")`);
    await queryRunner.query(`
      CREATE TABLE "activity_contacts" (
        "activity_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_contacts" PRIMARY KEY ("activity_id", "user_id"),
        CONSTRAINT "FK_activity_contacts_activity" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_activity_contacts_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_activity_contacts_user" ON "activity_contacts" ("user_id")`);

    // El responsable que ya tenía cada actividad pasa a ser su primer responsable.
    await queryRunner.query(`
      INSERT INTO "activity_responsibles" ("activity_id", "user_id")
      SELECT a."id", a."responsible_user_id" FROM "activities" a
       WHERE a."responsible_user_id" IS NOT NULL
      ON CONFLICT DO NOTHING`);

    // Términos de búsqueda derivados de lo que ya declara cada actividad.
    await queryRunner.query(`
      UPDATE "activities" a SET "search_keywords" = COALESCE((
        SELECT array_agg(DISTINCT lower(t)) FROM (
          SELECT ar."name" AS t FROM "activity_areas" aa JOIN "academic_areas" ar ON ar."id" = aa."academic_area_id" WHERE aa."activity_id" = a."id"
          UNION ALL
          SELECT unnest(ar."tags") FROM "activity_areas" aa JOIN "academic_areas" ar ON ar."id" = aa."academic_area_id" WHERE aa."activity_id" = a."id"
          UNION ALL
          SELECT s."name" FROM "activity_skills" acs JOIN "skills" s ON s."id" = acs."skill_id" WHERE acs."activity_id" = a."id"
          UNION ALL
          SELECT unnest(s."aliases") FROM "activity_skills" acs JOIN "skills" s ON s."id" = acs."skill_id" WHERE acs."activity_id" = a."id"
        ) terminos WHERE t IS NOT NULL AND t <> ''
      ), '{}')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "activity_contacts"`);
    await queryRunner.query(`DROP TABLE "activity_responsibles"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "search_keywords"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP CONSTRAINT "FK_activities_updated_by"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "updated_by"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "cancelled_at"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "cancellation_reason"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP CONSTRAINT "FK_activities_image_file"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "image_file_id"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "resource_links"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "meeting_url"`);
    // PostgreSQL no quita valores de un enum: se recrea sin los dos nuevos.
    await queryRunner.query(`
      UPDATE "activities" SET "outcome_policy" = CASE
        WHEN "outcome_policy"::text = 'institution_issued_certificate' THEN 'internal_constancy'
        ELSE 'none' END::text::"activity_outcome_policy_enum"
       WHERE "outcome_policy"::text IN ('participation_only', 'institution_issued_certificate')`);
    await queryRunner.query(`ALTER TYPE "activity_outcome_policy_enum" RENAME TO "activity_outcome_policy_enum_old"`);
    await queryRunner.query(`
      CREATE TYPE "activity_outcome_policy_enum"
        AS ENUM ('none', 'internal_constancy', 'external_credential_expected', 'other_authorized_resource')`);
    await queryRunner.query(`ALTER TABLE "activities" ALTER COLUMN "outcome_policy" DROP DEFAULT`);
    await queryRunner.query(`
      ALTER TABLE "activities" ALTER COLUMN "outcome_policy" TYPE "activity_outcome_policy_enum"
        USING "outcome_policy"::text::"activity_outcome_policy_enum"`);
    await queryRunner.query(`ALTER TABLE "activities" ALTER COLUMN "outcome_policy" SET DEFAULT 'none'`);
    await queryRunner.query(`DROP TYPE "activity_outcome_policy_enum_old"`);
  }
}
