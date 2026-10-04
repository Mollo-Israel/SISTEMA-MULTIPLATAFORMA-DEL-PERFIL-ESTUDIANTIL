import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Revisión de actividades por Dirección (especificación V2 §27, §30, §31.2).
 *
 * - `review_status` separado del ciclo de vida: las actividades de Docente y
 *   Sociedad Científica se envían a Dirección, que aprueba, observa o
 *   rechaza; solo aprobadas (o que no lo necesitan) se publican.
 * - `activity_reviews`: la historia de cada decisión, con su comentario.
 * - `internal_constancy_enabled`: la actividad declara si emite constancias
 *   internas; para Docente/Sociedad es parte de lo que Dirección aprueba.
 * - `activity_gamification_rules`: puntos propios de la actividad dentro de
 *   los criterios permitidos, también revisados por Dirección.
 *
 * Las actividades existentes nacieron con las reglas anteriores, que no
 * tenían revisión: quedan como `not_required` y con constancias habilitadas,
 * que es exactamente lo que permitían. No se las da por «aprobadas» por
 * nadie (§27.3: no reutilizar silenciosamente como aprobada).
 */
export class V2ActivityReview1780410000000 implements MigrationInterface {
  name = 'V2ActivityReview1780410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "activity_review_status_enum" AS ENUM ('not_required', 'pending', 'observed', 'approved', 'rejected')`,
    );
    await queryRunner.query(`
      ALTER TABLE "activities"
        ADD "review_status" "activity_review_status_enum",
        ADD "requires_review" boolean NOT NULL DEFAULT false,
        ADD "submitted_at" timestamptz,
        ADD "reviewed_at" timestamptz,
        ADD "reviewed_by" uuid,
        ADD "review_comment" varchar(1000),
        ADD "internal_constancy_enabled" boolean NOT NULL DEFAULT false,
        ADD CONSTRAINT "fk_activity_reviewer" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL`);
    await queryRunner.query(
      `UPDATE "activities" SET "review_status" = 'not_required', "internal_constancy_enabled" = true`,
    );
    await queryRunner.query(`CREATE INDEX "idx_activities_review" ON "activities" ("review_status")`);

    await queryRunner.query(`
      CREATE TABLE "activity_reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "activity_id" uuid NOT NULL,
        "actor_user_id" uuid,
        "action" varchar(20) NOT NULL,
        "comment" varchar(1000),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_activity_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "ck_activity_review_action" CHECK ("action" IN ('submitted', 'approved', 'observed', 'rejected')),
        CONSTRAINT "fk_review_activity" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_review_actor" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )`);
    await queryRunner.query(`CREATE INDEX "idx_activity_reviews_activity" ON "activity_reviews" ("activity_id", "created_at")`);

    await queryRunner.query(`
      CREATE TABLE "activity_gamification_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "activity_id" uuid NOT NULL,
        "criterion_id" uuid,
        "trigger" "gamification_criteria_trigger_enum" NOT NULL,
        "points" integer NOT NULL,
        "badge_id" uuid,
        "description" varchar(300),
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_activity_gamification_rules" PRIMARY KEY ("id"),
        CONSTRAINT "uq_activity_rule_trigger" UNIQUE ("activity_id", "trigger"),
        CONSTRAINT "ck_activity_rule_points" CHECK ("points" BETWEEN 1 AND 1000),
        CONSTRAINT "fk_rule_activity" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_rule_criterion" FOREIGN KEY ("criterion_id") REFERENCES "gamification_criteria"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_rule_badge" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_rule_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "activity_gamification_rules"`);
    await queryRunner.query(`DROP TABLE "activity_reviews"`);
    await queryRunner.query(`DROP INDEX "idx_activities_review"`);
    await queryRunner.query(`
      ALTER TABLE "activities"
        DROP CONSTRAINT "fk_activity_reviewer",
        DROP COLUMN "internal_constancy_enabled",
        DROP COLUMN "review_comment",
        DROP COLUMN "reviewed_by",
        DROP COLUMN "reviewed_at",
        DROP COLUMN "submitted_at",
        DROP COLUMN "requires_review",
        DROP COLUMN "review_status"`);
    await queryRunner.query(`DROP TYPE "activity_review_status_enum"`);
  }
}
