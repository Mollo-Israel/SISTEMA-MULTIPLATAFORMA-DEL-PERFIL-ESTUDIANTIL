import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V5 BATCH 10–11 · Cómo se resolvió un pedido de tecnología (V5-25, §4.3).
 *
 * Aditiva: `resolution` distingue dos decisiones que antes se mezclaban en
 * «vincular»: `alias` (el nombre detectado es otro nombre de una tecnología
 * que ya existe, p. ej. postgres → PostgreSQL) y `new_skill` (es una
 * tecnología distinta que se crea con su área, p. ej. FastAPI ≠ Python).
 * Los pedidos ya decididos quedan con `resolution` en null.
 */
export class V5SkillRequestResolution1780790000000 implements MigrationInterface {
  name = 'V5SkillRequestResolution1780790000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "skill_requests" ADD "resolution" varchar(12) NULL`);
    await queryRunner.query(`
      ALTER TABLE "skill_requests" ADD CONSTRAINT "CHK_skill_requests_resolution"
        CHECK ("resolution" IS NULL OR "resolution" IN ('alias', 'new_skill'))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "skill_requests" DROP CONSTRAINT IF EXISTS "CHK_skill_requests_resolution"`);
    await queryRunner.query(`ALTER TABLE "skill_requests" DROP COLUMN IF EXISTS "resolution"`);
  }
}
