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
import { API, asegurarGithubSimulado, codigoUniversitario, crearProyectoActivo, loginAdmin, provisionAndActivate, provisionStudent, repoDePrueba, req } from './lib/fixtures.mjs';

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
  const cats = ((await req('GET', '/activity-categories', { token: ctx.admin })).data ?? []).filter((c) => c.isActive !== false);
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

// ===========================================================================
//  BATCH V6-3 — Duplicar sin elevar permisos (§3.5) y «Ver detalles» (§3.6)
// ===========================================================================
async function batch3(ctx) {
  objective('BATCH V6-3 · La copia no hereda semestres ajenos ni la historia de la original');
  const { director, carlos, maria, base } = await escenarioScopes(ctx, 'b3');
  const est = await provisionStudent(ctx.admin, { firstName: 'Ana', lastName: `Copia${L}`, email: correoEst('b3e2'), semester: 2 });

  const origen = await req('POST', '/activities', {
    token: director.token,
    body: { ...base, title: `Original ${L}`, semesterScope: [1, 2, 3, 4, 5, 6, 7, 8], responsibleUserIds: [carlos.userId, maria.userId], status: 'open' },
  });
  await req('POST', `/activities/${origen.data?.id}/register`, { token: est.token });

  // V6-SCOPE-02: antes era 403 por los semestres heredados.
  const copia = await req('POST', `/activities/${origen.data?.id}/duplicate`, { token: carlos.token });
  const c = copia.data;
  check(copia.status === 201 && c?.status === 'draft' && c?.creatorId === carlos.userId && json(c?.semesterScope) === '[1,2,3,4]',
    'V6.3.1 V6-SCOPE-02 Carlos duplica: nuevo borrador suyo, solo con sus semestres (1.º–4.º)', json({ s: copia.status, st: c?.status, sem: c?.semesterScope, m: copia.data?.message }));
  check(/5\.º, 6\.º, 7\.º, 8\.º/.test(c?.duplicateNotice ?? ''), 'V6.3.2 La copia avisa qué semestres se quitaron', c?.duplicateNotice);
  const filasCopia = (await req('GET', `/activities/${c?.id}/participants`, { token: carlos.token })).data ?? [];
  check(c?.id !== origen.data?.id && filasCopia.length === 0 && c?.reviewStatus !== 'approved'
    && json((c?.responsibles ?? []).map((r) => r.id)) === json([carlos.userId]),
  'V6.3.3 Sin inscripciones ni aprobación de la original; responsable = quien duplica (sin María)', json({ n: filasCopia.length, r: c?.reviewStatus, resp: (c?.responsibles ?? []).length }));

  const deDireccion = await req('POST', `/activities/${origen.data?.id}/duplicate`, { token: director.token });
  check(deDireccion.status === 201 && json(deDireccion.data?.semesterScope) === '[1,2,3,4,5,6,7,8]' && !deDireccion.data?.duplicateNotice,
    'V6.3.4 Dirección duplica y conserva la audiencia (sin aviso)', json(deDireccion.data?.semesterScope));

  // Intersección vacía: la original va al 6.º y Carlos solo cubre 1.º–4.º.
  const ajena = await req('POST', '/activities', {
    token: director.token,
    body: { ...base, title: `Solo sexto ${L}`, semesterScope: [6], responsibleUserIds: [director.userId, carlos.userId], status: 'open' },
  });
  const vacia = await req('POST', `/activities/${ajena.data?.id}/duplicate`, { token: carlos.token });
  check(vacia.status === 201 && vacia.data?.status === 'draft' && vacia.data?.semesterScope === null && /sin semestres/.test(vacia.data?.duplicateNotice ?? ''),
    'V6.3.5 §3.5 Sin semestres en común: borrador sin semestres y mensaje para completarlos (no 400/403)', json({ s: vacia.status, sem: vacia.data?.semesterScope, n: vacia.data?.duplicateNotice }));
  await req('PATCH', `/activities/${vacia.data?.id}`, { token: carlos.token, body: { activityDate: en(96), endAt: en(98) } });
  const sinElegir = await req('POST', `/activities/${vacia.data?.id}/submit`, { token: carlos.token, body: {} });
  check(sinElegir.status === 400 && sinElegir.data?.code === 'SEMESTERS_REQUIRED' && !!sinElegir.data?.fields?.semesterScope,
    'V6.3.6 Sin elegir semestres no se envía a revisión (no sería «toda la carrera» de un docente)', `${sinElegir.status} ${sinElegir.data?.code}`);
  await req('PATCH', `/activities/${vacia.data?.id}`, { token: carlos.token, body: { semesterScope: [2] } });
  const elegida = await req('POST', `/activities/${vacia.data?.id}/submit`, { token: carlos.token, body: {} });
  check([200, 201].includes(elegida.status), 'V6.3.7 Elegidos sus semestres, se envía a revisión', `${elegida.status} ${json(elegida.data?.message)}`);
  const auditoria = psql(`select count(*) from audit_events where event_type = 'ACTIVITY_DUPLICATED' and entity_id = '${vacia.data?.id}' and metadata::text like '%notice%'`);
  check(Number(auditoria) === 1, 'V6.3.8 La duplicación y su aviso quedan en la auditoría', auditoria);

  // §3.6: el responsable que no creó la actividad tiene el detalle, sin edición.
  const detalle = await req('GET', `/activities/${origen.data?.id}`, { token: carlos.token });
  const yo = (detalle.data?.responsibles ?? []).find((r) => r.id === carlos.userId);
  const editar = await req('PATCH', `/activities/${origen.data?.id}`, { token: carlos.token, body: { title: 'Cambio ajeno' } });
  check(detalle.status === 200 && json(yo?.assignedSemesters) === '[1,2,3,4]' && editar.status === 403,
    'V6.3.9 §3.6 El responsable ve el detalle con su semestre asignado y sigue sin poder editar (403)', json({ d: detalle.status, a: yo?.assignedSemesters, e: editar.status }));
}

