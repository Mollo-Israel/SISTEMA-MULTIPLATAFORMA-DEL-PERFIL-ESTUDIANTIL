import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BATCH 4 — Actividades (especificacion §22 a §24, §55, §73.3).
 *
 * Tres cosas:
 *
 *   1. La actividad declara lo que §22 exige y aún no tenía: ventana de
 *      fechas, alcance por semestre, modo de inscripción, requisitos y
 *      responsable.
 *   2. `activity_skills`: qué habilidades trabaja cada actividad.
 *   3. Dos ponderaciones bajan a 0 para cumplir §23 y §55. Interés e
 *      inscripción dejan de sumar afinidad —son intención, no experiencia— y
 *      la constancia interna deja de duplicar lo que la participación
 *      confirmada ya aportó.
 *
 * Los datos existentes se conservan: `responsible_user_id` se rellena con el
 * creador de cada actividad, que es quien venía respondiendo por ella.
 */
export class Batch4Activities1780310000000 implements MigrationInterface {
  name = 'Batch4Activities1780310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================= §23
    // Un estudiante puede darse de baja de una inscripción.
    await queryRunner.query(`
      ALTER TYPE "activity_registrations_status_enum" ADD VALUE IF NOT EXISTS 'cancelled'
    `);

    // ============================================================= §22
    await queryRunner.query(`
      CREATE TYPE "activities_registration_mode_enum" AS ENUM ('open', 'approval')
    `);
    await queryRunner.query(`
      ALTER TABLE "activities"
        ADD COLUMN "end_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN "semester_scope" smallint array,
        ADD COLUMN "registration_mode" "activities_registration_mode_enum"
          NOT NULL DEFAULT 'open',
        ADD COLUMN "requirements" character varying(500),
        ADD COLUMN "responsible_user_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "activities"
        ADD CONSTRAINT "FK_activities_responsible"
        FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_activities_responsible" ON "activities" ("responsible_user_id")
    `);
    // Quien creó cada actividad es quien venía respondiendo por ella.
    await queryRunner.query(`
      UPDATE "activities" SET "responsible_user_id" = "creator_id"
      WHERE "responsible_user_id" IS NULL
    `);
    // Un índice GIN para poder preguntar «qué actividades alcanzan al
    // semestre N» sin recorrer la tabla entera.
    await queryRunner.query(`
      CREATE INDEX "IDX_activities_semester_scope"
        ON "activities" USING GIN ("semester_scope")
    `);

    // ============================================================= §73.3
    await queryRunner.query(`
      CREATE TABLE "activity_skills" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "activity_id" uuid NOT NULL,
        "skill_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_skills" PRIMARY KEY ("id"),
        CONSTRAINT "uq_activity_skill" UNIQUE ("activity_id", "skill_id"),
        CONSTRAINT "FK_activity_skills_activity" FOREIGN KEY ("activity_id")
          REFERENCES "activities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_activity_skills_skill" FOREIGN KEY ("skill_id")
          REFERENCES "skills"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_activity_skills_activity" ON "activity_skills" ("activity_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_activity_skills_skill" ON "activity_skills" ("skill_id")
    `);

    // ============================================================= §23, §55
    // Interés e inscripción son intención, no experiencia (§23), y §51.2 es
    // explícito: para actividades, solo CONFIRMED. La señal se sigue
    // registrando con valor cero para que el desglose la muestre.
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "points" = 0
      WHERE "code" IN ('activity_interested', 'activity_registered')
    `);
    // Una constancia interna respalda la participación que ya se contó; no la
    // vuelve a contar (§24, §55). Sube el respaldo, no la afinidad.
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "points" = 0 WHERE "code" = 'constancy'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "points" = 3 WHERE "code" = 'constancy'
    `);
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "points" = 1 WHERE "code" = 'activity_interested'
    `);
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "points" = 2 WHERE "code" = 'activity_registered'
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "activity_skills"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_activities_semester_scope"`);
    await queryRunner.query(`
      ALTER TABLE "activities" DROP CONSTRAINT IF EXISTS "FK_activities_responsible"
    `);
    await queryRunner.query(`
      ALTER TABLE "activities"
        DROP COLUMN IF EXISTS "responsible_user_id",
        DROP COLUMN IF EXISTS "requirements",
        DROP COLUMN IF EXISTS "registration_mode",
        DROP COLUMN IF EXISTS "semester_scope",
        DROP COLUMN IF EXISTS "end_at"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "activities_registration_mode_enum"`);

    // El valor 'cancelled' del enum de inscripciones no se retira: PostgreSQL
    // no permite quitar valores de un enum, y recrearlo obligaría a reescribir
    // la tabla. Queda como valor en desuso, que es inofensivo.
  }
}
