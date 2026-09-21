import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BATCH 1 — Identidad y seguridad (especificacion §9 a §15, §70, §74).
 *
 * Aporta lo que hace falta para retirar el registro publico:
 *   - cuatro estados de cuenta en lugar de dos;
 *   - tokens de activacion y de restablecimiento, guardados como hash;
 *   - sesiones revocables;
 *   - importacion de padron auditable e idempotente;
 *   - bitacora de auditoria.
 *
 * No toca datos existentes salvo para reetiquetar el enum de estado, y ahi
 * conserva el valor de cada fila.
 */
export class Batch1IdentityAndSecurity1780280000000 implements MigrationInterface {
  name = 'Batch1IdentityAndSecurity1780280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------------------------------------------------------------- estados
    // Se recrea el tipo en lugar de usar ALTER TYPE ADD VALUE: asi la
    // migracion es reversible y no depende de la version de PostgreSQL.
    await queryRunner.query(`
      CREATE TYPE "users_status_enum_new" AS ENUM (
        'pending_activation', 'active', 'suspended', 'inactive'
      )
    `);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "status" TYPE "users_status_enum_new"
        USING "status"::text::"users_status_enum_new"
    `);
    await queryRunner.query(`DROP TYPE "users_status_enum"`);
    await queryRunner.query(`ALTER TYPE "users_status_enum_new" RENAME TO "users_status_enum"`);
    // Las cuentas nuevas nacen provisionadas: activarlas es un acto explicito.
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "status" SET DEFAULT 'pending_activation'
    `);

    // ------------------------------------------------- tokens de un solo uso
    await queryRunner.query(`
      CREATE TYPE "account_token_purpose_enum" AS ENUM (
        'account_activation', 'password_reset'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "account_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "purpose" "account_token_purpose_enum" NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_account_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_account_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_account_tokens_hash" ON "account_tokens" ("token_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_account_tokens_user_purpose"
        ON "account_tokens" ("user_id", "purpose")
    `);

    // ------------------------------------------------------------- sesiones
    await queryRunner.query(`
      CREATE TABLE "auth_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "refresh_token_hash" character varying(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "last_used_at" TIMESTAMP WITH TIME ZONE,
        "user_agent" character varying(200),
        "ip_address" character varying(64),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_auth_sessions_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_auth_sessions_refresh_hash"
        ON "auth_sessions" ("refresh_token_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_sessions_user_active"
        ON "auth_sessions" ("user_id", "revoked_at")
    `);

    // --------------------------------------------------- importacion de padron
    await queryRunner.query(`
      CREATE TYPE "import_batch_status_enum" AS ENUM (
        'previewed', 'applied', 'discarded'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "import_row_status_enum" AS ENUM (
        'new', 'update', 'unchanged', 'conflict', 'invalid'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "import_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "original_filename" character varying(255) NOT NULL,
        "file_sha256" character varying(64) NOT NULL,
        "status" "import_batch_status_enum" NOT NULL DEFAULT 'previewed',
        "imported_by_user_id" uuid NOT NULL,
        "counts" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "total_rows" integer NOT NULL DEFAULT 0,
        "applied_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_import_batches" PRIMARY KEY ("id"),
        CONSTRAINT "FK_import_batches_user" FOREIGN KEY ("imported_by_user_id")
          REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_import_batches_sha" ON "import_batches" ("file_sha256")
    `);
    await queryRunner.query(`
      CREATE TABLE "import_batch_rows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "batch_id" uuid NOT NULL,
        "row_number" integer NOT NULL,
        "university_code" character varying(40),
        "institutional_email" character varying(160),
        "first_name" character varying(100),
        "last_name" character varying(100),
        "semester" integer,
        "status" "import_row_status_enum" NOT NULL,
        "message" character varying(300),
        "user_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_import_batch_rows" PRIMARY KEY ("id"),
        CONSTRAINT "FK_import_batch_rows_batch" FOREIGN KEY ("batch_id")
          REFERENCES "import_batches"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_import_batch_rows_batch_status"
        ON "import_batch_rows" ("batch_id", "status")
    `);

    // ------------------------------------------------------------ auditoria
    await queryRunner.query(`
      CREATE TABLE "audit_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actor_user_id" uuid,
        "event_type" character varying(60) NOT NULL,
        "entity_type" character varying(60) NOT NULL,
        "entity_id" character varying(64),
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_events_actor" FOREIGN KEY ("actor_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_events_entity" ON "audit_events" ("entity_type", "entity_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_events_actor" ON "audit_events" ("actor_user_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_events_type" ON "audit_events" ("event_type")
    `);

    // ------------------------------------------- integridad del padron (§74)
    // Parcial: hoy ningun perfil tiene codigo, y un codigo ausente no debe
    // impedir que existan varios perfiles sin codigo.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_student_profiles_university_code"
        ON "student_profiles" ("university_code")
        WHERE "university_code" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_student_profiles_university_code"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "audit_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "import_batch_rows"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "import_batches"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "import_row_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "import_batch_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auth_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "account_tokens"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "account_token_purpose_enum"`);

    // Vuelta a dos estados. Lo que estuviera provisionado o suspendido se
    // convierte en inactivo: es el equivalente mas cercano que existia antes.
    await queryRunner.query(`
      CREATE TYPE "users_status_enum_old" AS ENUM ('active', 'inactive')
    `);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(`
      UPDATE "users" SET "status" = 'inactive'
        WHERE "status" IN ('pending_activation', 'suspended')
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "status" TYPE "users_status_enum_old"
        USING "status"::text::"users_status_enum_old"
    `);
    await queryRunner.query(`DROP TYPE "users_status_enum"`);
    await queryRunner.query(`ALTER TYPE "users_status_enum_old" RENAME TO "users_status_enum"`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active'`);
  }
}
