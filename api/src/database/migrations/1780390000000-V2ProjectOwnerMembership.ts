import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El responsable también es integrante (especificación V2 §33, §34, §48).
 *
 * La afinidad V3 atribuye un proyecto a las áreas de las tecnologías que **el
 * propio integrante** confirmó haber usado (`skills_used`). El creador no tenía
 * fila de integrante, así que no tenía dónde confirmarlas y sus proyectos solo
 * podían clasificarse por el área general del proyecto, que §48 prohíbe usar
 * para atribuir experiencia.
 *
 * Se crea la fila del responsable (`is_owner = true`) en cada proyecto que no
 * la tenga. No es un integrante «aceptado»: el nivel de respaldo (§36) y la
 * gamificación la excluyen, para que crear un proyecto no lo respalde solo.
 */
export class V2ProjectOwnerMembership1780390000000 implements MigrationInterface {
  name = 'V2ProjectOwnerMembership1780390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD "is_owner" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`
      INSERT INTO "project_members" ("project_id", "user_id", "role", "contribution", "contribution_confirmed_at", "created_at", "is_owner")
      SELECT p.id, sp.user_id, 'Responsable', NULL, p.created_at, p.created_at, true
        FROM "projects" p
        JOIN "student_profiles" sp ON sp.id = p.created_by_profile_id
       WHERE NOT EXISTS (
         SELECT 1 FROM "project_members" pm WHERE pm.project_id = p.id AND pm.user_id = sp.user_id
       )`);
    await queryRunner.query(`
      UPDATE "project_members" pm SET "is_owner" = true
        FROM "projects" p JOIN "student_profiles" sp ON sp.id = p.created_by_profile_id
       WHERE pm.project_id = p.id AND pm.user_id = sp.user_id`);
    await queryRunner.query(
      `CREATE INDEX "idx_project_members_owner" ON "project_members" ("project_id") WHERE "is_owner"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_project_members_owner"`);
    // Solo las filas de responsable creadas aquí (sin tecnologías propias se
    // borran sin perder nada; las tecnologías que el responsable confirmó
    // después caen en cascada, que es lo que significa deshacer esto).
    await queryRunner.query(`DELETE FROM "project_members" WHERE "is_owner" = true`);
    await queryRunner.query(`ALTER TABLE "project_members" DROP COLUMN "is_owner"`);
  }
}
