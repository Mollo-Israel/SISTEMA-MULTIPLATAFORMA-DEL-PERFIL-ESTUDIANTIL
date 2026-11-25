/**
 * V7.1 §6.2 · Informe de impacto de D04 antes de un recálculo autorizado.
 *
 * Compara la afinidad GUARDADA de cada estudiante afectado con la que daría
 * la regla vigente (motor v6), calculada con `simulate`: NO escribe
 * resultados, instantáneas ni auditoría. Afectado = tiene alguna
 * participación confirmada en una actividad «Sin resultado».
 *
 * Solo agrega cifras: no imprime nombres ni identificadores de personas.
 *
 *   npm run api:build   (o el api:dev en observación ya mantiene api/dist)
 *   POSTGRES_DB=perfil_estudiantil node scripts/v7/impacto-d04.cjs [salida.json]
 */
const path = require('node:path');
const fs = require('node:fs');

const API = path.resolve(__dirname, '..', '..', 'api');
process.chdir(API); // .env y ../.env, como la API
Object.assign(process.env, {
  // Nada en segundo plano: este script solo lee.
  MAIL_WORKER_ENABLED: 'false',
  VALIDATION_WORKER_ENABLED: 'false',
  NOTIFICATION_REMINDERS_ENABLED: 'false',
  ORPHAN_CLEANUP_ENABLED: 'false',
  AFFINITY_BACKFILL_ON_BOOT: 'false',
  ACTIVITY_LIFECYCLE_INTERVAL_MS: '0',
  LINK_CHECK_ENABLED: 'false',
  REPOSITORY_CHECK_ENABLED: 'false',
});

const { NestFactory } = require(require.resolve('@nestjs/core', { paths: [API] }));
const { DataSource } = require(require.resolve('typeorm', { paths: [API] }));
const { AppModule } = require(path.join(API, 'dist', 'app.module'));
const { AffinityEngineService } = require(path.join(API, 'dist', 'affinity-recalc', 'affinity.engine'));

const tramo = (d) => (d === 0 ? '0' : d <= 5 ? '1–5' : d <= 10 ? '6–10' : d <= 25 ? '11–25' : '>25');

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const db = app.get(DataSource);
  const engine = app.get(AffinityEngineService);
  const base = db.options.database;

  const afectados = (await db.query(
    `SELECT DISTINCT r.student_profile_id AS id
       FROM activity_registrations r JOIN activities a ON a.id = r.activity_id
      WHERE r.status = 'confirmed' AND a.outcome_policy = 'none'`,
  )).map((f) => f.id);

  const resumen = {
    base, fecha: new Date().toISOString(), motor: 6,
    estudiantesAfectados: afectados.length,
    estudiantesConCambio: 0, areasEvaluadas: 0, areasQueBajan: 0, areasQueDesaparecen: 0,
    puntosQuePierdenEnTotal: 0, bajaMaxima: 0, bajaMedia: 0,
    cambiosDeNivel: {}, tramosDeBaja: { '0': 0, '1–5': 0, '6–10': 0, '11–25': 0, '>25': 0 },
    versionesGuardadas: {},
  };
  const bajas = [];
  let i = 0;
  for (const id of afectados) {
    i++;
    const guardado = await db.query(
      'SELECT academic_area_id AS area, score, level, engine_version AS v FROM affinity_results WHERE student_profile_id = $1', [id],
    );
    for (const g of guardado) resumen.versionesGuardadas[g.v] = (resumen.versionesGuardadas[g.v] ?? 0) + 1;
    const nuevo = new Map((await engine.simulate(id)).map((a) => [a.academicAreaId, a]));
    let cambia = false;
    for (const g of guardado) {
      resumen.areasEvaluadas++;
      const n = nuevo.get(g.area);
      const antes = Number(g.score);
      const despues = n ? n.score : 0;
      const baja = Math.max(0, antes - despues);
      resumen.tramosDeBaja[tramo(baja)]++;
      if (baja > 0) {
        cambia = true;
        resumen.areasQueBajan++;
        resumen.puntosQuePierdenEnTotal += baja;
        bajas.push(baja);
        resumen.bajaMaxima = Math.max(resumen.bajaMaxima, baja);
      }
      if (!n) resumen.areasQueDesaparecen++;
      const nivelDespues = n ? n.level : 'sin_afinidad';
      if (nivelDespues !== g.level) {
        const k = `${g.level} → ${nivelDespues}`;
        resumen.cambiosDeNivel[k] = (resumen.cambiosDeNivel[k] ?? 0) + 1;
      }
    }
    if (cambia) resumen.estudiantesConCambio++;
    if (i % 200 === 0) process.stderr.write(`  ${i}/${afectados.length}\n`);
  }
  resumen.bajaMedia = bajas.length ? Math.round((bajas.reduce((s, x) => s + x, 0) / bajas.length) * 10) / 10 : 0;

  // Tecnologías respaldadas que solo venían de actividades «Sin resultado» (D04 en consulta).
  const [{ n: paresQueSalen }] = await db.query(
    `WITH de_ninguna AS (
       SELECT DISTINCT r.student_profile_id AS p, a_s.skill_id AS s
         FROM activity_registrations r JOIN activities a ON a.id = r.activity_id
         JOIN activity_skills a_s ON a_s.activity_id = a.id
        WHERE r.status = 'confirmed' AND a.outcome_policy = 'none'),
     de_otras AS (
       SELECT DISTINCT r.student_profile_id AS p, a_s.skill_id AS s
         FROM activity_registrations r JOIN activities a ON a.id = r.activity_id
         JOIN activity_skills a_s ON a_s.activity_id = a.id
        WHERE r.status = 'confirmed' AND a.outcome_policy <> 'none')
     SELECT count(*)::int AS n FROM de_ninguna d
      WHERE NOT EXISTS (SELECT 1 FROM de_otras o WHERE o.p = d.p AND o.s = d.s)`,
  );
  resumen.tecnologiasRespaldadasQueSoloVenianDeSinResultado = paresQueSalen;
  const [{ n: itemsExportables }] = await db.query(
    `SELECT count(*)::int AS n FROM activity_registrations r JOIN activities a ON a.id = r.activity_id
      WHERE r.status = 'confirmed' AND a.outcome_policy = 'none' AND a.origin_type = 'internal'`,
  );
  resumen.itemsExportablesQueSalen = itemsExportables;

  await app.close();
  const salida = process.argv[2];
  if (salida) fs.writeFileSync(salida, JSON.stringify(resumen, null, 2));
  console.log(JSON.stringify(resumen, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
