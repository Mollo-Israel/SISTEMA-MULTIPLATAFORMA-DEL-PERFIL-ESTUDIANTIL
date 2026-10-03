import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fechas con zona horaria (correcciones de QA).
 *
 * Las tablas de las primeras etapas guardaban `created_at`, `updated_at` y
 * `calculated_at` como `timestamp` **sin** zona. La base corre en UTC, así que
 * lo guardado es la hora UTC; pero el controlador de PostgreSQL lee un
 * `timestamp` sin zona como hora *local* del servidor de la API —Bolivia,
 * UTC−4— y todas esas fechas aparecían cuatro horas adelantadas en pantalla.
 *
 * Se convierten a `timestamptz` diciendo explícitamente que lo guardado es UTC.
 * El instante no cambia; cambia que ahora se lee bien en cualquier zona.
 */
const COLUMNAS: [string, string][] = [
  ['academic_areas', 'created_at'], ['academic_areas', 'updated_at'],
  ['activities', 'created_at'], ['activities', 'updated_at'],
  ['activity_categories', 'created_at'], ['activity_categories', 'updated_at'],
  ['activity_registrations', 'created_at'], ['activity_registrations', 'updated_at'],
  ['affinity_contributions', 'created_at'],
  ['affinity_results', 'calculated_at'], ['affinity_results', 'updated_at'],
  ['affinity_snapshots', 'calculated_at'],
  ['affinity_weights', 'created_at'], ['affinity_weights', 'updated_at'],
  ['external_certificates', 'created_at'],
  ['gamification_criteria', 'created_at'], ['gamification_criteria', 'updated_at'],
  ['internal_constancies', 'created_at'],
  ['project_evidences', 'created_at'],
  ['project_feedback', 'created_at'], ['project_feedback', 'updated_at'],
  ['project_invitations', 'created_at'], ['project_invitations', 'updated_at'],
  ['project_members', 'created_at'],
  ['projects', 'created_at'], ['projects', 'updated_at'],
  ['recommendations', 'created_at'], ['recommendations', 'updated_at'],
  ['roles', 'created_at'], ['roles', 'updated_at'],
  ['skills', 'created_at'], ['skills', 'updated_at'],
  ['student_free_interests', 'created_at'], ['student_free_interests', 'updated_at'],
  ['student_interests', 'created_at'], ['student_interests', 'updated_at'],
  ['student_profiles', 'created_at'], ['student_profiles', 'updated_at'],
  ['student_skills', 'created_at'], ['student_skills', 'updated_at'],
  ['teacher_semester_access', 'created_at'],
  ['users', 'created_at'], ['users', 'updated_at'],
];

export class QaTimestampsWithTimeZone1780370500000 implements MigrationInterface {
  name = 'QaTimestampsWithTimeZone1780370500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [tabla, columna] of COLUMNAS) {
      await queryRunner.query(
        `ALTER TABLE "${tabla}" ALTER COLUMN "${columna}" TYPE timestamptz USING "${columna}" AT TIME ZONE 'UTC'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [tabla, columna] of COLUMNAS) {
      await queryRunner.query(
        `ALTER TABLE "${tabla}" ALTER COLUMN "${columna}" TYPE timestamp USING "${columna}" AT TIME ZONE 'UTC'`,
      );
    }
  }
}