// ===========================================================================
//  BATCH V6-4 — Cupo y admisión independientes (§4.1–§4.3, ADM-01…05)
// ===========================================================================
async function batch4(ctx) {
  objective('BATCH V6-4 · Cuatro combinaciones de cupo × admisión; externas con la misma política');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dora', lastName: `Cupo${L}`, email: correoStaff('b4dir'), role: 'CAREER_DIRECTOR' });
  const est = await Promise.all([0, 1, 2, 3].map((i) =>
    provisionStudent(ctx.admin, { firstName: ['Ana', 'Beto', 'Ciro', 'Dani'][i], lastName: `Cupo${L}`, email: correoEst(`b4e${i}`), semester: 3 })));
  const cats = ((await req('GET', '/activity-categories', { token: director.token })).data ?? []).filter((c) => c.isActive !== false);
  const cat = cats.find((c) => c.appliesTo === 'academica') ?? cats[0];
  const crear = (titulo, extra = {}) => req('POST', '/activities', {
    token: director.token,
    body: { title: `${titulo} ${L}`, type: 'academica', categoryId: cat.id, semesterScope: [3], activityDate: en(48), endAt: en(50), status: 'open', ...extra },
  });
  const inscribir = (id, e) => req('POST', `/activities/${id}/register`, { token: e.token });
  const ocupadas = (id) => Number(psql(`select count(*) from activity_registrations where activity_id = '${id}' and status in ('accepted','confirmed')`));

  // Sin límite × abierta → admitida al instante (nunca asistencia).
  const libre = await crear('Sin limite abierta');
  const r0 = await inscribir(libre.data?.id, est[0]);
  check(r0.status === 201 && r0.data?.status === 'accepted', 'V6.4.1 ADM-01 Sin límite y abierta: admitida al instante, no «presente»', `${r0.status} ${r0.data?.status}`);

  // Sin límite × aprobación → pendiente.
  const dirigida = await crear('Sin limite aprobacion', { registrationMode: 'approval' });
  const r1 = await inscribir(dirigida.data?.id, est[0]);
  check(r1.status === 201 && r1.data?.status === 'registered', 'V6.4.2 Sin límite y por aprobación: queda pendiente', `${r1.status} ${r1.data?.status}`);

  // Con límite × abierta → por orden de solicitud, atómico (ADM-02: 3 simultáneas, cupo 2).
  const taller = await crear('Taller abierto cupo 2', { capacity: 2 });
  const tres = await Promise.all(est.slice(0, 3).map((e) => inscribir(taller.data?.id, e)));
  const admitidas = tres.filter((r) => r.status === 201 && r.data?.status === 'accepted').length;
  const llenas = tres.filter((r) => r.status === 409 && r.data?.code === 'ACTIVITY_FULL').length;
  check(admitidas === 2 && llenas === 1 && ocupadas(taller.data?.id) === 2,
    'V6.4.3 ADM-02 Cupo 2 y abierta con 3 solicitudes simultáneas: 2 admitidas por orden, 1 «cupo agotado», sin sobrerreserva',
    tres.map((r) => `${r.status}:${r.data?.status ?? r.data?.code}`).join(' '));
  const rechazada = tres.find((r) => r.status === 409);
  check(/por orden de solicitud/.test(rechazada?.data?.message ?? ''), 'V6.4.4 El aviso explica la regla usada para el cupo', rechazada?.data?.message);
  const vista = (await req('GET', `/activities/${taller.data?.id}`, { token: est[3].token })).data;
  check(vista?.seatsLeft === 0 && vista?.capacity === 2 && vista?.registrationMode === 'open',
    'V6.4.5 El estudiante ve «0 de 2 plazas» y que la admisión es abierta', json({ s: vista?.seatsLeft, c: vista?.capacity, m: vista?.registrationMode }));
  // Una baja libera la plaza y la siguiente solicitud la toma sola.
  const quien = tres.findIndex((r) => r.status === 201);
  await req('POST', `/activities/${taller.data?.id}/cancel-registration`, { token: est[quien].token });
  const r3 = await inscribir(taller.data?.id, est[3]);
  check(r3.status === 201 && r3.data?.status === 'accepted' && ocupadas(taller.data?.id) === 2,
    'V6.4.6 Al liberarse una plaza, la siguiente solicitud la toma por orden', `${r3.status} ${r3.data?.status}`);

  // Con límite × aprobación → pendientes; el responsable admite hasta el cupo.
  const seleccion = await crear('Taller por aprobacion cupo 1', { capacity: 1, registrationMode: 'approval' });
  const [p0, p1] = [await inscribir(seleccion.data?.id, est[0]), await inscribir(seleccion.data?.id, est[1])];
  const adm0 = await req('PATCH', `/activities/${seleccion.data?.id}/confirm-participation`, { token: director.token, body: { studentProfileId: est[0].profileId, status: 'accepted' } });
  const adm1 = await req('PATCH', `/activities/${seleccion.data?.id}/confirm-participation`, { token: director.token, body: { studentProfileId: est[1].profileId, status: 'accepted' } });
  check(p0.data?.status === 'registered' && p1.data?.status === 'registered' && adm0.status === 200 && adm1.status === 409 && adm1.data?.code === 'ACTIVITY_FULL',
    'V6.4.7 Con límite y por aprobación: pendientes; el responsable admite hasta el cupo y no más', `${p0.data?.status}/${p1.data?.status} ${adm0.status} ${adm1.status}`);

  // §4.2: admitir nunca confirma asistencia.
  const tray = (await req('GET', '/trajectory/me', { token: est[0].token })).data;
  check(!(tray?.entries ?? []).some((x) => [libre.data?.id, taller.data?.id, seleccion.data?.id].includes(x.id) && x.cvEligible === true),
    'V6.4.8 §4.2 Ninguna admisión cuenta como asistencia en la trayectoria');

  // §4.3 / V6-ACT-03: externa con cupo y aprobación; su aceptación nunca es automática.
  const externa = await req('POST', '/activities', {
    token: director.token,
    body: {
      title: `Externa con cupo ${L}`, type: 'academica', categoryId: cat.id, semesterScope: [3], activityDate: en(48), endAt: en(50), status: 'open',
      originType: 'external', provider: 'Proveedor de pruebas', externalUrl: 'https://cursos.afinia-pruebas.org/curso', modality: 'virtual',
      capacity: 3, registrationMode: 'approval',
    },
  });
  const rExt = await inscribir(externa.data?.id, est[0]);
  const externaAbierta = await req('POST', '/activities', {
    token: director.token,
    body: {
      title: `Externa abierta ${L}`, type: 'academica', categoryId: cat.id, semesterScope: [3], activityDate: en(48), endAt: en(50), status: 'open',
      originType: 'external', provider: 'Proveedor de pruebas', externalUrl: 'https://cursos.afinia-pruebas.org/abierto', modality: 'virtual',
    },
  });
  const rExtA = await inscribir(externaAbierta.data?.id, est[1]);
  check(externa.status === 201 && externa.data?.capacity === 3 && externa.data?.registrationMode === 'approval' && rExt.data?.status === 'registered' && rExtA.data?.status === 'registered',
    'V6.4.9 V6-ACT-03 Una externa guarda cupo y admisión; su plaza la confirma el proveedor (nunca automática)',
    json({ s: externa.status, c: externa.data?.capacity, m: externa.data?.registrationMode, r: rExt.data?.status, a: rExtA.data?.status }));
}

