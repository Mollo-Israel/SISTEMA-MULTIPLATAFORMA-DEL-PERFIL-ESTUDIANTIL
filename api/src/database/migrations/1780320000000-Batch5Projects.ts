import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BATCH 5 — Proyectos (especificacion §32 a §41, §73.4).
 *
 * Tres tablas nuevas y dos columnas en cada extremo de la membresia.
 *
 * Nada se reescribe. Hay una sola decision sobre datos existentes: las
 * membresias ya aceptadas quedan con `contribution_confirmed_at` **nulo**, es
 * decir, sin confirmar. Es lo correcto aunque incomode: §33 exige que sea el
 * integrante quien confirme lo que se le atribuye, y nadie lo ha hecho todavia
 * porque hasta ahora no existia forma de hacerlo. Darlo por confirmado seria
 * fabricar un consentimiento que nunca se dio.
 */
export class Batch5Projects1780320000000 implements MigrationInterface {
  name = 'Batch5Projects1780320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================= §36
    await queryRunner.query(`
      CREATE TYPE "projects_backing_tier_enum" AS ENUM (
        'declared', 'supported', 'corroborated', 'reviewed', 'flagged'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "projects"
        ADD COLUMN "backing_tier" "projects_backing_tier_enum" NOT NULL DEFAULT 'declared',
        ADD COLUMN "backing_reasons" text array
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_projects_backing_tier" ON "projects" ("backing_tier")
    `);

    // ============================================================= §33
    await queryRunner.query(`
      ALTER TABLE "project_members"
        ADD COLUMN "contribution_confirmed_at" TIMESTAMP WITH TIME ZONE
    `);

    // ============================================================= §34, §73.4
    await queryRunner.query(`
      CREATE TABLE "project_member_skills" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_member_id" uuid NOT NULL,
        "skill_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_member_skills" PRIMARY KEY ("id"),
        CONSTRAINT "uq_project_member_skill" UNIQUE ("project_member_id", "skill_id"),
        CONSTRAINT "FK_project_member_skills_member" FOREIGN KEY ("project_member_id")
          REFERENCES "project_members"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_member_skills_skill" FOREIGN KEY ("skill_id")
          REFERENCES "skills"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_project_member_skills_member"
        ON "project_member_skills" ("project_member_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_project_member_skills_skill"
        ON "project_member_skills" ("skill_id")
    `);

    // ============================================================= §31, §37
    // El estado de un enlace ya existia como contrato (§31) pero no como
    // tipo: en el BATCH 3 el resultado viajaba dentro de un jsonb. Aqui es
    // una columna, asi que el tipo se crea ahora.
    await queryRunner.query(`
      CREATE TYPE "link_check_status_enum" AS ENUM (
        'unverified', 'available', 'unavailable', 'blocked'
      )
    `);

    // ============================================================= §37, §73.4
    await queryRunner.query(`
      CREATE TABLE "project_repository_checks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "repository_url" character varying(500) NOT NULL,
        "status" "link_check_status_enum" NOT NULL DEFAULT 'unverified',
        "metadata" jsonb,
        "technology_signals" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "checked_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_repository_checks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_project_repository_checks_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_project_repository_checks_project"
        ON "project_repository_checks" ("project_id")
    `);

    // ============================================================= §39, §73.4
    await queryRunner.query(`
      CREATE TABLE "project_link_checks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "url" character varying(500) NOT NULL,
        "status" "link_check_status_enum" NOT NULL DEFAULT 'unverified',
        "is_https" boolean NOT NULL DEFAULT false,
        "title" character varying(200),
        "http_status" smallint,
        "blocked_reason" character varying(200),
        "checked_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_link_checks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_project_link_checks_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_project_link_checks_project"
        ON "project_link_checks" ("project_id")
    `);

    // ============================================================= §41
    await queryRunner.query(`
      CREATE TYPE "project_events_type_enum" AS ENUM (
        'project_created', 'member_invited', 'member_accepted', 'member_declined',
        'member_removed', 'contribution_updated', 'contribution_confirmed',
        'evidence_added', 'evidence_removed', 'repository_checked', 'demo_checked',
        'feedback_added', 'project_visibility_changed', 'project_archived',
        'backing_tier_changed'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "project_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "actor_user_id" uuid,
        "event_type" "project_events_type_enum" NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_project_events_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_events_actor" FOREIGN KEY ("actor_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    // La bitacora se lee siempre igual: los eventos de un proyecto, del mas
    // reciente al mas antiguo.
    await queryRunner.query(`
      CREATE INDEX "IDX_project_events_proyecto"
        ON "project_events" ("project_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "project_events"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "project_events_type_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_link_checks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_repository_checks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_member_skills"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "link_check_status_enum"`);

    await queryRunner.query(`
      ALTER TABLE "project_members" DROP COLUMN IF EXISTS "contribution_confirmed_at"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_projects_backing_tier"`);
    await queryRunner.query(`
      ALTER TABLE "projects"
        DROP COLUMN IF EXISTS "backing_reasons",
        DROP COLUMN IF EXISTS "backing_tier"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "projects_backing_tier_enum"`);
  }
}
