import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3.2 BATCH 14 · Áreas y contexto de una credencial externa (§33, §50.1).
 *
 * - `external_certificate_areas`: una credencial puede tocar varias áreas;
 *   `academic_area_id` sigue siendo la principal y se copia aquí.
 * - `external_certificate_skills.academic_area_id`: en cuál de sus áreas se
 *   acredita cada tecnología. La afinidad usa ese contexto (§11.5).
 *   Relleno: la principal de la tecnología si la credencial la tiene; si no,
 *   una secundaria; si no, el área de la credencial.
 */
export class V32CertificateContext1780690000000 implements MigrationInterface {
  name = 'V32CertificateContext1780690000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "external_certificate_areas" (
        "certificate_id" uuid NOT NULL,
        "academic_area_id" uuid NOT NULL,
        CONSTRAINT "PK_external_certificate_areas" PRIMARY KEY ("certificate_id", "academic_area_id"),
        CONSTRAINT "FK_eca_certificate" FOREIGN KEY ("certificate_id") REFERENCES "external_certificates"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_eca_area" FOREIGN KEY ("academic_area_id") REFERENCES "academic_areas"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`
      INSERT INTO "external_certificate_areas" ("certificate_id", "academic_area_id")
      SELECT "id", "academic_area_id" FROM "external_certificates" WHERE "academic_area_id" IS NOT NULL
      ON CONFLICT DO NOTHING`);
    await queryRunner.query(`ALTER TABLE "external_certificate_skills" ADD "academic_area_id" uuid NULL`);
    await queryRunner.query(`
      ALTER TABLE "external_certificate_skills" ADD CONSTRAINT "FK_ecs_area"
        FOREIGN KEY ("academic_area_id") REFERENCES "academic_areas"("id") ON DELETE SET NULL`);
    await queryRunner.query(`
      UPDATE "external_certificate_skills" cs SET "academic_area_id" = COALESCE(
        (SELECT s."academic_area_id" FROM "skills" s
           WHERE s."id" = cs."skill_id"
             AND EXISTS (SELECT 1 FROM "external_certificate_areas" ea WHERE ea."certificate_id" = cs."certificate_id" AND ea."academic_area_id" = s."academic_area_id")),
        (SELECT r."academic_area_id" FROM "skill_area_relations" r
           JOIN "external_certificate_areas" ea ON ea."academic_area_id" = r."academic_area_id" AND ea."certificate_id" = cs."certificate_id"
          WHERE r."skill_id" = cs."skill_id" ORDER BY r."created_at" LIMIT 1),
        (SELECT c."academic_area_id" FROM "external_certificates" c WHERE c."id" = cs."certificate_id")
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "external_certificate_skills" DROP CONSTRAINT "FK_ecs_area"`);
    await queryRunner.query(`ALTER TABLE "external_certificate_skills" DROP COLUMN "academic_area_id"`);
    await queryRunner.query(`DROP TABLE "external_certificate_areas"`);
  }
}