// ===========================================================================
//  BATCH V6-6 — Alta de docente con sus semestres (§5.3, §5.4)
// ===========================================================================
async function batch6(ctx) {
  objective('BATCH V6-6 · El docente nace con los semestres que dicta; el correo no se inventa');
  const alta = (k, extra) => req('POST', '/users', {
    token: ctx.admin,
    body: { firstName: 'Teo', firstSurname: `Alta${L}`, email: correoStaff(k), universityCode: codigoUniversitario(extra.role), ...extra },
  });
  const docente = await alta('b6doc', { role: 'TEACHER', teacherSemesters: [3, 1, 2] });
  const guardados = (await req('GET', `/users/${docente.data?.id}/semesters`, { token: ctx.admin })).data;
  check(docente.status === 201 && json(guardados) === '[1,2,3]' && json(docente.data?.semesters) === '[1,2,3]',
    'V6.6.1 V6-USER-03 Al crear un docente se guardan los semestres que dicta (ordenados)', json({ s: docente.status, g: guardados, m: docente.data?.message }));
  const auditoria = psql(`select metadata->>'teacherSemesters' from audit_events where event_type = 'USER_PROVISIONED' and entity_id = '${docente.data?.id}'`);
  check(auditoria === '[1, 2, 3]', 'V6.6.2 El alta registra en la auditoría los semestres asignados', auditoria);

  const sinCarga = await alta('b6sincarga', { role: 'TEACHER' });
  const vacios = (await req('GET', `/users/${sinCarga.data?.id}/semesters`, { token: ctx.admin })).data;
  check(sinCarga.status === 201 && json(vacios) === '[]', 'V6.6.3 Un docente sin carga se crea igual, sin ningún semestre (pendiente de configuración)', json({ s: sinCarga.status, v: vacios }));

  const director = await alta('b6dir', { role: 'CAREER_DIRECTOR', teacherSemesters: [1] });
  check(director.status === 400 && !!director.data?.fields?.teacherSemesters, 'V6.6.4 Los semestres que dicta solo valen para un docente (400 en su campo)', `${director.status} ${json(director.data?.fields)}`);
  const fuera = await alta('b6fuera', { role: 'TEACHER', teacherSemesters: [9] });
  check(fuera.status === 400, 'V6.6.5 Un semestre fuera de 1..8 se rechaza', `${fuera.status}`);
  const repetido = await alta('b6doc', { role: 'TEACHER', teacherSemesters: [1] });
  check(repetido.status === 409 && (await req('GET', `/users?search=${encodeURIComponent(correoStaff('b6doc'))}`, { token: ctx.admin })).data?.length === 1,
    'V6.6.6 §5.4 Un correo repetido se rechaza (409) y no crea otra cuenta', `${repetido.status}`);
}

