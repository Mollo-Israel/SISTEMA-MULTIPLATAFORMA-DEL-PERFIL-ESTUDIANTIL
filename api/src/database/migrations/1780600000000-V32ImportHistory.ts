import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3.2 BATCH 1 · Historial de importación limpio (§7.5).
 *
 * - `failed`: una aplicación que no pudo completarse queda en el historial
 *   con su motivo (`failure_reason`); es lo único, además de `applied`, que
 *   el historial operativo muestra.
 * - Las previsualizaciones dejan de ser historial: se borran al descartar y
 *   por antigüedad. Las que ya existían como `previewed` o `discarded` no se
 *   tocan aquí; las retira la limpieza normal (no se destruye nada aplicado).
 */
export class V32ImportHistory1780600000000 implements MigrationInterface {
  name = 'V32ImportHistory1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "import_batch_status_enum" ADD VALUE IF NOT EXISTS 'failed'`);
    await queryRunner.query(`ALTER TABLE "import_batches" ADD "failure_reason" VARCHAR(300) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "import_batches" DROP COLUMN "failure_reason"`);
    // PostgreSQL no quita valores de un enum: se recrea sin `failed`.
    await queryRunner.query(`UPDATE "import_batches" SET "status" = 'discarded' WHERE "status" = 'failed'`);
    await queryRunner.query(`ALTER TYPE "import_batch_status_enum" RENAME TO "import_batch_status_enum_old"`);
    await queryRunner.query(`CREATE TYPE "import_batch_status_enum" AS ENUM ('previewed', 'applied', 'discarded')`);
    await queryRunner.query(`ALTER TABLE "import_batches" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "import_batches" ALTER COLUMN "status" TYPE "import_batch_status_enum" USING "status"::text::"import_batch_status_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "import_batches" ALTER COLUMN "status" SET DEFAULT 'previewed'`);
    await queryRunner.query(`DROP TYPE "import_batch_status_enum_old"`);
  }
}
