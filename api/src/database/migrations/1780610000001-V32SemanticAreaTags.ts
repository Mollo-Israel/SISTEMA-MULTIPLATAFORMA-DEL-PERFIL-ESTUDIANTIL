import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3.2 BATCH 3 · Catálogo semántico (§10.1–§10.4, §11.1).
 *
 * 1. Las etiquetas de las áreas base pasan a ser vocabulario del área
 *    («persistencia», «consultas»), no copias de habilidades («postgresql»):
 *    una etiqueta que repite una skill confunde al sugeridor (fue lo que mandó
 *    «aws» a Redes por la etiqueta «infraestructura»). Solo se tocan las que
 *    siguen exactamente como las dejó la semilla: lo que el administrador ya
 *    editó no se pisa.
 * 2. Se agrega «Computación en la nube», que faltaba, con sus habilidades
 *    (AWS, Azure, Google Cloud, Docker, Kubernetes), si no existen ya.
 * 3. Alias de las habilidades base: otros nombres de la misma tecnología
 *    («postgres» para PostgreSQL), solo si la habilidad no tenía alias y el
 *    nombre no lo usa otra.
 * 4. Áreas secundarias de ejemplo de §11.1 (Linux, Python, Docker).
 *
 * El `down` revierte exactamente lo que este `up` hizo y nada más: los
 * registros creados aquí se borran solo si nadie los usa todavía; si ya se
 * usan, se desactivan para no destruir datos.
 */

const TAGS: { code: string; antes: string[]; despues: string[] }[] = [
  {
    code: 'desarrollo_web',
    antes: ['frontend', 'backend', 'react', 'node', 'api', 'html', 'css'],
    despues: ['frontend', 'backend', 'aplicaciones web', 'servicios web', 'interfaces web'],
  },
  {
    code: 'desarrollo_movil',
    antes: ['android', 'ios', 'react-native', 'flutter', 'kotlin'],
    despues: ['aplicaciones móviles', 'mobile', 'multiplataforma', 'android'],
  },
  {
    code: 'inteligencia_artificial',
    antes: ['machine-learning', 'python', 'redes-neuronales', 'datos'],
    despues: ['aprendizaje automático', 'modelos predictivos', 'visión por computadora', 'procesamiento de lenguaje natural', 'sistemas inteligentes'],
  },
  {
    code: 'bases_de_datos',
    antes: ['sql', 'postgresql', 'mongodb', 'modelado'],
    despues: ['persistencia', 'modelado de datos', 'almacenamiento', 'relacional', 'no relacional', 'consultas'],
  },
  {
    code: 'redes',
    antes: ['tcp-ip', 'routing', 'linux', 'infraestructura'],
    despues: ['networking', 'conectividad', 'telecomunicaciones', 'protocolos', 'enrutamiento', 'infraestructura de red'],
  },
  {
    code: 'ciberseguridad',
    antes: ['pentesting', 'criptografia', 'vulnerabilidades', 'seguridad'],
    despues: ['seguridad informática', 'vulnerabilidades', 'protección de datos', 'análisis de riesgos', 'seguridad ofensiva', 'seguridad defensiva'],
  },
  {
    code: 'ingenieria_de_software',
    antes: ['uml', 'patrones', 'testing', 'git', 'arquitectura'],
    despues: ['arquitectura de software', 'calidad de software', 'procesos de desarrollo', 'requisitos', 'mantenimiento'],
  },
  {
    code: 'gestion_de_proyectos',
    antes: ['scrum', 'kanban', 'liderazgo', 'planificacion'],
    despues: ['planificación', 'metodologías ágiles', 'seguimiento', 'coordinación de equipos', 'gestión de riesgos'],
  },
];

const NUBE = {
  code: 'computacion_en_la_nube',
  name: 'Computación en la nube',
  description: 'Servicios en la nube, contenedores, despliegue y operación de sistemas.',
  tags: ['nube', 'cloud', 'contenedores', 'despliegue', 'escalabilidad', 'servicios administrados', 'devops'],
};

