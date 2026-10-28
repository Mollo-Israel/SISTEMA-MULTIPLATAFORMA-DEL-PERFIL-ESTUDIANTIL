import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V5 BATCH 13 · Imágenes de muestra de un proyecto (§13.4, G08).
 *
 * Aditiva. De 0 a 5 imágenes por proyecto, separadas de las evidencias: una
 * evidencia es privada por defecto y respalda; una imagen de muestra es lo que
 * el estudiante elige enseñar, y solo se ve donde el proyecto ya se ve.
 * Una sola portada por proyecto. Borrar el proyecto borra sus imágenes; el
 * archivo no se borra mientras una imagen lo use.
 */
export class V5ProjectImages1780840000000 implements MigrationInterface {
  name = 'V5ProjectImages1780840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "project_images" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "stored_file_id" uuid NOT NULL,
        "position" smallint NOT NULL,
        "is_cover" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_images" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_project_images_position" CHECK ("position" BETWEEN 0 AND 4),
        CONSTRAINT "UQ_project_images_file" UNIQUE ("project_id", "stored_file_id"),
        CONSTRAINT "FK_project_images_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_images_file" FOREIGN KEY ("stored_file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_project_images_project" ON "project_images" ("project_id", "position")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_project_images_cover" ON "project_images" ("project_id") WHERE "is_cover"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "project_images"`);
  }
}
