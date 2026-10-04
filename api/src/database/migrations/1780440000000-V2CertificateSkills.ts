import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tecnologías de un certificado externo (especificación V2 §41, `skills[]`).
 *
 * Tabla puente con clave compuesta: un certificado no repite una tecnología.
 * Los certificados existentes quedan sin tecnologías; nada se infiere.
 */
export class V2CertificateSkills1780440000000 implements MigrationInterface {
  name = 'V2CertificateSkills1780440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "external_certificate_skills" (
        "certificate_id" uuid NOT NULL,
        "skill_id" uuid NOT NULL,
        CONSTRAINT "pk_external_certificate_skills" PRIMARY KEY ("certificate_id", "skill_id"),
        CONSTRAINT "fk_cert_skill_certificate" FOREIGN KEY ("certificate_id")
          REFERENCES "external_certificates"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_cert_skill_skill" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_cert_skills_skill" ON "external_certificate_skills" ("skill_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "external_certificate_skills"`);
  }
}
