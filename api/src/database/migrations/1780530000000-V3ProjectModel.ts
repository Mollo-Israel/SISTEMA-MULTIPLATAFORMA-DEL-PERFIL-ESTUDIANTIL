import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3 BATCH 10 · Proyectos: multiárea, skills del catálogo y privacidad (§21, §22, §40).
 *
 * - `project_areas`: una o varias áreas. Se siembra con el área única actual.
 * - `project_skills`: tecnologías del catálogo. Se siembra cruzando las
 *   tecnologías escritas como texto con el nombre o los alias del catálogo;
 *   el texto original se conserva en `technologies`, nada se pierde.
 * - Visibilidad: se suman TEAM y PUBLIC_LINK; `public_link_token` para el
 *   enlace público y `team_id` para el equipo de colaboración (§21.1).
 */
export class V3ProjectModel1780530000000 implements MigrationInterface {
  name = 'V3ProjectModel1780530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "project_areas" (
        "project_id" UUID NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "academic_area_id" UUID NOT NULL REFERENCES "academic_areas"("id") ON DELETE CASCADE,
        PRIMARY KEY ("project_id", "academic_area_id")
      )`);
    await queryRunner.query(`CREATE INDEX "idx_project_areas_area" ON "project_areas" ("academic_area_id")`);
    await queryRunner.query(`
      INSERT INTO "project_areas" ("project_id", "academic_area_id")
      SELECT "id", "academic_area_id" FROM "projects" WHERE "academic_area_id" IS NOT NULL`);

    await queryRunner.query(`
      CREATE TABLE "project_skills" (
        "project_id" UUID NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "skill_id" UUID NOT NULL REFERENCES "skills"("id") ON DELETE CASCADE,
        PRIMARY KEY ("project_id", "skill_id")
      )`);
    await queryRunner.query(`CREATE INDEX "idx_project_skills_skill" ON "project_skills" ("skill_id")`);
    await queryRunner.query(`
      INSERT INTO "project_skills" ("project_id", "skill_id")
      SELECT DISTINCT p."id", s."id"
        FROM "projects" p
        CROSS JOIN LATERAL unnest(COALESCE(p."technologies", '{}')) AS t(nombre)
        JOIN "skills" s
          ON lower(s."name") = lower(trim(t.nombre))
          OR EXISTS (SELECT 1 FROM unnest(COALESCE(s."aliases", '{}')) a WHERE lower(a) = lower(trim(t.nombre)))`);

    await queryRunner.query(`ALTER TYPE "projects_visibility_enum" ADD VALUE IF NOT EXISTS 'team' AFTER 'private'`);
    await queryRunner.query(`ALTER TYPE "projects_visibility_enum" ADD VALUE IF NOT EXISTS 'public_link'`);
    await queryRunner.query(`
      ALTER TABLE "projects"
        ADD COLUMN "public_link_token" VARCHAR(64) NULL,
        ADD COLUMN "team_id" UUID NULL
          CONSTRAINT "fk_project_team" REFERENCES "teams"("id") ON DELETE SET NULL`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_project_public_link" ON "projects" ("public_link_token")
        WHERE "public_link_token" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX "idx_project_team" ON "projects" ("team_id")`);
    await queryRunner.query(`ALTER TYPE "project_events_type_enum" ADD VALUE IF NOT EXISTS 'project_activated'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // La bitácora pierde solo los eventos de activación, que no existían antes.
    await queryRunner.query(`DELETE FROM "project_events" WHERE "event_type" = 'project_activated'`);
    await queryRunner.query(`ALTER TABLE "project_events" ALTER COLUMN "event_type" TYPE TEXT`);
    await queryRunner.query(`DROP TYPE "project_events_type_enum"`);
    await queryRunner.query(`
      CREATE TYPE "project_events_type_enum" AS ENUM (
        'project_created', 'member_invited', 'member_accepted', 'member_declined', 'member_removed',
        'contribution_updated', 'contribution_confirmed', 'evidence_added', 'evidence_removed',
        'repository_checked', 'demo_checked', 'feedback_added', 'project_visibility_changed',
        'project_archived', 'backing_tier_changed')`);
    await queryRunner.query(`
      ALTER TABLE "project_events" ALTER COLUMN "event_type" TYPE "project_events_type_enum"
        USING "event_type"::"project_events_type_enum"`);

    await queryRunner.query(`DROP INDEX "idx_project_team"`);
    await queryRunner.query(`DROP INDEX "uq_project_public_link"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "team_id", DROP COLUMN "public_link_token"`);

    // Postgres no quita valores de un enum: se recrea. TEAM y PUBLIC_LINK
    // vuelven a PRIVATE, el nivel más restrictivo de los que quedan.
    await queryRunner.query(`UPDATE "projects" SET "visibility" = 'private' WHERE "visibility" IN ('team', 'public_link')`);
    await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "visibility" DROP DEFAULT`);
    await queryRunner.query(`ALTER TYPE "projects_visibility_enum" RENAME TO "projects_visibility_enum_old"`);
    await queryRunner.query(`CREATE TYPE "projects_visibility_enum" AS ENUM ('private', 'profile', 'teachers')`);
    await queryRunner.query(`
      ALTER TABLE "projects" ALTER COLUMN "visibility"
        TYPE "projects_visibility_enum" USING "visibility"::text::"projects_visibility_enum"`);
    await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "visibility" SET DEFAULT 'profile'`);
    await queryRunner.query(`DROP TYPE "projects_visibility_enum_old"`);

    await queryRunner.query(`DROP TABLE "project_skills"`);
    await queryRunner.query(`DROP TABLE "project_areas"`);
  }
}
