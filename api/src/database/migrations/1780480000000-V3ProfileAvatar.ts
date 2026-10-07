import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3 BATCH 5 · Avatar de catálogo (§11.2).
 *
 * Solo se guarda la clave de la ilustración elegida (`AVATAR_KEYS`); la lista
 * la valida la API, no la base, para poder ampliarla sin migrar. Nulo = sin
 * avatar, que se dibuja con las iniciales.
 */
export class V3ProfileAvatar1780480000000 implements MigrationInterface {
  name = 'V3ProfileAvatar1780480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "student_profiles" ADD COLUMN "avatar_key" varchar(40) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "student_profiles" DROP COLUMN "avatar_key"`);
  }
}
