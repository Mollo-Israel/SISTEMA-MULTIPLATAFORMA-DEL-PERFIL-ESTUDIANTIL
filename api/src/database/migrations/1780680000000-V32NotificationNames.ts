import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3.2 BATCH 13 · Nombres de las notificaciones según §47.
 *
 * - `PROJECT_MEMBER_CONFIRMATION_REQUIRED` → `PROJECT_CONFIRMATION_REQUIRED`.
 * - `ACTIVITY_REVIEW_APPROVED` → `ACTIVITY_APPROVED`.
 *
 * Las notificaciones ya enviadas conservan su contenido; solo cambia el tipo
 * para que el centro de avisos y los filtros hablen un solo idioma.
 */
export class V32NotificationNames1780680000000 implements MigrationInterface {
  name = 'V32NotificationNames1780680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "notifications" SET "type" = 'PROJECT_CONFIRMATION_REQUIRED' WHERE "type" = 'PROJECT_MEMBER_CONFIRMATION_REQUIRED'`);
    await queryRunner.query(`UPDATE "notifications" SET "type" = 'ACTIVITY_APPROVED' WHERE "type" = 'ACTIVITY_REVIEW_APPROVED'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "notifications" SET "type" = 'PROJECT_MEMBER_CONFIRMATION_REQUIRED' WHERE "type" = 'PROJECT_CONFIRMATION_REQUIRED'`);
    await queryRunner.query(`UPDATE "notifications" SET "type" = 'ACTIVITY_REVIEW_APPROVED' WHERE "type" = 'ACTIVITY_APPROVED'`);
  }
}