// ===========================================================================
//  BATCH V6-7 — Contribución sin el 400 del rol heredado (§6, PRO-01…04)
// ===========================================================================
async function batch7(ctx) {
  objective('BATCH V6-7 · Cada integrante confirma lo suyo; un rol anterior en texto libre ya no da 400');
  const [ana, luis, carla] = await Promise.all(['b7ana', 'b7luis', 'b7carla'].map((k, i) =>
    provisionStudent(ctx.admin, { firstName: ['Ana', 'Luis', 'Carla'][i], lastName: `Contrib${L}`, email: correoEst(k), semester: 5 })));
  const skills = ((await req('GET', '/skills', { token: ana.token })).data ?? []).filter((s) => s.isActive !== false && s.academicAreaId);
  // s3 comparte área con s1: quitarla no deja un área sin tecnología (eso lo impide otra regla).
  const [s1] = skills;
  const s3 = skills.find((s) => s.id !== s1.id && s.academicAreaId === s1.academicAreaId);
  const s2 = skills.find((s) => ![s1.id, s3.id].includes(s.id));
  const areas = [...new Set([s1, s2, s3].map((s) => s.academicAreaId))];
  const p = await req('POST', '/projects', {
    token: ana.token,
    body: { title: `Proyecto contribuciones ${L}`, areaIds: areas, skillIds: [s1.id, s2.id, s3.id], repositoryUrl: repoDePrueba(`v6-contrib-${TS}`), status: 'draft' },
  });
  const id = p.data?.id;
  const invitar = (perfil, rol) => req('POST', `/projects/${id}/invitations`, { token: ana.token, body: { invitedProfileId: perfil, proposedRole: rol } });
  const aceptar = async (est) => {
    const suya = ((await req('GET', '/projects/invitations/mine', { token: est.token })).data ?? []).find((i) => i.project?.id === id);
    return req('PATCH', `/projects/invitations/${suya?.id}`, { token: est.token, body: { decision: 'accept' } });
  };
  await invitar(luis.profileId, 'Backend');
  await aceptar(luis);
  const detalle = async (token = ana.token) => (await req('GET', `/projects/${id}/members/detailed`, { token })).data ?? [];
  const de = async (est) => (await detalle()).find((m) => m.userId === est.userId);
  const contribuir = (est, body) => req('PUT', `/projects/${id}/my-contribution`, { token: est.token, body });

  // PRO-01: reproducción del 400. Luis heredó un rol libre de una invitación anterior al catálogo.
  psql(`update project_members set role = 'Desarrollador Backend', roles = '{}' where project_id = '${id}' and user_id = '${luis.userId}'`);
  const crudo = await contribuir(luis, { contribution: 'Hice la API.', roles: ['Desarrollador Backend'], skillIds: [s1.id] });
  check(crudo.status === 400 && !!crudo.data?.fields?.roles,
    'V6.7.1 PRO-01 Reproducción: reenviar el rol libre «Desarrollador Backend» era el 400 VALIDATION_ERROR (error en el campo roles)', `${crudo.status} ${json(crudo.data?.fields)}`);
  const visto = await de(luis);
  check(json(visto?.roles) === '["Backend"]' && visto?.rolAnterior === 'Desarrollador Backend',
    'V6.7.2 PRO-02 La API entrega el rol traducido al catálogo (Backend) y avisa del anterior', json({ r: visto?.roles, a: visto?.rolAnterior }));
  const conLoQueMuestra = await contribuir(luis, { contribution: 'Hice la API y los modelos.', roles: visto?.roles, skillIds: [s1.id, s3.id] });
  check(conLoQueMuestra.status === 200, 'V6.7.3 PRO-03 Con lo que muestra el formulario, Luis guarda su contribución (2xx)', `${conLoQueMuestra.status} ${json(conLoQueMuestra.data?.message)}`);

  // A, B, C: varios roles; la misma tecnología para los dos; nadie pisa al otro.
  const deAna = await contribuir(ana, { contribution: 'Coordiné y armé el backend.', roles: ['Backend', 'Responsable'], skillIds: [s1.id, s2.id] });
  const anaVista = await de(ana);
  const luisVista = await de(luis);
  check(deAna.status === 200 && json(anaVista?.roles) === '["Backend","Responsable"]'
    && json(anaVista?.skillsUsed.map((s) => s.skillId).sort()) === json([s1.id, s2.id].sort()),
  'V6.7.4 A Ana: Backend + Responsable con dos tecnologías, persistido', json({ s: deAna.status, r: anaVista?.roles }));
  check(json(luisVista?.skillsUsed.map((s) => s.skillId).sort()) === json([s1.id, s3.id].sort()) && luisVista?.contributionConfirmed === true,
    'V6.7.5 B/C Luis conserva la suya (también con la misma tecnología que Ana): no son exclusivas', json(luisVista?.skillsUsed));

  // E: tecnología que no es del proyecto.
  const ajena = skills.find((s) => ![s1.id, s2.id, s3.id].includes(s.id));
  const fuera = await contribuir(luis, { skillIds: [ajena.id] });
  check(fuera.status === 400 && fuera.data?.code === 'SKILL_NOT_IN_PROJECT', 'V6.7.6 E Una tecnología que el proyecto no tiene se rechaza', `${fuera.status} ${fuera.data?.code}`);

  // F: no se confirma por otra persona.
  const falsa = await contribuir(luis, { userId: ana.userId, studentProfileId: ana.profileId, contribution: 'Ana no hizo nada.' });
  const anaTras = await de(ana);
  check([400, 403].includes(falsa.status) && anaTras?.contribution === 'Coordiné y armé el backend.',
    'V6.7.7 F Intentar escribir la contribución de otra integrante se rechaza y no la toca', `${falsa.status}`);

  // G: invitación pendiente → no hay contribución propia que confirmar.
  await invitar(carla.profileId, 'Frontend');
  const pendiente = await contribuir(carla, { contribution: 'Todavía no acepto.' });
  check([403, 404].includes(pendiente.status), 'V6.7.8 G Con la invitación pendiente no se confirma contribución', `${pendiente.status}`);
  // Una invitación anterior al catálogo («Tester») nace con su equivalente (QA).
  psql(`update project_invitations set proposed_role = 'Tester' where project_id = '${id}' and invited_profile_id = '${carla.profileId}'`);
  const aceptada = await aceptar(carla);
  const carlaVista = await de(carla);
  check(aceptada.status === 200 && carlaVista?.role === 'QA' && json(carlaVista?.roles) === '["QA"]',
    'V6.7.9 PRO-04 Aceptar una invitación con rol libre anterior deja el rol del catálogo (Tester → QA)', json({ s: aceptada.status, r: carlaVista?.role }));

  // H: tras recargar, lo mismo; D: quitar una tecnología usada pide reconfirmar.
  const recarga = await de(luis);
  check(json(recarga?.roles) === '["Backend"]' && recarga?.skillsUsed.length === 2, 'V6.7.10 H Al recargar, roles y tecnologías son los guardados', json({ r: recarga?.roles, n: recarga?.skillsUsed.length }));
  // La reconfirmación aplica a un proyecto activo (en borrador nada está atribuido aún).
  await asegurarGithubSimulado();
  await contribuir(carla, { contribution: 'Probé la aplicación.', roles: ['QA'], skillIds: [s1.id] });
  await req('POST', `/projects/${id}/evidences`, { token: ana.token, body: { evidenceType: 'link', externalUrl: `https://capturas.example.org/${id}.png`, description: 'Captura.' } });
  const activo = await req('PATCH', `/projects/${id}`, { token: ana.token, body: { status: 'active' } });
  check(activo.status === 200, 'V6.7.11a El proyecto con las tres contribuciones confirmadas se activa', `${activo.status} ${json(activo.data?.message)}`);
  await req('PATCH', `/projects/${id}`, { token: ana.token, body: { skillIds: [s1.id, s2.id] } });
  const luisD = await de(luis);
  check(luisD?.contributionConfirmed === false, 'V6.7.11 D Quitar del proyecto una tecnología que Luis confirmó le pide reconfirmar (con aviso)', json({ c: luisD?.contributionConfirmed }));
}

