import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V7.1 · BATCH V7-4 · Revisión humana obligatoria (D01).
 *
 * Aditiva: la revisión de Dirección gana dos decisiones.
 *  - `observed`: pide una corrección con su motivo; el estudiante la reenvía.
 *  - `approved`: aceptada revisando el documento, sin prueba externa
 *    independiente (respaldo parcial, C22).
 * No modifica ninguna fila.
 */
export class V71CredentialReview1780910000000 implements MigrationInterface {
  name = 'V71CredentialReview1780910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "validation_manual_review_enum" ADD VALUE IF NOT EXISTS 'observed'`);
    await queryRunner.query(`ALTER TYPE "validation_manual_review_enum" ADD VALUE IF NOT EXISTS 'approved'`);
  }

  public async down(): Promise<void> {
    // PostgreSQL no quita valores de un enum. Con el código anterior, ninguna
    // fila nueva los usa.
  }
}
