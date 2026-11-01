import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V6 BATCH 11 · Foto opcional del estudiante (§8.3).
 *
 * Aditiva. La foto es un archivo subido por el propio estudiante; si el
 * archivo se borra, el perfil vuelve al avatar. Que se vea en el perfil
 * compartido lo decide la casilla «Mi foto» (campo `photo` de la
 * visibilidad pública), que nace apagada.
 */
export class V6ProfilePhoto1780870000000 implements MigrationInterface {
  name = 'V6ProfilePhoto1780870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "student_profiles" ADD "photo_file_id" uuid NULL`);
    await queryRunner.query(`
      ALTER TABLE "student_profiles"
        ADD CONSTRAINT "FK_student_profiles_photo_file"
        FOREIGN KEY ("photo_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "student_profiles" DROP CONSTRAINT "FK_student_profiles_photo_file"`);
    await queryRunner.query(`ALTER TABLE "student_profiles" DROP COLUMN "photo_file_id"`);
  }
}
