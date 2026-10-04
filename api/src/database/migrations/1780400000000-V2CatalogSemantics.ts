import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catálogos V2 (especificación V2 §23, §24, §73).
 *
 * - `skills.aliases`: otros nombres de la misma tecnología («ReactJS» para
 *   React). Sirven para reconocerla en recomendaciones y en la validación
 *   semántica de la clasificación.
 * - Unicidad de nombre normalizado (minúsculas, sin espacios sobrantes) para
 *   áreas, habilidades y categorías: hasta ahora la garantizaba solo el
 *   servicio; §73 la pide en la base. Antes de crear los índices se comprobó
 *   que no hay duplicados en los datos existentes.
 */
export class V2CatalogSemantics1780400000000 implements MigrationInterface {
  name = 'V2CatalogSemantics1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "skills" ADD "aliases" text[] NOT NULL DEFAULT '{}'`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_academic_areas_name_norm" ON "academic_areas" (lower(btrim("name")))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_skills_name_norm" ON "skills" (lower(btrim("name")))`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_activity_categories_name_norm" ON "activity_categories" (lower(btrim("name")))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_activity_categories_name_norm"`);
    await queryRunner.query(`DROP INDEX "uq_skills_name_norm"`);
    await queryRunner.query(`DROP INDEX "uq_academic_areas_name_norm"`);
    await queryRunner.query(`ALTER TABLE "skills" DROP COLUMN "aliases"`);
  }
}
