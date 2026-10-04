import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quién emite y quién autoriza una constancia interna (especificación V2 §30).
 *
 * Desde la V2 una constancia la puede emitir el responsable de la actividad
 * cuando Dirección aprobó la actividad con constancias habilitadas. Entonces
 * hay dos personas: quien la emite (`issued_by`) y quien la autorizó
 * (`authorized_by`, la Dirección que aprobó). Las existentes las emitió y
 * autorizó la misma persona: se rellena `issued_by` con `authorized_by`.
 */
export class V2ConstancyIssuer1780410100000 implements MigrationInterface {
  name = 'V2ConstancyIssuer1780410100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "internal_constancies"
        ADD "issued_by" uuid,
        ADD CONSTRAINT "fk_constancy_issuer" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE SET NULL`);
    await queryRunner.query(`UPDATE "internal_constancies" SET "issued_by" = "authorized_by"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "internal_constancies"
        DROP CONSTRAINT "fk_constancy_issuer",
        DROP COLUMN "issued_by"`);
  }
}
