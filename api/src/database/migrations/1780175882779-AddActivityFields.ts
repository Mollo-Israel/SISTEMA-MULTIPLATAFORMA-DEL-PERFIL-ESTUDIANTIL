import { MigrationInterface, QueryRunner } from "typeorm";

export class AddActivityFields1780175882779 implements MigrationInterface {
    name = 'AddActivityFields1780175882779'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."activities_category_enum" AS ENUM('taller_academico', 'clase_espejo', 'seminario', 'charla', 'curso_externo_recomendado', 'reto', 'hackathon', 'convocatoria', 'actividad_sociedad_cientifica', 'club_estudio', 'tutoria', 'investigacion', 'responsabilidad_social', 'integracion')`);
        await queryRunner.query(`ALTER TABLE "activities" ADD "category" "public"."activities_category_enum" NOT NULL`);
        await queryRunner.query(`ALTER TABLE "activities" ADD "location" character varying(200)`);
        await queryRunner.query(`ALTER TABLE "activities" ADD "external_url" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "activities" ADD "evidence_required" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`CREATE INDEX "IDX_11457b0f8b1621d944a6aaedec" ON "activities" ("category") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_11457b0f8b1621d944a6aaedec"`);
        await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "evidence_required"`);
        await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "external_url"`);
        await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "location"`);
        await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "category"`);
        await queryRunner.query(`DROP TYPE "public"."activities_category_enum"`);
    }

}
