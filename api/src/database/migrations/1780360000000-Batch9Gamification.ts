import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BATCH 9 — Gamificación y resumen de trayectoria (§66, §67, §73.8, §134).
 *
 * Crea las cuatro tablas que §73.8 sugiere y pone el catálogo de criterios de
 * acuerdo con §66, que enumera qué se puede premiar y qué no.
 *
 * Los criterios del 40 % que §66 excluye —proyecto registrado, evidencia
 * adjunta, certificado externo, constancia interna, perfil completo— **no se
 * borran**: se desactivan. Premiar un proyecto recién creado es premiar un
 * proyecto vacío, y adjuntar un certificado es una autodeclaración; §66 lo dice
 * con esas palabras. Pero borrarlos perdería el registro de lo que la carrera
 * llegó a configurar, y esa decisión no es de una migración.
 */
export class Batch9Gamification1780360000000 implements MigrationInterface {
  name = 'Batch9Gamification1780360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ================================================================= §66
    // El enum se recrea en vez de ampliarse: PostgreSQL no deja usar un valor
    // añadido con ALTER TYPE dentro de la misma transacción que lo añade, y
    // aquí hacen falta los valores nuevos para sembrar las insignias.
    await queryRunner.query(`
      ALTER TYPE "gamification_criteria_trigger_enum"
        RENAME TO "gamification_criteria_trigger_enum_v1"
    `);
    await queryRunner.query(`
      CREATE TYPE "gamification_criteria_trigger_enum" AS ENUM (
        'participacion_confirmada',
        'primer_proyecto_respaldado',
        'proyecto_corroborado',
        'colaboracion_aceptada',
        'hito_trayectoria',
        'proyecto_registrado',
        'evidencia_adjunta',
        'certificado_externo',
        'constancia_interna',
        'perfil_completo'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "gamification_criteria"
        ALTER COLUMN "trigger" TYPE "gamification_criteria_trigger_enum"
        USING "trigger"::text::"gamification_criteria_trigger_enum"
    `);
    await queryRunner.query(`DROP TYPE "gamification_criteria_trigger_enum_v1"`);

    await queryRunner.query(`
      UPDATE "gamification_criteria" SET "is_active" = false
      WHERE "trigger"::text IN (
        'proyecto_registrado', 'evidencia_adjunta', 'certificado_externo',
        'constancia_interna', 'perfil_completo'
      )
    `);

    // =========================================================== §73.8
    await queryRunner.query(`
      CREATE TABLE "gamification_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "student_profile_id" uuid NOT NULL,
        "trigger" "gamification_criteria_trigger_enum" NOT NULL,
        "dedupe_key" character varying(120) NOT NULL,
        "points" integer NOT NULL,
        "reason" character varying(300) NOT NULL,
        "source_entity_type" character varying(40),
        "source_entity_id" uuid,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gamification_events" PRIMARY KEY ("id"),
        CONSTRAINT "uq_gamification_event" UNIQUE ("student_profile_id", "dedupe_key"),
        CONSTRAINT "chk_gamification_event_points" CHECK ("points" >= 0 AND "points" <= 1000),
        CONSTRAINT "FK_gamification_events_perfil" FOREIGN KEY ("student_profile_id")
          REFERENCES "student_profiles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_gamification_events_perfil"
        ON "gamification_events" ("student_profile_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_gamification_events_perfil"
        ON "gamification_events" ("student_profile_id", "occurred_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "student_points" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "student_profile_id" uuid NOT NULL,
        "total_points" integer NOT NULL DEFAULT 0,
        "events_count" integer NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student_points" PRIMARY KEY ("id"),
        CONSTRAINT "FK_student_points_perfil" FOREIGN KEY ("student_profile_id")
          REFERENCES "student_profiles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_student_points_perfil"
        ON "student_points" ("student_profile_id")
    `);

