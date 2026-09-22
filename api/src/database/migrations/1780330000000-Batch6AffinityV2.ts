import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BATCH 6 — Motor de Afinidad V2 (especificacion §48 a §57, §131).
 *
 * Lo que cambia aqui no son solo columnas: cambia el significado de un numero
 * que ya existia. `affinity_results.score` guardaba puntos crudos sin techo y
 * pasa a ser un porcentaje sobre 100 (§52). Por eso cada fila anterior queda
 * marcada con `engine_version = 1` y el recalculo lo hace el motor al
 * arrancar, no esta migracion: el calculo vive en el motor y reescribirlo en
 * SQL seria tener dos versiones de la misma regla, que es como empiezan las
 * discrepancias que nadie sabe explicar.
 *
 * §131 pide migrar «sin destruir historia»: las instantaneas de
 * `affinity_snapshots` se conservan intactas con su version, de modo que una
 * grafica de evolucion puede distinguir un cambio de escala de una caida real.
 */
export class Batch6AffinityV21780330000000 implements MigrationInterface {
  name = 'Batch6AffinityV21780330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===================================================== §51 · Codigos
    // El enum se recrea en vez de ampliarse: PostgreSQL no deja usar un valor
    // añadido con ALTER TYPE dentro de la misma transaccion que lo añade, y
    // esta migracion necesita insertar filas con los codigos nuevos.
    await queryRunner.query(`
      ALTER TYPE "public"."affinity_weight_code_enum"
        RENAME TO "affinity_weight_code_enum_v1"
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."affinity_weight_code_enum" AS ENUM(
        'interest',
        'interest_priority_1', 'interest_priority_2', 'interest_priority_3',
        'interest_priority_4', 'interest_priority_5',
        'improvement_area',
        'skill_basic', 'skill_intermediate', 'skill_advanced',
        'activity_interested', 'activity_registered', 'activity_confirmed',
        'project_owned', 'project_member',
        'project_declared', 'project_supported', 'project_corroborated',
        'project_reviewed', 'project_flagged',
        'evidence',
        'certificate',
        'certificate_declared', 'certificate_supported', 'certificate_corroborated',
        'constancy'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "affinity_weights"
        ALTER COLUMN "code" TYPE "public"."affinity_weight_code_enum"
        USING "code"::text::"public"."affinity_weight_code_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "affinity_contributions"
        ALTER COLUMN "weight_code" TYPE "public"."affinity_weight_code_enum"
        USING "weight_code"::text::"public"."affinity_weight_code_enum"
    `);
    await queryRunner.query(`DROP TYPE "public"."affinity_weight_code_enum_v1"`);

    // ===================================================== §53, §54, §56
    await queryRunner.query(`
      CREATE TYPE "public"."affinity_signal_family_enum" AS ENUM(
        'preference', 'activity', 'project',
        'external_certificate', 'academic_review', 'other'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."affinity_source_entity_type_enum" AS ENUM(
        'student_interest', 'student_skill', 'improvement_area',
        'activity_registration', 'project', 'external_certificate',
        'project_evidence', 'activity_evidence', 'internal_constancy',
        'project_feedback'
      )
    `);

    // ======================================================= §49 · Resultados
    await queryRunner.query(`
      ALTER TABLE "affinity_results"
        ADD COLUMN "raw_points" numeric(6,2) NOT NULL DEFAULT 0,
        ADD COLUMN "support_score" smallint NOT NULL DEFAULT 0,
        ADD COLUMN "support_level" "public"."affinity_results_level_enum" NOT NULL DEFAULT 'low',
        ADD COLUMN "support_families" text array NOT NULL DEFAULT '{}',
        ADD COLUMN "engine_version" smallint NOT NULL DEFAULT 1
    `);
    // El puntaje V1 ya era el total crudo del area: se copia tal cual para que
    // la fila quede coherente consigo misma hasta que el motor la recalcule.
    await queryRunner.query(`UPDATE "affinity_results" SET "raw_points" = "score"`);
    await queryRunner.query(`
      CREATE INDEX "IDX_affinity_results_engine"
        ON "affinity_results" ("engine_version")
    `);

