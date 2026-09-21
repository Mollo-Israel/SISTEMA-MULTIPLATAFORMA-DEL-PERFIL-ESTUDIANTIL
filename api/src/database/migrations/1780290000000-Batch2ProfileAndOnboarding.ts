import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BATCH 2 — Perfil y onboarding (especificacion §16 a §21, §44, §73.2, §73.7).
 *
 * Tres cambios sobre datos existentes, los tres conservadores:
 *
 *   1. `student_skills.level` pasa de una escala 1..5 a los tres niveles que
 *      fija §21.1. La conversion agrupa: 1–2 basico, 3 intermedio, 4–5
 *      avanzado. Ninguna fila se pierde.
 *   2. `student_interests` gana su origen; todo lo que ya existia se marca
 *      `manual`, que es literalmente lo que fue: el estudiante lo eligio del
 *      catalogo porque el cuestionario aun no existia.
 *   3. La ponderacion de `improvement_area` baja a 0 (§20). Las areas de
 *      mejora dejan de sumar afinidad y pasan a servir solo para
 *      recomendaciones y objetivos personales.
 *
 * El resto son columnas y tablas nuevas.
 */
export class Batch2ProfileAndOnboarding1780290000000 implements MigrationInterface {
  name = 'Batch2ProfileAndOnboarding1780290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================= §21.1
    // Autoevaluacion de tres niveles.
    await queryRunner.query(`
      CREATE TYPE "student_skills_level_enum" AS ENUM ('basic', 'intermediate', 'advanced')
    `);
    await queryRunner.query(`
      ALTER TABLE "student_skills" DROP CONSTRAINT IF EXISTS "chk_student_skill_level"
    `);
    await queryRunner.query(`ALTER TABLE "student_skills" ALTER COLUMN "level" DROP DEFAULT`);
    // El USING agrupa la escala anterior. Se hace en la propia conversion de
    // tipo para que no exista ningun instante con la columna a medias.
    await queryRunner.query(`
      ALTER TABLE "student_skills"
        ALTER COLUMN "level" TYPE "student_skills_level_enum"
        USING (
          CASE
            WHEN "level" >= 4 THEN 'advanced'
            WHEN "level" = 3 THEN 'intermediate'
            ELSE 'basic'
          END
        )::"student_skills_level_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "student_skills" ALTER COLUMN "level" SET DEFAULT 'basic'
    `);

    // ============================================================= §18
    // Origen del interes.
    await queryRunner.query(`
      CREATE TYPE "student_interests_source_enum" AS ENUM ('onboarding', 'manual')
    `);
    await queryRunner.query(`
      ALTER TABLE "student_interests"
        ADD COLUMN "source" "student_interests_source_enum" NOT NULL DEFAULT 'manual'
    `);

    // ============================================================= §17.2, §44
    // Disponibilidad, preferencias de colaboracion y privacidad.
    await queryRunner.query(`
      CREATE TYPE "student_profiles_availability_enum" AS ENUM (
        'looking', 'open', 'busy', 'unspecified'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "student_profiles"
        ADD COLUMN "availability" "student_profiles_availability_enum"
          NOT NULL DEFAULT 'unspecified',
        ADD COLUMN "collaboration_preferences" jsonb,
        ADD COLUMN "public_profile_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN "public_visibility_config" jsonb NOT NULL DEFAULT '{
          "bio": false,
          "areas": false,
          "affinities": false,
          "support_level": false,
          "projects": false,
          "skills": false,
          "availability": false,
          "trajectory": false
        }'::jsonb
    `);

    // ============================================================= §73.2
    // Ejecuciones del cuestionario y sus respuestas. Las preguntas viven
    // versionadas en codigo, que es lo que §73.2 permite siempre que se
    // persista esto.
    await queryRunner.query(`
      CREATE TYPE "onboarding_runs_status_enum" AS ENUM (
        'completed', 'confirmed', 'superseded'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "onboarding_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "student_profile_id" uuid NOT NULL,
        "questionnaire_version" smallint NOT NULL,
        "status" "onboarding_runs_status_enum" NOT NULL DEFAULT 'completed',
        "suggested_areas" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "confirmed_area_ids" uuid array,
        "confirmed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_onboarding_runs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_onboarding_runs_profile" FOREIGN KEY ("student_profile_id")
          REFERENCES "student_profiles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_onboarding_runs_profile"
        ON "onboarding_runs" ("student_profile_id")
    `);
    // Solo una ejecucion vigente por estudiante. El indice parcial deja
    // convivir cuantas 'superseded' haga falta.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_onboarding_runs_vigente"
        ON "onboarding_runs" ("student_profile_id")
        WHERE "status" <> 'superseded'
    `);

    await queryRunner.query(`
      CREATE TABLE "onboarding_answers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "run_id" uuid NOT NULL,
        "question_code" character varying(60) NOT NULL,
        "option_codes" character varying(60) array NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_onboarding_answers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_onboarding_answers_pregunta" UNIQUE ("run_id", "question_code"),
        CONSTRAINT "FK_onboarding_answers_run" FOREIGN KEY ("run_id")
          REFERENCES "onboarding_runs"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_onboarding_answers_run" ON "onboarding_answers" ("run_id")
    `);

    // ============================================================= §20
    // Un area de mejora vale 0 puntos de afinidad. Se deja la ponderacion en
    // la tabla en lugar de borrarla: el motor la sigue registrando como
    // contribucion explicable, con valor cero, de modo que el estudiante ve
    // que se tuvo en cuenta y que no sumo.
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "points" = 0 WHERE "code" = 'improvement_area'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "points" = 1 WHERE "code" = 'improvement_area'
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "onboarding_answers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "onboarding_runs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "onboarding_runs_status_enum"`);

    await queryRunner.query(`
      ALTER TABLE "student_profiles"
        DROP COLUMN IF EXISTS "public_visibility_config",
        DROP COLUMN IF EXISTS "public_profile_enabled",
        DROP COLUMN IF EXISTS "collaboration_preferences",
        DROP COLUMN IF EXISTS "availability"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "student_profiles_availability_enum"`);

    await queryRunner.query(`ALTER TABLE "student_interests" DROP COLUMN IF EXISTS "source"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "student_interests_source_enum"`);

    // La escala numerica vuelve, pero no la precision: lo que era un 5 y lo
    // que era un 4 regresan como el mismo 4. Agrupar fue irreversible.
    await queryRunner.query(`ALTER TABLE "student_skills" ALTER COLUMN "level" DROP DEFAULT`);
    await queryRunner.query(`
      ALTER TABLE "student_skills"
        ALTER COLUMN "level" TYPE smallint
        USING (
          CASE "level"::text
            WHEN 'advanced' THEN 4
            WHEN 'intermediate' THEN 3
            ELSE 1
          END
        )
    `);
    await queryRunner.query(`ALTER TABLE "student_skills" ALTER COLUMN "level" SET DEFAULT 1`);
    await queryRunner.query(`DROP TYPE IF EXISTS "student_skills_level_enum"`);
    await queryRunner.query(`
      ALTER TABLE "student_skills"
        ADD CONSTRAINT "chk_student_skill_level" CHECK ("level" >= 1 AND "level" <= 5)
    `);
  }
}
