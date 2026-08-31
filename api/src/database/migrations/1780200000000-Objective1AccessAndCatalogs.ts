import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Objetivo 1 - Gestion de usuarios, roles y control de acceso.
 *
 *  - teacher_semester_access: semestres habilitados por docente (RF3), relacion
 *    N:M normalizada entre users y semestre, con auditoria de quien la otorgo.
 *  - gamification_criteria: administracion persistente del criterio (RF4). No es
 *    consumida por ningun modulo en el 40%; queda lista para la fase posterior.
 *  - is_active en academic_areas y skills: estado de catalogo (RF4).
 */
export class Objective1AccessAndCatalogs1780200000000 implements MigrationInterface {
  name = 'Objective1AccessAndCatalogs1780200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Estado de catalogo ---
    await queryRunner.query(
      `ALTER TABLE "academic_areas" ADD "is_active" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "skills" ADD "is_active" boolean NOT NULL DEFAULT true`,
    );

    // --- Semestres habilitados por docente ---
    await queryRunner.query(`
      CREATE TABLE "teacher_semester_access" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "teacher_id" uuid NOT NULL,
        "semester" smallint NOT NULL,
        "granted_by" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "chk_teacher_semester_range" CHECK ("semester" >= 1 AND "semester" <= 8),
        CONSTRAINT "uq_teacher_semester" UNIQUE ("teacher_id", "semester"),
        CONSTRAINT "PK_teacher_semester_access" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_teacher_semester_teacher" ON "teacher_semester_access" ("teacher_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "teacher_semester_access"
        ADD CONSTRAINT "FK_teacher_semester_teacher"
        FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "teacher_semester_access"
        ADD CONSTRAINT "FK_teacher_semester_granted_by"
        FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // --- Criterios de gamificacion (administrables, aun no consumidos) ---
    await queryRunner.query(`
      CREATE TYPE "public"."gamification_criteria_trigger_enum" AS ENUM(
        'participacion_confirmada',
        'proyecto_registrado',
        'evidencia_adjunta',
        'certificado_externo',
        'constancia_interna',
        'perfil_completo'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "gamification_criteria" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(60) NOT NULL,
        "name" character varying(120) NOT NULL,
        "description" character varying(300),
        "trigger" "public"."gamification_criteria_trigger_enum" NOT NULL,
        "points" integer NOT NULL DEFAULT 0,
        "academic_area_id" uuid,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "chk_gamification_points" CHECK ("points" >= 0 AND "points" <= 1000),
        CONSTRAINT "PK_gamification_criteria" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_gamification_criteria_code" ON "gamification_criteria" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_gamification_criteria_area" ON "gamification_criteria" ("academic_area_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "gamification_criteria"
        ADD CONSTRAINT "FK_gamification_criteria_area"
        FOREIGN KEY ("academic_area_id") REFERENCES "academic_areas"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gamification_criteria" DROP CONSTRAINT "FK_gamification_criteria_area"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_gamification_criteria_area"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_gamification_criteria_code"`);
    await queryRunner.query(`DROP TABLE "gamification_criteria"`);
    await queryRunner.query(`DROP TYPE "public"."gamification_criteria_trigger_enum"`);

    await queryRunner.query(
      `ALTER TABLE "teacher_semester_access" DROP CONSTRAINT "FK_teacher_semester_granted_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teacher_semester_access" DROP CONSTRAINT "FK_teacher_semester_teacher"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_teacher_semester_teacher"`);
    await queryRunner.query(`DROP TABLE "teacher_semester_access"`);

    await queryRunner.query(`ALTER TABLE "skills" DROP COLUMN "is_active"`);
    await queryRunner.query(`ALTER TABLE "academic_areas" DROP COLUMN "is_active"`);
  }
}
