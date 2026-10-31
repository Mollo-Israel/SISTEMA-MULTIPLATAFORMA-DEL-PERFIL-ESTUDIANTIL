import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V6 BATCH 1 · Responsable × semestre (§3.2).
 *
 * Aditiva. Cada responsable de una actividad queda asignado a semestres
 * concretos: un docente, solo dentro de su alcance; Dirección, Sociedad o
 * Administración, con la lista vacía, que significa «cubre toda la audiencia
 * de la actividad». Antes solo existía la unión (`activities.semester_scope`).
 *
 * Relleno con lo que ya era cierto:
 * - un docente queda con la intersección de su alcance y la audiencia (o con
 *   todo su alcance si la actividad no declaraba semestres);
 * - los demás roles, con la lista vacía.
 * No se borra ni se reescribe nada más: las asistencias registradas conservan
 * a quien las confirmó.
 */
export class V6ResponsibleSemesters1780850000000 implements MigrationInterface {
  name = 'V6ResponsibleSemesters1780850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activity_responsibles" ADD "semesters" smallint[] NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`
      UPDATE "activity_responsibles" ar
         SET "semesters" = COALESCE((
               SELECT array_agg(t."semester" ORDER BY t."semester")
                 FROM "teacher_semester_access" t
                WHERE t."teacher_id" = ar."user_id"
                  AND (a."semester_scope" IS NULL OR cardinality(a."semester_scope") = 0 OR t."semester" = ANY(a."semester_scope"))
             ), '{}')
        FROM "activities" a, "users" u, "roles" r
       WHERE a."id" = ar."activity_id" AND u."id" = ar."user_id" AND r."id" = u."role_id" AND r."name" = 'TEACHER'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activity_responsibles" DROP COLUMN IF EXISTS "semesters"`);
  }
}
