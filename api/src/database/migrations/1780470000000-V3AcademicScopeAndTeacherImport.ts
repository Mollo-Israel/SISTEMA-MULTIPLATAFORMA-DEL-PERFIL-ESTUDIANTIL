import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3 BATCH 2 · Alcance académico del estudiante e importación de docentes.
 *
 * - `academic_scope_semesters` (V3 §8.1): semestres adicionales que el
 *   estudiante cursa por arrastre o repetición. Lo gestiona Administración; la
 *   cuenta es la fuente y el perfil guarda una copia, como el semestre.
 * - `import_batches.kind` (V3 §7.1): el mismo circuito de importación sirve
 *   para estudiantes y para docentes; los lotes existentes son de estudiantes.
 * - `import_batch_rows.semesters`: semestres autorizados de una fila de docente.
 */
export class V3AcademicScopeAndTeacherImport1780470000000 implements MigrationInterface {
  name = 'V3AcademicScopeAndTeacherImport1780470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "academic_scope_semesters" smallint[] NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`
      ALTER TABLE "student_profiles"
        ADD COLUMN "academic_scope_semesters" smallint[] NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD CONSTRAINT "ck_users_academic_scope_range"
          CHECK ("academic_scope_semesters" <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[])`);
    await queryRunner.query(`
      CREATE INDEX "idx_student_profiles_academic_scope"
        ON "student_profiles" USING GIN ("academic_scope_semesters")`);

    await queryRunner.query(`
      ALTER TABLE "import_batches"
        ADD COLUMN "kind" varchar(20) NOT NULL DEFAULT 'students',
        ADD CONSTRAINT "ck_import_batches_kind" CHECK ("kind" IN ('students', 'teachers'))`);
    await queryRunner.query(`
      ALTER TABLE "import_batch_rows"
        ADD COLUMN "semesters" smallint[] NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "import_batch_rows" DROP COLUMN "semesters"`);
    // Los lotes de docentes no existían antes de esta migración: se retiran
    // junto con la columna que los distingue (sus filas caen en cascada).
    await queryRunner.query(`DELETE FROM "import_batches" WHERE "kind" = 'teachers'`);
    await queryRunner.query(`
      ALTER TABLE "import_batches"
        DROP CONSTRAINT "ck_import_batches_kind",
        DROP COLUMN "kind"`);
    await queryRunner.query(`DROP INDEX "idx_student_profiles_academic_scope"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "ck_users_academic_scope_range"`);
    await queryRunner.query(`ALTER TABLE "student_profiles" DROP COLUMN "academic_scope_semesters"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "academic_scope_semesters"`);
  }
}
