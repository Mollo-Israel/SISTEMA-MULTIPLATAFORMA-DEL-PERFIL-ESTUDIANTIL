import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gamificación administrable, retos docentes y recompensas (correcciones de QA).
 *
 * 1. **Los criterios pasan a mandar.** Hasta ahora el administrador editaba
 *    criterios que ningún módulo leía: los puntos salían de una tabla fija en
 *    el código. Ahora cada hecho válido (§66) tiene su criterio general, con
 *    código igual al hecho, y los puntos salen de ahí. Para no cambiar ni un
 *    punto en el momento del cambio, los criterios generales toman los valores
 *    que el sistema aplicaba de verdad (10, 25, 20, 8 y 15).
 *    Los criterios adicionales solo tienen sentido limitados a un área (un
 *    «extra» por participar en Ciberseguridad, por ejemplo). Los generales
 *    duplicados que hubiera se desactivan: antes no hacían nada, y activos
 *    competirían con el general sin que nadie supiera cuál gana.
 * 2. **Retos docentes**: el docente define un reto con sus puntos y lo
 *    reconoce a estudiantes de su alcance. Cuenta como un hecho verificado
 *    por una persona responsable, nunca como algo autodeclarado.
 * 3. **Recompensas**: un catálogo con costo en puntos; el estudiante canjea y
 *    quien la ofrece entrega o rechaza (y si rechaza, los puntos vuelven).
 *
 * Nada de esto toca la afinidad: §66, «nunca puntos → afinidad».
 */
export class QaGamification1780370400000 implements MigrationInterface {
  name = 'QaGamification1780370400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "gamification_criteria_trigger_enum" ADD VALUE IF NOT EXISTS 'reconocimiento_docente'`,
    );

    // ------------------------------------------- criterios generales vigentes
    const generales: [string, string, number][] = [
      ['participacion_confirmada', 'Participación confirmada', 10],
      ['primer_proyecto_respaldado', 'Primer proyecto respaldado', 25],
      ['proyecto_corroborado', 'Proyecto corroborado', 20],
      ['colaboracion_aceptada', 'Colaboración aceptada', 8],
      ['hito_trayectoria', 'Hito de trayectoria', 15],
    ];
    for (const [codigo, nombre, puntos] of generales) {
      await queryRunner.query(
        `INSERT INTO "gamification_criteria" ("code", "name", "description", "trigger", "points", "is_active")
         VALUES ($1, $2, $3, $4::text::"gamification_criteria_trigger_enum", $5, true)
         ON CONFLICT ("code") DO UPDATE
           SET "points" = EXCLUDED."points", "is_active" = true, "academic_area_id" = NULL,
               "trigger" = EXCLUDED."trigger"`,
        [codigo, nombre, 'Criterio general del sistema: puntos por cada vez que ocurre el hecho.', codigo, puntos],
      );
    }
    // Duplicados generales: inactivos, no borrados.
    await queryRunner.query(
      `UPDATE "gamification_criteria" SET "is_active" = false
        WHERE "academic_area_id" IS NULL AND "code" <> "trigger"::text`,
    );

    // --------------------------------------------------------------- retos
    await queryRunner.query(`
      CREATE TABLE "gamification_challenges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar(120) NOT NULL,
        "description" varchar(400),
        "points" integer NOT NULL,
        "academic_area_id" uuid,
        "created_by_user_id" uuid NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_gamification_challenges" PRIMARY KEY ("id"),
        CONSTRAINT "ck_challenge_points" CHECK ("points" BETWEEN 1 AND 100),
        CONSTRAINT "fk_challenge_area" FOREIGN KEY ("academic_area_id") REFERENCES "academic_areas"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_challenge_creator" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_challenges_creator" ON "gamification_challenges" ("created_by_user_id")`,
    );

    // --------------------------------------------------------- recompensas
    await queryRunner.query(`
      CREATE TABLE "gamification_rewards" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(120) NOT NULL,
        "description" varchar(400),
        "cost" integer NOT NULL,
        "stock" integer,
        "created_by_user_id" uuid NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_gamification_rewards" PRIMARY KEY ("id"),
        CONSTRAINT "ck_reward_cost" CHECK ("cost" BETWEEN 1 AND 10000),
        CONSTRAINT "ck_reward_stock" CHECK ("stock" IS NULL OR "stock" >= 0),
        CONSTRAINT "fk_reward_creator" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`
      CREATE TABLE "reward_redemptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reward_id" uuid NOT NULL,
        "student_profile_id" uuid NOT NULL,
        "cost" integer NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "note" varchar(300),
        "resolved_by_user_id" uuid,
        "resolved_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_reward_redemptions" PRIMARY KEY ("id"),
        CONSTRAINT "ck_redemption_status" CHECK ("status" IN ('pending', 'delivered', 'rejected')),
        CONSTRAINT "fk_redemption_reward" FOREIGN KEY ("reward_id") REFERENCES "gamification_rewards"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_redemption_profile" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_redemptions_profile" ON "reward_redemptions" ("student_profile_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemptions_reward" ON "reward_redemptions" ("reward_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "reward_redemptions"`);
    await queryRunner.query(`DROP TABLE "gamification_rewards"`);
    await queryRunner.query(`DROP TABLE "gamification_challenges"`);
    // Los eventos de reconocimiento dejan de tener tipo: se retiran antes de
    // quitar el valor del enumerado.
    await queryRunner.query(
      `DELETE FROM "gamification_events" WHERE "trigger" = 'reconocimiento_docente'`,
    );
    await queryRunner.query(`
      ALTER TYPE "gamification_criteria_trigger_enum" RENAME TO "gamification_criteria_trigger_enum_old";
      CREATE TYPE "gamification_criteria_trigger_enum" AS ENUM (
        'participacion_confirmada', 'primer_proyecto_respaldado', 'proyecto_corroborado',
        'colaboracion_aceptada', 'hito_trayectoria', 'proyecto_registrado', 'evidencia_adjunta',
        'certificado_externo', 'constancia_interna', 'perfil_completo');
      ALTER TABLE "gamification_criteria" ALTER COLUMN "trigger" TYPE "gamification_criteria_trigger_enum" USING "trigger"::text::"gamification_criteria_trigger_enum";
      ALTER TABLE "gamification_events" ALTER COLUMN "trigger" TYPE "gamification_criteria_trigger_enum" USING "trigger"::text::"gamification_criteria_trigger_enum";
      ALTER TABLE "badges" ALTER COLUMN "trigger" TYPE "gamification_criteria_trigger_enum" USING "trigger"::text::"gamification_criteria_trigger_enum";
      DROP TYPE "gamification_criteria_trigger_enum_old";
    `);
    // La desactivación de duplicados y los puntos de los criterios generales
    // no se revierten: antes de esta migración los criterios no tenían efecto.
  }
}