// ===========================================================================
//  BATCH V6-8 — Proyectos sin OCR; mínimos de activación (§7.1–§7.3, PRO-05…08)
// ===========================================================================
async function subir(token, bytes, nombre, tipo) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: tipo }), nombre);
  const res = await fetch(`${API}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data };
}
// PNG mínimo válido (1×1).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function batch8(ctx) {
  objective('BATCH V6-8 · La evidencia de un proyecto no pasa por OCR; activar pide evidencia o demo, no galería');
  await asegurarGithubSimulado();
  const est = await provisionStudent(ctx.admin, { firstName: 'Oto', lastName: `SinOcr${L}`, email: correoEst('b8e1'), semester: 6 });
  const skill = ((await req('GET', '/skills', { token: est.token })).data ?? []).find((s) => s.isActive !== false && s.academicAreaId);
  const nuevo = (titulo, extra = {}) => req('POST', '/projects', {
    token: est.token,
    body: { title: `${titulo} ${L}`, areaIds: [skill.academicAreaId], skillIds: [skill.id], repositoryUrl: repoDePrueba(`v6-${titulo.toLowerCase().replace(/[^a-z]+/g, '-')}-${TS}`), status: 'draft', ...extra },
  });
  const contribuir = (id) => req('PUT', `/projects/${id}/my-contribution`, { token: est.token, body: { contribution: 'Lo construí.', skillIds: [skill.id] } });
  const activar = (id, extra = {}) => req('PATCH', `/projects/${id}`, { token: est.token, body: { status: 'active', ...extra } });

  // PRO-06: solo galería → no activa (la imagen decorativa no acredita funcionamiento).
  const conGaleria = await nuevo('Solo galeria');
  await contribuir(conGaleria.data?.id);
  const img = await subir(est.token, PNG, 'portada.png', 'image/png');
  const puesta = await req('POST', `/projects/${conGaleria.data?.id}/images`, { token: est.token, body: { fileId: img.data?.id } });
  const sinEvidencia = await activar(conGaleria.data?.id);
  check(puesta.status === 201 && sinEvidencia.status === 400 && sinEvidencia.data?.code === 'PROJECT_NOT_READY'
    && (sinEvidencia.data?.details?.missing ?? []).some((m) => m.code === 'evidence'),
  'V6.8.1 PRO-06 Con solo imágenes de galería no se activa: falta evidencia o demo', json({ g: puesta.status, s: sinEvidencia.status, m: (sinEvidencia.data?.details?.missing ?? []).map((m) => m.code) }));

  // PRO-05: la captura como evidencia privada se registra sin OCR.
  const captura = await subir(est.token, PNG, 'funcionando.png', 'image/png');
  const ev = await req('POST', `/projects/${conGaleria.data?.id}/evidences`, {
    token: est.token, body: { evidenceType: 'file', storedFileId: captura.data?.id, description: 'Pantalla del sistema funcionando.' },
  });
  let fila = '';
  for (let i = 0; i < 40; i++) {
    fila = psql(`select status || '|' || coalesce(backing_tier::text,'') || '|' || (extracted_data is null) from validation_records where resource_id = '${ev.data?.id}'`);
    if (fila && !fila.startsWith('pending') && !fila.startsWith('processing')) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const sinOcr = psql(`select count(*) from audit_events where event_type = 'VALIDATION_COMPLETED' and entity_id = '${ev.data?.id}' and metadata->>'sinOcr' = 'true'`);
  check(ev.status === 201 && fila === 'completed|declared|true' && Number(sinOcr) === 1,
    'V6.8.2 PRO-05 V6-PROJ-03 La captura del proyecto queda registrada sin OCR ni extracción: «declarada», sin texto leído', `${ev.status} ${fila} audit=${sinOcr}`);

  // PRO-07: con esa evidencia privada se activa (sin demo).
  const conEvidencia = await activar(conGaleria.data?.id);
  check(conEvidencia.status === 200 && conEvidencia.data?.status === 'active', 'V6.8.3 PRO-07 Con evidencia privada se activa; la demo es opcional', `${conEvidencia.status} ${json(conEvidencia.data?.message)}`);

  // PRO-08: solo demo accesible → se activa sin captura.
  const { createServer } = await import('node:http');
  const demo = createServer((rq, rs) => { rs.writeHead(200, { 'content-type': 'text/html' }); rs.end('<html><head><title>Demo</title></head><body>ok</body></html>'); });
  await new Promise((r) => demo.listen(3997, '127.0.0.1', r));
  try {
    const conDemo = await nuevo('Solo demo');
    await contribuir(conDemo.data?.id);
    const activa = await activar(conDemo.data?.id, { demoUrl: `http://verificador.afinia-pruebas.org:3997/demo-v6-${TS}` });
    check(activa.status === 200 && activa.data?.status === 'active', 'V6.8.4 PRO-08 Con una demo accesible se activa sin captura privada', `${activa.status} ${json(activa.data?.message)}`);
  } finally {
    demo.close();
  }
}

