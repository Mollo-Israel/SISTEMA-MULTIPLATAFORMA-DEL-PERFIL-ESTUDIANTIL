import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Objetivo 4 - Participacion, evidencias y constancias.
 *
 *  - project_evidences: la evidencia pasa a pertenecer al perfil del estudiante
 *    y puede asociarse a un proyecto, a una actividad o a un area academica,
 *    segun lo que respalde (RF11). Se agregan los metadatos del archivo subido.
 *    Las filas existentes heredan el perfil del creador de su proyecto, de modo
 *    que no se pierde ninguna evidencia ya registrada.
 *  - external_certificates: archivo adjunto, area academica y descripcion.
 *  - internal_constancies: una sola constancia por estudiante y actividad (RF12).
 */
export class Objective4EvidenceAndConstancies1780210000000 implements MigrationInterface {
  name = 'Objective4EvidenceAndConstancies1780210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------------- Evidencias ----------------
    await queryRunner.query(
      `ALTER TABLE "project_evidences" ADD "student_profile_id" uuid`,
    );
    // Backfill: la evidencia queda a nombre del estudiante dueno del proyecto.
    await queryRunner.query(`
      UPDATE "project_evidences" e
         SET "student_profile_id" = p."created_by_profile_id"
        FROM "projects" p
       WHERE p."id" = e."project_id"
    `);
    // Cualquier fila que hubiera quedado sin dueno no puede migrarse: se elimina
    // solo si su proyecto ya no existe (huerfana por datos previos).
    await queryRunner.query(
      `DELETE FROM "project_evidences" WHERE "student_profile_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_evidences" ALTER COLUMN "student_profile_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_evidences" ALTER COLUMN "project_id" DROP NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "project_evidences" ADD "activity_id" uuid`);
    await queryRunner.query(`ALTER TABLE "project_evidences" ADD "academic_area_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "project_evidences" ADD "file_name" character varying(160)`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_evidences" ADD "mime_type" character varying(120)`,
    );
    await queryRunner.query(`ALTER TABLE "project_evidences" ADD "file_size" integer`);

    await queryRunner.query(
      `CREATE INDEX "IDX_evidence_student_profile" ON "project_evidences" ("student_profile_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_evidence_activity" ON "project_evidences" ("activity_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_evidence_area" ON "project_evidences" ("academic_area_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "project_evidences"
        ADD CONSTRAINT "FK_evidence_student_profile"
        FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "project_evidences"
        ADD CONSTRAINT "FK_evidence_activity"
        FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "project_evidences"
        ADD CONSTRAINT "FK_evidence_area"
        FOREIGN KEY ("academic_area_id") REFERENCES "academic_areas"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // ---------------- Certificados externos ----------------
    await queryRunner.query(
      `ALTER TABLE "external_certificates" ADD "description" character varying(300)`,
    );
    await queryRunner.query(`ALTER TABLE "external_certificates" ADD "academic_area_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "external_certificates" ADD "file_url" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "external_certificates" ADD "file_name" character varying(160)`,
    );
    await queryRunner.query(
      `ALTER TABLE "external_certificates" ADD "mime_type" character varying(120)`,
    );
    await queryRunner.query(`ALTER TABLE "external_certificates" ADD "file_size" integer`);
    await queryRunner.query(
      `CREATE INDEX "IDX_certificate_area" ON "external_certificates" ("academic_area_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "external_certificates"
        ADD CONSTRAINT "FK_certificate_area"
        FOREIGN KEY ("academic_area_id") REFERENCES "academic_areas"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // ---------------- Constancias internas ----------------
    // Una constancia por estudiante y actividad. Indice parcial: las constancias
    // sin actividad asociada no entran en la restriccion.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_constancy_student_activity"
        ON "internal_constancies" ("student_profile_id", "activity_id")
        WHERE "activity_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."uq_constancy_student_activity"`);

    await queryRunner.query(
      `ALTER TABLE "external_certificates" DROP CONSTRAINT "FK_certificate_area"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_certificate_area"`);
    await queryRunner.query(`ALTER TABLE "external_certificates" DROP COLUMN "file_size"`);
    await queryRunner.query(`ALTER TABLE "external_certificates" DROP COLUMN "mime_type"`);
    await queryRunner.query(`ALTER TABLE "external_certificates" DROP COLUMN "file_name"`);
    await queryRunner.query(`ALTER TABLE "external_certificates" DROP COLUMN "file_url"`);
    await queryRunner.query(`ALTER TABLE "external_certificates" DROP COLUMN "academic_area_id"`);
    await queryRunner.query(`ALTER TABLE "external_certificates" DROP COLUMN "description"`);

    await queryRunner.query(
      `ALTER TABLE "project_evidences" DROP CONSTRAINT "FK_evidence_area"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_evidences" DROP CONSTRAINT "FK_evidence_activity"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_evidences" DROP CONSTRAINT "FK_evidence_student_profile"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_evidence_area"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_evidence_activity"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_evidence_student_profile"`);
    await queryRunner.query(`ALTER TABLE "project_evidences" DROP COLUMN "file_size"`);
    await queryRunner.query(`ALTER TABLE "project_evidences" DROP COLUMN "mime_type"`);
    await queryRunner.query(`ALTER TABLE "project_evidences" DROP COLUMN "file_name"`);
    await queryRunner.query(`ALTER TABLE "project_evidences" DROP COLUMN "academic_area_id"`);
    await queryRunner.query(`ALTER TABLE "project_evidences" DROP COLUMN "activity_id"`);
    // Las evidencias sin proyecto no caben en el esquema anterior.
    await queryRunner.query(`DELETE FROM "project_evidences" WHERE "project_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "project_evidences" ALTER COLUMN "project_id" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "project_evidences" DROP COLUMN "student_profile_id"`);
  }
}