const SKILLS_NUBE: { code: string; name: string; aliases: string[] }[] = [
  { code: 'aws', name: 'AWS', aliases: ['Amazon Web Services'] },
  { code: 'microsoft_azure', name: 'Microsoft Azure', aliases: ['Azure'] },
  { code: 'google_cloud', name: 'Google Cloud', aliases: ['GCP', 'Google Cloud Platform'] },
  { code: 'docker', name: 'Docker', aliases: [] },
  { code: 'kubernetes', name: 'Kubernetes', aliases: ['K8s'] },
];

const ALIASES: { code: string; aliases: string[] }[] = [
  { code: 'postgresql', aliases: ['Postgres'] },
  { code: 'react', aliases: ['ReactJS', 'React.js'] },
  { code: 'node_js', aliases: ['Node', 'NodeJS'] },
  { code: 'javascript', aliases: ['JS'] },
  { code: 'typescript', aliases: ['TS'] },
  { code: 'machine_learning', aliases: ['ML'] },
  { code: 'administracion_linux', aliases: ['Linux'] },
];

const SECUNDARIAS: { skill: string; area: string }[] = [
  { skill: 'administracion_linux', area: 'ciberseguridad' },
  { skill: 'administracion_linux', area: 'computacion_en_la_nube' },
  { skill: 'python', area: 'desarrollo_web' },
  { skill: 'docker', area: 'ingenieria_de_software' },
];

/** Filas de un resultado: TypeORM devuelve `[filas, n]` en UPDATE/DELETE y `filas` en lo demás. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const filas = (r: any): any[] => (Array.isArray(r) && Array.isArray(r[0]) ? r[0] : Array.isArray(r) ? r : []);

/** ¿Este nombre ya identifica a alguna habilidad (por nombre o alias)? */
const OCUPADO = `EXISTS (
  SELECT 1 FROM "skills" o
   WHERE lower(o."name") = lower($1)
      OR EXISTS (SELECT 1 FROM unnest(o."aliases") al WHERE lower(al) = lower($1))
)`;

export class V32SemanticAreaTags1780610000001 implements MigrationInterface {
  name = 'V32SemanticAreaTags1780610000001';

