/**
 * Cierre V6 — verificación del contrato contra la API en marcha.
 *
 * Una sección por batch (PLAN_BATCHES_AFINIA_V6.md). Cada comprobación cita
 * el escenario de la matriz §16 del contrato (ACT-01…ADM-TECH-03) que
 * verifica. Se ejecuta con la API en modo de correo simulado.
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-v6.mjs [batch1 …]
 */
import { execSync } from 'child_process';
import { loginAdmin, provisionAndActivate, provisionStudent, req } from './lib/fixtures.mjs';

const TS = Date.now();
const L = String.fromCharCode(...String(TS).slice(-6).split('').map((d) => 97 + Number(d)));

const C = {
  r: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[90m',
  ok: '\x1b[32m', bad: '\x1b[31m', head: '\x1b[36m',
};

let passed = 0;
const failures = [];

function check(condition, label, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ${C.ok}✓${C.r} ${label}`);
  } else {
    failures.push(label + (detail ? ` -> ${detail}` : ''));
    console.log(`  ${C.bad}✗${C.r} ${label}${detail ? ` ${C.dim}-> ${detail}${C.r}` : ''}`);
  }
}

const objective = (t) => console.log(`\n${C.head}${C.bold}${t}${C.r}`);
const correoStaff = (k) => `v6.${k}.${TS}@univalle.edu`;
const correoEst = (k) => `v6.${k}.${TS}@est.univalle.edu`;
const json = (x) => JSON.stringify(x ?? null).slice(0, 220);
const en = (h) => new Date(Date.now() + h * 3_600_000).toISOString();
const psql = (sql) => execSync(
  `docker exec perfil_postgres psql -U ${process.env.POSTGRES_USER ?? 'perfil_user'} -d ${process.env.POSTGRES_DB ?? 'perfil_estudiantil'} -tAc "${sql.replace(/"/g, '\\"')}"`,
  { encoding: 'utf8' },
).trim();

/** Carlos (1–4), María (5–8) y Dirección: el ejemplo del §3.3 del contrato. */
async function escenarioScopes(ctx, k) {
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dora', lastName: `Scope${L}`, email: correoStaff(`${k}dir`), role: 'CAREER_DIRECTOR' });
  const carlos = await provisionAndActivate(ctx.admin, { firstName: 'Carlos', lastName: `Scope${L}`, email: correoStaff(`${k}carlos`), role: 'TEACHER' });
  const maria = await provisionAndActivate(ctx.admin, { firstName: 'Maria', lastName: `Scope${L}`, email: correoStaff(`${k}maria`), role: 'TEACHER' });
  await req('PUT', `/users/${carlos.userId}/semesters`, { token: ctx.admin, body: { semesters: [1, 2, 3, 4] } });
  await req('PUT', `/users/${maria.userId}/semesters`, { token: ctx.admin, body: { semesters: [4, 5, 6, 7, 8] } });
  const cats = (await req('GET', '/activity-categories', { token: ctx.admin })).data ?? [];
  const cat = cats.find((c) => c.appliesTo === 'academica') ?? cats[0];
  const area = ((await req('GET', '/academic-areas', { token: ctx.admin })).data ?? [])[0];
  const base = { type: 'academica', categoryId: cat.id, areaIds: [area.id], activityDate: en(72), endAt: en(74), modality: 'presencial', location: 'Aula 301' };
  return { director, carlos, maria, base };
}

const asignacionDe = (actividad, userId) => (actividad?.responsibles ?? []).find((r) => r.id === userId)?.assignedSemesters;

