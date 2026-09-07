import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Objetivo 6 - Motor de afinidad estudiantil (RF17, RN-14, RN-15).
 *
 * El motor ya existia y calculaba puntajes. Lo que faltaba era lo que hace que
 * un motor de orientacion sea defendible:
 *
 *  - affinity_weights: RN-14 exige "mecanismos de ponderacion definidos para el
 *    sistema". Estaban incrustados como constante en el codigo fuente, donde no
 *    eran ni visibles ni auditables. Ahora son filas, y la migracion las siembra
 *    con exactamente los mismos valores que ya usaba el motor, para que este
 *    cambio no altere ningun puntaje existente.
 *
 *  - affinity_contributions: el desglose que explica cada puntaje. RN-15 dice
 *    que la afinidad es orientacion; una orientacion que no se puede explicar
 *    es una caja negra.
 *
 *  - affinity_snapshots y sus items: RF17 pide "calcular, ACTUALIZAR y
 *    consultar". Sin historial, actualizar es solo sobrescribir.
 *
 * PRESERVACION: no se toca affinity_results. Los resultados vigentes de cada
 * estudiante se conservan intactos; las tablas nuevas los acompanan, no los
 * reemplazan.
 */
export class Objective6AffinityEngine1780260000000 implements MigrationInterface {
  name = 'Objective6AffinityEngine1780260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------
    // Tipos compartidos por las tres tablas
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TYPE "public"."affinity_signal_type_enum" AS ENUM(
        'interest', 'skill', 'improvement_area', 'activity',
        'project', 'evidence', 'certificate', 'constancy'
      )
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
      CREATE TYPE "public"."affinity_match_type_enum" AS ENUM(
        'declared', 'tag', 'text', 'inherited'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."affinity_calculation_status_enum" AS ENUM(
        'calculated', 'insufficient_data'
      )
    `);

    // ------------------------------------------------------------------
    // RN-14 · Ponderaciones del motor
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "affinity_weights" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" "public"."affinity_weight_code_enum" NOT NULL,
        "signal_type" "public"."affinity_signal_type_enum" NOT NULL,
        "points" numeric(5,2) NOT NULL,
        "label" character varying(120) NOT NULL,
        "description" character varying(400) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_affinity_weights" PRIMARY KEY ("id"),
        CONSTRAINT "uq_affinity_weight_code" UNIQUE ("code"),
        CONSTRAINT "chk_affinity_weight_points" CHECK ("points" >= 0 AND "points" <= 100)
      )
    `);

    // Los valores replican exactamente la constante POINTS que el motor usaba
    // antes de esta migracion, de modo que ningun puntaje cambia al migrar.
    await queryRunner.query(`
      INSERT INTO "affinity_weights" ("code", "signal_type", "points", "label", "description") VALUES
        ('interest', 'interest', 2.00,
         'Interes declarado',
         'El estudiante declaro explicitamente interes en el area dentro de su perfil.'),
        ('improvement_area', 'improvement_area', 1.00,
         'Area en la que desea mejorar',
         'Declarada por el estudiante como area de crecimiento. Pondera menos que un interes porque expresa una intencion, no una trayectoria.'),
        ('skill_basic', 'skill', 1.00,
         'Habilidad de nivel basico',
         'Habilidad declarada con nivel 1 o 2 asociada al area.'),
        ('skill_intermediate', 'skill', 2.00,
         'Habilidad de nivel intermedio',
         'Habilidad declarada con nivel 3 asociada al area.'),
        ('skill_advanced', 'skill', 3.00,
         'Habilidad de nivel avanzado',
         'Habilidad declarada con nivel 4 o 5 asociada al area.'),
        ('activity_interested', 'activity', 1.00,
         'Interes en una actividad',
         'El estudiante marco interes pero aun no se inscribio. Es la senal mas debil de participacion.'),
        ('activity_registered', 'activity', 2.00,
         'Inscripcion en una actividad',
         'El estudiante se inscribio en la actividad del area.'),
        ('activity_confirmed', 'activity', 3.00,
         'Participacion confirmada',
         'El responsable confirmo la asistencia. Es participacion verificada, no declarada, y por eso pondera mas.'),
        ('project_owned', 'project', 5.00,
         'Proyecto propio',
         'Proyecto del portafolio del que el estudiante es responsable. Es la senal individual mas fuerte: implica trabajo sostenido y verificable.'),
        ('project_member', 'project', 5.00,
         'Proyecto como integrante',
         'Proyecto en el que el estudiante participa por haber aceptado una invitacion. Una invitacion pendiente o rechazada no genera pertenencia y no suma.'),
        ('evidence', 'evidence', 2.00,
         'Evidencia academica',
         'Evidencia cargada por el estudiante que respalda su trabajo en el area.'),
        ('certificate', 'certificate', 4.00,
         'Certificado externo',
         'Certificado externo adjuntado al perfil. Pondera alto porque proviene de una entidad ajena a la plataforma.'),
        ('constancy', 'constancy', 3.00,
         'Constancia interna',
         'Constancia emitida por el director de carrera sobre participacion confirmada.')
    `);

