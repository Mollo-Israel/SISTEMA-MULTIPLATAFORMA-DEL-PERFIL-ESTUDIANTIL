/**
 * Cierre V7.1 — verificación del contrato contra la API en marcha.
 *
 * Una sección por batch (docs/planes/PLAN_BATCHES_AFINIA_V7.md). Cada
 * comprobación cita el escenario de la matriz §15 del contrato (F01…) que
 * verifica. Se ejecuta contra la API aislada de pruebas:
 *
 *   node scripts/pruebas/entorno.mjs api          # :3020, base afinia_test
 *   API_URL=http://localhost:3020/api node scripts/e2e-v7.mjs [batch1 …]
 */
import { execSync } from 'node:child_process';
import { codigoUniversitario, loginAdmin, provisionAndActivate, provisionStudent, req } from './lib/fixtures.mjs';

const TS = Date.now();
// Solo letras: los nombres de persona no admiten dígitos.
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
const correoStaff = (k) => `v71.${k}.${TS}@univalle.edu`;
const correoEst = (k) => `v71.${k}.${TS}@est.univalle.edu`;
/**
 * Consulta a la base de la API en prueba. Por omisión la aislada
 * (afinia_test): una suite que mueve fechas no debe tocar desarrollo.
 */
const psql = (sql) => execSync(
  `docker exec perfil_postgres psql -U ${process.env.POSTGRES_USER ?? 'perfil_user'} -d ${process.env.POSTGRES_DB ?? 'afinia_test'} -tAc "${sql.replace(/"/g, '\\"')}"`,
  { encoding: 'utf8' },
).trim();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (x) => JSON.stringify(x ?? null).slice(0, 220);
const en = (h) => new Date(Date.now() + h * 3_600_000).toISOString();
const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)).toString();
const ids = (lista) => (Array.isArray(lista) ? lista : lista?.items ?? []).map((x) => x.id);

/** Una cuenta sin activar: el administrador la crea y nadie usa la invitación. */
async function cuentaPendiente(admin, { firstName, lastName, k }) {
  const r = await req('POST', '/users', {
    token: admin,
    body: { firstName, lastName, email: correoStaff(k), role: 'TEACHER', universityCode: codigoUniversitario('TEACHER') },
  });
  if (r.status !== 201) throw new Error(`No se pudo crear la cuenta pendiente ${k} (${r.status}): ${json(r.data)}`);
  return r.data;
}

