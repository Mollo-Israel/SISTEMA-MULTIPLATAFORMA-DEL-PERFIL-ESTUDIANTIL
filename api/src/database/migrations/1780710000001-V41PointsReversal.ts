import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V4.1 BATCH 4 · Reversos auditables de puntos (A41-011, §5, §9.6).
 *
 * Una corrección excepcional de asistencia no borra el premio: agrega un
 * reverso negativo en el historial. Hasta ahora `gamification_events` solo
 * admitía 0..1000; se admiten negativos únicamente en filas de reverso
 * (`dedupe_key` que empieza con `reverso:`). El resto sigue igual.
 *
 * `down` restaura la regla anterior como NOT VALID: los reversos que ya
 * existan se conservan (no se destruyen datos) y las filas nuevas vuelven a
 * exigir 0..1000.
 */
export class V41PointsReversal1780710000001 implements MigrationInterface {
  name = 'V41PointsReversal1780710000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "gamification_events" DROP CONSTRAINT IF EXISTS "chk_gamification_event_points"`);
    await queryRunner.query(`
      ALTER TABLE "gamification_events" ADD CONSTRAINT "chk_gamification_event_points"
        CHECK (("points" >= 0 AND "points" <= 1000)
          OR ("points" < 0 AND "points" >= -1000 AND "dedupe_key" LIKE 'reverso:%'))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "gamification_events" DROP CONSTRAINT IF EXISTS "chk_gamification_event_points"`);
    await queryRunner.query(`
      ALTER TABLE "gamification_events" ADD CONSTRAINT "chk_gamification_event_points"
        CHECK ("points" >= 0 AND "points" <= 1000) NOT VALID`);
  }
}
