import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Código único para áreas académicas y habilidades (correcciones de QA).
 *
 * Las categorías de actividad ya tenían código; áreas y habilidades se
 * identificaban solo por su nombre, que puede corregirse o traducirse. Un
 * código estable permite tratarlas como únicas aunque cambie el nombre, y es
 * lo que conviene usar para referirse a ellas desde importaciones o informes.
 *
 * Las filas existentes reciben un código derivado de su nombre
 * («Bases de Datos» → «bases_de_datos»); si dos nombres dan el mismo código,
 * el segundo lleva sufijo («_2», «_3»…). Nada se borra ni se renombra.
 */
export class QaCatalogCodes1780370300000 implements MigrationInterface {
  name = 'QaCatalogCodes1780370300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Mismo criterio que slugCode() en el código: sin tildes, minúsculas,
    // todo lo demás a guion bajo, y empezando por letra.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION pg_temp.afinia_slug(nombre text, defecto text) RETURNS text AS $$
      DECLARE base text;
      BEGIN
        base := translate(lower(nombre),
          'áéíóúüñàèìòùâêîôûäëïöçÁÉÍÓÚÜÑ', 'aeiouunaeiouaeiouaeiocaeiouun');
        base := regexp_replace(base, '[^a-z0-9]+', '_', 'g');
        base := regexp_replace(base, '^_+|_+$', '', 'g');
        base := left(base, 52);
        IF base = '' THEN base := defecto; END IF;
        IF base !~ '^[a-z]' THEN base := left('c_' || base, 52); END IF;
        RETURN base;
      END $$ LANGUAGE plpgsql
    `);

    for (const [tabla, defecto] of [
      ['academic_areas', 'area'],
      ['skills', 'habilidad'],
    ] as const) {
      await queryRunner.query(`ALTER TABLE "${tabla}" ADD COLUMN "code" varchar(60)`);
      // Fila a fila, en orden de antigüedad: la más antigua conserva el código
      // limpio y las posteriores reciben el sufijo.
      await queryRunner.query(`
        DO $$
        DECLARE r record; candidato text; base text; n int;
        BEGIN
          FOR r IN SELECT id, name FROM "${tabla}" ORDER BY created_at, id LOOP
            base := pg_temp.afinia_slug(r.name, '${defecto}');
            candidato := base;
            n := 1;
            WHILE EXISTS (SELECT 1 FROM "${tabla}" WHERE code = candidato) LOOP
              n := n + 1;
              candidato := base || '_' || n;
            END LOOP;
            UPDATE "${tabla}" SET code = candidato WHERE id = r.id;
          END LOOP;
        END $$
      `);
      await queryRunner.query(`ALTER TABLE "${tabla}" ALTER COLUMN "code" SET NOT NULL`);
      await queryRunner.query(
        `CREATE UNIQUE INDEX "uq_${tabla}_code" ON "${tabla}" ("code")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of ['skills', 'academic_areas']) {
      await queryRunner.query(`DROP INDEX IF EXISTS "uq_${tabla}_code"`);
      await queryRunner.query(`ALTER TABLE "${tabla}" DROP COLUMN "code"`);
    }
  }
}