    await queryRunner.query(`
      CREATE TYPE "badge_code_enum" AS ENUM (
        'primera_participacion', 'cinco_participaciones', 'primer_respaldo',
        'tres_proyectos_corroborados', 'primera_colaboracion', 'equipo_formado',
        'trayectoria_respaldada'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "badges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" "badge_code_enum" NOT NULL,
        "name" character varying(120) NOT NULL,
        "description" character varying(300) NOT NULL,
        "trigger" "gamification_criteria_trigger_enum" NOT NULL,
        "threshold" smallint NOT NULL DEFAULT 1,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_badges" PRIMARY KEY ("id"),
        CONSTRAINT "chk_badge_threshold" CHECK ("threshold" > 0)
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_badges_code" ON "badges" ("code")`);

    await queryRunner.query(`
      CREATE TABLE "student_badges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "student_profile_id" uuid NOT NULL,
        "badge_id" uuid NOT NULL,
        "awarded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student_badges" PRIMARY KEY ("id"),
        CONSTRAINT "uq_student_badge" UNIQUE ("student_profile_id", "badge_id"),
        CONSTRAINT "FK_student_badges_perfil" FOREIGN KEY ("student_profile_id")
          REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_student_badges_badge" FOREIGN KEY ("badge_id")
          REFERENCES "badges"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_student_badges_perfil" ON "student_badges" ("student_profile_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_student_badges_badge" ON "student_badges" ("badge_id")
    `);

    // Las insignias reconocen una cantidad de un hecho concreto, nunca el
    // puntaje total: una insignia por acumular puntos premiaría acumular.
    await queryRunner.query(`
      INSERT INTO "badges" ("code", "name", "description", "trigger", "threshold") VALUES
        ('primera_participacion', 'Primera participación',
         'Participaste en una actividad y el responsable lo confirmó.',
         'participacion_confirmada', 1),
        ('cinco_participaciones', 'Cinco participaciones',
         'Cinco actividades con participación confirmada.',
         'participacion_confirmada', 5),
        ('primer_respaldo', 'Primer proyecto respaldado',
         'Uno de tus proyectos dejó de ser solo una declaración.',
         'primer_proyecto_respaldado', 1),
        ('tres_proyectos_corroborados', 'Tres proyectos corroborados',
         'Tres proyectos con corroboración técnica o revisión docente.',
         'proyecto_corroborado', 3),
        ('primera_colaboracion', 'Primera colaboración',
         'Aceptaste trabajar con alguien, o alguien aceptó trabajar contigo.',
         'colaboracion_aceptada', 1),
        ('equipo_formado', 'Equipo consolidado',
         'Cinco colaboraciones aceptadas.',
         'colaboracion_aceptada', 5),
        ('trayectoria_respaldada', 'Trayectoria respaldada',
         'El respaldo de un área tuya cruzó un umbral (§54).',
         'hito_trayectoria', 1)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "student_badges"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "badges"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "badge_code_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "student_points"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gamification_events"`);

    await queryRunner.query(`
      UPDATE "gamification_criteria" SET "is_active" = true
      WHERE "trigger"::text IN (
        'proyecto_registrado', 'evidencia_adjunta', 'certificado_externo',
        'constancia_interna', 'perfil_completo'
      )
    `);

    await queryRunner.query(`
      ALTER TYPE "gamification_criteria_trigger_enum"
        RENAME TO "gamification_criteria_trigger_enum_v2"
    `);
    await queryRunner.query(`
      CREATE TYPE "gamification_criteria_trigger_enum" AS ENUM (
        'participacion_confirmada', 'proyecto_registrado', 'evidencia_adjunta',
        'certificado_externo', 'constancia_interna', 'perfil_completo'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "gamification_criteria"
        ALTER COLUMN "trigger" TYPE "gamification_criteria_trigger_enum"
        USING "trigger"::text::"gamification_criteria_trigger_enum"
    `);
    await queryRunner.query(`DROP TYPE "gamification_criteria_trigger_enum_v2"`);
  }
}