  public async up(q: QueryRunner): Promise<void> {
    // Registro de lo que hace este up, para que el down revierta solo eso.
    await q.query(`
      CREATE TABLE "v32_catalog_seed_log" (
        "kind" varchar(20) NOT NULL,
        "ref" varchar(120) NOT NULL,
        PRIMARY KEY ("kind", "ref")
      )`);

    // 1 · Etiquetas semánticas en las áreas base que siguen como la semilla.
    for (const t of TAGS) {
      const r = await q.query(
        `UPDATE "academic_areas" SET "tags" = $2, "updated_at" = now()
          WHERE "code" = $1 AND "tags" = $3 RETURNING "id"`,
        [t.code, t.despues, t.antes],
      );
      if (filas(r).length > 0) {
        await q.query(`INSERT INTO "v32_catalog_seed_log" VALUES ('tags', $1)`, [t.code]);
      }
    }

    // 2 · Área «Computación en la nube» y sus habilidades.
    const nube = await q.query(
      `SELECT "id" FROM "academic_areas" WHERE "code" = $1 OR lower("name") = lower($2) LIMIT 1`,
      [NUBE.code, NUBE.name],
    );
    let nubeId: string = nube[0]?.id;
    if (!nubeId) {
      const creada = await q.query(
        `INSERT INTO "academic_areas" ("name", "code", "description", "tags", "is_active")
         VALUES ($1, $2, $3, $4, true) RETURNING "id"`,
        [NUBE.name, NUBE.code, NUBE.description, NUBE.tags],
      );
      nubeId = filas(creada)[0].id;
      await q.query(`INSERT INTO "v32_catalog_seed_log" VALUES ('area', $1)`, [NUBE.code]);
    }
    for (const s of SKILLS_NUBE) {
      const libre = await q.query(
        `SELECT NOT ${OCUPADO} AND NOT EXISTS (SELECT 1 FROM "skills" WHERE "code" = $2) AS libre`,
        [s.name, s.code],
      );
      const aliasesLibres: string[] = [];
      for (const a of s.aliases) {
        const r = await q.query(`SELECT NOT ${OCUPADO} AS libre`, [a]);
        if (r[0]?.libre) aliasesLibres.push(a);
      }
      if (libre[0]?.libre) {
        await q.query(
          `INSERT INTO "skills" ("name", "code", "aliases", "academic_area_id", "is_active")
           VALUES ($1, $2, $3, $4, true)`,
          [s.name, s.code, aliasesLibres, nubeId],
        );
        await q.query(`INSERT INTO "v32_catalog_seed_log" VALUES ('skill', $1)`, [s.code]);
      }
    }

    // 3 · Alias de las habilidades base, si no tenían y nadie los usa.
    for (const a of ALIASES) {
      const libres: string[] = [];
      for (const alias of a.aliases) {
        const r = await q.query(`SELECT NOT ${OCUPADO} AS libre`, [alias]);
        if (r[0]?.libre) libres.push(alias);
      }
      if (libres.length === 0) continue;
      const r = await q.query(
        `UPDATE "skills" SET "aliases" = $2, "updated_at" = now()
          WHERE "code" = $1 AND cardinality("aliases") = 0 RETURNING "id"`,
        [a.code, libres],
      );
      if (filas(r).length > 0) {
        await q.query(`INSERT INTO "v32_catalog_seed_log" VALUES ('aliases', $1)`, [a.code]);
      }
    }

    // 4 · Áreas secundarias de §11.1.
    for (const s of SECUNDARIAS) {
      const r = await q.query(
        `INSERT INTO "skill_area_relations" ("skill_id", "academic_area_id", "relation_type")
         SELECT sk."id", ar."id", 'SECONDARY'
           FROM "skills" sk, "academic_areas" ar
          WHERE sk."code" = $1 AND ar."code" = $2 AND sk."academic_area_id" IS DISTINCT FROM ar."id"
         ON CONFLICT DO NOTHING
         RETURNING "skill_id"`,
        [s.skill, s.area],
      );
      if (filas(r).length > 0) {
        await q.query(`INSERT INTO "v32_catalog_seed_log" VALUES ('secondary', $1)`, [`${s.skill}:${s.area}`]);
      }
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    const hecho = async (kind: string): Promise<string[]> =>
      (await q.query(`SELECT "ref" FROM "v32_catalog_seed_log" WHERE "kind" = $1`, [kind])).map(
        (f: { ref: string }) => f.ref,
      );

    for (const ref of await hecho('secondary')) {
      const [skill, area] = ref.split(':');
      await q.query(
        `DELETE FROM "skill_area_relations" r USING "skills" sk, "academic_areas" ar
          WHERE r."skill_id" = sk."id" AND r."academic_area_id" = ar."id" AND sk."code" = $1 AND ar."code" = $2`,
        [skill, area],
      );
    }
    for (const code of await hecho('aliases')) {
      const a = ALIASES.find((x) => x.code === code);
      if (a) await q.query(`UPDATE "skills" SET "aliases" = '{}' WHERE "code" = $1`, [code]);
    }
    // Lo creado aquí se borra si nadie lo usa; si ya se usa, se desactiva.
    for (const code of await hecho('skill')) {
      await q.query(`
        DO $$ BEGIN
          DELETE FROM "skills" WHERE "code" = '${code.replace(/'/g, "''")}';
        EXCEPTION WHEN foreign_key_violation THEN
          UPDATE "skills" SET "is_active" = false WHERE "code" = '${code.replace(/'/g, "''")}';
        END $$`);
    }
    for (const code of await hecho('area')) {
      await q.query(`
        DO $$ BEGIN
          DELETE FROM "academic_areas" WHERE "code" = '${code.replace(/'/g, "''")}'
            AND NOT EXISTS (SELECT 1 FROM "skills" s WHERE s."academic_area_id" = "academic_areas"."id");
          UPDATE "academic_areas" SET "is_active" = false WHERE "code" = '${code.replace(/'/g, "''")}';
        EXCEPTION WHEN foreign_key_violation THEN
          UPDATE "academic_areas" SET "is_active" = false WHERE "code" = '${code.replace(/'/g, "''")}';
        END $$`);
    }
    for (const code of await hecho('tags')) {
      const t = TAGS.find((x) => x.code === code);
      if (t) {
        await q.query(`UPDATE "academic_areas" SET "tags" = $2 WHERE "code" = $1 AND "tags" = $3`, [code, t.antes, t.despues]);
      }
    }
    await q.query(`DROP TABLE "v32_catalog_seed_log"`);
  }
}
