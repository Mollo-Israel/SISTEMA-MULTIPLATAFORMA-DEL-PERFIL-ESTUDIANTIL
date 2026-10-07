import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3 BATCH 6 · Modelo unificado de oportunidades (§12).
 *
 * - `origin_type`: interna o externa. La columna `type` existente
 *   (académica / extracurricular) es el `internal_type` de la V3.
 * - Campos de una oportunidad externa: proveedor, credencial esperada,
 *   dominios oficiales del emisor y palabras clave (§12.1).
 * - `activity_areas`: una oportunidad puede tocar varias áreas. Se conserva
 *   `academic_area_id` como área principal (la primera), que es la que leen
 *   hoy los motores; la tabla nueva guarda todas.
 *
 * Datos: las actividades de las categorías de curso externo y recurso de
 * apoyo pasan a origen externo; todas las demás quedan internas. Cada
 * actividad con área recibe su fila en `activity_areas`. Nada se borra.
 */
export class V3OpportunityModel1780490000000 implements MigrationInterface {
  name = 'V3OpportunityModel1780490000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "activity_origin_enum" AS ENUM ('internal', 'external')`);
    await queryRunner.query(`
      ALTER TABLE "activities"
        ADD COLUMN "origin_type" "activity_origin_enum" NOT NULL DEFAULT 'internal',
        ADD COLUMN "provider" varchar(160) NULL,
        ADD COLUMN "credential_expected" boolean NOT NULL DEFAULT false,
        ADD COLUMN "expected_issuer_domains" text[] NOT NULL DEFAULT '{}',
        ADD COLUMN "expected_keywords" text[] NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`CREATE INDEX "idx_activities_origin" ON "activities" ("origin_type")`);

    await queryRunner.query(`
      CREATE TABLE "activity_areas" (
        "activity_id" uuid NOT NULL,
        "academic_area_id" uuid NOT NULL,
        CONSTRAINT "pk_activity_areas" PRIMARY KEY ("activity_id", "academic_area_id"),
        CONSTRAINT "fk_activity_areas_activity" FOREIGN KEY ("activity_id")
          REFERENCES "activities"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_activity_areas_area" FOREIGN KEY ("academic_area_id")
          REFERENCES "academic_areas"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "idx_activity_areas_area" ON "activity_areas" ("academic_area_id")`);

    await queryRunner.query(`
      INSERT INTO "activity_areas" ("activity_id", "academic_area_id")
      SELECT "id", "academic_area_id" FROM "activities" WHERE "academic_area_id" IS NOT NULL`);
    await queryRunner.query(`
      UPDATE "activities" a SET "origin_type" = 'external'
      FROM "activity_categories" c
      WHERE c."id" = a."category_id" AND c."code" IN ('curso_externo_recomendado', 'recurso_de_apoyo')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "activity_areas"`);
    await queryRunner.query(`DROP INDEX "idx_activities_origin"`);
    await queryRunner.query(`
      ALTER TABLE "activities"
        DROP COLUMN "expected_keywords",
        DROP COLUMN "expected_issuer_domains",
        DROP COLUMN "credential_expected",
        DROP COLUMN "provider",
        DROP COLUMN "origin_type"`);
    await queryRunner.query(`DROP TYPE "activity_origin_enum"`);
  }
}
