import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Código corto de activación y recuperación (correcciones de QA).
 *
 * Hasta ahora el correo llevaba un token de 43 caracteres que había que copiar
 * a mano. Se añade un código de seis dígitos que viaja junto al enlace: el
 * enlace sirve para quien abre el correo en el mismo equipo, el código para
 * quien lo lee en el teléfono y activa en otro sitio.
 *
 * - `code_hash`: HMAC del código. Seis dígitos son un millón de combinaciones,
 *   pocas para guardarlas con un hash simple: con la tabla en la mano se
 *   recorrerían en segundos. El HMAC necesita además el secreto del servidor.
 * - `failed_attempts`: un código corto solo es seguro si se agota. Tras cinco
 *   intentos fallidos el token se revoca.
 * - `revoked_reason`: un token revocado puede estarlo porque se pidió otro,
 *   porque se agotaron los intentos o porque la cuenta se suspendió. Al
 *   usuario le sirve saber cuál de las tres le pasó.
 */
export class QaAccountCodes1780370000000 implements MigrationInterface {
  name = 'QaAccountCodes1780370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "account_tokens" ADD COLUMN "code_hash" varchar(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "account_tokens" ADD COLUMN "failed_attempts" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "account_tokens" ADD COLUMN "revoked_reason" varchar(30)`,
    );
    // Los revocados que ya existían lo fueron, todos, por pedir un enlace nuevo
    // o por suspender la cuenta; sin poder distinguirlos, se marcan como
    // reemplazados, que es el caso abrumadoramente común.
    await queryRunner.query(
      `UPDATE "account_tokens" SET "revoked_reason" = 'replaced' WHERE "revoked_at" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_account_tokens_user_purpose_created"
         ON "account_tokens" ("user_id", "purpose", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_account_tokens_user_purpose_created"`);
    await queryRunner.query(`ALTER TABLE "account_tokens" DROP COLUMN "revoked_reason"`);
    await queryRunner.query(`ALTER TABLE "account_tokens" DROP COLUMN "failed_attempts"`);
    await queryRunner.query(`ALTER TABLE "account_tokens" DROP COLUMN "code_hash"`);
  }
}
