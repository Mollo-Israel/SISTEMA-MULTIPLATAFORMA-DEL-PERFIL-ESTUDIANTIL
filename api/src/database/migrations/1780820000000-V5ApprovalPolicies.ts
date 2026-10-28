import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V5 BATCH 7 · Autonomía docente por módulo (§9.2).
 *
 * Aditiva. Sin fila vigente, un docente sigue en REQUIRE_REVIEW: la tabla
 * solo guarda las excepciones que Dirección concede, con quién, cuándo, para
 * qué módulo y por qué. Revocar no borra la fila (se marca `revoked_at`) ni
 * toca lo que se hizo con la excepción.
 *
 * `ACTIVITY` existe en el CHECK para que la decisión institucional pendiente
 * (ND-03) no necesite otra migración, pero la API la rechaza hasta entonces.
 *
 * `policy_id` en recursos y propuestas de puntos guarda qué excepción permitió
 * publicar u otorgar sin revisión: es el historial de acciones directas.
 */
export class V5ApprovalPolicies1780820000000 implements MigrationInterface {
  name = 'V5ApprovalPolicies1780820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "approval_policies" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "module" varchar(20) NOT NULL,
        "teacher_user_id" uuid NOT NULL,
        "decision" varchar(20) NOT NULL DEFAULT 'DIRECT_ALLOWED',
        "justification" varchar(500) NOT NULL,
        "granted_by" uuid NOT NULL,
        "granted_at" timestamptz NOT NULL DEFAULT now(),
        "revoked_at" timestamptz NULL,
        "revoked_by" uuid NULL,
        "revoke_reason" varchar(500) NULL,
        CONSTRAINT "PK_approval_policies" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_approval_policies_module" CHECK ("module" IN ('RESOURCE', 'GAMIFICATION', 'ACTIVITY')),
        CONSTRAINT "CHK_approval_policies_decision" CHECK ("decision" IN ('DIRECT_ALLOWED')),
        CONSTRAINT "CHK_approval_policies_revocation" CHECK (("revoked_at" IS NULL) = ("revoked_by" IS NULL)),
        CONSTRAINT "FK_approval_policies_teacher" FOREIGN KEY ("teacher_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_approval_policies_granted_by" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_approval_policies_revoked_by" FOREIGN KEY ("revoked_by") REFERENCES "users"("id") ON DELETE RESTRICT
      )`);
    // Una sola excepción vigente por docente y módulo.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_approval_policies_vigente"
        ON "approval_policies" ("teacher_user_id", "module") WHERE "revoked_at" IS NULL`);
    await queryRunner.query(`ALTER TABLE "learning_resources" ADD "policy_id" uuid NULL`);
    await queryRunner.query(`
      ALTER TABLE "learning_resources" ADD CONSTRAINT "FK_learning_resources_policy"
        FOREIGN KEY ("policy_id") REFERENCES "approval_policies"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE "gamification_proposals" ADD "policy_id" uuid NULL`);
    await queryRunner.query(`
      ALTER TABLE "gamification_proposals" ADD CONSTRAINT "FK_gamification_proposals_policy"
        FOREIGN KEY ("policy_id") REFERENCES "approval_policies"("id") ON DELETE RESTRICT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "gamification_proposals" DROP CONSTRAINT IF EXISTS "FK_gamification_proposals_policy"`);
    await queryRunner.query(`ALTER TABLE "gamification_proposals" DROP COLUMN IF EXISTS "policy_id"`);
    await queryRunner.query(`ALTER TABLE "learning_resources" DROP CONSTRAINT IF EXISTS "FK_learning_resources_policy"`);
    await queryRunner.query(`ALTER TABLE "learning_resources" DROP COLUMN IF EXISTS "policy_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "approval_policies"`);
  }
}
