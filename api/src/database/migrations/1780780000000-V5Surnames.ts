import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V5 BATCH 1 · Primer y segundo apellido (V5-04, V5-05; A01–A03).
 *
 * Aditiva: dos columnas nullable. `last_name` no cambia: sigue siendo el
 * apellido completo que muestran todas las pantallas.
 *
 * Se copia a `first_surname` solo un apellido de una sola palabra, porque ahí
 * no hay ambigüedad. Uno con espacios («Pérez García», «De la Cruz») NO se
 * parte por suposición (A02): queda pendiente de que Administración lo separe.
 * `down` quita las columnas; `last_name` sigue intacto.
 */
export class V5Surnames1780780000000 implements MigrationInterface {
  name = 'V5Surnames1780780000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "first_surname" varchar(50) NULL`);
    await queryRunner.query(`ALTER TABLE "users" ADD "second_surname" varchar(50) NULL`);
    // Las filas del padrón guardan los dos apellidos entre previsualizar y aplicar.
    await queryRunner.query(`ALTER TABLE "import_batch_rows" ADD "first_surname" varchar(50) NULL`);
    await queryRunner.query(`ALTER TABLE "import_batch_rows" ADD "second_surname" varchar(50) NULL`);
    await queryRunner.query(`
      UPDATE "users" SET "first_surname" = btrim("last_name")
       WHERE btrim("last_name") <> '' AND position(' ' in btrim("last_name")) = 0 AND length(btrim("last_name")) <= 50`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "import_batch_rows" DROP COLUMN IF EXISTS "second_surname"`);
    await queryRunner.query(`ALTER TABLE "import_batch_rows" DROP COLUMN IF EXISTS "first_surname"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "second_surname"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "first_surname"`);
  }
}
