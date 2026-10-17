import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V4.1 BATCH 2 · Varias imágenes por actividad (A41-006, A.5).
 *
 * Aditiva: `activity_images` guarda hasta cinco imágenes en orden. La imagen
 * que ya tenía cada actividad (`activities.image_file_id`) se copia como
 * portada (posición 0) y la columna se conserva como portada, así que ningún
 * cliente anterior pierde su imagen. `down` solo borra la tabla nueva.
 */
export class V41ActivityImages1780700000000 implements MigrationInterface {
  name = 'V41ActivityImages1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "activity_images" (
        "activity_id" uuid NOT NULL,
        "stored_file_id" uuid NOT NULL,
        "position" smallint NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_images" PRIMARY KEY ("activity_id", "stored_file_id"),
        CONSTRAINT "FK_activity_images_activity" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_activity_images_file" FOREIGN KEY ("stored_file_id") REFERENCES "stored_files"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_activity_images_file" ON "activity_images" ("stored_file_id")`);
    await queryRunner.query(`
      INSERT INTO "activity_images" ("activity_id", "stored_file_id", "position")
      SELECT "id", "image_file_id", 0 FROM "activities" WHERE "image_file_id" IS NOT NULL
      ON CONFLICT DO NOTHING`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_activity_images_file"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_images"`);
  }
}
