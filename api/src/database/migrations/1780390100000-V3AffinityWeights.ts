import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pesos del motor de afinidad V3 (especificación V2 §45–§47).
 *
 * Lo declarado deja de sumar (intereses, habilidades autodeclaradas, áreas de
 * mejora: 0) y cambian los puntos de la trayectoria respaldada: actividad
 * confirmada 10; proyecto 0/10/18/22/0 según su respaldo; certificado 0/8/15.
 *
 * Los resultados V2 no se tocan aquí: siguen en sus instantáneas con
 * `engine_version = 2`, y el recálculo al arrancar (`AFFINITY_BACKFILL_ON_BOOT`)
 * produce los resultados V3.
 */
const V3: [string, number][] = [
  ['interest_priority_1', 0],
  ['interest_priority_2', 0],
  ['interest_priority_3', 0],
  ['interest_priority_4', 0],
  ['interest_priority_5', 0],
  ['skill_basic', 0],
  ['skill_intermediate', 0],
  ['skill_advanced', 0],
  ['improvement_area', 0],
  ['activity_confirmed', 10],
  ['project_declared', 0],
  ['project_supported', 10],
  ['project_corroborated', 18],
  ['project_reviewed', 22],
  ['project_flagged', 0],
  ['certificate_declared', 0],
  ['certificate_supported', 8],
  ['certificate_corroborated', 15],
];

const V2: [string, number][] = [
  ['interest_priority_1', 5],
  ['interest_priority_2', 4],
  ['interest_priority_3', 3],
  ['interest_priority_4', 2],
  ['interest_priority_5', 1],
  ['skill_basic', 0.5],
  ['skill_intermediate', 1],
  ['skill_advanced', 1.5],
  ['improvement_area', 0],
  ['activity_confirmed', 4],
  ['project_declared', 2],
  ['project_supported', 6],
  ['project_corroborated', 10],
  ['project_reviewed', 12],
  ['project_flagged', 0],
  ['certificate_declared', 1],
  ['certificate_supported', 3],
  ['certificate_corroborated', 6],
];

export class V3AffinityWeights1780390100000 implements MigrationInterface {
  name = 'V3AffinityWeights1780390100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [code, points] of V3) {
      await queryRunner.query(
        `UPDATE "affinity_weights" SET "points" = $2, "updated_at" = now() WHERE "code" = $1::text::"affinity_weight_code_enum"`,
        [code, points],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [code, points] of V2) {
      await queryRunner.query(
        `UPDATE "affinity_weights" SET "points" = $2, "updated_at" = now() WHERE "code" = $1::text::"affinity_weight_code_enum"`,
        [code, points],
      );
    }
  }
}
