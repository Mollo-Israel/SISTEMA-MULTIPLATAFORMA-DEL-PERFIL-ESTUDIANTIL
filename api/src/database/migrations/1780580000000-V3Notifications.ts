import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3 BATCH 16 · Centro de notificaciones (§33).
 *
 * Persiste `type`, `recipient`, `entity_type`, `entity_id`, `dedupe_key`,
 * `created_at`, `read_at` y `delivered_at` (§33.1). La clave de
 * deduplicación es única por destinatario: el mismo hecho no se notifica
 * dos veces aunque el evento se emita más de una vez.
 */
export class V3Notifications1780580000000 implements MigrationInterface {
  name = 'V3Notifications1780580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "recipient_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type" VARCHAR(60) NOT NULL,
        "entity_type" VARCHAR(60) NULL,
        "entity_id" UUID NULL,
        "title" VARCHAR(160) NOT NULL,
        "body" VARCHAR(500) NOT NULL,
        "link" VARCHAR(300) NULL,
        "dedupe_key" VARCHAR(200) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "read_at" TIMESTAMPTZ NULL,
        "delivered_at" TIMESTAMPTZ NULL,
        CONSTRAINT "uq_notification_dedupe" UNIQUE ("recipient_user_id", "dedupe_key")
      )`);
    await queryRunner.query(`
      CREATE INDEX "idx_notifications_inbox" ON "notifications" ("recipient_user_id", "read_at", "created_at" DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notifications"`);
  }
}
