import { MigrationInterface, QueryRunner } from "typeorm";

export class AddImprovementAreas1780175301816 implements MigrationInterface {
    name = 'AddImprovementAreas1780175301816'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "student_profiles" ADD "improvement_area_ids" uuid array`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "student_profiles" DROP COLUMN "improvement_area_ids"`);
    }

}
