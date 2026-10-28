import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V5 BATCH 8 · Gamificación: tres familias e historial que dice quién y por qué (§10).
 *
 * Aditiva. Nada del historial se borra ni se recalcula:
 *
 * - Nuevo hecho `recurso_completado_atestiguado` (un docente da fe de que el
 *   estudiante completó un recurso; abrirlo o guardarlo no cuenta) y su
 *   criterio general, para que el hecho pueda premiarse desde el primer día.
 * - El historial (`gamification_events`) gana `criterion_id`, `awarded_by` y
 *   `approved_by`, nulos para lo anterior salvo lo que se puede reconstruir
 *   con certeza: quién confirmó la asistencia y quién propuso y aprobó los
 *   puntos de un proyecto.
 * - Las propuestas docentes admiten un recurso como origen, y un recurso puede
 *   llevar un criterio opcional (§8.3).
 * - Los criterios generales de los hechos que el V5 retira (primer proyecto
 *   respaldado, colaboración aceptada, hito de trayectoria) se desactivan: el
 *   motor ya no los reconoce y sus eventos pasados se conservan.
 */
export class V5GamificationFamilies1780830000000 implements MigrationInterface {
  name = 'V5GamificationFamilies1780830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "gamification_criteria_trigger_enum" ADD VALUE IF NOT EXISTS 'recurso_completado_atestiguado'`);
    // PostgreSQL no deja usar un valor nuevo del enum en la misma transacción
    // que lo agregó: se confirma aquí y se sigue en otra.
    if (queryRunner.isTransactionActive) {
      await queryRunner.commitTransaction();
      await queryRunner.startTransaction();
    }

    await queryRunner.query(`ALTER TABLE "gamification_events" ADD "criterion_id" uuid NULL`);
    await queryRunner.query(`ALTER TABLE "gamification_events" ADD "awarded_by" uuid NULL`);
    await queryRunner.query(`ALTER TABLE "gamification_events" ADD "approved_by" uuid NULL`);
    await queryRunner.query(`
      ALTER TABLE "gamification_events" ADD CONSTRAINT "FK_gamification_events_criterion"
        FOREIGN KEY ("criterion_id") REFERENCES "gamification_criteria"("id") ON DELETE SET NULL`);
    await queryRunner.query(`
      ALTER TABLE "gamification_events" ADD CONSTRAINT "FK_gamification_events_awarded_by"
        FOREIGN KEY ("awarded_by") REFERENCES "users"("id") ON DELETE SET NULL`);
    await queryRunner.query(`
      ALTER TABLE "gamification_events" ADD CONSTRAINT "FK_gamification_events_approved_by"
        FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL`);

    await queryRunner.query(`ALTER TABLE "gamification_proposals" DROP CONSTRAINT IF EXISTS "CHK_gamification_proposals_source"`);
    await queryRunner.query(`
      ALTER TABLE "gamification_proposals" ADD CONSTRAINT "CHK_gamification_proposals_source"
        CHECK ("source_type" IN ('project', 'resource'))`);

    await queryRunner.query(`ALTER TABLE "learning_resources" ADD "criterion_id" uuid NULL`);
    await queryRunner.query(`
      ALTER TABLE "learning_resources" ADD CONSTRAINT "FK_learning_resources_criterion"
        FOREIGN KEY ("criterion_id") REFERENCES "gamification_criteria"("id") ON DELETE SET NULL`);

    // Lo que se puede reconstruir con certeza.
    await queryRunner.query(`
      UPDATE "gamification_events" e
         SET "criterion_id" = p."criterion_id", "awarded_by" = p."proposed_by", "approved_by" = p."reviewed_by"
        FROM "gamification_proposals" p
       WHERE p."status" = 'approved'
         AND e."student_profile_id" = p."student_profile_id"
         AND e."dedupe_key" = 'criterio:' || p."criterion_id" || ':' || p."source_type" || ':' || p."source_id"`);
    await queryRunner.query(`
      UPDATE "gamification_events" e
         SET "awarded_by" = r."confirmed_by"
        FROM "activity_registrations" r
       WHERE e."source_entity_type" = 'activity_registration'
         AND e."source_entity_id" = r."id"
         AND e."dedupe_key" = 'participacion:' || r."id"
         AND e."awarded_by" IS NULL`);

    await queryRunner.query(`
      INSERT INTO "gamification_criteria" ("code", "name", "description", "trigger", "points", "is_active", "is_bonus")
      VALUES ('recurso_completado_atestiguado', 'Recurso completado (atestiguado por un docente)',
              'Un docente da fe, con sustento, de que el estudiante completó el recurso. Abrirlo, descargarlo o guardarlo no cuenta.',
              'recurso_completado_atestiguado', 10, true, false)
      ON CONFLICT DO NOTHING`);
    await queryRunner.query(`
      UPDATE "gamification_criteria" SET "is_active" = false
       WHERE "trigger" IN ('primer_proyecto_respaldado', 'colaboracion_aceptada', 'hito_trayectoria')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Los criterios generales retirados vuelven a estar activos; el valor del
    // enum no se puede quitar en PostgreSQL y queda sin uso.
    await queryRunner.query(`
      UPDATE "gamification_criteria" SET "is_active" = true
       WHERE "code" IN ('primer_proyecto_respaldado', 'colaboracion_aceptada', 'hito_trayectoria')`);
    await queryRunner.query(`ALTER TABLE "learning_resources" DROP CONSTRAINT IF EXISTS "FK_learning_resources_criterion"`);
    await queryRunner.query(`ALTER TABLE "learning_resources" DROP COLUMN IF EXISTS "criterion_id"`);
    await queryRunner.query(`ALTER TABLE "gamification_proposals" DROP CONSTRAINT IF EXISTS "CHK_gamification_proposals_source"`);
    await queryRunner.query(`
      ALTER TABLE "gamification_proposals" ADD CONSTRAINT "CHK_gamification_proposals_source"
        CHECK ("source_type" IN ('project'))`);
    await queryRunner.query(`ALTER TABLE "gamification_events" DROP CONSTRAINT IF EXISTS "FK_gamification_events_approved_by"`);
    await queryRunner.query(`ALTER TABLE "gamification_events" DROP CONSTRAINT IF EXISTS "FK_gamification_events_awarded_by"`);
    await queryRunner.query(`ALTER TABLE "gamification_events" DROP CONSTRAINT IF EXISTS "FK_gamification_events_criterion"`);
    await queryRunner.query(`ALTER TABLE "gamification_events" DROP COLUMN IF EXISTS "approved_by"`);
    await queryRunner.query(`ALTER TABLE "gamification_events" DROP COLUMN IF EXISTS "awarded_by"`);
    await queryRunner.query(`ALTER TABLE "gamification_events" DROP COLUMN IF EXISTS "criterion_id"`);
  }
}
