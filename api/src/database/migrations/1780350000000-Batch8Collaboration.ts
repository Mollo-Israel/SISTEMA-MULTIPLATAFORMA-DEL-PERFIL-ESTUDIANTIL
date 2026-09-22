import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BATCH 8 — Colaboración (especificación §42 a §47, §73.6, §73.7, §133).
 *
 * Añade el identificador público opaco del perfil compartible y las once tablas
 * que sostienen contactos, equipos y mensajería.
 *
 * El slug se genera para todos los perfiles existentes, pero **no** activa el
 * perfil compartible: `public_profile_enabled` sigue en `false` desde el BATCH
 * 2 y §44 es explícito en que nada se expone públicamente por omisión. Tener
 * identificador y estar publicado son cosas distintas.
 */
export class Batch8Collaboration1780350000000 implements MigrationInterface {
  name = 'Batch8Collaboration1780350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================= §43, §73.7
    await queryRunner.query(`
      ALTER TABLE "student_profiles"
        ADD COLUMN "public_profile_slug" character varying(24)
    `);

    /*
     * Un slug opaco por perfil. §43 prohíbe usar el correo, el código
     * universitario o el UUID interno: un identificador que se pueda adivinar o
     * que revele algo deja de ser opaco.
     *
     * El alfabeto no lleva vocales ni caracteres que se confundan al leerlos en
     * voz alta —`0`, `O`, `1`, `l`, `I`—, así que tampoco sale por azar ninguna
     * palabra que a nadie le apetezca llevar encima.
     *
     * Se genera fila a fila en un bucle explícito, y no con un UPDATE de una
     * sola pasada, porque un subconsulta sin correlación se evalúa **una vez**:
     * el primer intento le puso a los 869 perfiles el mismo identificador. Un
     * bucle con reintento ante colisión es más largo de leer y no deja lugar a
     * dudas sobre lo que hace.
     */
    await queryRunner.query(`
      DO $$
      DECLARE
        alfabeto CONSTANT text := '23456789bcdfghjkmnpqrstvwxyz';
        perfil record;
        candidato text;
        intentos int;
      BEGIN
        FOR perfil IN SELECT "id" FROM "student_profiles"
                      WHERE "public_profile_slug" IS NULL LOOP
          intentos := 0;
          LOOP
            SELECT string_agg(
                     substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1), ''
                   )
              INTO candidato
              FROM generate_series(1, 12);

            EXIT WHEN NOT EXISTS (
              SELECT 1 FROM "student_profiles" WHERE "public_profile_slug" = candidato
            );

            intentos := intentos + 1;
            IF intentos > 20 THEN
              RAISE EXCEPTION 'No se pudo generar un slug único para el perfil %', perfil."id";
            END IF;
          END LOOP;

          UPDATE "student_profiles"
             SET "public_profile_slug" = candidato
           WHERE "id" = perfil."id";
        END LOOP;
      END $$
    `);

    await queryRunner.query(`
      ALTER TABLE "student_profiles"
        ALTER COLUMN "public_profile_slug" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "student_profiles"
        ADD CONSTRAINT "uq_student_profile_slug" UNIQUE ("public_profile_slug")
    `);

    // ================================================================= §45
    await queryRunner.query(`
      CREATE TYPE "contact_request_status_enum" AS ENUM (
        'pending', 'accepted', 'rejected', 'cancelled'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "contact_source_enum" AS ENUM ('qr', 'suggestion', 'directory')
    `);

