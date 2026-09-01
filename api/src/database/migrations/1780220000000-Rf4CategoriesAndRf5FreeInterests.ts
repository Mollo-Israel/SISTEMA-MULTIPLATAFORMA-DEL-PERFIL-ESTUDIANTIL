import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cierre de RF4 y RF5.
 *
 * RF4 - Categorias de actividad administrables.
 *   Las categorias dejan de ser un enum fijo del codigo y pasan a ser un
 *   catalogo que el administrador gestiona, como ya ocurria con las areas
 *   academicas y las habilidades. La migracion crea el catalogo con las mismas
 *   14 categorias que existian en el enum, agrega activities.category_id y lo
 *   rellena a partir del valor anterior de cada actividad, de modo que
 *   NINGUNA actividad existente se pierde ni cambia de categoria.
 *
 * RF5 - Intereses en texto libre.
 *   El documento distingue "intereses" de "areas de preferencia". Se agrega
 *   student_free_interests para los primeros. La tabla student_interests se
 *   conserva intacta (area academica + prioridad) y pasa a representar las
 *   areas de preferencia: se mantiene su nombre fisico por seguridad de datos y
 *   se documenta el cambio de significado en la entidad y en la API.
 */
export class Rf4CategoriesAndRf5FreeInterests1780220000000 implements MigrationInterface {
  name = 'Rf4CategoriesAndRf5FreeInterests1780220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------
    // RF4 · Catalogo de categorias de actividad
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TYPE "public"."activity_categories_applies_to_enum" AS ENUM('academica', 'extracurricular')
    `);
    await queryRunner.query(`
      CREATE TABLE "activity_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(60) NOT NULL,
        "name" character varying(120) NOT NULL,
        "description" character varying(255),
        "applies_to" "public"."activity_categories_applies_to_enum",
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_categories" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_activity_categories_code" ON "activity_categories" ("code")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_activity_categories_name" ON "activity_categories" ("name")`,
    );

    // Semilla: exactamente las 14 categorias que existian como enum, con el
    // mismo codigo, para que el mapeo posterior sea uno a uno.
    await queryRunner.query(`
      INSERT INTO "activity_categories" ("code", "name", "description", "applies_to") VALUES
        ('taller_academico',              'Taller académico',                  'Sesión práctica de formación complementaria.',        'academica'),
        ('clase_espejo',                  'Clase espejo',                      'Sesión compartida con otra institución o carrera.',   'academica'),
        ('seminario',                     'Seminario',                         'Sesión de profundización sobre un tema académico.',   'academica'),
        ('charla',                        'Charla',                            'Exposición breve a cargo de un invitado o docente.',  'academica'),
        ('curso_externo_recomendado',     'Curso externo recomendado',         'Curso de una plataforma o institución externa.',      'academica'),
        ('tutoria',                       'Tutoría',                           'Acompañamiento académico en grupo reducido.',         'academica'),
        ('investigacion',                 'Investigación',                     'Actividad vinculada a un proceso de investigación.',  'academica'),
        ('reto',                          'Reto',                              'Desafío académico o técnico con entregable.',         'extracurricular'),
        ('hackathon',                     'Hackathon',                         'Competencia intensiva de desarrollo por equipos.',    'extracurricular'),
        ('convocatoria',                  'Convocatoria',                      'Llamado abierto a participar en una iniciativa.',     'extracurricular'),
        ('actividad_sociedad_cientifica', 'Actividad de sociedad científica',  'Iniciativa organizada por la sociedad científica.',   'extracurricular'),
        ('club_estudio',                  'Club de estudio',                   'Grupo permanente de estudio sobre un área.',          'extracurricular'),
        ('responsabilidad_social',        'Responsabilidad social',            'Actividad de proyección social de la carrera.',       'extracurricular'),
        ('integracion',                   'Integración',                       'Actividad de integración de la comunidad estudiantil.', 'extracurricular')
    `);

    // activities.category_id, rellenado desde el enum anterior.
    await queryRunner.query(`ALTER TABLE "activities" ADD "category_id" uuid`);
    await queryRunner.query(`
      UPDATE "activities" a
         SET "category_id" = c."id"
        FROM "activity_categories" c
       WHERE c."code" = a."category"::text
    `);
    // Red de seguridad: cualquier actividad cuyo valor de enum no tenga
    // equivalente en el catalogo se asigna a la categoria mas generica de su
    // tipo, en lugar de bloquear la migracion o perder la actividad.
    await queryRunner.query(`
      UPDATE "activities" a
         SET "category_id" = (
           SELECT c."id" FROM "activity_categories" c
            WHERE c."code" = CASE WHEN a."type" = 'academica' THEN 'charla' ELSE 'integracion' END
         )
       WHERE a."category_id" IS NULL
    `);
    await queryRunner.query(
      `ALTER TABLE "activities" ALTER COLUMN "category_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_activities_category" ON "activities" ("category_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "activities"
        ADD CONSTRAINT "FK_activities_category"
        FOREIGN KEY ("category_id") REFERENCES "activity_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // El enum queda retirado: a partir de aqui la categoria vive solo en el catalogo.
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_activities_category_enum"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "category"`);
    await queryRunner.query(`DROP TYPE "public"."activities_category_enum"`);

    // ------------------------------------------------------------------
    // RF5 · Intereses en texto libre
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "student_free_interests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "student_profile_id" uuid NOT NULL,
        "name" character varying(120) NOT NULL,
        "description" character varying(300),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student_free_interests" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_free_interest_profile" ON "student_free_interests" ("student_profile_id")`,
    );
    // Un mismo interes no se repite dentro de un perfil, sin distinguir
    // mayusculas: "Automatizacion" y "automatizacion" son el mismo.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_student_free_interest"
        ON "student_free_interests" ("student_profile_id", lower("name"))
    `);
    await queryRunner.query(`
      ALTER TABLE "student_free_interests"
        ADD CONSTRAINT "FK_free_interest_profile"
        FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // RF5
    await queryRunner.query(
      `ALTER TABLE "student_free_interests" DROP CONSTRAINT "FK_free_interest_profile"`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_student_free_interest"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_free_interest_profile"`);
    await queryRunner.query(`DROP TABLE "student_free_interests"`);

    // RF4 — se restituye el enum y se rellena desde el catalogo, de modo que
    // las actividades conservan su categoria al revertir.
    await queryRunner.query(`
      CREATE TYPE "public"."activities_category_enum" AS ENUM(
        'taller_academico', 'clase_espejo', 'seminario', 'charla',
        'curso_externo_recomendado', 'reto', 'hackathon', 'convocatoria',
        'actividad_sociedad_cientifica', 'club_estudio', 'tutoria',
        'investigacion', 'responsabilidad_social', 'integracion'
      )
    `);
    await queryRunner.query(`ALTER TABLE "activities" ADD "category" "public"."activities_category_enum"`);
    await queryRunner.query(`
      UPDATE "activities" a
         SET "category" = c."code"::"public"."activities_category_enum"
        FROM "activity_categories" c
       WHERE c."id" = a."category_id"
    `);
    await queryRunner.query(`ALTER TABLE "activities" ALTER COLUMN "category" SET NOT NULL`);
    await queryRunner.query(
      `CREATE INDEX "IDX_activities_category_enum" ON "activities" ("category")`,
    );

    await queryRunner.query(`ALTER TABLE "activities" DROP CONSTRAINT "FK_activities_category"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_activities_category"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "category_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_activity_categories_name"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_activity_categories_code"`);
    await queryRunner.query(`DROP TABLE "activity_categories"`);
    await queryRunner.query(`DROP TYPE "public"."activity_categories_applies_to_enum"`);
  }
}