// ===========================================================================
//  BATCH V6-9 — Archivos con su tipo, demo https y límites (§7.4, §7.6, §7.7)
// ===========================================================================
async function batch9(ctx) {
  objective('BATCH V6-9 · La imagen se abre como imagen; la demo pide https; evidencia acotada');
  await asegurarGithubSimulado();
  const [due, otro] = await Promise.all(['b9due', 'b9otro'].map((k, i) =>
    provisionStudent(ctx.admin, { firstName: ['Iris', 'Omar'][i], lastName: `Archivo${L}`, email: correoEst(k), semester: 6 })));
  const skill = ((await req('GET', '/skills', { token: due.token })).data ?? []).find((s) => s.isActive !== false && s.academicAreaId);
  const p = await req('POST', '/projects', {
    token: due.token,
    body: { title: `Proyecto archivos ${L}`, areaIds: [skill.academicAreaId], skillIds: [skill.id], repositoryUrl: repoDePrueba(`v6-archivos-${TS}`), status: 'draft', visibility: 'private' },
  });
  const id = p.data?.id;

  // §7.7 (V6-PROJ-06): la captura se entrega como imagen.
  const subida = await subir(due.token, PNG, 'pantalla.png', 'image/png');
  const ev = await req('POST', `/projects/${id}/evidences`, { token: due.token, body: { evidenceType: 'file', storedFileId: subida.data?.id, description: 'Pantalla.' } });
  const ruta = (ev.data?.fileUrl ?? '').replace(/^\/api/, '');
  const pedir = (token) => fetch(`${API}${ruta}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const propia = await pedir(due.token);
  const bytes = Buffer.from(await propia.arrayBuffer());
  check(propia.status === 200 && propia.headers.get('content-type') === 'image/png' && /^inline/.test(propia.headers.get('content-disposition') ?? '') && bytes.equals(PNG),
    'V6.9.1 V6-PROJ-06 La imagen de evidencia llega con Content-Type image/png y en línea (ya no como archivo sin tipo)',
    json({ s: propia.status, t: propia.headers.get('content-type'), d: propia.headers.get('content-disposition') }));
  check(propia.headers.get('x-content-type-options') === 'nosniff' && /sandbox/.test(propia.headers.get('content-security-policy') ?? ''),
    'V6.9.2 Con nosniff y CSP sandbox: el navegador no la reinterpreta ni ejecuta nada', propia.headers.get('content-security-policy'));
  const ajeno = await pedir(otro.token);
  const sinSesion = await pedir(null);
  check([403, 404].includes(ajeno.status) && sinSesion.status === 401, 'V6.9.3 Otro estudiante no la obtiene (403/404) y sin sesión tampoco (401)', `${ajeno.status} / ${sinSesion.status}`);

  // §7.4: demo solo https y sin credenciales.
  const http = await req('PATCH', `/projects/${id}`, { token: due.token, body: { demoUrl: 'http://demo.afinia-pruebas.org/app' } });
  const conClave = await req('PATCH', `/projects/${id}`, { token: due.token, body: { demoUrl: 'https://usuario:clave@demo.afinia-pruebas.org/app' } });
  const segura = await req('PATCH', `/projects/${id}`, { token: due.token, body: { demoUrl: 'https://demo.afinia-pruebas.org/app' } });
  check(http.status === 400 && http.data?.code === 'DEMO_URL_UNSAFE' && !!http.data?.fields?.demoUrl && conClave.status === 400 && segura.status === 200,
    'V6.9.4 V6-PROJ-05 Una demo http:// o con usuario y contraseña se rechaza en su campo; https:// se acepta', `${http.status} ${conClave.status} ${segura.status}`);

  // §7.6: hasta 5 archivos y 8 enlaces.
  for (let i = 0; i < 4; i++) {
    const s = await subir(due.token, Buffer.concat([PNG, Buffer.from(`v6-${TS}-${i}`)]), `extra${i}.png`, 'image/png');
    await req('POST', `/projects/${id}/evidences`, { token: due.token, body: { evidenceType: 'file', storedFileId: s.data?.id, description: `Extra ${i}` } });
  }
  const sexto = await subir(due.token, Buffer.concat([PNG, Buffer.from(`v6-${TS}-sexto`)]), 'sexto.png', 'image/png');
  const deMas = await req('POST', `/projects/${id}/evidences`, { token: due.token, body: { evidenceType: 'file', storedFileId: sexto.data?.id } });
  check(deMas.status === 400 && deMas.data?.code === 'EVIDENCE_LIMIT' && !!deMas.data?.fields?.storedFileId,
    'V6.9.5 §7.6 El sexto archivo de evidencia se rechaza (máximo 5)', `${deMas.status} ${deMas.data?.code}`);
  const enlaces = [];
  for (let i = 0; i < 9; i++) {
    enlaces.push(await req('POST', `/projects/${id}/evidences`, { token: due.token, body: { evidenceType: 'link', externalUrl: `https://capturas.example.org/${TS}-${i}.png` } }));
  }
  check(enlaces.slice(0, 8).every((r) => r.status === 201) && enlaces[8].status === 400 && enlaces[8].data?.code === 'EVIDENCE_LIMIT',
    'V6.9.6 §7.6 Hasta 8 enlaces de evidencia; el noveno se rechaza', enlaces.map((r) => r.status).join(','));
}

