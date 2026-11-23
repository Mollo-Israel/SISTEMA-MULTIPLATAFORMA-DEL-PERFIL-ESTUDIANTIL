import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V9 · Correos personales comprobados (validación reforzada de credenciales).
 *
 * Aditiva. Un correo comprobado pertenece a un solo usuario: lo garantiza un
 * índice único parcial, no solo el código de la aplicación.
 */
export class V9VerifiedEmails1780890000000 implements MigrationInterface {
  name = 'V9VerifiedEmails1780890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "student_verified_emails" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "email" varchar(254) NOT NULL,
        "code_hash" char(64) NULL,
        "code_expires_at" timestamptz NULL,
        "attempts" smallint NOT NULL DEFAULT 0,
        "sent_count" smallint NOT NULL DEFAULT 0,
        "last_sent_at" timestamptz NULL,
        "verified_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student_verified_emails" PRIMARY KEY ("id"),
        CONSTRAINT "FK_student_verified_emails_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CK_student_verified_emails_minusculas" CHECK ("email" = lower("email"))
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_student_verified_emails_usuario_correo" ON "student_verified_emails" ("user_id", "email")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_student_verified_emails_comprobado" ON "student_verified_emails" ("email") WHERE "verified_at" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "student_verified_emails"`);
  }
}