    // ===================================================== §56 · Desglose
    await queryRunner.query(`
      ALTER TABLE "affinity_contributions"
        ADD COLUMN "signal_family" "public"."affinity_signal_family_enum" NOT NULL DEFAULT 'other',
        ADD COLUMN "source_entity_type" "public"."affinity_source_entity_type_enum",
        ADD COLUMN "raw_points" numeric(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN "multiplier" numeric(4,2) NOT NULL DEFAULT 1,
        ADD COLUMN "support_points" numeric(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN "engine_version" smallint NOT NULL DEFAULT 1
    `);
    // La explicacion de V2 lleva el nivel de respaldo y el detalle de las
    // tecnologias propias; 200 caracteres se quedaban cortos.
    await queryRunner.query(`
      ALTER TABLE "affinity_contributions"
        ALTER COLUMN "source_label" TYPE character varying(300)
    `);
    await queryRunner.query(`UPDATE "affinity_contributions" SET "raw_points" = "points"`);
    await queryRunner.query(`
      UPDATE "affinity_contributions" SET "signal_family" = CASE "signal_type"
        WHEN 'interest' THEN 'preference'::"public"."affinity_signal_family_enum"
        WHEN 'skill' THEN 'preference'::"public"."affinity_signal_family_enum"
        WHEN 'improvement_area' THEN 'preference'::"public"."affinity_signal_family_enum"
        WHEN 'activity' THEN 'activity'::"public"."affinity_signal_family_enum"
        WHEN 'project' THEN 'project'::"public"."affinity_signal_family_enum"
        WHEN 'certificate' THEN 'external_certificate'::"public"."affinity_signal_family_enum"
        WHEN 'constancy' THEN 'academic_review'::"public"."affinity_signal_family_enum"
        ELSE 'other'::"public"."affinity_signal_family_enum"
      END
    `);

    // ================================================== §131 · Instantaneas
    await queryRunner.query(`
      ALTER TABLE "affinity_snapshots"
        ADD COLUMN "engine_version" smallint NOT NULL DEFAULT 1,
        ADD COLUMN "average_support" smallint NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "affinity_snapshot_items"
        ADD COLUMN "raw_points" numeric(6,2) NOT NULL DEFAULT 0,
        ADD COLUMN "support_score" smallint NOT NULL DEFAULT 0,
        ADD COLUMN "support_level" "public"."affinity_results_level_enum" NOT NULL DEFAULT 'low'
    `);
    await queryRunner.query(`UPDATE "affinity_snapshot_items" SET "raw_points" = "score"`);

    // ================================================== §51 · Ponderaciones
    // Los puntos base viven en la base porque §51 pide que se almacenen y
    // versionen. La estructura -topes, rendimientos, normalizacion- vive en el
    // codigo del motor: cambiarla no es ajustar un parametro, es cambiar el
    // significado del puntaje.
    await queryRunner.query(`
      INSERT INTO "affinity_weights" ("code", "signal_type", "points", "label", "description") VALUES
        ('interest_priority_1', 'interest', 5.00,
         'Interes declarado con prioridad 1',
         'Area que el estudiante puso en primer lugar. §51.1 pondera por prioridad: tratarlas todas igual desperdiciaba el orden que el propio estudiante eligio.'),
        ('interest_priority_2', 'interest', 4.00,
         'Interes declarado con prioridad 2',
         'Segunda area en el orden declarado por el estudiante (§51.1).'),
        ('interest_priority_3', 'interest', 3.00,
         'Interes declarado con prioridad 3',
         'Tercera area en el orden declarado por el estudiante (§51.1).'),
        ('interest_priority_4', 'interest', 2.00,
         'Interes declarado con prioridad 4',
         'Cuarta area en el orden declarado por el estudiante (§51.1).'),
        ('interest_priority_5', 'interest', 1.00,
         'Interes declarado con prioridad 5',
         'Quinta area en el orden declarado por el estudiante (§51.1).'),
        ('project_declared', 'project', 2.00,
         'Proyecto declarado',
         'Solo existe lo que su autor escribio. Puntua poco, no porque el proyecto valga poco, sino porque el sistema no pudo corroborar nada (§51.3).'),
        ('project_supported', 'project', 6.00,
         'Proyecto respaldado',
         'Hay al menos una fuente adicional: integrante confirmado, evidencia, repositorio o demo accesibles (§51.3).'),
        ('project_corroborated', 'project', 10.00,
         'Proyecto corroborado',
         'Dos senales independientes y una corroboracion tecnica que responde por si misma (§51.3).'),
        ('project_reviewed', 'project', 12.00,
         'Proyecto revisado por un docente',
         'Respaldado y con retroalimentacion docente. No significa aprobado academicamente: significa que alguien con criterio lo miro (§36, §51.3).'),
        ('project_flagged', 'project', 0.00,
         'Proyecto marcado por inconsistencia',
         'Vale cero hasta resolver la inconsistencia (§51.3). El proyecto no se elimina: se marca.'),
        ('certificate_declared', 'certificate', 1.00,
         'Certificado externo declarado',
         'Archivo aportado sin corroboracion suficiente. Puede ser autentico: solo significa que no se pudo comprobar (§51.4).'),
        ('certificate_supported', 'certificate', 3.00,
         'Certificado externo respaldado',
         'Documento legible y con metadata consistente con lo declarado (§51.4).'),
        ('certificate_corroborated', 'certificate', 6.00,
         'Certificado externo corroborado',
         'URL o QR externo accesible y coherente con lo declarado (§51.4).')
    `);

