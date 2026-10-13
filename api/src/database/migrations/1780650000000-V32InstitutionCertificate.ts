import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3.2 BATCH 8 · Certificado emitido por la institución (§28.3).
 *
 * - `activities.certificate_issuer`: quién emite el certificado (Univalle, una
 *   facultad…). Afinia no se atribuye la autoría.
 * - `internal_constancies` pasa a guardar dos clases de documento:
 *   `internal_constancy` (la constancia que emite Afinia al confirmar) e
 *   `institution_certificate` (el que emite la institución y el responsable
 *   entrega), con su emisor real, el archivo y el código de verificación.
 *   Todo lo existente queda como `internal_constancy`.
 */
export class V32InstitutionCertificate1780650000000 implements MigrationInterface {
  name = 'V32InstitutionCertificate1780650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activities" ADD "certificate_issuer" varchar(200) NULL`);
    await queryRunner.query(`ALTER TABLE "internal_constancies" ADD "kind" varchar(30) NOT NULL DEFAULT 'internal_constancy'`);
    await queryRunner.query(`
      ALTER TABLE "internal_constancies" ADD CONSTRAINT "CHK_internal_constancies_kind"
        CHECK ("kind" IN ('internal_constancy', 'institution_certificate'))`);
    await queryRunner.query(`ALTER TABLE "internal_constancies" ADD "issuer_name" varchar(200) NULL`);
    await queryRunner.query(`ALTER TABLE "internal_constancies" ADD "stored_file_id" uuid NULL`);
    await queryRunner.query(`
      ALTER TABLE "internal_constancies" ADD CONSTRAINT "FK_internal_constancies_file"
        FOREIGN KEY ("stored_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE "internal_constancies" ADD "certificate_code" varchar(80) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Los certificados institucionales no existían antes: se quitan.
    await queryRunner.query(`DELETE FROM "internal_constancies" WHERE "kind" = 'institution_certificate'`);
    await queryRunner.query(`ALTER TABLE "internal_constancies" DROP COLUMN "certificate_code"`);
    await queryRunner.query(`ALTER TABLE "internal_constancies" DROP CONSTRAINT "FK_internal_constancies_file"`);
    await queryRunner.query(`ALTER TABLE "internal_constancies" DROP COLUMN "stored_file_id"`);
    await queryRunner.query(`ALTER TABLE "internal_constancies" DROP COLUMN "issuer_name"`);
    await queryRunner.query(`ALTER TABLE "internal_constancies" DROP CONSTRAINT "CHK_internal_constancies_kind"`);
    await queryRunner.query(`ALTER TABLE "internal_constancies" DROP COLUMN "kind"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "certificate_issuer"`);
  }
}