// ===========================================================================
//  BATCH V7-1 — Filtros excluyentes, paginación y revisión separada (§4.1)
// ===========================================================================
async function batch1(ctx) {
  objective('BATCH V7-1 · Estado exclusivo, filtrado en el servidor antes de paginar, revisión aparte');
  const admin = ctx.admin;

  // --- Cuentas en los cuatro estados, todas con la misma marca en el apellido.
  const M = `Filtro${L}`;
  const activa1 = await provisionAndActivate(admin, { firstName: 'Ana', lastName: M, email: correoStaff('act1'), role: 'TEACHER' });
  const activa2 = await provisionAndActivate(admin, { firstName: 'Bruno', lastName: M, email: correoStaff('act2'), role: 'TEACHER' });
  const suspendida = await provisionAndActivate(admin, { firstName: 'Carla', lastName: M, email: correoStaff('sus'), role: 'TEACHER' });
  const inactiva = await provisionAndActivate(admin, { firstName: 'Dario', lastName: M, email: correoStaff('ina'), role: 'TEACHER' });
  const pendiente = await cuentaPendiente(admin, { firstName: 'Elena', lastName: M, k: 'pen' });
  const s1 = await req('PATCH', `/users/${suspendida.userId}/status`, { token: admin, body: { status: 'suspended' } });
  const s2 = await req('PATCH', `/users/${inactiva.userId}/status`, { token: admin, body: { status: 'inactive' } });
  if (s1.status !== 200 || s2.status !== 200) throw new Error(`No se pudo preparar los estados (${s1.status}/${s2.status})`);

  const usuarios = async (extra) => req('GET', `/users?${q({ search: M, limit: 10, ...extra })}`, { token: admin });

  const sus = await usuarios({ status: 'suspended' });
  check(sus.status === 200 && sus.data?.total === 1 && json(ids(sus.data)) === json([suspendida.userId])
    && (sus.data?.items ?? []).every((u) => u.status === 'suspended'),
  'V7.1.1 F01 «Suspendidas»: solo la suspendida; ni activas ni pendientes', json({ s: sus.status, t: sus.data?.total, e: (sus.data?.items ?? []).map((u) => u.status) }));

  const pen = await usuarios({ status: 'pending_activation' });
  check(pen.status === 200 && pen.data?.total === 1 && json(ids(pen.data)) === json([pendiente.id]),
    'V7.1.2 F02 «Pendientes de activación»: solo la que no se activó; no se confunde con suspendida', json({ s: pen.status, t: pen.data?.total }));

  const act = await usuarios({ status: 'active' });
  check(act.status === 200 && act.data?.total === 2 && ids(act.data).includes(activa1.userId) && ids(act.data).includes(activa2.userId),
    'V7.1.3 «Activas»: solo las dos activas', json({ s: act.status, t: act.data?.total }));

  const ina = await usuarios({ status: 'inactive' });
  check(ina.status === 200 && ina.data?.total === 1 && json(ids(ina.data)) === json([inactiva.userId]),
    'V7.1.4 «Inactivas»: solo la dada de baja', json({ s: ina.status, t: ina.data?.total }));

  const todas = await usuarios({ status: 'all' });
  check(todas.status === 200 && todas.data?.total === 5,
    'V7.1.5 «Todas» trae los cinco estados juntos (no es la opción por omisión de la web)', json({ s: todas.status, t: todas.data?.total }));

  // --- 0 / 1 / 11 registros: el total es el del filtro y la página tiene 10 como máximo.
  const P = `Pagina${L}`;
  const nombres = ['Alba', 'Beto', 'Ciro', 'Dina', 'Eloy', 'Fabi', 'Gael', 'Hugo', 'Ines', 'Juan', 'Kira'];
  for (const [i, n] of nombres.entries()) await cuentaPendiente(admin, { firstName: n, lastName: P, k: `pag${i}` });
  const p1 = await req('GET', `/users?${q({ search: P, status: 'pending_activation', limit: 10, offset: 0, sort: 'name', dir: 'asc' })}`, { token: admin });
  const p2 = await req('GET', `/users?${q({ search: P, status: 'pending_activation', limit: 10, offset: 10, sort: 'name', dir: 'asc' })}`, { token: admin });
  const cero = await req('GET', `/users?${q({ search: `Nadie${L}`, status: 'all', limit: 10 })}`, { token: admin });
  check(p1.data?.total === 11 && (p1.data?.items ?? []).length === 10 && p2.data?.total === 11 && (p2.data?.items ?? []).length === 1
    && cero.status === 200 && cero.data?.total === 0 && (cero.data?.items ?? []).length === 0,
  'V7.1.6 0 / 1 / 11: página de 10, segunda página con 1, filtro vacío con total 0', json({ p1: [p1.data?.total, p1.data?.items?.length], p2: [p2.data?.total, p2.data?.items?.length], c: [cero.status, cero.data?.total] }));

  const orden = (p1.data?.items ?? []).concat(p2.data?.items ?? []).map((u) => u.firstName);
  const desc = await req('GET', `/users?${q({ search: P, status: 'pending_activation', limit: 3, sort: 'name', dir: 'desc' })}`, { token: admin });
  check(json(orden) === json(nombres) && json((desc.data?.items ?? []).map((u) => u.firstName)) === json(['Kira', 'Juan', 'Ines']),
    'V7.1.7 Orden asc/desc en el servidor, estable entre páginas', json({ orden, desc: (desc.data?.items ?? []).map((u) => u.firstName) }));

  check(typeof p1.data?.surnamesPending === 'number',
    'V7.1.8 La página informa cuántas cuentas del filtro tienen apellidos por separar', json(p1.data?.surnamesPending));

  const compat = await req('GET', `/users?${q({ search: M })}`, { token: admin });
  check(compat.status === 200 && Array.isArray(compat.data) && compat.data.length === 5,
    'V7.1.9 Sin «limit» la respuesta sigue siendo la lista de siempre (clientes y suites anteriores)', json({ s: compat.status, n: compat.data?.length }));

  const invalido = await req('GET', `/users?${q({ status: 'borrada', limit: 10 })}`, { token: admin });
  const docente = await req('GET', `/users?${q({ status: 'active', limit: 10 })}`, { token: activa1.token });
  check(invalido.status === 400 && docente.status === 403,
    'V7.1.10 Un estado inexistente es 400; un docente no lista usuarios (403)', `${invalido.status} / ${docente.status}`);

  // --- Catálogos: vigentes / dadas de baja, filtrado en el servidor.
  const director = await provisionAndActivate(admin, { firstName: 'Dora', lastName: `Catalogo${L}`, email: correoStaff('dir'), role: 'CAREER_DIRECTOR' });
  const areaVigente = await req('POST', '/academic-areas', { token: admin, body: { name: `Area vigente ${L}`, tags: [`vig${L}`] } });
  const areaBaja = await req('POST', '/academic-areas', { token: admin, body: { name: `Area retirada ${L}`, tags: [`ret${L}`] } });
  await req('PATCH', `/academic-areas/${areaBaja.data?.id}`, { token: admin, body: { isActive: false } });
  const areas = async (status, token = admin) => (await req('GET', `/academic-areas${status ? `?status=${status}` : ''}`, { token }));
  const aBaja = await areas('inactive');
  const aVig = await areas('active');
  const aTodas = await areas();
  const aDir = await areas('inactive', director.token);
  check(aBaja.status === 200 && ids(aBaja.data).includes(areaBaja.data?.id) && !ids(aBaja.data).includes(areaVigente.data?.id)
    && (aBaja.data ?? []).every((a) => a.isActive === false),
  'V7.1.11 F03 Áreas «Dadas de baja»: solo las retiradas, filtradas por la API', json({ s: aBaja.status, n: aBaja.data?.length }));
  check(aVig.status === 200 && ids(aVig.data).includes(areaVigente.data?.id) && !ids(aVig.data).includes(areaBaja.data?.id),
    'V7.1.12 Áreas «Vigentes»: sin las retiradas', json({ s: aVig.status }));
  check(ids(aTodas.data).includes(areaBaja.data?.id) && ids(aTodas.data).includes(areaVigente.data?.id),
    'V7.1.13 Sin filtro, Administración sigue recibiendo todas (selectores del formulario)', '');
  check(aDir.status === 200 && (aDir.data ?? []).every((a) => a.isActive !== false),
    'V7.1.14 Quien no administra nunca recibe lo dado de baja, aunque lo pida', json({ s: aDir.status, bajas: (aDir.data ?? []).filter((a) => a.isActive === false).length }));
  const aInvalido = await areas('borradas');
  check(aInvalido.status === 400, 'V7.1.15 Un estado de catálogo inexistente es 400', `${aInvalido.status}`);

  const skVig = await req('POST', '/skills', { token: admin, body: { name: `Tecfiltro ${L} Alfa`, academicAreaId: areaVigente.data?.id } });
  const skBaja = await req('POST', '/skills', { token: admin, body: { name: `Tecfiltro ${L} Beta`, academicAreaId: areaVigente.data?.id } });
  await req('PATCH', `/skills/${skBaja.data?.id}`, { token: admin, body: { isActive: false } });
  const sBaja = await req('GET', '/skills?status=inactive', { token: admin });
  const sVig = await req('GET', '/skills?status=active', { token: admin });
  check(sBaja.status === 200 && ids(sBaja.data).includes(skBaja.data?.id) && !ids(sBaja.data).includes(skVig.data?.id)
    && ids(sVig.data).includes(skVig.data?.id) && !ids(sVig.data).includes(skBaja.data?.id),
  'V7.1.16 Tecnologías: vigentes y dadas de baja por separado', json({ s: [sBaja.status, sVig.status] }));

  const catVig = await req('POST', '/activity-categories', { token: admin, body: { code: `cat_vig_${L}`, name: `Categoria vigente ${L}`, appliesTo: 'academica' } });
  const catBaja = await req('POST', '/activity-categories', { token: admin, body: { code: `cat_ret_${L}`, name: `Categoria retirada ${L}`, appliesTo: 'academica' } });
  await req('PATCH', `/activity-categories/${catBaja.data?.id}`, { token: admin, body: { isActive: false } });
  const cBaja = await req('GET', '/activity-categories?status=inactive', { token: admin });
  const cVig = await req('GET', '/activity-categories?status=active', { token: admin });
  check(cBaja.status === 200 && ids(cBaja.data).includes(catBaja.data?.id) && !ids(cBaja.data).includes(catVig.data?.id)
    && ids(cVig.data).includes(catVig.data?.id) && !ids(cVig.data).includes(catBaja.data?.id),
  'V7.1.17 Categorías: vigentes y dadas de baja por separado', json({ s: [cBaja.status, cVig.status] }));

  const recurso = (t) => ({
    title: `Recurso ${t} ${L}`, provider: 'Laboratorio de la carrera', url: `https://example.org/v71-${t}-${TS}`,
    description: 'Material de prueba del filtro de estado.', academicAreaId: areaVigente.data?.id, resourceType: 'practice', skillIds: [],
  });
  const rVig = await req('POST', '/learning-resources', { token: director.token, body: recurso('vigente') });
  const rRet = await req('POST', '/learning-resources', { token: director.token, body: recurso('retirado') });
  await req('PATCH', `/learning-resources/${rRet.data?.id}`, { token: director.token, body: { status: 'inactive' } });
  const recRet = await req('GET', '/learning-resources?status=inactive', { token: director.token });
  const recVig = await req('GET', '/learning-resources?status=active', { token: director.token });
  check(recRet.status === 200 && ids(recRet.data).includes(rRet.data?.id) && !ids(recRet.data).includes(rVig.data?.id)
    && (recRet.data ?? []).every((r) => r.status === 'inactive') && ids(recVig.data).includes(rVig.data?.id) && !ids(recVig.data).includes(rRet.data?.id),
  'V7.1.18 Recursos: «Retirados» solo trae los retirados', json({ s: [rVig.status, rRet.status, recRet.status] }));

  // --- Autonomía docente: vigentes / revocadas.
  const doc1 = await provisionAndActivate(admin, { firstName: 'Ivan', lastName: `Autonomia${L}`, email: correoStaff('aut1'), role: 'TEACHER' });
  const doc2 = await provisionAndActivate(admin, { firstName: 'Jose', lastName: `Autonomia${L}`, email: correoStaff('aut2'), role: 'TEACHER' });
  const justification = 'Coordina la materia en los paralelos A, B y C.';
  const pol1 = await req('POST', '/approval-policies', { token: director.token, body: { teacherUserId: doc1.userId, module: 'RESOURCE', justification } });
  const pol2 = await req('POST', '/approval-policies', { token: director.token, body: { teacherUserId: doc2.userId, module: 'RESOURCE', justification } });
  await req('POST', `/approval-policies/${pol1.data?.id}/revoke`, { token: director.token, body: { reason: 'Terminó la coordinación del semestre.' } });
  const revocadas = await req('GET', '/approval-policies?status=revoked', { token: director.token });
  const vigentes = await req('GET', '/approval-policies?status=active', { token: director.token });
  check(revocadas.status === 200 && ids(revocadas.data).includes(pol1.data?.id) && !ids(revocadas.data).includes(pol2.data?.id)
    && ids(vigentes.data).includes(pol2.data?.id) && !ids(vigentes.data).includes(pol1.data?.id),
  'V7.1.19 Autonomía docente: «Revocadas» y «Vigentes» por separado', json({ s: [pol1.status, pol2.status, revocadas.status] }));

  // --- Actividades: estado de la actividad y estado de revisión, sin mezclar.
  const cats = ((await req('GET', '/activity-categories?status=active', { token: admin })).data ?? []).filter((c) => c.isActive !== false);
  const cat = cats.find((c) => c.appliesTo === 'academica') ?? cats[0];
  const resp = await provisionAndActivate(admin, { firstName: 'Kevin', lastName: `Actividades${L}`, email: correoStaff('resp'), role: 'TEACHER' });
  await req('PUT', `/users/${resp.userId}/semesters`, { token: admin, body: { semesters: [1, 2, 3, 4, 5, 6, 7, 8] } });
  const base = { type: 'academica', categoryId: cat?.id, activityDate: en(72), endAt: en(74), modality: 'presencial', location: 'Aula 301', semesterScope: [1, 2, 3, 4, 5, 6, 7, 8] };
  const borrador = await req('POST', '/activities', { token: admin, body: { ...base, title: `Borrador admin ${L}`, responsibleUserIds: [resp.userId], status: 'draft' } });
  const abierta = await req('POST', '/activities', { token: admin, body: { ...base, title: `Abierta admin ${L}`, responsibleUserIds: [resp.userId], status: 'open' } });
  const propuesta = await req('POST', '/activities', { token: resp.token, body: { ...base, title: `Propuesta docente ${L}`, status: 'draft' } });
  if ([borrador.status, abierta.status, propuesta.status].some((s) => s !== 201)) {
    throw new Error(`No se pudieron crear las actividades (${borrador.status}/${abierta.status}/${propuesta.status}): ${json(propuesta.data)}`);
  }
  const gest = async (token, extra) => req('GET', `/activities/managed?${q(extra)}`, { token });

  const borradores = await gest(admin, { type: 'academica', status: 'draft' });
  check(borradores.status === 200 && ids(borradores.data).includes(borrador.data.id) && !ids(borradores.data).includes(abierta.data.id)
    && (borradores.data ?? []).every((a) => a.status === 'draft' && a.type === 'academica'),
  'V7.1.20 Gestión: estado de la actividad «Borrador» filtrado en la API', json({ s: borradores.status, n: borradores.data?.length }));

  const abiertas = await gest(admin, { status: 'open' });
  check(abiertas.status === 200 && ids(abiertas.data).includes(abierta.data.id) && !ids(abiertas.data).includes(borrador.data.id),
    'V7.1.21 Gestión: «Inscripciones abiertas» no trae borradores', json({ s: abiertas.status }));

  const sinEnviar = await gest(resp.token, { review: 'unsubmitted' });
  const pendAntes = await gest(resp.token, { review: 'pending' });
  await req('POST', `/activities/${propuesta.data.id}/submit`, { token: resp.token, body: {} });
  const pendDespues = await gest(resp.token, { review: 'pending', status: 'draft' });
  check(sinEnviar.status === 200 && ids(sinEnviar.data).includes(propuesta.data.id) && !ids(pendAntes.data).includes(propuesta.data.id)
    && ids(pendDespues.data).includes(propuesta.data.id),
  'V7.1.22 Revisión aparte: «Sin enviar» y luego «En revisión», combinable con el estado (borrador + pendiente)', json({ s: [sinEnviar.status, pendAntes.status, pendDespues.status] }));

  const sinRevision = await gest(admin, { review: 'not_required', type: 'academica' });
  check(sinRevision.status === 200 && ids(sinRevision.data).includes(abierta.data.id)
    && (sinRevision.data ?? []).every((a) => !a.requiresReview || a.reviewStatus === 'not_required'),
  'V7.1.23 «No requiere revisión»: lo que publica Administración sin pasar por Dirección', json({ s: sinRevision.status }));

  // V7-2: Administración la ve en su gestión, marcada como solo lectura.
  const adminPend = await gest(admin, { review: 'pending' });
  const filaAdmin = (adminPend.data ?? []).find((a) => a.id === propuesta.data.id);
  check(adminPend.status === 200 && filaAdmin?.soloLectura === true,
    'V7.1.24 «En revisión» le muestra a Administración la propuesta del docente, en solo lectura (V7-2)', json({ s: adminPend.status, l: filaAdmin?.soloLectura }));

  // §4.1 «Probar también docencia, sociedad y URL directa»: la Sociedad filtra sus extracurriculares igual.
  const soc = await provisionAndActivate(admin, { firstName: 'Sofia', lastName: `Sociedad${L}`, email: correoStaff('soc'), role: 'SCIENTIFIC_SOCIETY' });
  const extra = cats.find((c) => c.appliesTo === 'extracurricular') ?? cats.find((c) => !c.appliesTo);
  const socBorrador = await req('POST', '/activities', { token: soc.token, body: { title: `Reto sociedad ${L}`, type: 'extracurricular', categoryId: extra?.id } });
  const socSinEnviar = await gest(soc.token, { type: 'extracurricular', review: 'unsubmitted' });
  const socAcademicas = await gest(soc.token, { type: 'academica' });
  check(socBorrador.status === 201 && ids(socSinEnviar.data).includes(socBorrador.data?.id) && !ids(socAcademicas.data).includes(socBorrador.data?.id),
    'V7.1.27 Sociedad científica: su borrador extracurricular con los mismos filtros; «académicas» no lo trae', json({ s: [socBorrador.status, socSinEnviar.status, socAcademicas.status] }));

  const malos = [await gest(admin, { review: 'aprobadisima' }), await gest(admin, { status: 'borrador' }), await gest(admin, { type: 'otra' })];
  check(malos.every((r) => r.status === 400), 'V7.1.25 Valores de filtro inexistentes son 400', malos.map((r) => r.status).join(','));

  const todasGest = await gest(admin, {});
  check(todasGest.status === 200 && Array.isArray(todasGest.data) && ids(todasGest.data).includes(borrador.data.id) && ids(todasGest.data).includes(abierta.data.id),
    'V7.1.26 Sin filtros, la gestión responde como siempre', json({ s: todasGest.status }));
}