    // §51.1: la escala de habilidades baja de 1/2/3 a 0,5/1/1,5. El nivel
    // sigue siendo autodeclarado, y una autodeclaracion no puede pesar como
    // una participacion confirmada.
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "points" = 0.50,
        "description" = 'Habilidad autodeclarada de nivel basico. Peso debil a proposito: §50 admite las habilidades como fuente, pero nadie verifico el nivel.'
      WHERE "code" = 'skill_basic'
    `);
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "points" = 1.00,
        "description" = 'Habilidad autodeclarada de nivel intermedio (§51.1).'
      WHERE "code" = 'skill_intermediate'
    `);
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "points" = 1.50,
        "description" = 'Habilidad autodeclarada de nivel avanzado (§51.1).'
      WHERE "code" = 'skill_advanced'
    `);
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "points" = 4.00,
        "description" = 'Participacion confirmada en una actividad institucional. Es la unica situacion de actividad que suma afinidad (§51.2).'
      WHERE "code" = 'activity_confirmed'
    `);
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "points" = 0.00,
        "description" = 'Una evidencia mejora el respaldo del proyecto o de la actividad que acompana. No crea una experiencia mas (§55).'
      WHERE "code" = 'evidence'
    `);

    // Codigos que V2 sustituye. No se borran: hay contribuciones historicas
    // que los referencian y borrarlos dejaria el desglose pasado sin sentido.
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "is_active" = false, "points" = 0.00
      WHERE "code" IN ('interest', 'project_owned', 'project_member', 'certificate')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "affinity_weights" WHERE "code" IN (
        'interest_priority_1', 'interest_priority_2', 'interest_priority_3',
        'interest_priority_4', 'interest_priority_5',
        'project_declared', 'project_supported', 'project_corroborated',
        'project_reviewed', 'project_flagged',
        'certificate_declared', 'certificate_supported', 'certificate_corroborated'
      )
    `);
    await queryRunner.query(`
      UPDATE "affinity_weights" SET "is_active" = true WHERE "code" IN (
        'interest', 'project_owned', 'project_member', 'certificate'
      )
    `);
    await queryRunner.query(`UPDATE "affinity_weights" SET "points" = 2.00 WHERE "code" = 'interest'`);
    await queryRunner.query(`UPDATE "affinity_weights" SET "points" = 5.00 WHERE "code" = 'project_owned'`);
    await queryRunner.query(`UPDATE "affinity_weights" SET "points" = 5.00 WHERE "code" = 'project_member'`);
    await queryRunner.query(`UPDATE "affinity_weights" SET "points" = 4.00 WHERE "code" = 'certificate'`);
    await queryRunner.query(`UPDATE "affinity_weights" SET "points" = 1.00 WHERE "code" = 'skill_basic'`);
    await queryRunner.query(`UPDATE "affinity_weights" SET "points" = 2.00 WHERE "code" = 'skill_intermediate'`);
    await queryRunner.query(`UPDATE "affinity_weights" SET "points" = 3.00 WHERE "code" = 'skill_advanced'`);
    await queryRunner.query(`UPDATE "affinity_weights" SET "points" = 3.00 WHERE "code" = 'activity_confirmed'`);
    await queryRunner.query(`UPDATE "affinity_weights" SET "points" = 2.00 WHERE "code" = 'evidence'`);

    // Las contribuciones con codigos nuevos no caben en el enum anterior. Se
    // eliminan porque describen el ULTIMO calculo, que se rehara al volver al
    // motor V1; la historia vive en las instantaneas, que no se tocan.
    await queryRunner.query(`
      DELETE FROM "affinity_contributions" WHERE "weight_code"::text IN (
        'interest_priority_1', 'interest_priority_2', 'interest_priority_3',
        'interest_priority_4', 'interest_priority_5',
        'project_declared', 'project_supported', 'project_corroborated',
        'project_reviewed', 'project_flagged',
        'certificate_declared', 'certificate_supported', 'certificate_corroborated'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "affinity_snapshot_items"
        DROP COLUMN IF EXISTS "support_level",
        DROP COLUMN IF EXISTS "support_score",
        DROP COLUMN IF EXISTS "raw_points"
    `);
    await queryRunner.query(`
      ALTER TABLE "affinity_snapshots"
        DROP COLUMN IF EXISTS "average_support",
        DROP COLUMN IF EXISTS "engine_version"
    `);
    // Las explicaciones de V2 son mas largas que el limite anterior, asi que
    // encogerlas a secas falla. Se recortan primero: describen el ULTIMO
    // calculo, que se rehace entero al volver al motor V1, de modo que el
    // recorte no pierde nada que no se vaya a reescribir.
    await queryRunner.query(`
      UPDATE "affinity_contributions"
        SET "source_label" = left("source_label", 200)
      WHERE length("source_label") > 200
    `);
    await queryRunner.query(`
      ALTER TABLE "affinity_contributions"
        ALTER COLUMN "source_label" TYPE character varying(200)
    `);
    await queryRunner.query(`
      ALTER TABLE "affinity_contributions"
        DROP COLUMN IF EXISTS "engine_version",
        DROP COLUMN IF EXISTS "support_points",
        DROP COLUMN IF EXISTS "multiplier",
        DROP COLUMN IF EXISTS "raw_points",
        DROP COLUMN IF EXISTS "source_entity_type",
        DROP COLUMN IF EXISTS "signal_family"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_affinity_results_engine"`);
    await queryRunner.query(`
      ALTER TABLE "affinity_results"
        DROP COLUMN IF EXISTS "engine_version",
        DROP COLUMN IF EXISTS "support_families",
        DROP COLUMN IF EXISTS "support_level",
        DROP COLUMN IF EXISTS "support_score",
        DROP COLUMN IF EXISTS "raw_points"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."affinity_source_entity_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."affinity_signal_family_enum"`);

    await queryRunner.query(`
      ALTER TYPE "public"."affinity_weight_code_enum" RENAME TO "affinity_weight_code_enum_v2"
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."affinity_weight_code_enum" AS ENUM(
        'interest', 'improvement_area',
        'skill_basic', 'skill_intermediate', 'skill_advanced',
        'activity_interested', 'activity_registered', 'activity_confirmed',
        'project_owned', 'project_member',
        'evidence', 'certificate', 'constancy'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "affinity_weights"
        ALTER COLUMN "code" TYPE "public"."affinity_weight_code_enum"
        USING "code"::text::"public"."affinity_weight_code_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "affinity_contributions"
        ALTER COLUMN "weight_code" TYPE "public"."affinity_weight_code_enum"
        USING "weight_code"::text::"public"."affinity_weight_code_enum"
    `);
    await queryRunner.query(`DROP TYPE "public"."affinity_weight_code_enum_v2"`);
  }
}