// ===========================================================================
//  BATCH V6-10 — Galería con integrantes que aceptaron; sin repositorio (§7.5)
// ===========================================================================
async function batch10(ctx) {
  objective('BATCH V6-10 · La galería nombra solo a quien aceptó, con sus roles; el enlace público no da el repositorio');
  const [due, mia, ajeno] = await Promise.all(['b10due', 'b10mia', 'b10ajeno'].map((k, i) =>
    provisionStudent(ctx.admin, { firstName: ['Rosa', 'Mia', 'Teo'][i], lastName: `Galeria${L}`, email: correoEst(k), semester: 4 })));
  const p = await crearProyectoActivo(due.token, { title: `Galeria V6 ${L}`, visibility: 'profile' });
  const id = p.data?.id;
  await req('POST', `/projects/${id}/invitations`, { token: due.token, body: { invitedProfileId: mia.profileId, proposedRole: 'Frontend' } });
  const inv = ((await req('GET', '/projects/invitations/mine', { token: mia.token })).data ?? []).find((i) => i.project?.id === id);
  await req('PATCH', `/projects/invitations/${inv?.id}`, { token: mia.token, body: { decision: 'accept' } });
  const skillId = p.data?.projectSkills?.[0]?.skillId ?? (await req('GET', `/projects/${id}`, { token: due.token })).data?.projectSkills?.[0]?.skillId;
  await req('PUT', `/projects/${id}/my-contribution`, { token: mia.token, body: { contribution: 'Hice la interfaz.', roles: ['Frontend', 'UX/UI'], skillIds: skillId ? [skillId] : [] } });
  const tarjeta = async () => ((await req('GET', `/projects/community?q=${encodeURIComponent(`Galeria V6 ${L}`)}`, { token: ajeno.token })).data?.items ?? [])[0];

  const antes = await tarjeta();
  check(!!antes && json(antes.members) === '[]' && !JSON.stringify(antes).includes('Mia'),
    'V6.10.1 V6-PROJ-07 Sin aceptar, la integrante no aparece por nombre en la galería', json(antes?.members));
  const acepta = await req('PUT', `/projects/${id}/my-gallery-consent`, { token: mia.token, body: { showInGallery: true } });
  const despues = await tarjeta();
  const ella = (despues?.members ?? []).find((m) => m.name.startsWith('Mia'));
  check(acepta.status === 200 && json(ella?.roles) === '["Frontend","UX/UI"]',
    'V6.10.2 Al aceptar, la galería muestra su nombre y sus roles confirmados (no solo «1 integrante»)', json(despues?.members));
  const falso = await req('PUT', `/projects/${id}/my-gallery-consent`, { token: ajeno.token, body: { showInGallery: true } });
  check(falso.status === 403, 'V6.10.3 Quien no integra el proyecto no decide sobre nombres ajenos (403)', `${falso.status}`);
  const retira = await req('PUT', `/projects/${id}/my-gallery-consent`, { token: mia.token, body: { showInGallery: false } });
  check(retira.status === 200 && !((await tarjeta())?.members ?? []).some((m) => m.name.startsWith('Mia')),
    'V6.10.4 Retirar el permiso la quita de la galería al instante', `${retira.status}`);
  check(!('repositoryUrl' in (despues ?? {})) && !JSON.stringify(despues ?? {}).includes('github.com'),
    'V6.10.5 §7.5 La tarjeta de la galería no expone el repositorio', Object.keys(despues ?? {}).join(','));

  const publico = await req('PATCH', `/projects/${id}`, { token: due.token, body: { visibility: 'public_link' } });
  const vista = await (await fetch(`${API}/projects/public/${publico.data?.publicLinkToken}`)).json();
  check(publico.status === 200 && vista.title?.startsWith('Galeria V6') && !('repositoryUrl' in vista) && !JSON.stringify(vista).includes('github.com'),
    'V6.10.6 §7.5 El enlace público tampoco entrega el repositorio', Object.keys(vista).join(','));
}

