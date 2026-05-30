import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameRoleValues1780172000000 implements MigrationInterface {
  name = 'RenameRoleValues1780172000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "roles_name_enum" RENAME VALUE 'ESTUDIANTE' TO 'STUDENT'`);
    await queryRunner.query(`ALTER TYPE "roles_name_enum" RENAME VALUE 'DOCENTE' TO 'TEACHER'`);
    await queryRunner.query(`ALTER TYPE "roles_name_enum" RENAME VALUE 'DIRECTOR' TO 'CAREER_DIRECTOR'`);
    await queryRunner.query(`ALTER TYPE "roles_name_enum" RENAME VALUE 'SOCIEDAD_CIENTIFICA' TO 'SCIENTIFIC_SOCIETY'`);
    await queryRunner.query(`ALTER TYPE "roles_name_enum" RENAME VALUE 'ADMINISTRADOR' TO 'ADMIN'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "roles_name_enum" RENAME VALUE 'ADMIN' TO 'ADMINISTRADOR'`);
    await queryRunner.query(`ALTER TYPE "roles_name_enum" RENAME VALUE 'SCIENTIFIC_SOCIETY' TO 'SOCIEDAD_CIENTIFICA'`);
    await queryRunner.query(`ALTER TYPE "roles_name_enum" RENAME VALUE 'CAREER_DIRECTOR' TO 'DIRECTOR'`);
    await queryRunner.query(`ALTER TYPE "roles_name_enum" RENAME VALUE 'TEACHER' TO 'DOCENTE'`);
    await queryRunner.query(`ALTER TYPE "roles_name_enum" RENAME VALUE 'STUDENT' TO 'ESTUDIANTE'`);
  }
}
