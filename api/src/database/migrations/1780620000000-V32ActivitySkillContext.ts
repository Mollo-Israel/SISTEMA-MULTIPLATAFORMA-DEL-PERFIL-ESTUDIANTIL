import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3.2 BATCH 4 · Contexto área + habilidad en una actividad (§11.4).
 *
 * Si una habilidad pertenece a varias de las áreas elegidas (Python: IA y
 * Desarrollo Web), la actividad guarda en cuál de ellas se trabajó. La
 * afinidad usa ese contexto explícito y no reparte la habilidad por todas sus
 * áreas posibles (§11.5).
 *
 * Relleno de lo existente, sin inventar: el área principal de la habilidad si
 * la actividad la tiene; si no, una secundaria que la actividad tenga; si no,
 * el área principal de la actividad. Un área borrada deja el contexto en NULL.
 */
export class V32ActivitySkillContext1780620000000 implements MigrationInterface {
  name = 'V32ActivitySkillContext1780620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activity_skills" ADD "academic_area_id" uuid NULL`);
    await queryRunner.query(`
      ALTER TABLE "activity_skills" ADD CONSTRAINT "FK_activity_skills_area"
        FOREIGN KEY ("academic_area_id") REFERENCES "academic_areas"("id") ON DELETE SET NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_activity_skills_area" ON "activity_skills" ("academic_area_id")`);

    await queryRunner.query(`
      UPDATE "activity_skills" acs SET "academic_area_id" = COALESCE(
        (SELECT s."academic_area_id" FROM "skills" s
           WHERE s."id" = acs."skill_id"
             AND EXISTS (SELECT 1 FROM "activity_areas" aa
                          WHERE aa."activity_id" = acs."activity_id" AND aa."academic_area_id" = s."academic_area_id")),
        (SELECT r."academic_area_id" FROM "skill_area_relations" r
           JOIN "activity_areas" aa ON aa."academic_area_id" = r."academic_area_id" AND aa."activity_id" = acs."activity_id"
          WHERE r."skill_id" = acs."skill_id"
          ORDER BY r."created_at" LIMIT 1),
        (SELECT a."academic_area_id" FROM "activities" a WHERE a."id" = acs."activity_id")
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_activity_skills_area"`);
    await queryRunner.query(`ALTER TABLE "activity_skills" DROP CONSTRAINT "FK_activity_skills_area"`);
    await queryRunner.query(`ALTER TABLE "activity_skills" DROP COLUMN "academic_area_id"`);
  }
}
