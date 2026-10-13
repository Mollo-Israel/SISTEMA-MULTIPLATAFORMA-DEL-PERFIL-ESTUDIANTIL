import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3.2 BATCH 11 · Contexto área + habilidad en un proyecto (§11.4, §40).
 *
 * Igual que en las actividades: si una habilidad pertenece a varias de las
 * áreas del proyecto, se guarda en cuál se usó. La afinidad usa ese contexto
 * explícito (§11.5). Relleno: la principal de la habilidad si el proyecto la
 * tiene; si no, una secundaria del proyecto; si no, el área principal del
 * proyecto.
 */
export class V32ProjectSkillContext1780670000000 implements MigrationInterface {
  name = 'V32ProjectSkillContext1780670000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project_skills" ADD "academic_area_id" uuid NULL`);
    await queryRunner.query(`
      ALTER TABLE "project_skills" ADD CONSTRAINT "FK_project_skills_area"
        FOREIGN KEY ("academic_area_id") REFERENCES "academic_areas"("id") ON DELETE SET NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_project_skills_area" ON "project_skills" ("academic_area_id")`);
    await queryRunner.query(`
      UPDATE "project_skills" ps SET "academic_area_id" = COALESCE(
        (SELECT s."academic_area_id" FROM "skills" s
           WHERE s."id" = ps."skill_id"
             AND EXISTS (SELECT 1 FROM "project_areas" pa WHERE pa."project_id" = ps."project_id" AND pa."academic_area_id" = s."academic_area_id")),
        (SELECT r."academic_area_id" FROM "skill_area_relations" r
           JOIN "project_areas" pa ON pa."academic_area_id" = r."academic_area_id" AND pa."project_id" = ps."project_id"
          WHERE r."skill_id" = ps."skill_id" ORDER BY r."created_at" LIMIT 1),
        (SELECT p."academic_area_id" FROM "projects" p WHERE p."id" = ps."project_id")
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_project_skills_area"`);
    await queryRunner.query(`ALTER TABLE "project_skills" DROP CONSTRAINT "FK_project_skills_area"`);
    await queryRunner.query(`ALTER TABLE "project_skills" DROP COLUMN "academic_area_id"`);
  }
}
