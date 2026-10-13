import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3.2 BATCH 6 · «Cancelar envío» (§23.1).
 *
 * Mientras Dirección no decide, quien propuso puede retirar el envío para
 * corregir: la actividad vuelve a borrador. La historia de revisión lo registra
 * con la acción `cancelled`.
 */
export class V32ReviewCancelSubmission1780640000000 implements MigrationInterface {
  name = 'V32ReviewCancelSubmission1780640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activity_reviews" DROP CONSTRAINT "ck_activity_review_action"`);
    await queryRunner.query(`
      ALTER TABLE "activity_reviews" ADD CONSTRAINT "ck_activity_review_action"
        CHECK ("action" IN ('submitted', 'approved', 'observed', 'rejected', 'cancelled'))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Volver atrás obliga a quitar las anulaciones de envío de la historia.
    await queryRunner.query(`DELETE FROM "activity_reviews" WHERE "action" = 'cancelled'`);
    await queryRunner.query(`ALTER TABLE "activity_reviews" DROP CONSTRAINT "ck_activity_review_action"`);
    await queryRunner.query(`
      ALTER TABLE "activity_reviews" ADD CONSTRAINT "ck_activity_review_action"
        CHECK ("action" IN ('submitted', 'approved', 'observed', 'rejected'))`);
  }
}
