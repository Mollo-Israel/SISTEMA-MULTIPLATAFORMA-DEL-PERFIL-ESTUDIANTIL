import { MigrationInterface, QueryRunner } from "typeorm";

export class RefactorProjects1780176772925 implements MigrationInterface {
    name = 'RefactorProjects1780176772925'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_b1bd2fbf5d0ef67319c91acb5cf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b1bd2fbf5d0ef67319c91acb5c"`);
        await queryRunner.query(`ALTER TABLE "project_members" DROP COLUMN "role_in_project"`);
        await queryRunner.query(`ALTER TABLE "project_evidences" DROP COLUMN "type"`);
        await queryRunner.query(`DROP TYPE "public"."project_evidences_type_enum"`);
        await queryRunner.query(`ALTER TABLE "project_evidences" DROP COLUMN "title"`);
        await queryRunner.query(`ALTER TABLE "project_evidences" DROP COLUMN "url"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "owner_id"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "start_date"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "end_date"`);
        await queryRunner.query(`ALTER TABLE "project_members" ADD "role" character varying(80)`);
        await queryRunner.query(`ALTER TABLE "project_members" ADD "contribution" text`);
        await queryRunner.query(`CREATE TYPE "public"."project_evidences_evidence_type_enum" AS ENUM('link', 'file')`);
        await queryRunner.query(`ALTER TABLE "project_evidences" ADD "evidence_type" "public"."project_evidences_evidence_type_enum" NOT NULL`);
        await queryRunner.query(`ALTER TABLE "project_evidences" ADD "description" character varying(300)`);
        await queryRunner.query(`ALTER TABLE "project_evidences" ADD "file_url" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "project_evidences" ADD "external_url" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "projects" ADD "created_by_profile_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "projects" ADD "repository_url" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "projects" ADD "demo_url" character varying(500)`);
        await queryRunner.query(`CREATE INDEX "IDX_094f87ce814bd60bae98a47345" ON "projects" ("created_by_profile_id") `);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_094f87ce814bd60bae98a47345a" FOREIGN KEY ("created_by_profile_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_094f87ce814bd60bae98a47345a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_094f87ce814bd60bae98a47345"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "demo_url"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "repository_url"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "created_by_profile_id"`);
        await queryRunner.query(`ALTER TABLE "project_evidences" DROP COLUMN "external_url"`);
        await queryRunner.query(`ALTER TABLE "project_evidences" DROP COLUMN "file_url"`);
        await queryRunner.query(`ALTER TABLE "project_evidences" DROP COLUMN "description"`);
        await queryRunner.query(`ALTER TABLE "project_evidences" DROP COLUMN "evidence_type"`);
        await queryRunner.query(`DROP TYPE "public"."project_evidences_evidence_type_enum"`);
        await queryRunner.query(`ALTER TABLE "project_members" DROP COLUMN "contribution"`);
        await queryRunner.query(`ALTER TABLE "project_members" DROP COLUMN "role"`);
        await queryRunner.query(`ALTER TABLE "projects" ADD "end_date" date`);
        await queryRunner.query(`ALTER TABLE "projects" ADD "start_date" date`);
        await queryRunner.query(`ALTER TABLE "projects" ADD "owner_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "project_evidences" ADD "url" character varying(500) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "project_evidences" ADD "title" character varying(160) NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."project_evidences_type_enum" AS ENUM('link', 'file')`);
        await queryRunner.query(`ALTER TABLE "project_evidences" ADD "type" "public"."project_evidences_type_enum" NOT NULL`);
        await queryRunner.query(`ALTER TABLE "project_members" ADD "role_in_project" character varying(80)`);
        await queryRunner.query(`CREATE INDEX "IDX_b1bd2fbf5d0ef67319c91acb5c" ON "projects" ("owner_id") `);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_b1bd2fbf5d0ef67319c91acb5cf" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}
