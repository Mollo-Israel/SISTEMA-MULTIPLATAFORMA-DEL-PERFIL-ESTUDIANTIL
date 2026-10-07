import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3 BATCH 11 · GitHub con caché y demo con metadata pública (§24.6, §26).
 */
export class V3GithubCache1780540000000 implements MigrationInterface {
  name = 'V3GithubCache1780540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "github_api_cache" (
        "url" VARCHAR(600) NOT NULL PRIMARY KEY,
        "etag" VARCHAR(200) NULL,
        "status" SMALLINT NOT NULL,
        "body" TEXT NULL,
        "fetched_at" TIMESTAMPTZ NOT NULL
      )`);
    await queryRunner.query(`ALTER TABLE "project_link_checks" ADD COLUMN "metadata" JSONB NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project_link_checks" DROP COLUMN "metadata"`);
    await queryRunner.query(`DROP TABLE "github_api_cache"`);
  }
}
