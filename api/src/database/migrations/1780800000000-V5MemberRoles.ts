import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V5 BATCH 12 · Varios roles por integrante (V5-29, §4.4; G04).
 *
 * Aditiva: `roles` guarda 0..N roles del catálogo controlado. `role` se
 * conserva como el rol principal (el primero), así las pantallas, informes y
 * clientes anteriores siguen leyendo lo mismo. Un rol describe; no prueba
 * tecnologías ni suma afinidad.
 */
export class V5MemberRoles1780800000000 implements MigrationInterface {
  name = 'V5MemberRoles1780800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project_members" ADD "roles" varchar(40)[] NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`
      UPDATE "project_members" SET "roles" = ARRAY[left("role", 40)]
       WHERE "role" IS NOT NULL AND btrim("role") <> ''`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project_members" DROP COLUMN IF EXISTS "roles"`);
  }
}
