import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V5 BATCH 4 · Inscripción, admisión y asistencia son tres cosas (§6).
 *
 * Aditiva: el estado `rejected` (la solicitud no se admitió) y su motivo.
 * Ninguna fila cambia: las 'confirmed' siguen siendo asistencia y las
 * 'registered' siguen pendientes. `accepted` ya existía (V3 §15) y pasa a
 * significar también la admisión de una interna.
 *
 * `down` quita la columna y devuelve a 'registered' las solicitudes
 * rechazadas antes de recrear el tipo sin ese valor (Postgres no borra
 * valores de un enum).
 */
export class V5AdmissionAttendance1780760000000 implements MigrationInterface {
  name = 'V5AdmissionAttendance1780760000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "activity_registrations_status_enum" ADD VALUE IF NOT EXISTS 'rejected' AFTER 'accepted'`);
    await queryRunner.query(`ALTER TABLE "activity_registrations" ADD "decision_reason" varchar(300) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "activity_registrations" SET "status" = 'registered' WHERE "status" = 'rejected'`);
    await queryRunner.query(`ALTER TABLE "activity_registrations" DROP COLUMN IF EXISTS "decision_reason"`);
    await queryRunner.query(`ALTER TABLE "activity_registrations" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(`ALTER TYPE "activity_registrations_status_enum" RENAME TO "activity_registrations_status_enum_old"`);
    await queryRunner.query(`
      CREATE TYPE "activity_registrations_status_enum"
        AS ENUM ('interested', 'registered', 'accepted', 'confirmed', 'absent', 'cancelled')`);
    await queryRunner.query(`
      ALTER TABLE "activity_registrations" ALTER COLUMN "status"
        TYPE "activity_registrations_status_enum" USING "status"::text::"activity_registrations_status_enum"`);
    await queryRunner.query(`ALTER TABLE "activity_registrations" ALTER COLUMN "status" SET DEFAULT 'interested'`);
    await queryRunner.query(`DROP TYPE "activity_registrations_status_enum_old"`);
  }
}
