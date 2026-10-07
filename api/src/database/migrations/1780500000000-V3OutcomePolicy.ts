import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3 BATCH 7 · Política de resultado de una oportunidad (§14).
 *
 * Se deduce de lo que ya existe: constancias habilitadas → constancia interna;
 * credencial esperada → credencial externa; el resto, ninguna. La columna
 * `internal_constancy_enabled` se conserva sincronizada porque la leen las
 * constancias y la gamificación.
 */
export class V3OutcomePolicy1780500000000 implements MigrationInterface {
  name = 'V3OutcomePolicy1780500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "activity_outcome_policy_enum"
        AS ENUM ('none', 'internal_constancy', 'external_credential_expected', 'other_authorized_resource')`);
    await queryRunner.query(`
      ALTER TABLE "activities"
        ADD COLUMN "outcome_policy" "activity_outcome_policy_enum" NOT NULL DEFAULT 'none'`);
    await queryRunner.query(`
      UPDATE "activities" SET "outcome_policy" = CASE
        WHEN "internal_constancy_enabled" THEN 'internal_constancy'::"activity_outcome_policy_enum"
        WHEN "credential_expected" THEN 'external_credential_expected'::"activity_outcome_policy_enum"
        ELSE 'none'::"activity_outcome_policy_enum" END`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "outcome_policy"`);
    await queryRunner.query(`DROP TYPE "activity_outcome_policy_enum"`);
  }
}
