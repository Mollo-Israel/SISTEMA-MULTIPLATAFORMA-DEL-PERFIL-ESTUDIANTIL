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
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
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

const BATCHES = { batch1, batch3, batch4 };

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
