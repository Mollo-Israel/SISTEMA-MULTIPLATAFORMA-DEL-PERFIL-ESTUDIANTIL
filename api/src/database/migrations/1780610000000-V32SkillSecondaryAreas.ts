import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3.2 BATCH 3 · Una habilidad puede pertenecer a más de un área (§11).
 *
 * `skills.academic_area_id` se conserva como área principal (§11.2: no
 * reescribir). Las secundarias van en `skill_area_relations` con
 * `relation_type = 'SECONDARY'`. Una habilidad no repite un área, y borrar la
 * habilidad o el área borra la relación (no hay datos que conservar en ella).
 */
export class V32SkillSecondaryAreas1780610000000 implements MigrationInterface {
  name = 'V32SkillSecondaryAreas1780610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "skill_area_relations" (
        "skill_id" uuid NOT NULL,
        "academic_area_id" uuid NOT NULL,
        "relation_type" varchar(20) NOT NULL DEFAULT 'SECONDARY',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_skill_area_relations" PRIMARY KEY ("skill_id", "academic_area_id"),
        CONSTRAINT "CHK_skill_area_relations_type" CHECK ("relation_type" IN ('SECONDARY')),
        CONSTRAINT "FK_skill_area_relations_skill" FOREIGN KEY ("skill_id")
          REFERENCES "skills"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_skill_area_relations_area" FOREIGN KEY ("academic_area_id")
          REFERENCES "academic_areas"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_skill_area_relations_area" ON "skill_area_relations" ("academic_area_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_skill_area_relations_area"`);
    await queryRunner.query(`DROP TABLE "skill_area_relations"`);
  }
}
