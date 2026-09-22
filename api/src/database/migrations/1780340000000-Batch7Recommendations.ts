import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BATCH 7 — Recomendaciones (especificacion §58 a §62, §92, §132).
 *
 * Crea el catalogo controlado que pide §61 y traslada a el los recursos y
 * cursos externos que hasta ahora vivian disfrazados de actividad.
 *
 * Que estuvieran modelados como actividades nunca encajo: un recurso no tiene
 * fecha, ni cupo, ni inscripcion, ni participacion que confirmar. Los 71 que
 * habia en la base no acumulaban una sola inscripcion, que es la prueba de que
 * nadie los trataba como actividades.
 *
 * Las actividades originales **no se borran ni se modifican**: se copian. Quien
 * dirija la carrera decidira que hacer con ellas; esta migracion no toma esa
 * decision por nadie.
 */
export class Batch7Recommendations1780340000000 implements MigrationInterface {
  name = 'Batch7Recommendations1780340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================= §61
    await queryRunner.query(`
      CREATE TYPE "learning_resource_type_enum" AS ENUM (
        'external_course', 'documentation', 'guide', 'video', 'book', 'tool', 'practice'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "learning_resource_status_enum" AS ENUM ('active', 'inactive')
    `);

    await queryRunner.query(`
      CREATE TABLE "learning_resources" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(200) NOT NULL,
        "provider" character varying(160) NOT NULL,
        "url" character varying(500) NOT NULL,
        "description" character varying(500),
        "academic_area_id" uuid NOT NULL,
        "resource_type" "learning_resource_type_enum" NOT NULL,
        "status" "learning_resource_status_enum" NOT NULL DEFAULT 'active',
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_learning_resources" PRIMARY KEY ("id"),
        CONSTRAINT "FK_learning_resources_area" FOREIGN KEY ("academic_area_id")
          REFERENCES "academic_areas"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_learning_resources_creador" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_learning_resources_area_estado"
        ON "learning_resources" ("academic_area_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_learning_resources_area"
        ON "learning_resources" ("academic_area_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "learning_resource_skills" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "learning_resource_id" uuid NOT NULL,
        "skill_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_learning_resource_skills" PRIMARY KEY ("id"),
        CONSTRAINT "uq_learning_resource_skill" UNIQUE ("learning_resource_id", "skill_id"),
        CONSTRAINT "FK_learning_resource_skills_recurso" FOREIGN KEY ("learning_resource_id")
          REFERENCES "learning_resources"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_learning_resource_skills_skill" FOREIGN KEY ("skill_id")
          REFERENCES "skills"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_learning_resource_skills_recurso"
        ON "learning_resource_skills" ("learning_resource_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_learning_resource_skills_skill"
        ON "learning_resource_skills" ("skill_id")
    `);

    // ================================================ Traslado al catalogo
    // Solo se copian las que tienen enlace y area: un recurso sin URL no es un
    // recurso, y sin area no hay forma de relacionarlo con nadie.
    await queryRunner.query(`
      INSERT INTO "learning_resources" (
        "title", "provider", "url", "description", "academic_area_id",
        "resource_type", "status", "created_by", "created_at"
      )
      SELECT
        left(a."title", 200),
        'Catálogo de la carrera',
        left(a."external_url", 500),
        left(a."description", 500),
        a."academic_area_id",
        CASE c."code"
          WHEN 'curso_externo_recomendado' THEN 'external_course'::"learning_resource_type_enum"
          ELSE 'guide'::"learning_resource_type_enum"
        END,
        'active'::"learning_resource_status_enum",
        a."creator_id",
        a."created_at"
      FROM "activities" a
      JOIN "activity_categories" c ON c."id" = a."category_id"
      WHERE c."code" IN ('curso_externo_recomendado', 'recurso_de_apoyo')
        AND a."external_url" IS NOT NULL
        AND a."academic_area_id" IS NOT NULL
    `);

    // Las habilidades que la actividad declaraba viajan con el recurso: es la
    // informacion que §61 pide en `skills[]` y ya existia.
    await queryRunner.query(`
      INSERT INTO "learning_resource_skills" ("learning_resource_id", "skill_id")
      SELECT DISTINCT r."id", asx."skill_id"
      FROM "learning_resources" r
      JOIN "activities" a
        ON left(a."title", 200) = r."title" AND left(a."external_url", 500) = r."url"
      JOIN "activity_skills" asx ON asx."activity_id" = a."id"
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "learning_resource_skills"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "learning_resources"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "learning_resource_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "learning_resource_type_enum"`);
  }
}
