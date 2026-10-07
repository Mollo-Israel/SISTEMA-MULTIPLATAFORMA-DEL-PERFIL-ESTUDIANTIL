import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3 BATCH 12 · Equipos y contribuciones (§30, §31).
 *
 * Nuevo evento de bitácora: el integrante pide corregir lo que le
 * propusieron. Los roles existentes se conservan como están: el catálogo
 * controlado de §30.1 rige para lo que se escriba desde ahora.
 */
export class V3ProjectTeams1780550000000 implements MigrationInterface {
  name = 'V3ProjectTeams1780550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "project_events_type_enum" ADD VALUE IF NOT EXISTS 'contribution_correction_requested'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "project_events" WHERE "event_type" = 'contribution_correction_requested'`);
    await queryRunner.query(`ALTER TABLE "project_events" ALTER COLUMN "event_type" TYPE TEXT`);
    await queryRunner.query(`DROP TYPE "project_events_type_enum"`);
    await queryRunner.query(`
      CREATE TYPE "project_events_type_enum" AS ENUM (
        'project_created', 'member_invited', 'member_accepted', 'member_declined', 'member_removed',
        'contribution_updated', 'contribution_confirmed', 'evidence_added', 'evidence_removed',
        'repository_checked', 'demo_checked', 'feedback_added', 'project_visibility_changed',
        'project_archived', 'backing_tier_changed', 'project_activated')`);
    await queryRunner.query(`
      ALTER TABLE "project_events" ALTER COLUMN "event_type" TYPE "project_events_type_enum"
        USING "event_type"::"project_events_type_enum"`);
  }
}
