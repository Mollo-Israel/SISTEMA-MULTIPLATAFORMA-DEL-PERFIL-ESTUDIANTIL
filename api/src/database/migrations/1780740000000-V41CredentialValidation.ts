import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V4.1 BATCH 8 · Credenciales externas: revisión con método y prueba (A41-018, §6.2, A.8).
 *
 * Aditiva:
 * - `validation_manual_review_enum` gana `inconclusive` y `rejected`: una
 *   revisión sin fuente externa queda inconclusa (B32) y una contradicción
 *   fuerte documentada, rechazada.
 * - `validation_records` gana `manual_review_method` y `manual_review_proof`.
 *
 * Las decisiones anteriores (`corroborated`, `not_corroborated`) no se tocan.
 * El estado de validación del contrato se deriva de lo registrado; no se
 * guarda aparte para que nunca se desincronice del respaldo.
 */
export class V41CredentialValidation1780740000000 implements MigrationInterface {
  name = 'V41CredentialValidation1780740000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "validation_manual_review_enum" ADD VALUE IF NOT EXISTS 'inconclusive'`);
    await queryRunner.query(`ALTER TYPE "validation_manual_review_enum" ADD VALUE IF NOT EXISTS 'rejected'`);
    await queryRunner.query(`ALTER TABLE "validation_records" ADD "manual_review_method" varchar(40) NULL`);
    await queryRunner.query(`ALTER TABLE "validation_records" ADD "manual_review_proof" varchar(500) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "validation_records" DROP COLUMN IF EXISTS "manual_review_proof"`);
    await queryRunner.query(`ALTER TABLE "validation_records" DROP COLUMN IF EXISTS "manual_review_method"`);
    // PostgreSQL no permite quitar valores de un enum. Se dejan: sin filas que
    // los usen no cambian nada, y volver a subir la migración no los duplica.
  }
}
