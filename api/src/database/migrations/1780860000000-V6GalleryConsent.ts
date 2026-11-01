import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V6 BATCH 10 · Integrantes visibles en «Proyectos de la carrera» (§7.5).
 *
 * Aditiva. Cada integrante decide si su nombre y sus roles se muestran en la
 * galería de la carrera. Nace en `false`: publicar el proyecto no hace
 * visibles a sus integrantes sin que cada uno lo acepte.
 */
export class V6GalleryConsent1780860000000 implements MigrationInterface {
  name = 'V6GalleryConsent1780860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project_members" ADD "show_in_gallery" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project_members" DROP COLUMN "show_in_gallery"`);
  }
}
