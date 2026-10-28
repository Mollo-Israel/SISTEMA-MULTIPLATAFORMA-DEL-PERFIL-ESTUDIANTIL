import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V5 BATCH 6 · Recurso por enlace o por archivo (V5-13, §8.1; D01–D04).
 *
 * Aditiva: `url` deja de ser obligatoria y se agrega `file_id` (un archivo del
 * almacenamiento existente: los bytes nunca van a PostgreSQL). Un recurso
 * tiene al menos uno de los dos. Todos los recursos actuales tienen URL, así
 * que cumplen la regla. `down` solo es posible si ninguno quedó sin URL.
 */
export class V5ResourceFile1780810000000 implements MigrationInterface {
  name = 'V5ResourceFile1780810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "learning_resources" ALTER COLUMN "url" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "learning_resources" ADD "file_id" uuid NULL`);
    await queryRunner.query(`
      ALTER TABLE "learning_resources" ADD CONSTRAINT "FK_learning_resources_file"
        FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL`);
    await queryRunner.query(`
      ALTER TABLE "learning_resources" ADD CONSTRAINT "CHK_learning_resources_source"
        CHECK ("url" IS NOT NULL OR "file_id" IS NOT NULL)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "learning_resources" DROP CONSTRAINT IF EXISTS "CHK_learning_resources_source"`);
    await queryRunner.query(`ALTER TABLE "learning_resources" DROP CONSTRAINT IF EXISTS "FK_learning_resources_file"`);
    await queryRunner.query(`ALTER TABLE "learning_resources" DROP COLUMN IF EXISTS "file_id"`);
    await queryRunner.query(`ALTER TABLE "learning_resources" ALTER COLUMN "url" SET NOT NULL`);
  }
}