// ===========================================================================
//  BATCH V6-1 — Responsable × semestre en la API (§3.2, ACT-01…06, ADM-06)
// ===========================================================================
async function batch1(ctx) {
  objective('BATCH V6-1 · Cada responsable cubre sus semestres; ninguno queda sin responsable');
  const { director, carlos, maria, base } = await escenarioScopes(ctx, 'b1');
  const ver = async (id) => (await req('GET', `/activities/${id}`, { token: ctx.admin })).data;

  // Caso B (§3.3): Carlos + María → audiencia 1..8, asignación individual.
  const ambos = await req('POST', '/activities', {
    token: ctx.admin,
    body: { ...base, title: `Ambos ${L}`, semesterScope: [1, 2, 3, 4, 5, 6, 7, 8], responsibleUserIds: [carlos.userId, maria.userId], status: 'open' },
  });
  const a1 = ambos.data;
  check(ambos.status === 201 && json(asignacionDe(a1, carlos.userId)) === '[1,2,3,4]' && json(asignacionDe(a1, maria.userId)) === '[4,5,6,7,8]',
    'V6.1.1 Caso B Carlos + María cubren 1..8; cada uno queda asignado solo a lo suyo', json(a1?.responsibles?.map((r) => r.assignedSemesters)));

  // Caso C / ACT-02: quitar a María deja 5..8 sin responsable → no se guarda.
  const sinMaria = await req('PATCH', `/activities/${a1?.id}`, { token: ctx.admin, body: { responsibleUserIds: [carlos.userId] } });
  const tras = await ver(a1?.id);
  check(sinMaria.status === 400 && sinMaria.data?.code === 'ACTIVITY_SCOPE_NOT_COVERED' && json(sinMaria.data?.details?.uncoveredSemesters) === '[5,6,7,8]'
    && (tras?.responsibles ?? []).length === 2,
    'V6.1.2 ACT-02 Quitar a María de una publicada 1..8 se rechaza nombrando 5.º–8.º, sin guardar a medias', json({ s: sinMaria.status, c: sinMaria.data?.code, u: sinMaria.data?.details?.uncoveredSemesters }));

  // ACT-03 / Caso D: ambos cubren el 4.º; quitar a Carlos conserva el 4.º.
  const solo = await req('POST', '/activities', {
    token: ctx.admin,
    body: { ...base, title: `Cuarto ${L}`, semesterScope: [4], responsibleUserIds: [carlos.userId, maria.userId], status: 'open' },
  });
  const sinCarlos = await req('PATCH', `/activities/${solo.data?.id}`, { token: ctx.admin, body: { responsibleUserIds: [maria.userId] } });
  check(solo.status === 201 && sinCarlos.status === 200 && json((await ver(solo.data?.id))?.semesterScope) === '[4]',
    'V6.1.3 ACT-03 Si dos cubren el 4.º, quitar a uno conserva el 4.º', `${solo.status} / ${sinCarlos.status}`);

  // ACT-05 / B4: agregar el 8.º a una publicada que solo cubre Carlos.
  const deCarlos = await req('POST', '/activities', {
    token: ctx.admin,
    body: { ...base, title: `Carlos solo ${L}`, semesterScope: [1, 2], responsibleUserIds: [carlos.userId], status: 'open' },
  });
  const con8 = await req('PATCH', `/activities/${deCarlos.data?.id}`, { token: ctx.admin, body: { semesterScope: [1, 2, 8] } });
  check(con8.status === 400 && con8.data?.code === 'ACTIVITY_SCOPE_NOT_COVERED' && json((await ver(deCarlos.data?.id))?.semesterScope) === '[1,2]',
    'V6.1.4 ACT-05 Agregar el 8.º a una actividad que solo cubre Carlos se rechaza', `${con8.status} ${con8.data?.code}`);
  const con3 = await req('PATCH', `/activities/${deCarlos.data?.id}`, { token: ctx.admin, body: { semesterScope: [1, 2, 3] } });
  check(con3.status === 200 && json(asignacionDe(con3.data, carlos.userId)) === '[1,2,3]',
    'V6.1.5 Agregar un semestre que Carlos sí cubre se le asigna', json(asignacionDe(con3.data, carlos.userId)));

  // Caso F / ACT-01: petición fabricada que asigna a Carlos el 8.º.
  const falsa = await req('POST', '/activities', {
    token: ctx.admin,
    body: {
      ...base, title: `Falsa ${L}`, semesterScope: [1, 8], status: 'draft',
      responsibleAssignments: [{ userId: carlos.userId, semesters: [1, 8] }],
    },
  });
  check(falsa.status === 403 && falsa.data?.code === 'RESPONSIBLE_SCOPE_EXCEEDED' && !!falsa.data?.fields?.responsibleAssignments,
    'V6.1.6 Caso F Asignar a Carlos el 8.º por API es 403 estable (RESPONSIBLE_SCOPE_EXCEEDED), también en borrador', `${falsa.status} ${falsa.data?.code}`);
  const fuera = await req('POST', '/activities', {
    token: ctx.admin,
    body: { ...base, title: `Fuera ${L}`, semesterScope: [1], status: 'draft', responsibleAssignments: [{ userId: carlos.userId, semesters: [2] }] },
  });
  check(fuera.status === 400 && fuera.data?.code === 'ASSIGNMENT_OUTSIDE_AUDIENCE', 'V6.1.7 No se asigna un semestre que no está en la audiencia', `${fuera.status} ${fuera.data?.code}`);

  // Caso E / ACT-04: Dirección + Carlos → audiencia 1..8 por Dirección; Carlos solo 1..4.
  const conDir = await req('POST', '/activities', {
    token: ctx.admin,
    body: { ...base, title: `Con Direccion ${L}`, semesterScope: [1, 2, 3, 4, 5, 6, 7, 8], responsibleUserIds: [director.userId, carlos.userId], status: 'open' },
  });
  check(conDir.status === 201 && json(asignacionDe(conDir.data, director.userId)) === '[]' && json(asignacionDe(conDir.data, carlos.userId)) === '[1,2,3,4]',
    'V6.1.8 ACT-04 Con Dirección la audiencia puede ser 1..8, y Carlos sigue asignado solo a 1..4', json(conDir.data?.responsibles?.map((r) => r.assignedSemesters)));

  // Asignación explícita más estrecha: Carlos solo el 2.º; María el resto.
  const estrecha = await req('POST', '/activities', {
    token: ctx.admin,
    body: {
      ...base, title: `Estrecha ${L}`, semesterScope: [2, 5], status: 'open',
      responsibleAssignments: [{ userId: carlos.userId, semesters: [2] }, { userId: maria.userId, semesters: [5] }],
    },
  });
  check(estrecha.status === 201 && json(asignacionDe(estrecha.data, carlos.userId)) === '[2]' && json(asignacionDe(estrecha.data, maria.userId)) === '[5]',
    'V6.1.9 §3.4 La asignación por responsable se guarda tal cual y editar la recupera', json(estrecha.data?.responsibles?.map((r) => r.assignedSemesters)));

  // ACT-06 / ADM-06: cada docente opera solo a los estudiantes de sus semestres.
  const e3 = await provisionStudent(ctx.admin, { firstName: 'Ana', lastName: `Scope${L}`, email: correoEst('b1e3'), semester: 3 });
  const e6 = await provisionStudent(ctx.admin, { firstName: 'Beto', lastName: `Scope${L}`, email: correoEst('b1e6'), semester: 6 });
  for (const e of [e3, e6]) await req('POST', `/activities/${a1?.id}/register`, { token: e.token });
  const listaCarlos = ((await req('GET', `/activities/${a1?.id}/participants`, { token: carlos.token })).data ?? []).map((r) => r.studentProfileId);
  const listaMaria = ((await req('GET', `/activities/${a1?.id}/participants`, { token: maria.token })).data ?? []).map((r) => r.studentProfileId);
  check(listaCarlos.includes(e3.profileId) && !listaCarlos.includes(e6.profileId) && listaMaria.includes(e6.profileId) && !listaMaria.includes(e3.profileId),
    'V6.1.10 Regla 9 Cada responsable ve solo a los inscritos de sus semestres', json({ c: listaCarlos.length, m: listaMaria.length }));
  const asistencia = (t, p) => req('PATCH', `/activities/${a1?.id}/confirm-participation`, { token: t, body: { studentProfileId: p, status: 'confirmed' } });
  const ajena = await asistencia(carlos.token, e6.profileId);
  const propia = await asistencia(carlos.token, e3.profileId);
  check(ajena.status === 403 && ajena.data?.code === 'STUDENT_OUT_OF_RESPONSIBLE_SCOPE' && propia.status === 200,
    'V6.1.11 ADM-06 Carlos no confirma a un estudiante de 6.º (403); al de 3.º sí', `${ajena.status} ${ajena.data?.code} / ${propia.status}`);
  const deDireccion = ((await req('GET', `/activities/${conDir.data?.id}/participants`, { token: director.token })).status);
  check(deDireccion === 200, 'V6.1.12 Dirección, como responsable, no tiene ese límite', `${deDireccion}`);

  // Toda la carrera con solo docentes: necesita a Dirección o a la Sociedad.
  const carrera = await req('POST', '/activities', {
    token: ctx.admin,
    body: { ...base, title: `Carrera ${L}`, responsibleUserIds: [carlos.userId, maria.userId], status: 'open' },
  });
  check(carrera.status === 400 && carrera.data?.code === 'ACTIVITY_SCOPE_NOT_COVERED',
    'V6.1.13 §3.4 «Toda la carrera» con solo docentes no se publica (no se finge cobertura)', `${carrera.status} ${carrera.data?.code}`);

  // El docente creador sigue sin poder salirse de su alcance (ya era así).
  const propiaDoc = await req('POST', '/activities', { token: carlos.token, body: { ...base, title: `De Carlos ${L}`, semesterScope: [1, 2], status: 'draft' } });
  const doc8 = await req('PATCH', `/activities/${propiaDoc.data?.id}`, { token: carlos.token, body: { semesterScope: [1, 2, 8] } });
  check(propiaDoc.status === 201 && json(asignacionDe(propiaDoc.data, carlos.userId)) === '[1,2]' && doc8.status === 403,
    'V6.1.14 ACT-01 El docente creador queda asignado a su audiencia y no agrega el 8.º (403)', `${propiaDoc.status} / ${doc8.status}`);

  // Auditoría: el cambio de asignaciones queda registrado.
  const auditado = psql(`select count(*) from audit_events where entity_id = '${estrecha.data?.id}' and metadata::text like '%responsibleAssignments%'`);
  check(Number(auditado) >= 1, 'V6.1.15 La creación registra en la auditoría quién cubre qué', auditado);
}

const BATCHES = { batch1 };

async function main() {
  console.log(`${C.bold}Afinia V6 — verificación del contrato contra la API${C.r}`);
  const ctx = { admin: await loginAdmin() };
  const pedidos = process.argv.slice(2);
  for (const [nombre, paso] of Object.entries(BATCHES)) {
    if (pedidos.length && !pedidos.includes(nombre)) continue;
    try {
      await paso(ctx);
    } catch (e) {
      failures.push(`${nombre}: ${e.message}`);
      console.log(`  ${C.bad}✗ ${nombre} se interrumpió: ${e.message}${C.r}`);
    }
  }
  console.log(`\n${C.bold}${passed} comprobaciones correctas, ${failures.length} fallidas${C.r}`);
  if (failures.length) {
    for (const f of failures) console.log(`  ${C.bad}- ${f}${C.r}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
