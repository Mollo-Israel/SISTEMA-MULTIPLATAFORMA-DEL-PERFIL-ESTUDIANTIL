import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V4.1 BATCH 4 · Asistencia independiente del fin del evento (A41-011, §5).
 *
 * Aditiva: `attendance_status` dice si el acta de asistencia sigue abierta
 * (`open`, también después de FINISHED: es la regularización) o ya se cerró
 * (`locked`). Todas las actividades existentes quedan `open`: nadie pierde la
 * posibilidad de registrar asistencia pendiente. `down` quita las columnas.
 */
export class V41AttendanceSettlement1780710000000 implements MigrationInterface {
  name = 'V41AttendanceSettlement1780710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activities" ADD "attendance_status" varchar(16) NOT NULL DEFAULT 'open'`);
    await queryRunner.query(`ALTER TABLE "activities" ADD "attendance_closed_at" TIMESTAMP WITH TIME ZONE NULL`);
    await queryRunner.query(`ALTER TABLE "activities" ADD "attendance_closed_by" uuid NULL`);
    await queryRunner.query(`
      ALTER TABLE "activities" ADD CONSTRAINT "CHK_activities_attendance_status"
        CHECK ("attendance_status" IN ('open', 'locked'))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activities" DROP CONSTRAINT IF EXISTS "CHK_activities_attendance_status"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "attendance_closed_by"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "attendance_closed_at"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "attendance_status"`);
  }
}