    // ------------------------------------------------------------------
    // RF17 · Desglose explicativo del calculo vigente
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "affinity_contributions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "student_profile_id" uuid NOT NULL,
        "academic_area_id" uuid NOT NULL,
        "signal_type" "public"."affinity_signal_type_enum" NOT NULL,
        "weight_code" "public"."affinity_weight_code_enum" NOT NULL,
        "match_type" "public"."affinity_match_type_enum" NOT NULL,
        "points" numeric(5,2) NOT NULL,
        "source_label" character varying(200) NOT NULL,
        "source_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_affinity_contributions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_affinity_contribution_profile" ON "affinity_contributions" ("student_profile_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_affinity_contribution_area" ON "affinity_contributions" ("academic_area_id")`,
    );
    await queryRunner.query(`
      CREATE INDEX "idx_affinity_contribution_profile_area"
        ON "affinity_contributions" ("student_profile_id", "academic_area_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "affinity_contributions"
        ADD CONSTRAINT "FK_affinity_contribution_profile"
        FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "affinity_contributions"
        ADD CONSTRAINT "FK_affinity_contribution_area"
        FOREIGN KEY ("academic_area_id") REFERENCES "academic_areas"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // ------------------------------------------------------------------
    // RF17 · Historial de calculos
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "affinity_snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "student_profile_id" uuid NOT NULL,
        "status" "public"."affinity_calculation_status_enum" NOT NULL,
        "total_score" numeric(8,2) NOT NULL DEFAULT 0,
        "areas_count" smallint NOT NULL DEFAULT 0,
        "signals_count" smallint NOT NULL DEFAULT 0,
        "rules_version" character varying(64) NOT NULL,
        "calculated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_affinity_snapshots" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_affinity_snapshot_profile" ON "affinity_snapshots" ("student_profile_id")`,
    );
    await queryRunner.query(`
      CREATE INDEX "idx_affinity_snapshot_profile_date"
        ON "affinity_snapshots" ("student_profile_id", "calculated_at")
    `);
    await queryRunner.query(`
      ALTER TABLE "affinity_snapshots"
        ADD CONSTRAINT "FK_affinity_snapshot_profile"
        FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "affinity_snapshot_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "snapshot_id" uuid NOT NULL,
        "academic_area_id" uuid NOT NULL,
        "score" numeric(6,2) NOT NULL,
        "level" "public"."affinity_results_level_enum" NOT NULL,
        "rank" smallint NOT NULL,
        CONSTRAINT "PK_affinity_snapshot_items" PRIMARY KEY ("id"),
        CONSTRAINT "uq_affinity_snapshot_item" UNIQUE ("snapshot_id", "academic_area_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_affinity_snapshot_item_snapshot" ON "affinity_snapshot_items" ("snapshot_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_affinity_snapshot_item_area" ON "affinity_snapshot_items" ("academic_area_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "affinity_snapshot_items"
        ADD CONSTRAINT "FK_affinity_snapshot_item_snapshot"
        FOREIGN KEY ("snapshot_id") REFERENCES "affinity_snapshots"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "affinity_snapshot_items"
        ADD CONSTRAINT "FK_affinity_snapshot_item_area"
        FOREIGN KEY ("academic_area_id") REFERENCES "academic_areas"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "affinity_snapshot_items" DROP CONSTRAINT "FK_affinity_snapshot_item_area"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affinity_snapshot_items" DROP CONSTRAINT "FK_affinity_snapshot_item_snapshot"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_affinity_snapshot_item_area"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_affinity_snapshot_item_snapshot"`);
    await queryRunner.query(`DROP TABLE "affinity_snapshot_items"`);

    await queryRunner.query(
      `ALTER TABLE "affinity_snapshots" DROP CONSTRAINT "FK_affinity_snapshot_profile"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_affinity_snapshot_profile_date"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_affinity_snapshot_profile"`);
    await queryRunner.query(`DROP TABLE "affinity_snapshots"`);

    await queryRunner.query(
      `ALTER TABLE "affinity_contributions" DROP CONSTRAINT "FK_affinity_contribution_area"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affinity_contributions" DROP CONSTRAINT "FK_affinity_contribution_profile"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_affinity_contribution_profile_area"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_affinity_contribution_area"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_affinity_contribution_profile"`);
    await queryRunner.query(`DROP TABLE "affinity_contributions"`);

    await queryRunner.query(`DROP TABLE "affinity_weights"`);

    await queryRunner.query(`DROP TYPE "public"."affinity_calculation_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."affinity_match_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."affinity_weight_code_enum"`);
    await queryRunner.query(`DROP TYPE "public"."affinity_signal_type_enum"`);
  }
}
