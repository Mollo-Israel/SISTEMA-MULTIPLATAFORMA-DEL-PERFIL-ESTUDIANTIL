import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3 BATCH 14 · Pesos de la Afinidad V4 (§35).
 *
 * Un proyecto o una credencial SUPPORTED ya no suman afinidad: siguen
 * sumando respaldo (§37). Los resultados se recalculan al arrancar con el
 * motor v4; las instantáneas de V2 y V3 se conservan (§35).
 */
export class V3AffinityV4Weights1780570000000 implements MigrationInterface {
  name = 'V3AffinityV4Weights1780570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "points" = 0, "updated_at" = now(),
        "description" = 'V4 §35: un proyecto SUPPORTED no suma afinidad; suma respaldo.'
       WHERE "code" = 'project_supported'`);
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "points" = 0, "updated_at" = now(),
        "description" = 'V4 §35: una credencial SUPPORTED no suma afinidad; suma respaldo.'
       WHERE "code" = 'certificate_supported'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "points" = 10, "updated_at" = now(),
        "description" = 'Hay al menos una fuente adicional: integrante confirmado, evidencia, repositorio o demo accesibles (§51.3).'
       WHERE "code" = 'project_supported'`);
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "points" = 8, "updated_at" = now(),
        "description" = 'Documento legible y con metadata consistente con lo declarado (§51.4).'
       WHERE "code" = 'certificate_supported'`);
  }
}
