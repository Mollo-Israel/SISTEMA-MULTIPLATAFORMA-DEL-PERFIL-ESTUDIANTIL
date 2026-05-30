import { MigrationInterface, QueryRunner } from "typeorm";

export class RefactorEvidenceTables1780177516870 implements MigrationInterface {
    name = 'RefactorEvidenceTables1780177516870'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "internal_constancies" DROP CONSTRAINT "FK_de8827b13bf65606e5840630bc1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_de8827b13bf65606e5840630bc"`);
        await queryRunner.query(`ALTER TABLE "external_certificates" DROP COLUMN "title"`);
        await queryRunner.query(`ALTER TABLE "external_certificates" DROP COLUMN "url"`);
        await queryRunner.query(`ALTER TABLE "external_certificates" DROP COLUMN "issued_date"`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" DROP COLUMN "title"`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" DROP COLUMN "type"`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" DROP COLUMN "issued_by"`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" DROP COLUMN "authorized"`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" DROP COLUMN "issued_date"`);
        await queryRunner.query(`ALTER TABLE "external_certificates" ADD "certificate_name" character varying(200) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "external_certificates" ADD "certificate_url" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "external_certificates" ADD "issue_date" date`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" ADD "activity_id" uuid`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" ADD "activity_registration_id" uuid`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" ADD "description" character varying(300) NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."internal_constancies_status_enum" AS ENUM('pending', 'authorized', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" ADD "status" "public"."internal_constancies_status_enum" NOT NULL DEFAULT 'authorized'`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" ADD "authorized_by" uuid`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" ADD CONSTRAINT "FK_ca23e550eaf912f87d53d2134e3" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" ADD CONSTRAINT "FK_58ccdc4c1533fbf65335a76a65b" FOREIGN KEY ("activity_registration_id") REFERENCES "activity_registrations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" ADD CONSTRAINT "FK_4414a97da3a6af1fabbb1411fd8" FOREIGN KEY ("authorized_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "internal_constancies" DROP CONSTRAINT "FK_4414a97da3a6af1fabbb1411fd8"`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" DROP CONSTRAINT "FK_58ccdc4c1533fbf65335a76a65b"`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" DROP CONSTRAINT "FK_ca23e550eaf912f87d53d2134e3"`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" DROP COLUMN "authorized_by"`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."internal_constancies_status_enum"`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" DROP COLUMN "description"`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" DROP COLUMN "activity_registration_id"`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" DROP COLUMN "activity_id"`);
        await queryRunner.query(`ALTER TABLE "external_certificates" DROP COLUMN "issue_date"`);
        await queryRunner.query(`ALTER TABLE "external_certificates" DROP COLUMN "certificate_url"`);
        await queryRunner.query(`ALTER TABLE "external_certificates" DROP COLUMN "certificate_name"`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" ADD "issued_date" date`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" ADD "authorized" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" ADD "issued_by" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" ADD "type" character varying(80)`);
        await queryRunner.query(`ALTER TABLE "internal_constancies" ADD "title" character varying(160) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "external_certificates" ADD "issued_date" date`);
        await queryRunner.query(`ALTER TABLE "external_certificates" ADD "url" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "external_certificates" ADD "title" character varying(160) NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_de8827b13bf65606e5840630bc" ON "internal_constancies" ("issued_by") `);
        await queryRunner.query(`ALTER TABLE "internal_constancies" ADD CONSTRAINT "FK_de8827b13bf65606e5840630bc1" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}
