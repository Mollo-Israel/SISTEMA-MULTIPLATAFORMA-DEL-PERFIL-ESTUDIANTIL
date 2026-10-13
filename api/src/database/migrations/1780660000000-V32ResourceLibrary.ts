import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3.2 BATCH 9 · Biblioteca de recursos (§35).
 *
 * - `learning_resource_areas`: un recurso puede tocar varias áreas (la de
 *   siempre, `academic_area_id`, sigue siendo la principal y se copia aquí).
 * - `image_file_id`: imagen opcional del recurso.
 * - `learning_resource_favorites`: «guardar» un recurso. Es organización
 *   personal y, como mucho, una señal secundaria y explícita de preferencia;
 *   nunca afinidad (§35.3).
 */
export class V32ResourceLibrary1780660000000 implements MigrationInterface {
  name = 'V32ResourceLibrary1780660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "learning_resource_areas" (
        "learning_resource_id" uuid NOT NULL,
        "academic_area_id" uuid NOT NULL,
        CONSTRAINT "PK_learning_resource_areas" PRIMARY KEY ("learning_resource_id", "academic_area_id"),
        CONSTRAINT "FK_lra_resource" FOREIGN KEY ("learning_resource_id") REFERENCES "learning_resources"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lra_area" FOREIGN KEY ("academic_area_id") REFERENCES "academic_areas"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_lra_area" ON "learning_resource_areas" ("academic_area_id")`);
    await queryRunner.query(`
      INSERT INTO "learning_resource_areas" ("learning_resource_id", "academic_area_id")
      SELECT "id", "academic_area_id" FROM "learning_resources" WHERE "academic_area_id" IS NOT NULL
      ON CONFLICT DO NOTHING`);

    await queryRunner.query(`ALTER TABLE "learning_resources" ADD "image_file_id" uuid NULL`);
    await queryRunner.query(`
      ALTER TABLE "learning_resources" ADD CONSTRAINT "FK_learning_resources_image"
        FOREIGN KEY ("image_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL`);

    await queryRunner.query(`
      CREATE TABLE "learning_resource_favorites" (
        "student_profile_id" uuid NOT NULL,
        "learning_resource_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_learning_resource_favorites" PRIMARY KEY ("student_profile_id", "learning_resource_id"),
        CONSTRAINT "FK_lrf_profile" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lrf_resource" FOREIGN KEY ("learning_resource_id") REFERENCES "learning_resources"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_lrf_resource" ON "learning_resource_favorites" ("learning_resource_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "learning_resource_favorites"`);
    await queryRunner.query(`ALTER TABLE "learning_resources" DROP CONSTRAINT "FK_learning_resources_image"`);
    await queryRunner.query(`ALTER TABLE "learning_resources" DROP COLUMN "image_file_id"`);
    await queryRunner.query(`DROP TABLE "learning_resource_areas"`);
  }
}