    await queryRunner.query(`
      CREATE TABLE "contact_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "requester_profile_id" uuid NOT NULL,
        "target_profile_id" uuid NOT NULL,
        "status" "contact_request_status_enum" NOT NULL DEFAULT 'pending',
        "source" "contact_source_enum" NOT NULL DEFAULT 'directory',
        "message" character varying(300),
        "decided_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contact_requests" PRIMARY KEY ("id"),
        CONSTRAINT "chk_contact_request_distintos"
          CHECK ("requester_profile_id" <> "target_profile_id"),
        CONSTRAINT "FK_contact_requests_solicitante" FOREIGN KEY ("requester_profile_id")
          REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_contact_requests_destino" FOREIGN KEY ("target_profile_id")
          REFERENCES "student_profiles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_contact_requests_solicitante"
        ON "contact_requests" ("requester_profile_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_contact_requests_destino"
        ON "contact_requests" ("target_profile_id", "status")
    `);
    // Una solicitud pendiente por pareja y sentido: reenviarla no debe generar
    // otra fila ni convertirse en una forma de insistir.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_contact_request_pendiente"
        ON "contact_requests" ("requester_profile_id", "target_profile_id")
        WHERE "status" = 'pending'
    `);

    await queryRunner.query(`
      CREATE TABLE "contacts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "profile_a_id" uuid NOT NULL,
        "profile_b_id" uuid NOT NULL,
        "source" "contact_source_enum" NOT NULL DEFAULT 'directory',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contacts" PRIMARY KEY ("id"),
        CONSTRAINT "uq_contact_pareja" UNIQUE ("profile_a_id", "profile_b_id"),
        CONSTRAINT "chk_contact_orden" CHECK ("profile_a_id" < "profile_b_id"),
        CONSTRAINT "FK_contacts_a" FOREIGN KEY ("profile_a_id")
          REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_contacts_b" FOREIGN KEY ("profile_b_id")
          REFERENCES "student_profiles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_contacts_a" ON "contacts" ("profile_a_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_contacts_b" ON "contacts" ("profile_b_id")`);

    // ================================================================= §46
    await queryRunner.query(`
      CREATE TYPE "team_need_status_enum" AS ENUM ('open', 'closed')
    `);
    await queryRunner.query(`
      CREATE TYPE "availability_requirement_enum" AS ENUM (
        'any', 'open_or_looking', 'looking'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "team_status_enum" AS ENUM ('forming', 'active', 'closed')
    `);
    await queryRunner.query(`
      CREATE TYPE "team_invitation_status_enum" AS ENUM (
        'pending', 'accepted', 'declined', 'cancelled'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "team_needs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "owner_profile_id" uuid NOT NULL,
        "purpose" character varying(300) NOT NULL,
        "description" character varying(1000),
        "project_id" uuid,
        "activity_id" uuid,
        "max_members" smallint NOT NULL DEFAULT 5,
        "availability_requirement" "availability_requirement_enum" NOT NULL DEFAULT 'any',
        "status" "team_need_status_enum" NOT NULL DEFAULT 'open',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_team_needs" PRIMARY KEY ("id"),
        CONSTRAINT "chk_team_need_max" CHECK ("max_members" BETWEEN 2 AND 20),
        CONSTRAINT "FK_team_needs_owner" FOREIGN KEY ("owner_profile_id")
          REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_needs_proyecto" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_team_needs_actividad" FOREIGN KEY ("activity_id")
          REFERENCES "activities"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_team_needs_owner" ON "team_needs" ("owner_profile_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_team_needs_estado" ON "team_needs" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE "team_need_skills" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "team_need_id" uuid NOT NULL,
        "skill_id" uuid NOT NULL,
        CONSTRAINT "PK_team_need_skills" PRIMARY KEY ("id"),
        CONSTRAINT "uq_team_need_skill" UNIQUE ("team_need_id", "skill_id"),
        CONSTRAINT "FK_team_need_skills_need" FOREIGN KEY ("team_need_id")
          REFERENCES "team_needs"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_need_skills_skill" FOREIGN KEY ("skill_id")
          REFERENCES "skills"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_team_need_skills_need" ON "team_need_skills" ("team_need_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_team_need_skills_skill" ON "team_need_skills" ("skill_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "team_need_areas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "team_need_id" uuid NOT NULL,
        "academic_area_id" uuid NOT NULL,
        CONSTRAINT "PK_team_need_areas" PRIMARY KEY ("id"),
        CONSTRAINT "uq_team_need_area" UNIQUE ("team_need_id", "academic_area_id"),
        CONSTRAINT "FK_team_need_areas_need" FOREIGN KEY ("team_need_id")
          REFERENCES "team_needs"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_need_areas_area" FOREIGN KEY ("academic_area_id")
          REFERENCES "academic_areas"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_team_need_areas_need" ON "team_need_areas" ("team_need_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_team_need_areas_area" ON "team_need_areas" ("academic_area_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "teams" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(160) NOT NULL,
        "owner_profile_id" uuid NOT NULL,
        "team_need_id" uuid,
        "status" "team_status_enum" NOT NULL DEFAULT 'forming',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teams" PRIMARY KEY ("id"),
        CONSTRAINT "FK_teams_owner" FOREIGN KEY ("owner_profile_id")
          REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_teams_need" FOREIGN KEY ("team_need_id")
          REFERENCES "team_needs"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_teams_owner" ON "teams" ("owner_profile_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_teams_need" ON "teams" ("team_need_id")`);

    await queryRunner.query(`
      CREATE TABLE "team_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "team_id" uuid NOT NULL,
        "student_profile_id" uuid NOT NULL,
        "role" character varying(80),
        "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_team_members" PRIMARY KEY ("id"),
        CONSTRAINT "uq_team_member" UNIQUE ("team_id", "student_profile_id"),
        CONSTRAINT "FK_team_members_team" FOREIGN KEY ("team_id")
          REFERENCES "teams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_members_profile" FOREIGN KEY ("student_profile_id")
          REFERENCES "student_profiles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_team_members_team" ON "team_members" ("team_id")`);
    await queryRunner.query(`
      CREATE INDEX "IDX_team_members_profile" ON "team_members" ("student_profile_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "team_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "team_id" uuid NOT NULL,
        "invited_profile_id" uuid NOT NULL,
        "invited_by_profile_id" uuid NOT NULL,
        "status" "team_invitation_status_enum" NOT NULL DEFAULT 'pending',
        "message" character varying(300),
        "decided_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_team_invitations" PRIMARY KEY ("id"),
        CONSTRAINT "uq_team_invitation" UNIQUE ("team_id", "invited_profile_id"),
        CONSTRAINT "FK_team_invitations_team" FOREIGN KEY ("team_id")
          REFERENCES "teams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_invitations_invitado" FOREIGN KEY ("invited_profile_id")
          REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_invitations_emisor" FOREIGN KEY ("invited_by_profile_id")
          REFERENCES "student_profiles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_team_invitations_team" ON "team_invitations" ("team_id")`);
    await queryRunner.query(`
      CREATE INDEX "idx_team_invitations_invitado"
        ON "team_invitations" ("invited_profile_id", "status")
    `);

    // ================================================================= §42
    await queryRunner.query(`
      CREATE TYPE "conversation_kind_enum" AS ENUM ('direct', 'team')
    `);
    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "kind" "conversation_kind_enum" NOT NULL,
        "team_id" uuid,
        "last_message_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversations" PRIMARY KEY ("id"),
        CONSTRAINT "chk_conversation_equipo" CHECK (
          ("kind" = 'team' AND "team_id" IS NOT NULL)
          OR ("kind" = 'direct' AND "team_id" IS NULL)
        ),
        CONSTRAINT "FK_conversations_team" FOREIGN KEY ("team_id")
          REFERENCES "teams"("id") ON DELETE CASCADE
      )
    `);
    // Un equipo tiene una conversación, no varias.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_conversation_equipo"
        ON "conversations" ("team_id") WHERE "team_id" IS NOT NULL
    `);
    await queryRunner.query(`CREATE INDEX "IDX_conversations_team" ON "conversations" ("team_id")`);

    await queryRunner.query(`
      CREATE TABLE "conversation_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "student_profile_id" uuid NOT NULL,
        "last_read_at" TIMESTAMP WITH TIME ZONE,
        "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversation_members" PRIMARY KEY ("id"),
        CONSTRAINT "uq_conversation_member" UNIQUE ("conversation_id", "student_profile_id"),
        CONSTRAINT "FK_conversation_members_conv" FOREIGN KEY ("conversation_id")
          REFERENCES "conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_conversation_members_profile" FOREIGN KEY ("student_profile_id")
          REFERENCES "student_profiles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_conversation_members_conv" ON "conversation_members" ("conversation_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_conversation_members_profile"
        ON "conversation_members" ("student_profile_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "sender_profile_id" uuid NOT NULL,
        "body" character varying(2000) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_messages_conv" FOREIGN KEY ("conversation_id")
          REFERENCES "conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_messages_sender" FOREIGN KEY ("sender_profile_id")
          REFERENCES "student_profiles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_messages_conversacion" ON "messages" ("conversation_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_messages_sender" ON "messages" ("sender_profile_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversation_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversations"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "conversation_kind_enum"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "team_invitations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teams"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_need_areas"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_need_skills"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_needs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "team_invitation_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "team_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "availability_requirement_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "team_need_status_enum"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "contacts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contact_requests"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "contact_source_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "contact_request_status_enum"`);

    await queryRunner.query(`
      ALTER TABLE "student_profiles"
        DROP CONSTRAINT IF EXISTS "uq_student_profile_slug"
    `);
    await queryRunner.query(`
      ALTER TABLE "student_profiles" DROP COLUMN IF EXISTS "public_profile_slug"
    `);
  }
}
