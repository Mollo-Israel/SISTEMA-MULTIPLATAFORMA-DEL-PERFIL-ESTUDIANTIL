import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Perfil institucional y asistente de bienvenida (correcciones de QA).
 *
 * - `claimed_at`: cuándo el estudiante empezó su perfil. El alta —por padrón
 *   o desde administración— crea el perfil con sus datos institucionales
 *   (semestre, código); el estudiante lo «reclama» al completar lo suyo. Sin
 *   esta marca no se distinguía un perfil recién creado por la institución de
 *   uno que el estudiante ya trabajó.
 * - `onboarding_step` y `onboarding_completed_at`: por dónde va y cuándo
 *   terminó el asistente de bienvenida. Hasta terminarlo, el resto del sistema
 *   no se le muestra: casi todo depende de tener el perfil.
 *
 * Los perfiles que ya tienen contenido se dan por reclamados y con el
 * asistente terminado: a quien ya usa el sistema no se le hace repetir la
 * bienvenida.
 */
export class QaProfileOnboarding1780370200000 implements MigrationInterface {
  name = 'QaProfileOnboarding1780370200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "student_profiles" ADD COLUMN "claimed_at" timestamptz`);
    await queryRunner.query(`ALTER TABLE "student_profiles" ADD COLUMN "onboarding_step" varchar(30)`);
    await queryRunner.query(
      `ALTER TABLE "student_profiles" ADD COLUMN "onboarding_completed_at" timestamptz`,
    );

    // Reclamado: lo que tenga algo escrito por el estudiante.
    await queryRunner.query(`
      UPDATE "student_profiles" p
         SET "claimed_at" = p."created_at"
       WHERE (p."bio" IS NOT NULL AND btrim(p."bio") <> '')
          OR (p."improvement_area_ids" IS NOT NULL AND cardinality(p."improvement_area_ids") > 0)
          OR EXISTS (SELECT 1 FROM "student_interests" i WHERE i."student_profile_id" = p."id")
          OR EXISTS (SELECT 1 FROM "student_skills" s WHERE s."student_profile_id" = p."id")
    `);
    // Bienvenida terminada: los reclamados que ya declararon intereses.
    await queryRunner.query(`
      UPDATE "student_profiles" p
         SET "onboarding_completed_at" = p."claimed_at", "onboarding_step" = 'done'
       WHERE p."claimed_at" IS NOT NULL
         AND EXISTS (SELECT 1 FROM "student_interests" i WHERE i."student_profile_id" = p."id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "student_profiles" DROP COLUMN "onboarding_completed_at"`);
    await queryRunner.query(`ALTER TABLE "student_profiles" DROP COLUMN "onboarding_step"`);
    await queryRunner.query(`ALTER TABLE "student_profiles" DROP COLUMN "claimed_at"`);
  }
}