// ===========================================================================
//  BATCH V6-11 — Foto opcional, privada por omisión (§8.2, §8.3)
// ===========================================================================
async function batch11(ctx) {
  objective('BATCH V6-11 · La foto es opcional y solo sale en el perfil compartido si su dueño lo decide');
  const [est, otro] = await Promise.all(['b11est', 'b11otro'].map((k, i) =>
    provisionStudent(ctx.admin, { firstName: ['Lia', 'Max'][i], lastName: `Foto${L}`, email: correoEst(k), semester: 3 })));
  const foto = Buffer.concat([PNG, Buffer.from(`foto-${TS}`)]);
  const subida = await subir(est.token, foto, 'yo.png', 'image/png');
  const puesta = await req('PUT', '/profiles/me/photo', { token: est.token, body: { fileId: subida.data?.id } });
  const mia = await fetch(`${API}/profiles/me/photo`, { headers: { Authorization: `Bearer ${est.token}` } });
  check(puesta.status === 200 && mia.status === 200 && mia.headers.get('content-type') === 'image/png' && Buffer.from(await mia.arrayBuffer()).equals(foto),
    'V6.11.1 V6-PROFILE-02 El estudiante sube su foto y la ve (PNG, con su tipo)', `${puesta.status} ${mia.status}`);

  const ajena = await subir(otro.token, Buffer.concat([PNG, Buffer.from(`ajena-${TS}`)]), 'otro.png', 'image/png');
  const robada = await req('PUT', '/profiles/me/photo', { token: est.token, body: { fileId: ajena.data?.id } });
  const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n', 'latin1');
  const doc = await subir(est.token, PDF, 'doc.pdf', 'application/pdf');
  const noImagen = await req('PUT', '/profiles/me/photo', { token: est.token, body: { fileId: doc.data?.id } });
  check(robada.status === 400 && robada.data?.code === 'PHOTO_INVALID' && noImagen.status === 400 && !!noImagen.data?.fields?.fileId,
    'V6.11.2 No vale como foto un archivo de otra persona ni un PDF', `${robada.status} ${noImagen.status}`);

  // Perfil compartido activo, pero «Mi foto» apagada (por omisión).
  await req('PUT', '/profiles/me/visibility', { token: est.token, body: { publicProfileEnabled: true, fields: { bio: true } } });
  const enlace = (await req('GET', '/profiles/me/public-link', { token: est.token })).data;
  const publico = async () => (await fetch(`${API}/public/profiles/${enlace?.slug}`)).json();
  const fotoPublica = () => fetch(`${API}/public/profiles/${enlace?.slug}/photo`);
  const p1 = await publico();
  const f1 = await fotoPublica();
  check(!('photoUrl' in p1) && f1.status === 404, 'V6.11.3 §8.3 Por omisión la foto no es pública: ni figura en el perfil compartido ni se sirve (404)', `${f1.status}`);

  await req('PUT', '/profiles/me/visibility', { token: est.token, body: { fields: { photo: true } } });
  const p2 = await publico();
  const f2 = await fotoPublica();
  check(typeof p2.photoUrl === 'string' && f2.status === 200 && f2.headers.get('content-type') === 'image/png' && /no-store/.test(f2.headers.get('cache-control') ?? ''),
    'V6.11.4 Con «Mi foto» activa, el perfil compartido la muestra (sin sesión, sin caché)', `${f2.status} ${p2.photoUrl}`);

  await req('PUT', '/profiles/me/visibility', { token: est.token, body: { publicProfileEnabled: false } });
  const f3 = await fotoPublica();
  check(f3.status === 404, 'V6.11.5 Con el perfil compartido desactivado, la foto deja de servirse (no hay atajo por URL)', `${f3.status}`);
  await req('PUT', '/profiles/me/visibility', { token: est.token, body: { publicProfileEnabled: true } });
  const quitada = await req('DELETE', '/profiles/me/photo', { token: est.token });
  const f4 = await fotoPublica();
  const p4 = await publico();
  check(quitada.status === 200 && f4.status === 404 && !('photoUrl' in p4), 'V6.11.6 Quitar la foto vuelve al avatar en todas partes', `${quitada.status} ${f4.status}`);
}

const BATCHES = { batch1, batch3, batch4, batch6, batch7, batch8, batch9, batch10, batch11 };

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
