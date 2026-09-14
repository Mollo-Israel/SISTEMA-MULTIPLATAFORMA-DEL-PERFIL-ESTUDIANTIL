import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Objetivo 7 - Recomendaciones academicas ligeras (RF18, RN-16).
 *
 *  - recommendations: cada sugerencia que el sistema hace a un estudiante, con
 *    su motivo y su estado. El diagrama de clases del documento ya modela
 *    Recommendation con generate() y markAsViewed(); RN-16 agrega que el
 *    estudiante "conservara la decision sobre su utilizacion", y el estado
 *    (nueva, vista, guardada, descartada) es donde esa decision queda
 *    registrada.
 *
 *  - student_profiles.peer_discoverable: si el estudiante acepta aparecer como
 *    posible companero de equipo en las recomendaciones de otros. Activo por
 *    defecto y desactivable por el propio estudiante. Es la forma concreta del
 *    visibilityLevel que el diagrama de clases pone en StudentProfile.
 *
 *  - Categoria "recurso_de_apoyo" en el catalogo de RF4. RN-16 y la Tabla 2.27
 *    nombran los recursos de apoyo como elemento recomendable. Se publican como
 *    actividades con su enlace, igual que los cursos externos, que ya eran una
 *    categoria del catalogo desde el Objetivo 3.
 *
 * PRESERVACION: ninguna tabla existente pierde datos. La columna nueva tiene
 * valor por defecto y la categoria se agrega sin tocar las existentes.
 */
export class Objective7Recommendations1780270000000 implements MigrationInterface {
  name = 'Objective7Recommendations1780270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------
    // RF18 · Recomendaciones
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TYPE "public"."recommendation_type_enum" AS ENUM(
        'activity', 'opportunity', 'external_course',
        'resource', 'strengthening_area', 'teammate'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."recommendation_status_enum" AS ENUM(
        'new', 'viewed', 'saved', 'dismissed'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "recommendations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "student_profile_id" uuid NOT NULL,
        "type" "public"."recommendation_type_enum" NOT NULL,
        "status" "public"."recommendation_status_enum" NOT NULL DEFAULT 'new',
        "target_id" uuid NOT NULL,
        "academic_area_id" uuid,
        "title" character varying(200) NOT NULL,
        "description" character varying(500),
        "target_link" character varying(500),
        "score" numeric(6,2) NOT NULL DEFAULT 0,
        "reasons" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "is_current" boolean NOT NULL DEFAULT true,
        "rules_version" character varying(64) NOT NULL,
        "generated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "viewed_at" TIMESTAMP WITH TIME ZONE,
        "decided_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recommendations" PRIMARY KEY ("id"),
        CONSTRAINT "uq_recommendation_target"
          UNIQUE ("student_profile_id", "type", "target_id"),
        CONSTRAINT "chk_recommendation_score" CHECK ("score" >= 0),
        CONSTRAINT "chk_recommendation_reasons_array" CHECK (jsonb_typeof("reasons") = 'array')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_recommendation_profile" ON "recommendations" ("student_profile_id")`,
    );
    await queryRunner.query(`
      CREATE INDEX "idx_recommendation_profile_status"
        ON "recommendations" ("student_profile_id", "status")
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_recommendation_area" ON "recommendations" ("academic_area_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "recommendations"
        ADD CONSTRAINT "FK_recommendation_profile"
        FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "recommendations"
        ADD CONSTRAINT "FK_recommendation_area"
        FOREIGN KEY ("academic_area_id") REFERENCES "academic_areas"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // ------------------------------------------------------------------
    // RF18 · Aparecer como posible companero de equipo
    // ------------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "student_profiles"
        ADD "peer_discoverable" boolean NOT NULL DEFAULT true
    `);

    // ------------------------------------------------------------------
    // RF4 · Categoria de recursos de apoyo
    // ------------------------------------------------------------------
    // applies_to nulo: sirve para actividades academicas y extracurriculares.
    // ON CONFLICT DO NOTHING cubre el caso de que un administrador ya haya
    // creado una categoria con ese codigo o ese nombre.
    await queryRunner.query(`
      INSERT INTO "activity_categories" ("code", "name", "description", "applies_to")
      VALUES (
        'recurso_de_apoyo',
        'Recurso de apoyo',
        'Guía, documentación o material de consulta recomendado por la carrera.',
        NULL
      )
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // La categoria solo se retira si ninguna actividad la usa. Borrarla con
    // actividades asociadas destruiria datos, y dejarla es inofensivo.
    await queryRunner.query(`
      DELETE FROM "activity_categories" c
       WHERE c."code" = 'recurso_de_apoyo'
         AND NOT EXISTS (SELECT 1 FROM "activities" a WHERE a."category_id" = c."id")
    `);

    await queryRunner.query(`ALTER TABLE "student_profiles" DROP COLUMN "peer_discoverable"`);

    await queryRunner.query(
      `ALTER TABLE "recommendations" DROP CONSTRAINT "FK_recommendation_area"`,
    );
    await queryRunner.query(
      `ALTER TABLE "recommendations" DROP CONSTRAINT "FK_recommendation_profile"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_recommendation_area"`);
    await queryRunner.query(`DROP INDEX "public"."idx_recommendation_profile_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_recommendation_profile"`);
    await queryRunner.query(`DROP TABLE "recommendations"`);
    await queryRunner.query(`DROP TYPE "public"."recommendation_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."recommendation_type_enum"`);
  }
}
