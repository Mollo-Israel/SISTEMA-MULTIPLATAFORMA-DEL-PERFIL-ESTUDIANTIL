import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cola de correos de cuenta (correcciones de QA).
 *
 * Ver `MailJob`: guarda la intención de enviar, no el mensaje, así que nunca
 * contiene un enlace o un código de activación utilizable.
 */
export class QaMailJobs1780370100000 implements MigrationInterface {
  name = 'QaMailJobs1780370100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "mail_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "kind" varchar(30) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "last_error" varchar(300),
        "next_attempt_at" timestamptz NOT NULL DEFAULT now(),
        "requested_by" uuid,
        "sent_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_mail_jobs" PRIMARY KEY ("id"),
        CONSTRAINT "fk_mail_jobs_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "ck_mail_jobs_kind" CHECK ("kind" IN ('account_activation', 'password_reset')),
        CONSTRAINT "ck_mail_jobs_status"
          CHECK ("status" IN ('pending', 'sending', 'sent', 'failed', 'skipped'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_mail_jobs_status_next" ON "mail_jobs" ("status", "next_attempt_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_mail_jobs_user_kind_created" ON "mail_jobs" ("user_id", "kind", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "mail_jobs"`);
  }
}
