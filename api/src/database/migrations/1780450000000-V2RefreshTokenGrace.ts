import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gracia de reutilización del refresh token (V2 §14).
 *
 * Guarda el hash del token recién reemplazado y cuándo se rotó. Si el
 * navegador recarga la página justo mientras se renueva la sesión, descarta la
 * respuesta con la cookie nueva y vuelve a presentar la anterior: sin esta
 * ventana corta, un simple F5 cerraba la sesión.
 */
export class V2RefreshTokenGrace1780450000000 implements MigrationInterface {
  name = 'V2RefreshTokenGrace1780450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "auth_sessions"
        ADD COLUMN "previous_refresh_token_hash" varchar(64) NULL,
        ADD COLUMN "rotated_at" timestamptz NULL`);
    await queryRunner.query(
      `CREATE INDEX "idx_auth_sessions_previous_hash" ON "auth_sessions" ("previous_refresh_token_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_auth_sessions_previous_hash"`);
    await queryRunner.query(`
      ALTER TABLE "auth_sessions"
        DROP COLUMN "rotated_at",
        DROP COLUMN "previous_refresh_token_hash"`);
  }
}
