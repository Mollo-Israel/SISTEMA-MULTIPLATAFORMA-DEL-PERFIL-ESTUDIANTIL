import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bienvenida V2 e intereses por tecnología (especificación V2 §20–§22, §82).
 *
 * 1. `student_skill_interests`: «me interesa» / «quiero mejorar» una
 *    tecnología, con procedencia. Sustituye al nivel autodeclarado.
 * 2. Migración de `student_skills`: cada autoevaluación se conserva como
 *    interés con procedencia `historical_self_assessment` (V2 §82: «si
 *    representan preferencia, migrar»; quien se autoevaluó en algo, como
 *    mínimo, declaró interés en ello). La tabla original **no se borra**: queda
 *    como histórico y deja de leerse para afinidad.
 * 3. Marcas de la bienvenida V2 (§20.2): confirmación de datos
 *    institucionales, privacidad revisada y disponibilidad decidida. Los
 *    perfiles que ya terminaron la bienvenida anterior las reciben con esa
 *    fecha, para no volver a encerrarlos en el asistente.
 */
export class V2OnboardingAndSkillInterests1780380000000 implements MigrationInterface {
  name = 'V2OnboardingAndSkillInterests1780380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "skill_interest_kind_enum" AS ENUM ('interest', 'improve')`);
    await queryRunner.query(
      `CREATE TYPE "skill_interest_source_enum" AS ENUM ('declared', 'orientation', 'historical_self_assessment')`,
    );
    await queryRunner.query(`
      CREATE TABLE "student_skill_interests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "student_profile_id" uuid NOT NULL,
        "skill_id" uuid NOT NULL,
        "kind" "skill_interest_kind_enum" NOT NULL DEFAULT 'interest',
        "source" "skill_interest_source_enum" NOT NULL DEFAULT 'declared',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_student_skill_interests" PRIMARY KEY ("id"),
        CONSTRAINT "uq_student_skill_interest" UNIQUE ("student_profile_id", "skill_id"),
        CONSTRAINT "fk_ssi_profile" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_ssi_skill" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "idx_ssi_profile" ON "student_skill_interests" ("student_profile_id")`);
    await queryRunner.query(`CREATE INDEX "idx_ssi_skill" ON "student_skill_interests" ("skill_id")`);

    await queryRunner.query(`
      INSERT INTO "student_skill_interests" ("student_profile_id", "skill_id", "kind", "source", "created_at", "updated_at")
      SELECT "student_profile_id", "skill_id", 'interest', 'historical_self_assessment', "created_at", now()
        FROM "student_skills"
      ON CONFLICT ("student_profile_id", "skill_id") DO NOTHING`);

    await queryRunner.query(`
      ALTER TABLE "student_profiles"
        ADD "institutional_confirmed_at" timestamptz,
        ADD "privacy_reviewed_at" timestamptz,
        ADD "availability_decided_at" timestamptz`);
    await queryRunner.query(`
      UPDATE "student_profiles"
         SET "institutional_confirmed_at" = "onboarding_completed_at",
             "privacy_reviewed_at" = "onboarding_completed_at",
             "availability_decided_at" = "onboarding_completed_at"
       WHERE "onboarding_completed_at" IS NOT NULL`);
    await queryRunner.query(`
      UPDATE "student_profiles"
         SET "availability_decided_at" = COALESCE("availability_decided_at", "updated_at")
       WHERE "availability" <> 'unspecified'`);
    await queryRunner.query(`COMMENT ON TABLE "student_skills" IS
      'Histórico: nivel autodeclarado retirado por la especificación V2 §22. No se escribe ni alimenta afinidad; ver student_skill_interests.'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`COMMENT ON TABLE "student_skills" IS NULL`);
    await queryRunner.query(`
      ALTER TABLE "student_profiles"
        DROP COLUMN "availability_decided_at",
        DROP COLUMN "privacy_reviewed_at",
        DROP COLUMN "institutional_confirmed_at"`);
    await queryRunner.query(`DROP TABLE "student_skill_interests"`);
    await queryRunner.query(`DROP TYPE "skill_interest_source_enum"`);
    await queryRunner.query(`DROP TYPE "skill_interest_kind_enum"`);
  }
}
