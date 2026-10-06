import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Código universitario en todas las cuentas, con un formato único.
 *
 * Hasta ahora solo los estudiantes tenían código, guardado en su perfil y sin
 * formato fijo. Desde aquí toda cuenta lo tiene, en `users`, con la forma
 * `PREFIJO-XXXXXXX` (EST, DOC, DIR o ADM según el rol). El semestre también
 * pasa a la cuenta, para los roles que lo cursan.
 *
 * Se regularizan todas las cuentas existentes: cada una recibe un código nuevo
 * en el formato, sin repetidos. El perfil del estudiante conserva su copia del
 * código, sincronizada, porque el padrón y los reportes la leen de ahí.
 *
 * Los códigos anteriores de los perfiles se guardan en
 * `university_code_legacy` para que `down` los devuelva tal cual.
 */
export class UniversityCodeAllAccounts1780460000000 implements MigrationInterface {
  name = 'UniversityCodeAllAccounts1780460000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Respaldo de lo que había, para poder revertir sin perder nada.
    await queryRunner.query(`
      CREATE TABLE "university_code_legacy" (
        "user_id" uuid PRIMARY KEY,
        "profile_code" varchar(30) NULL
      )`);
    await queryRunner.query(`
      INSERT INTO "university_code_legacy" ("user_id", "profile_code")
      SELECT "user_id", "university_code" FROM "student_profiles"`);

    // 2. Columnas nuevas en la cuenta.
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "university_code" varchar(11) NULL,
        ADD COLUMN "semester" smallint NULL`);

    // 3. Un código nuevo por cuenta, con el prefijo de su rol y sin repetidos.
    await queryRunner.query(`
      DO $$
      DECLARE
        fila record;
        alfabeto constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        prefijo text;
        cuerpo text;
        intento int;
      BEGIN
        FOR fila IN
          SELECT u."id", r."name" AS rol
          FROM "users" u JOIN "roles" r ON r."id" = u."role_id"
          ORDER BY u."created_at", u."id"
        LOOP
          prefijo := CASE fila.rol
            WHEN 'TEACHER' THEN 'DOC'
            WHEN 'CAREER_DIRECTOR' THEN 'DIR'
            WHEN 'ADMIN' THEN 'ADM'
            ELSE 'EST'
          END;
          LOOP
            cuerpo := '';
            FOR intento IN 1..7 LOOP
              cuerpo := cuerpo || substr(alfabeto, 1 + floor(random() * 36)::int, 1);
            END LOOP;
            EXIT WHEN NOT EXISTS (
              SELECT 1 FROM "users" WHERE "university_code" = prefijo || '-' || cuerpo
            );
          END LOOP;
          UPDATE "users" SET "university_code" = prefijo || '-' || cuerpo WHERE "id" = fila."id";
        END LOOP;
      END $$`);

    // 4. El semestre de los estudiantes pasa también a su cuenta.
    await queryRunner.query(`
      UPDATE "users" u SET "semester" = p."semester"
      FROM "student_profiles" p
      WHERE p."user_id" = u."id" AND p."semester" IS NOT NULL`);

    // 5. El perfil del estudiante queda con el mismo código que su cuenta.
    await queryRunner.query(`
      UPDATE "student_profiles" p SET "university_code" = u."university_code"
      FROM "users" u
      WHERE u."id" = p."user_id"`);

    // 6. Desde aquí, obligatorio, único y con formato.
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "university_code" SET NOT NULL`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_university_code" ON "users" ("university_code")`,
    );
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD CONSTRAINT "ck_users_university_code_format"
          CHECK ("university_code" ~ '^(EST|DOC|DIR|ADM)-[A-Z0-9]{7}$'),
        ADD CONSTRAINT "ck_users_semester_range"
          CHECK ("semester" IS NULL OR "semester" BETWEEN 1 AND 12)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Los perfiles recuperan exactamente el código que tenían.
    await queryRunner.query(`
      UPDATE "student_profiles" p SET "university_code" = l."profile_code"
      FROM "university_code_legacy" l
      WHERE l."user_id" = p."user_id"`);
    // Perfiles creados después de la migración: no tenían código antiguo que
    // devolver; se dejan sin él, como era la regla anterior para lo no importado.
    await queryRunner.query(`
      UPDATE "student_profiles" p SET "university_code" = NULL
      WHERE NOT EXISTS (SELECT 1 FROM "university_code_legacy" l WHERE l."user_id" = p."user_id")`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP CONSTRAINT "ck_users_semester_range",
        DROP CONSTRAINT "ck_users_university_code_format"`);
    await queryRunner.query(`DROP INDEX "uq_users_university_code"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN "semester",
        DROP COLUMN "university_code"`);
    await queryRunner.query(`DROP TABLE "university_code_legacy"`);
  }
}