// ===========================================================================
//  BATCH V7-2 — Aprobar = publicar y abrir (D02), lectura de Administración,
//  asistencia con la lista abierta y regla D04
// ===========================================================================
async function batch2(ctx) {
  objective('BATCH V7-2 · Aprobar publica y abre; Admin en solo lectura; asistencia hasta cerrar la lista; «Sin resultado» no es trayectoria');
  const admin = ctx.admin;
  const director = await provisionAndActivate(admin, { firstName: 'Dora', lastName: `Aprueba${L}`, email: correoStaff('b2dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(admin, { firstName: 'Carlos', lastName: `Propone${L}`, email: correoStaff('b2doc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: admin, body: { semesters: [1, 2, 3, 4, 5, 6, 7, 8] } });
  const cats = ((await req('GET', '/activity-categories?status=active', { token: admin })).data ?? []);
  const cat = cats.find((c) => c.appliesTo === 'academica') ?? cats.find((c) => !c.appliesTo);
  const base = { type: 'academica', categoryId: cat?.id, activityDate: en(72), endAt: en(74), modality: 'presencial', location: 'Aula 210', semesterScope: [1, 2, 3, 4, 5, 6, 7, 8] };
  const ver = async (id, token = admin) => (await req('GET', `/activities/${id}`, { token })).data;
  const propuesta = async (titulo) => {
    const p = await req('POST', '/activities', { token: docente.token, body: { ...base, title: `${titulo} ${L}`, status: 'draft' } });
    if (p.status !== 201) throw new Error(`No se pudo crear la propuesta (${p.status}): ${json(p.data)}`);
    const s = await req('POST', `/activities/${p.data.id}/submit`, { token: docente.token, body: {} });
    if (s.status !== 200 && s.status !== 201) throw new Error(`No se pudo enviar a revisión (${s.status}): ${json(s.data)}`);
    return p.data;
  };
  const aprobar = (id, token = director.token) => req('POST', `/activities/${id}/review`, { token, body: { decision: 'approve' } });

  // --- A03 / A13: aprobar publica y abre en la misma operación.
  const a1 = await propuesta('Taller aprobado');
  const aprobada = await aprobar(a1.id);
  const cambioAuditado = psql(`select count(*) from audit_events where entity_id = '${a1.id}' and event_type = 'ACTIVITY_STATUS_CHANGED' and metadata->>'automatico' = 'aprobacion'`);
  check(aprobada.status === 200 && aprobada.data?.status === 'open' && aprobada.data?.reviewStatus === 'approved' && cambioAuditado === '1',
    'V7.2.1 A03/A13 Dirección aprueba y, en la misma operación, queda publicada con inscripciones abiertas (auditado)', json({ s: aprobada.status, st: aprobada.data?.status, r: aprobada.data?.reviewStatus, a: cambioAuditado }));

  // --- A05: aprobar otra vez no repite efectos ni avisos.
  const otraVez = await aprobar(a1.id);
  const bandeja = (await req('GET', '/notifications/me', { token: docente.token })).data;
  const avisos = (Array.isArray(bandeja) ? bandeja : bandeja?.items ?? [])
    .filter((n) => (n.type ?? n.kind) === 'ACTIVITY_APPROVED' && (n.entityId ?? n.entity_id) === a1.id);
  check(otraVez.status === 409 && avisos.length === 1 && /publicada/.test(avisos[0]?.body ?? ''),
    'V7.2.2 A05 Una segunda aprobación es 409; el docente recibe un solo aviso, que dice que ya está publicada', json({ s: otraVez.status, n: avisos.length, b: avisos[0]?.body }));

  // --- A04: observar o rechazar no publica.
  const a2 = await propuesta('Taller observado');
  const observada = await req('POST', `/activities/${a2.id}/review`, { token: director.token, body: { decision: 'observe', comment: 'Falta la bibliografía.' } });
  const a3 = await propuesta('Taller rechazado');
  const rechazada = await req('POST', `/activities/${a3.id}/review`, { token: director.token, body: { decision: 'reject', comment: 'No corresponde a la carrera.' } });
  check(observada.data?.status === 'draft' && observada.data?.reviewStatus === 'observed' && rechazada.data?.status === 'draft' && rechazada.data?.reviewStatus === 'rejected',
    'V7.2.3 A04 Observar o rechazar deja la actividad en borrador, con su decisión', json({ o: [observada.data?.status, observada.data?.reviewStatus], r: [rechazada.data?.status, rechazada.data?.reviewStatus] }));

  // --- A16: una propuesta que empezó o terminó mientras esperaba no se abre.
  const a4 = await propuesta('Taller que ya empezo');
  psql(`update activities set event_date = now() - interval '1 hour' where id = '${a4.id}'`);
  const empezada = await aprobar(a4.id);
  const a4d = await ver(a4.id);
  check(empezada.status === 409 && empezada.data?.code === 'ACTIVITY_APPROVAL_STARTED' && a4d?.status === 'draft' && a4d?.reviewStatus === 'pending',
    'V7.2.4 A16 Si ya empezó, aprobar es 409 con el motivo; sigue pendiente y en borrador para corregir la fecha', json({ s: empezada.status, c: empezada.data?.code, st: a4d?.status, r: a4d?.reviewStatus }));
  const a5 = await propuesta('Taller vencido');
  psql(`update activities set event_date = now() - interval '3 hours', end_at = now() - interval '1 hour' where id = '${a5.id}'`);
  const vencida = await aprobar(a5.id);
  const a5d = await ver(a5.id);
  check(vencida.status === 409 && vencida.data?.code === 'ACTIVITY_APPROVAL_EXPIRED' && a5d?.status === 'draft' && a5d?.reviewStatus === 'pending',
    'V7.2.5 A16 Una propuesta vencida no se publica ni se revive', json({ s: vencida.status, c: vencida.data?.code, st: a5d?.status }));

  // --- A01: Administración consulta lo enviado a Dirección, en solo lectura.
  const gestAdmin = await req('GET', '/activities/managed?review=pending', { token: admin });
  const fila = (gestAdmin.data ?? []).find((a) => a.id === a4.id);
  const detalle = await req('GET', `/activities/${a4.id}`, { token: admin });
  check(gestAdmin.status === 200 && fila?.soloLectura === true && detalle.status === 200,
    'V7.2.6 A01 Administración ve la propuesta enviada a Dirección, marcada como solo lectura', json({ s: gestAdmin.status, l: fila?.soloLectura, d: detalle.status }));
  const privado = await req('POST', '/activities', { token: docente.token, body: { ...base, title: `Borrador privado ${L}`, status: 'draft' } });
  const gestTodas = await req('GET', '/activities/managed', { token: admin });
  const verPrivado = await req('GET', `/activities/${privado.data?.id}`, { token: admin });
  check(privado.status === 201 && !ids(gestTodas.data).includes(privado.data?.id) && verPrivado.status === 404,
    'V7.2.7 A01 El borrador que el docente no envió no existe para Administración', json({ s: verPrivado.status }));

  // --- A02: ni por la API. Aprobar, cancelar o editar una propuesta ajena es 403.
  const aprobarAdmin = await aprobar(a4.id, admin);
  const cancelarAdmin = await req('PATCH', `/activities/${a4.id}`, { token: admin, body: { status: 'cancelled', cancellationReason: 'Prueba de solo lectura.' } });
  const editarAdmin = await req('PATCH', `/activities/${a4.id}`, { token: admin, body: { title: `Cambiado por admin ${L}` } });
  const intacta = await ver(a4.id);
  check(aprobarAdmin.status === 403 && cancelarAdmin.status === 403 && cancelarAdmin.data?.code === 'ACTIVITY_PROPOSAL_READ_ONLY' && editarAdmin.status === 403
    && intacta?.status === 'draft' && intacta?.reviewStatus === 'pending' && intacta?.title === a4.title,
  'V7.2.8 A02 Administración no aprueba, ni cancela, ni edita una propuesta ajena (403); nada cambia', json({ a: aprobarAdmin.status, c: [cancelarAdmin.status, cancelarAdmin.data?.code], e: editarAdmin.status, st: intacta?.status }));

  // --- A14 / A15: la propia de Dirección se publica abierta; desde el inicio no hay inscripción nueva.
  const est1 = await provisionStudent(admin, { firstName: 'Lia', lastName: `Inscribe${L}`, email: correoEst('b2e1'), semester: 1 });
  const est2 = await provisionStudent(admin, { firstName: 'Teo', lastName: `Inscribe${L}`, email: correoEst('b2e2'), semester: 1 });
  const propia = await req('POST', '/activities', { token: director.token, body: { ...base, title: `Taller de Direccion ${L}`, responsibleUserIds: [docente.userId], status: 'open' } });
  const antes = await req('POST', `/activities/${propia.data?.id}/register`, { token: est1.token, body: {} });
  psql(`update activities set event_date = now() - interval '1 second' where id = '${propia.data?.id}'`);
  const despues = await req('POST', `/activities/${propia.data?.id}/register`, { token: est2.token, body: {} });
  check(propia.status === 201 && propia.data?.status === 'open' && [200, 201].includes(antes.status) && despues.status === 400,
    'V7.2.9 A14/A15 Lo propio de Dirección se publica abierto; desde el inicio la API ya no admite inscripciones', json({ c: [propia.status, propia.data?.status], antes: antes.status, despues: [despues.status, despues.data?.message] }));

  // --- A06: el backend cierra al inicio y finaliza al fin, sin que nadie abra la web.
  const cierra = await req('POST', '/activities', { token: director.token, body: { ...base, title: `Cierra sola ${L}`, responsibleUserIds: [docente.userId], status: 'open' } });
  const termina = await req('POST', '/activities', { token: director.token, body: { ...base, title: `Termina sola ${L}`, responsibleUserIds: [docente.userId], status: 'open' } });
  psql(`update activities set event_date = now() - interval '1 minute' where id = '${cierra.data?.id}'`);
  psql(`update activities set event_date = now() - interval '2 hours', end_at = now() - interval '1 minute' where id = '${termina.data?.id}'`);
  const esperarEstado = async (id, estado) => {
    for (let i = 0; i < 30; i++) {
      if ((await ver(id))?.status === estado) return true;
      await espera(3000);
    }
    return false;
  };
  const [cerrada, terminada] = await Promise.all([esperarEstado(cierra.data?.id, 'closed'), esperarEstado(termina.data?.id, 'finished')]);
  check(cerrada && terminada, 'V7.2.10 A06 El backend cierra al llegar el inicio y finaliza al llegar el fin (trabajador de ciclo de vida)', json({ cerrada, terminada }));

  // --- A10 / A11: con FINISHED y la lista abierta se corrige; cerrada la lista, no.
  const asis = await req('POST', '/activities', { token: director.token, body: { ...base, title: `Asistencia abierta ${L}`, responsibleUserIds: [docente.userId], status: 'open' } });
  const est3 = await provisionStudent(admin, { firstName: 'Ivo', lastName: `Asiste${L}`, email: correoEst('b2e3'), semester: 1 });
  await req('POST', `/activities/${asis.data?.id}/register`, { token: est3.token, body: {} });
  const confirma = await req('PATCH', `/activities/${asis.data?.id}/confirm-participation`, { token: docente.token, body: { studentProfileId: est3.profileId, status: 'confirmed' } });
  psql(`update activities set status = 'finished' where id = '${asis.data?.id}'`);
  const corrige = await req('PATCH', `/activities/${asis.data?.id}/confirm-participation`, { token: docente.token, body: { studentProfileId: est3.profileId, status: 'absent' } });
  const vuelve = await req('PATCH', `/activities/${asis.data?.id}/confirm-participation`, { token: docente.token, body: { studentProfileId: est3.profileId, status: 'confirmed' } });
  check(confirma.status === 200 && corrige.status === 200 && vuelve.status === 200,
    'V7.2.11 A10 Finalizada con la lista abierta, el responsable todavía corrige presente o ausente', json({ c: confirma.status, corrige: [corrige.status, corrige.data?.code], vuelve: vuelve.status }));
  const cierre = await req('POST', `/activities/${asis.data?.id}/attendance/close`, { token: docente.token, body: {} });
  const trasCierre = await req('PATCH', `/activities/${asis.data?.id}/confirm-participation`, { token: docente.token, body: { studentProfileId: est3.profileId, status: 'absent' } });
  check([200, 201].includes(cierre.status) && trasCierre.status === 409 && trasCierre.data?.code === 'ATTENDANCE_LOCKED',
    'V7.2.12 A11 Cerrada la lista, la API bloquea la corrección ordinaria del responsable', json({ cierre: cierre.status, tras: [trasCierre.status, trasCierre.data?.code] }));

  // --- D04 (I01, I10, I11): «Sin resultado» es asistencia operativa; «Solo participación» cuenta una vez.
  const area = await req('POST', '/academic-areas', { token: admin, body: { name: `Area resultado ${L}`, tags: [`res${L}`] } });
  const skNinguno = await req('POST', '/skills', { token: admin, body: { name: `Sinresultado ${L} Uno`, academicAreaId: area.data?.id } });
  const skParticipa = await req('POST', '/skills', { token: admin, body: { name: `Conresultado ${L} Dos`, academicAreaId: area.data?.id } });
  const crear = (titulo, outcomePolicy, skillId) => req('POST', '/activities', {
    token: director.token,
    body: { ...base, title: `${titulo} ${L}`, areaIds: [area.data?.id], skillIds: [skillId], outcomePolicy, responsibleUserIds: [docente.userId], status: 'open' },
  });
  const sinResultado = await crear('Charla sin resultado', 'none', skNinguno.data?.id);
  const conResultado = await crear('Taller con participacion', 'participation_only', skParticipa.data?.id);
  const est4 = await provisionStudent(admin, { firstName: 'Noa', lastName: `Resultado${L}`, email: correoEst('b2e4'), semester: 1 });
  for (const a of [sinResultado, conResultado]) {
    await req('POST', `/activities/${a.data?.id}/register`, { token: est4.token, body: {} });
    await req('PATCH', `/activities/${a.data?.id}/confirm-participation`, { token: docente.token, body: { studentProfileId: est4.profileId, status: 'confirmed' } });
  }
  const registro = (a) => psql(`select id from activity_registrations where activity_id = '${a.data?.id}' and student_profile_id = '${est4.profileId}'`);
  const regNinguno = registro(sinResultado);
  const regParticipa = registro(conResultado);
  const puntos = (regId) => Number(psql(`select coalesce(max(points), -1) from affinity_contributions where source_id = '${regId}'`));
  let ptsNinguno = -1;
  let ptsParticipa = -1;
  for (let i = 0; i < 10 && ptsParticipa <= 0; i++) {
    ptsNinguno = puntos(regNinguno);
    ptsParticipa = puntos(regParticipa);
    if (ptsParticipa <= 0) await espera(1000);
  }
  const version = psql(`select coalesce(min(engine_version), 0) from affinity_results where student_profile_id = '${est4.profileId}'`);
  check(sinResultado.status === 201 && conResultado.status === 201 && ptsNinguno === 0 && ptsParticipa > 0 && version === '6',
    'V7.2.13 I01/I11 Afinidad (motor v6): la de «Sin resultado» aporta 0; la de «Solo participación» aporta una vez', json({ ptsNinguno, ptsParticipa, version }));

  const resumen = await req('GET', '/profiles/me/summary', { token: est4.token });
  const nombres = (resumen.data?.skills ?? []).map((s) => s.skill ?? s.name);
  check(nombres.includes(skParticipa.data?.name) && !nombres.includes(skNinguno.data?.name),
    'V7.2.14 I10 Tecnologías respaldadas: no incluyen las de una actividad «Sin resultado»', json(nombres));

  const items = await req('GET', '/trajectory-summary/items', { token: est4.token });
  const elegibles = (items.data?.sections ?? []).flatMap((s) => s.items ?? []).map((i) => i.id);
  const asistencia = psql(`select status from activity_registrations where id = '${regNinguno}'`);
  check(elegibles.includes(conResultado.data?.id) && !elegibles.includes(sinResultado.data?.id) && asistencia === 'confirmed',
    'V7.2.15 I10 El resumen exportable no incluye «Sin resultado»; su asistencia se conserva', json({ elegibles: elegibles.length, asistencia }));
}

const BATCHES = { batch1, batch2 };

async function main() {
  console.log(`${C.bold}Afinia V7.1 — verificación del contrato contra la API${C.r}`);
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
