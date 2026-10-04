import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Canales de contacto, nota por contacto y retiro del chat (V2 §56, §57, §59).
 *
 * - `student_contact_channels`: Teams, WhatsApp, LinkedIn, correo de contacto
 *   u otro enlace, cada uno con su casilla de perfil público.
 * - `contact_notes`: alias, contexto y canal preferido, una por dueño.
 * - Chat: §57 lo retira del alcance y pide no borrar historia sin auditoría.
 *   Las tablas `conversations`, `conversation_members` y `messages` se
 *   conservan tal cual, sin acceso funcional (la API ya no tiene rutas que las
 *   lean ni escriban), y se documenta en la propia base por qué siguen ahí.
 */
export class V2ContactChannelsAndChatRetirement1780430000000 implements MigrationInterface {
  name = 'V2ContactChannelsAndChatRetirement1780430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "student_contact_channels" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "student_profile_id" uuid NOT NULL,
        "channel" varchar(20) NOT NULL,
        "value" varchar(300) NOT NULL,
        "is_public" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_student_contact_channels" PRIMARY KEY ("id"),
        CONSTRAINT "uq_contact_channel" UNIQUE ("student_profile_id", "channel"),
        CONSTRAINT "ck_contact_channel" CHECK ("channel" IN ('teams', 'whatsapp', 'linkedin', 'email', 'link')),
        CONSTRAINT "fk_contact_channel_profile" FOREIGN KEY ("student_profile_id")
          REFERENCES "student_profiles"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_contact_channels_profile" ON "student_contact_channels" ("student_profile_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "contact_notes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "contact_id" uuid NOT NULL,
        "owner_profile_id" uuid NOT NULL,
        "alias" varchar(60),
        "context" varchar(300),
        "preferred_channel" varchar(20),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_contact_notes" PRIMARY KEY ("id"),
        CONSTRAINT "uq_contact_note_owner" UNIQUE ("contact_id", "owner_profile_id"),
        CONSTRAINT "ck_contact_note_channel" CHECK ("preferred_channel" IS NULL
          OR "preferred_channel" IN ('teams', 'whatsapp', 'linkedin', 'email', 'link')),
        CONSTRAINT "fk_contact_note_contact" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_contact_note_owner" FOREIGN KEY ("owner_profile_id")
          REFERENCES "student_profiles"("id") ON DELETE CASCADE
      )`);
    for (const t of ['conversations', 'conversation_members', 'messages']) {
      await queryRunner.query(
        `COMMENT ON TABLE "${t}" IS 'Retirado por la especificación V2 §57 (chat fuera del alcance). Se conserva como historia sin acceso funcional; no borrar sin auditoría.'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const t of ['conversations', 'conversation_members', 'messages']) {
      await queryRunner.query(`COMMENT ON TABLE "${t}" IS NULL`);
    }
    await queryRunner.query(`DROP TABLE "contact_notes"`);
    await queryRunner.query(`DROP TABLE "student_contact_channels"`);
  }
}
