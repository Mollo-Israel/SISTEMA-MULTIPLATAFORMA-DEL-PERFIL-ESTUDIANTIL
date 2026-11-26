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
import { createHash } from 'node:crypto';
import {
  codigoUniversitario, loginAdmin, pdfConTexto, provisionAndActivate, provisionStudent, req, subirArchivo,
} from './lib/fixtures.mjs';

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
  check(sinResultado.status === 201 && conResultado.status === 201 && ptsNinguno === 0 && ptsParticipa > 0 && Number(version) >= 6,
    'V7.2.13 I01/I11 Afinidad (motor v6 o posterior): la de «Sin resultado» aporta 0; la de «Solo participación» aporta una vez', json({ ptsNinguno, ptsParticipa, version }));

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

// ===========================================================================
//  BATCH V7-3 — Credenciales: formulario, origen y procesamiento técnico (§5.2–§5.5, D03, D08)
// ===========================================================================
async function batch3(ctx) {
  objective('BATCH V7-3 · Vinculada derivada de la oportunidad, histórica directo a Dirección, fases y modelo versionado');
  const admin = ctx.admin;
  const director = await provisionAndActivate(admin, { firstName: 'Irene', lastName: `Modelo${L}`, email: correoStaff('b3dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(admin, { firstName: 'Tomas', lastName: `Responsable${L}`, email: correoStaff('b3doc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: admin, body: { semesters: [1, 2, 3, 4, 5, 6, 7, 8] } });
  const nombres = ['Valeria', 'Rodrigo', 'Camila', 'Esteban', 'Lucia', 'Mateo'];
  const est = [];
  for (const [i, n] of nombres.entries()) {
    const e = await provisionAndActivate(admin, { firstName: n, lastName: `Credencial${L}`, email: correoEst(`b3e${i}`), role: 'STUDENT', semester: 5 });
    e.nombre = `${n} Credencial${L}`;
    e.profileId = (await req('GET', '/profiles/me', { token: e.token })).data?.id;
    est.push(e);
  }
  const [e1, e2, e3, e4, e5, e6] = est;

  const crearCatalogo = async (ruta, body) => {
    const r = await req('POST', ruta, { token: admin, body });
    if (r.status !== 201) throw new Error(`No se pudo crear ${ruta} «${body.name}» (${r.status}): ${json(r.data)}`);
    return r.data;
  };
  const area1 = await crearCatalogo('/academic-areas', { name: `Redes credencial ${L}`, tags: [`rc${L}`] });
  const area2 = await crearCatalogo('/academic-areas', { name: `Otra area credencial ${L}`, tags: [`oc${L}`] });
  const sk1 = await crearCatalogo('/skills', { name: `Tecandina ${L} Uno`, academicAreaId: area1.id });
  const sk2 = await crearCatalogo('/skills', { name: `Tecandina ${L} Dos`, academicAreaId: area2.id });
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const cat = cats.find((c) => c.code === 'curso_externo_recomendado') ?? cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const PROVEEDOR = 'Academia Andina de Redes';
  const oportunidad = async (titulo, extra = {}) => {
    const r = await req('POST', '/activities', {
      token: director.token,
      body: {
        title: `${titulo} ${L}`, type: 'academica', categoryId: cat.id, status: 'open', originType: 'external',
        provider: PROVEEDOR, externalUrl: 'https://andina.example.org/cursos', outcomePolicy: 'external_credential_expected',
        activityDate: en(48), endAt: en(72), semesterScope: [1, 2, 3, 4, 5, 6, 7, 8], areaIds: [area1.id], skillIds: [sk1.id], responsibleUserIds: [docente.userId], ...extra,
      },
    });
    if (r.status !== 201) throw new Error(`No se pudo crear la oportunidad (${r.status}): ${json(r.data)}`);
    return r.data;
  };
  const aceptar = async (a, alumnos) => {
    for (const e of alumnos) {
      await req('POST', `/activities/${a.id}/register`, { token: e.token });
      const r = await req('PATCH', `/activities/${a.id}/confirm-participation`, { token: director.token, body: { studentProfileId: e.profileId, status: 'accepted' } });
      if (r.status !== 200) throw new Error(`No se pudo aceptar a ${e.nombre} (${r.status}): ${json(r.data)}`);
    }
  };
  const terminar = async (a) => {
    const r = await req('PATCH', `/activities/${a.id}`, { token: director.token, body: { status: 'finished' } });
    if (r.status !== 200) throw new Error(`No se pudo finalizar (${r.status}): ${json(r.data)}`);
  };
  const subir = async (e, lineas, nombre) => {
    const buffer = pdfConTexto(lineas);
    const r = await subirArchivo(e.token, buffer, nombre);
    if (r.status !== 201) throw new Error(`No se pudo subir ${nombre} (${r.status})`);
    return { id: r.data.id, sha: createHash('sha256').update(buffer).digest('hex') };
  };
  const registro = (certId) => {
    const fila = psql(`select status || '|' || coalesce(skipped_reason,'') || '|' || coalesce(manual_review_status::text,'') || '|' || coalesce(file_sha256,'') || '|' || jsonb_array_length(previous_results) || '|' || (extracted_data is null) from validation_records where resource_id = '${certId}'`);
    const [status, skipped, revision, sha, previos, sinLectura] = fila.split('|');
    return { status, skipped, revision, sha, previos: Number(previos), sinLectura: sinLectura === 'true' };
  };
  const vista = async (e, certId) => (await req('GET', `/validation/external_certificate/${certId}`, { token: e.token })).data;
  const procesarCola = async () => { for (let i = 0; i < 3; i++) await req('POST', '/validation/run?limit=50', { token: admin }); };
  const elegibles = async (e) => (await req('GET', '/certificates/external/eligible-opportunities', { token: e.token })).data ?? [];
  const crear = (e, body) => req('POST', '/certificates/external', { token: e.token, body });

  // --- Oportunidades: A con certificado modelo; B sin modelo.
  const A = await oportunidad('Fundamentos de redes andinas');
  const B = await oportunidad('Taller de cableado estructurado');
  await aceptar(A, [e1, e2, e4, e5]);
  await aceptar(B, [e1, e2]);
  const modelo = await subirArchivo(director.token, pdfConTexto([
    PROVEEDOR, 'Certificado de finalizacion', 'Otorgado a Juan Modelo Perez', 'Curso Fundamentos de Redes Andinas',
    'Duracion de cuarenta horas academicas', 'Fecha 12 de marzo de 2025',
  ]), 'modelo-andina.pdf');
  const ref = await req('PUT', `/activities/${A.id}/validation-reference`, {
    token: director.token, body: { expectedCourseName: 'Fundamentos de Redes Andinas', sampleStoredFileId: modelo.data?.id },
  });
  if (ref.status !== 200) throw new Error(`No se pudo guardar la referencia (${ref.status}): ${json(ref.data)}`);
  await terminar(A);
  await terminar(B);

  // --- C03: la oportunidad trae lo que hereda la credencial.
  const lista = await elegibles(e1);
  const oA = lista.find((o) => o.activityId === A.id);
  const oB = lista.find((o) => o.activityId === B.id);
  check(oA?.expectedName === 'Fundamentos de Redes Andinas' && oA?.expectedIssuer === PROVEEDOR
    && json(oA?.areas?.map((a) => a.id)) === json([area1.id]) && json(oA?.skills?.map((s) => s.id)) === json([sk1.id])
    && oA?.hasModel === true && oB?.expectedName === B.title && oB?.hasModel === false,
  'V7.3.1 C03 La oportunidad elegible trae nombre esperado, emisor, áreas, tecnologías y si tiene modelo', json({ oA, oB: { n: oB?.expectedName, m: oB?.hasModel } }));

  // --- C06: vinculada sin archivo.
  const sinArchivo = await crear(e1, { activityId: A.id, issueDate: '2026-11-01' });
  const filasSinArchivo = psql(`select count(*) from external_certificates where student_profile_id = '${e1.profileId}' and activity_id = '${A.id}'`);
  check(sinArchivo.status === 400 && sinArchivo.data?.code === 'CREDENTIAL_FILE_REQUIRED' && !!sinArchivo.data?.fields?.storedFileId && filasSinArchivo === '0',
    'V7.3.2 C06 Una vinculada sin archivo no se crea: 400 con el error en el campo del archivo', json({ s: sinArchivo.status, c: sinArchivo.data?.code }));

  // --- C04: el cuerpo intenta cambiar nombre, emisor, áreas y tecnologías.
  const f1 = await subir(e1, [PROVEEDOR, 'Certificado de finalizacion', `Otorgado a ${e1.nombre}`, 'Curso Fundamentos de Redes Andinas',
    'Duracion de cuarenta horas academicas', 'Fecha 3 de noviembre de 2026'], 'e1-andina.pdf');
  const c1 = await crear(e1, {
    activityId: A.id, storedFileId: f1.id, issueDate: '2026-11-03', certificateName: 'Nombre inventado', issuer: 'Emisor inventado',
    areaIds: [area2.id], skillIds: [sk2.id], academicAreaId: area2.id,
  });
  const mias = (await req('GET', '/certificates/external/my', { token: e1.token })).data ?? [];
  const guardada = mias.find((c) => c.id === c1.data?.id);
  const areasC1 = psql(`select string_agg(academic_area_id::text, ',') from external_certificate_areas where certificate_id = '${c1.data?.id}'`);
  const skillsC1 = psql(`select string_agg(skill_id::text, ',') from external_certificate_skills where certificate_id = '${c1.data?.id}'`);
  check(c1.status === 201 && guardada?.certificateName === 'Fundamentos de Redes Andinas' && guardada?.issuer === PROVEEDOR
    && areasC1 === area1.id && skillsC1 === sk1.id,
  'V7.3.3 C04 El servidor deriva nombre, emisor, áreas y tecnologías de la oportunidad e ignora el cuerpo', json({ s: c1.status, n: guardada?.certificateName, i: guardada?.issuer, areasC1, skillsC1 }));

  // --- C18: reintento.
  const otraVez = await crear(e1, { activityId: A.id, storedFileId: f1.id, issueDate: '2026-11-03' });
  const filas = psql(`select count(*) from external_certificates where student_profile_id = '${e1.profileId}' and activity_id = '${A.id}'`);
  check(otraVez.status === 409 && filas === '1', 'V7.3.4 C18 Reintentar el envío no crea otra credencial (409)', json({ s: otraVez.status, filas }));

  // --- Con modelo: se encola, con el hash del archivo, y queda pedida a Dirección.
  const r1 = registro(c1.data?.id);
  check(['pending', 'processing', 'completed', 'inconclusive'].includes(r1.status) && r1.sha === f1.sha && r1.revision === 'requested',
    'V7.3.5 §5.3 Con modelo: va a comprobación con el hash del archivo y ya pedida a Dirección', json(r1));

  // --- C09: otra versión del certificado (e2).
  const f2 = await subir(e2, [PROVEEDOR, 'Constancia de aprobacion', `Otorgado a ${e2.nombre}`,
    'Curso Fundamentos de Redes Andinas edicion virtual', 'Fecha 4 de noviembre de 2026'], 'e2-andina.pdf');
  const c2 = await crear(e2, { activityId: A.id, storedFileId: f2.id, issueDate: '2026-11-04' });

  // --- C16: enlace a una dirección interna (e5).
  const f5 = await subir(e5, [PROVEEDOR, `Otorgado a ${e5.nombre}`, 'Curso Fundamentos de Redes Andinas'], 'e5-andina.pdf');
  const c5 = await crear(e5, { activityId: A.id, storedFileId: f5.id, issueDate: '2026-11-05', certificateUrl: 'http://127.0.0.1:3020/api/health' });

  await procesarCola();
  const v1 = await vista(e1, c1.data?.id);
  const comp1 = v1?.credentialCheck?.documentComparison;
  check(['completed', 'inconclusive'].includes(v1?.status) && comp1?.matched?.includes('Curso Fundamentos de Redes Andinas')
    && comp1?.missing?.length === 0 && !JSON.stringify(comp1).includes('Juan Modelo') && comp1?.holder === 'match',
  'V7.3.6 C08 Fase 1: coinciden los textos estables; el titular del modelo no cuenta y el del archivo es el estudiante', json(comp1));
  check(v1?.phases?.[2]?.estado === 'pendiente' && registro(c1.data?.id).revision === 'requested',
    'V7.3.7 C14 Aunque la comparación coincida, la revisión de Dirección sigue pendiente', json(v1?.phases?.map((f) => f.estado)));
  const comp2 = (await vista(e2, c2.data?.id))?.credentialCheck?.documentComparison;
  check(c2.status === 201 && comp2?.missing?.includes('Duracion de cuarenta horas academicas') && comp2?.matched?.includes(PROVEEDOR)
    && registro(c2.data?.id).revision === 'requested',
  'V7.3.8 C09 Otra versión: se explican faltantes y variaciones, sin porcentaje, y se envía igual', json(comp2));
  const v5 = await vista(e5, c5.data?.id);
  check(c5.status === 201 && v5?.linkCheck?.status === 'blocked' && registro(c5.data?.id).revision === 'requested',
    'V7.3.9 C16 Un enlace a una dirección interna no se consulta (bloqueado); la credencial se envía igual', json({ s: c5.status, l: v5?.linkCheck }));

  // --- C07 / C25: vinculada sin modelo.
  const fB = await subir(e1, ['Cableado estructurado', `Otorgado a ${e1.nombre}`, PROVEEDOR], 'e1-cableado.pdf');
  const cB = await crear(e1, { activityId: B.id, storedFileId: fB.id, issueDate: '2026-11-06' });
  await procesarCola();
  const rB = registro(cB.data?.id);
  const vB = await vista(e1, cB.data?.id);
  check(cB.status === 201 && rB.status === 'not_applicable' && rB.skipped === 'no_reference_model' && rB.revision === 'requested' && rB.sinLectura
    && json(vB?.phases?.map((f) => f.estado)) === json(['omitida', 'omitida', 'pendiente']),
  'V7.3.10 C07/C25 Sin modelo: fases 1 y 2 omitidas, sin leer el archivo, y directo a Dirección', json({ rB, f: vB?.phases?.map((f) => f.estado) }));

  // --- C01: histórica con archivo sin QR.
  const fH = await subir(e3, ['Diploma de Robotica Educativa', `Otorgado a ${e3.nombre}`, 'Club Andino de Robotica'], 'e3-robotica.pdf');
  const cH = await crear(e3, { certificateName: 'Robotica Educativa', issuer: 'Club Andino de Robotica', issueDate: '2025-06-10', storedFileId: fH.id, areaIds: [area1.id] });
  await procesarCola();
  const rH = registro(cH.data?.id);
  const vH = await vista(e3, cH.data?.id);
  check(cH.status === 201 && rH.status === 'not_applicable' && rH.skipped === 'historical' && rH.revision === 'requested' && rH.sinLectura
    && /fuera de Afinia/.test(vH?.phases?.[0]?.resumen ?? ''),
  'V7.3.11 C01 Histórica: sin OCR ni QR («no aplica»), directo a revisión de Dirección', json({ rH, r: vH?.phases?.[0]?.resumen }));

  // --- C02 (D08): histórica solo con enlace; y sin evidencia mínima.
  const cU = await crear(e3, { certificateName: 'Seguridad en la nube', issuer: 'Nube Abierta', certificateUrl: `https://nube.example.org/c/${L}` });
  const cN = await crear(e3, { certificateName: 'Taller sin respaldo', issuer: 'Comunidad Local' });
  const rU = registro(cU.data?.id);
  const rN = registro(cN.data?.id);
  const vN = await vista(e3, cN.data?.id);
  check(cU.status === 201 && rU.status === 'not_applicable' && rU.revision === 'requested' && cN.status === 201 && rN.revision === ''
    && vN?.phases?.[2]?.estado === 'sin_solicitud',
  'V7.3.12 C02 D08 vigente: el enlace solo basta para pedir revisión; sin archivo ni enlace queda declarada, sin solicitud', json({ rU, rN }));

  // --- CRED-10 §5.2: título común no es duplicado; el mismo archivo sí.
  const p1 = await crear(e3, { certificateName: 'Introduccion a Python', issuer: 'Coursera', issueDate: '2025-01-10' });
  const p2 = await crear(e3, { certificateName: 'Introducción a Python', issuer: 'edX', issueDate: '2025-03-01' });
  const p3 = await crear(e3, { certificateName: 'INTRODUCCION A PYTHON', issuer: 'coursera', issueDate: '2025-01-10' });
  const copia = await subir(e3, ['Diploma de Robotica Educativa', `Otorgado a ${e3.nombre}`, 'Club Andino de Robotica'], 'copia.pdf');
  const p4 = await crear(e3, { certificateName: 'Otro nombre', issuer: 'Otro emisor', storedFileId: copia.id });
  check(p1.status === 201 && p2.status === 201 && p3.status === 409 && p4.status === 409,
    'V7.3.13 §5.2 Un título común no bloquea certificados distintos; mismo nombre+emisor+fecha o el mismo archivo sí', json([p1.status, p2.status, p3.status, p4.status]));

  // --- C19: reemplazar el archivo mientras el worker procesaba.
  const f4 = await subir(e4, [PROVEEDOR, `Otorgado a ${e4.nombre}`, 'Curso Fundamentos de Redes Andinas'], 'e4-v1.pdf');
  const c4 = await crear(e4, { activityId: A.id, storedFileId: f4.id, issueDate: '2026-11-07' });
  psql(`update validation_records set status = 'processing', claimed_by = 'sonda-v73', started_at = now() where resource_id = '${c4.data?.id}'`);
  const f4b = await subir(e4, [PROVEEDOR, `Otorgado a ${e4.nombre}`, 'Curso Fundamentos de Redes Andinas', 'Duracion de cuarenta horas academicas'], 'e4-v2.pdf');
  const cambio = await req('PATCH', `/certificates/external/${c4.data?.id}`, { token: e4.token, body: { storedFileId: f4b.id } });
  const r4 = registro(c4.data?.id);
  check(cambio.status === 200 && r4.status === 'pending' && r4.sha === f4b.sha && r4.previos >= 1,
    'V7.3.14 C19 Reemplazar el archivo invalida lo que estaba en curso: nuevo hash en cola y el intento anterior archivado', json(r4));
  await procesarCola();
  const v4 = await vista(e4, c4.data?.id);
  check(v4?.fileSha256 === f4b.sha && v4?.credentialCheck?.documentComparison?.matched?.includes('Duracion de cuarenta horas academicas'),
    'V7.3.15 C19 El resultado corresponde al archivo nuevo', json({ sha: v4?.fileSha256 === f4b.sha, m: v4?.credentialCheck?.documentComparison?.matched }));
  const sinQuitar = await req('PATCH', `/certificates/external/${c4.data?.id}`, { token: e4.token, body: { storedFileId: null } });
  check(sinQuitar.status === 400 && sinQuitar.data?.code === 'CREDENTIAL_FILE_REQUIRED', 'V7.3.16 C06 A una vinculada no se le puede quitar el archivo', `status ${sinQuitar.status}`);

  // --- «Comprobar información»: conserva el intento; no aplica a una histórica.
  const recheck = await req('POST', `/certificates/external/${c1.data?.id}/check`, { token: e1.token });
  const recheckHist = await req('POST', `/certificates/external/${cH.data?.id}/check`, { token: e3.token });
  check(recheck.status === 200 && recheck.data?.status === 'pending' && recheck.data?.previousAttempts >= 1
    && recheckHist.status === 409 && recheckHist.data?.code === 'RECHECK_NOT_APPLICABLE',
  'V7.3.17 §5.3 «Comprobar información» vuelve a comprobar y archiva el intento; en una histórica no aplica', json({ a: recheck.data, h: recheckHist.data?.code }));

  // --- C26: Dirección adjunta el modelo a B ya finalizada.
  const antes = (await req('GET', `/activities/${B.id}`, { token: director.token })).data;
  const modeloB = await subirArchivo(director.token, pdfConTexto(['Cableado estructurado', 'Certificado oficial', PROVEEDOR]), 'modelo-cableado.pdf');
  const sinMotivo = await req('PUT', `/activities/${B.id}/validation-reference/model`, { token: director.token, body: { storedFileId: modeloB.data?.id, reason: 'corto' } });
  const adjunto = await req('PUT', `/activities/${B.id}/validation-reference/model`, {
    token: director.token, body: { storedFileId: modeloB.data?.id, reason: 'El docente entregó el modelo oficial después de finalizar.' },
  });
  const despues = (await req('GET', `/activities/${B.id}`, { token: director.token })).data;
  const versiones = adjunto.data?.modelVersions ?? [];
  const rBdespues = registro(cB.data?.id);
  const material = (a) => json([a?.title, a?.status, a?.provider, a?.activityDate, a?.endAt, a?.capacity, (a?.areas ?? a?.activityAreas ?? []).length]);
  check(sinMotivo.status === 400 && adjunto.status === 200 && versiones[0]?.origin === 'direccion' && versiones[0]?.version === 1
    && !!versiones[0]?.fileSha256 && /después de finalizar/.test(versiones[0]?.reason ?? '') && material(antes) === material(despues),
  'V7.3.18 C26 Dirección adjunta el modelo tras finalizar: versión con hash, autor y motivo, sin cambiar datos materiales', json({ s: [sinMotivo.status, adjunto.status], v: versiones[0] }));
  check(rBdespues.status === 'not_applicable' && rBdespues.revision === 'requested',
    'V7.3.19 C26 Adjuntar el modelo no reprocesa ni cambia las credenciales ya enviadas', json(rBdespues));
  const oB2 = (await elegibles(e2)).find((o) => o.activityId === B.id);
  const fB2 = await subir(e2, ['Cableado estructurado', `Otorgado a ${e2.nombre}`, PROVEEDOR], 'e2-cableado.pdf');
  const cB2 = await crear(e2, { activityId: B.id, storedFileId: fB2.id, issueDate: '2026-11-08' });
  check(oB2?.hasModel === true && ['pending', 'processing'].includes(registro(cB2.data?.id).status),
    'V7.3.20 C26 Los envíos nuevos usan el modelo vigente', json({ m: oB2?.hasModel, r: registro(cB2.data?.id) }));
  const recheckDir = await req('POST', `/validation/manual-reviews/${cB.data?.id}/recheck`, { token: director.token });
  check(recheckDir.status === 200 && recheckDir.data?.status === 'pending' && recheckDir.data?.previousResults >= 1,
    'V7.3.21 §5.5 Dirección puede volver a comprobar una pendiente con el modelo nuevo; el intento anterior se conserva', json(recheckDir.data));

  // --- C27: el docente responsable no cambia el modelo después de publicada.
  const otroModelo = await subirArchivo(docente.token, pdfConTexto(['Modelo del docente', PROVEEDOR]), 'modelo-docente.pdf');
  const general = await req('PUT', `/activities/${A.id}/validation-reference`, { token: docente.token, body: { sampleStoredFileId: otroModelo.data?.id } });
  const especifica = await req('PUT', `/activities/${A.id}/validation-reference/model`, {
    token: docente.token, body: { storedFileId: otroModelo.data?.id, reason: 'Quiero cambiar el modelo de la oportunidad.' },
  });
  const deAdmin = await req('PUT', `/activities/${A.id}/validation-reference/model`, {
    token: admin, body: { storedFileId: otroModelo.data?.id, reason: 'Administración intenta cambiar el modelo.' },
  });
  const modeloA = psql(`select sample_stored_file_id from external_opportunity_validation_references where activity_id = '${A.id}'`);
  check(general.status === 403 && general.data?.code === 'VALIDATION_REFERENCE_LOCKED' && especifica.status === 403 && deAdmin.status === 403
    && modeloA === modelo.data?.id,
  'V7.3.22 C27 Ni el docente (por la edición general o la acción) ni Administración cambian el modelo; sigue el de antes', json({ g: [general.status, general.data?.code], e: especifica.status, a: deAdmin.status }));

  // --- C05: otra cuenta no adjunta a una oportunidad ajena.
  const ajena = await crear(e6, { activityId: A.id, storedFileId: (await subir(e6, ['x y z'], 'e6.pdf')).id });
  check(ajena.status === 400 && ajena.data?.code === 'CREDENTIAL_OPPORTUNITY_NOT_ELIGIBLE', 'V7.3.23 C05 Un estudiante no aceptado no adjunta a esa oportunidad', `status ${ajena.status}`);
}

// ===========================================================================
//  BATCH V7-4 — Revisión humana obligatoria (§5.1, §5.3 fase 3, D01)
// ===========================================================================
async function batch4(ctx) {
  objective('BATCH V7-4 · Solo Dirección decide; la máquina no aprueba; solo lo aprobado cuenta');
  const admin = ctx.admin;
  const { createServer } = await import('node:http');
  const BASE = 'http://verificador.afinia-pruebas.org:3997';
  const director = await provisionAndActivate(admin, { firstName: 'Olga', lastName: `Revisora${L}`, email: correoStaff('b4dir'), role: 'CAREER_DIRECTOR' });
  const nombres = ['Andrea', 'Bruno', 'Celia', 'Diego', 'Elisa'];
  const est = [];
  for (const [i, n] of nombres.entries()) {
    const e = await provisionAndActivate(admin, { firstName: n, lastName: `Revision${L}`, email: correoEst(`b4e${i}`), role: 'STUDENT', semester: 5 });
    e.nombre = `${n} Revision${L}`;
    e.profileId = (await req('GET', '/profiles/me', { token: e.token })).data?.id;
    est.push(e);
  }
  const [e1, e2, e3, e4, e5] = est;
  const server = createServer((rq, rs) => {
    const html = (c) => { rs.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); rs.end(`<html><body>${c}</body></html>`); };
    const m = /^\/v74\/ok\/(\d)$/.exec(rq.url ?? '');
    if (m) return html(`Credential NA-2026-AA${m[1]} issued to ${est[Number(m[1])].nombre} for CCNA Introduction to Networks by Cisco Networking Academy`);
    if (rq.url === '/v74/otra') return html('Credential NA-2026-ZZ9 issued to Persona Distinta for CCNA Introduction to Networks by Cisco Networking Academy');
    if (rq.url === '/v74/curso') return html('CCNA Introduction to Networks. Inscríbete en el curso de Cisco Networking Academy.');
    rs.writeHead(404); rs.end();
  });
  await new Promise((r) => server.listen(3997, '127.0.0.1', r));
  try {
    const area = (await req('POST', '/academic-areas', { token: admin, body: { name: `Redes revision ${L}`, tags: [`rv${L}`] } })).data;
    const sk = (await req('POST', '/skills', { token: admin, body: { name: `Tecrevision ${L} Uno`, academicAreaId: area.id } })).data;
    const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
    const cat = cats.find((c) => c.code === 'curso_externo_recomendado') ?? cats[0];
    const op = (await req('POST', '/activities', {
      token: director.token,
      body: {
        title: `CCNA revision ${L}`, type: 'academica', categoryId: cat.id, status: 'open', originType: 'external',
        provider: 'Cisco Networking Academy', externalUrl: `${BASE}/v74/curso`, outcomePolicy: 'external_credential_expected',
        expectedIssuerDomains: ['afinia-pruebas.org'], activityDate: en(48), endAt: en(72), semesterScope: [1, 2, 3, 4, 5, 6, 7, 8],
        areaIds: [area.id], skillIds: [sk.id],
      },
    })).data;
    if (!op?.id) throw new Error('No se pudo crear la oportunidad');
    const modelo = await subirArchivo(director.token, pdfConTexto(['Cisco Networking Academy', 'CCNA Introduction to Networks', 'Otorgado a Persona Modelo']), 'modelo.pdf');
    await req('PUT', `/activities/${op.id}/validation-reference`, { token: director.token, body: { expectedCourseName: 'CCNA Introduction to Networks', sampleStoredFileId: modelo.data?.id } });
    for (const e of est) {
      await req('POST', `/activities/${op.id}/register`, { token: e.token });
      await req('PATCH', `/activities/${op.id}/confirm-participation`, { token: director.token, body: { studentProfileId: e.profileId, status: 'accepted' } });
    }
    await req('PATCH', `/activities/${op.id}`, { token: director.token, body: { status: 'finished' } });

    const vista = async (e, id) => (await req('GET', `/validation/external_certificate/${id}`, { token: e.token })).data;
    const procesar = async () => { for (let i = 0; i < 3; i++) await req('POST', '/validation/run?limit=50', { token: admin }); };
    const enviar = async (e, i, extra = {}) => {
      const f = await subirArchivo(e.token, pdfConTexto(['Cisco Networking Academy', 'CCNA Introduction to Networks', `Otorgado a ${e.nombre}`, `Folio ${i}-${Date.now()}`]), `e${i}.pdf`);
      const r = await req('POST', '/certificates/external', {
        token: e.token, body: { activityId: op.id, storedFileId: f.data?.id, issueDate: '2026-11-10', credentialId: `NA-2026-AA${i}`, certificateUrl: `${BASE}/v74/ok/${i}`, ...extra },
      });
      if (r.status !== 201) throw new Error(`No se pudo enviar la credencial (${r.status}): ${json(r.data)}`);
      return r.data.id;
    };
    // La afinidad se recalcula aparte: se espera el resultado, no un tiempo fijo.
    const puntos = async (certId, esperado) => {
      let p = -1;
      for (let i = 0; i < 20; i++) {
        p = Number(psql(`select coalesce(max(points), 0) from affinity_contributions where source_id = '${certId}'`));
        if (esperado === undefined || esperado(p)) return p;
        await espera(500);
      }
      return p;
    };
    const respaldo = async (certId, esperado) => {
      let p = -1;
      for (let i = 0; i < 20; i++) {
        p = Number(psql(`select coalesce(max(support_points), 0) from affinity_contributions where source_id = '${certId}'`));
        if (esperado(p)) return p;
        await espera(500);
      }
      return p;
    };
    const exportables = async (e) => ((await req('GET', '/trajectory-summary/items', { token: e.token })).data?.sections ?? []).flatMap((s) => s.items ?? []).map((x) => x.id);
    const respaldadas = async (e) => ((await req('GET', '/profiles/me/summary', { token: e.token })).data?.skills ?? []).map((s) => s.skill ?? s.name);
    const decidir = (token, id, body) => req('POST', `/validation/manual-reviews/${id}`, { token, body });

    // --- C11 / C14: fuente oficial individual que coincide; la máquina no aprueba.
    const c1 = await enviar(e1, 0);
    await procesar();
    const v1 = await vista(e1, c1);
    check(v1?.credentialCheck?.status === 'verified_match' && v1?.manualReview?.status === 'requested'
      && v1?.validationStatus?.status === 'MANUAL_REVIEW_REQUIRED' && v1?.backingTier !== 'corroborated',
    'V7.4.1 C11/C14 Una fuente oficial que coincide queda como hallazgo: sin CORROBORATED ni AUTO_VERIFIED, pendiente de Dirección', json({ c: v1?.credentialCheck?.status, s: v1?.validationStatus?.status, t: v1?.backingTier }));
    check(await puntos(c1) === 0 && !(await exportables(e1)).includes(c1) && !(await respaldadas(e1)).includes(sk.name),
      'V7.4.2 §5.1 Pendiente: no suma afinidad, no respalda tecnologías ni se exporta', json({ p: await puntos(c1) }));

    // --- C24: Administración no decide, ni por API.
    const deAdmin = await decidir(admin, c1, { decision: 'corroborated', reason: 'Administración intenta aprobar la credencial.', method: 'issuer_official_lookup', proof: 'https://otra-fuente.example.org/registro/1' });
    const sinCambio = psql(`select manual_review_status || '|' || backing_tier from validation_records where resource_id = '${c1}'`);
    const auditadas = psql(`select count(*) from audit_events where entity_id = '${c1}' and event_type = 'EXTERNAL_CREDENTIAL_MANUAL_REVIEWED'`);
    check(deAdmin.status === 403 && sinCambio.startsWith('requested|') && auditadas === '0',
      'V7.4.3 C24 D01 Administración intenta aprobar por API: 403, sin cambios ni decisión auditada', json({ s: deAdmin.status, sinCambio, auditadas }));
    const bandejaAdmin = await req('GET', '/validation/manual-reviews', { token: admin });
    check(bandejaAdmin.status === 200 && (bandejaAdmin.data?.items ?? bandejaAdmin.data ?? []).some((x) => x.certificateId === c1),
      'V7.4.4 D01 Administración consulta la bandeja (solo lectura)', `status ${bandejaAdmin.status}`);

    // --- C17: el estudiante no puede forzar el resultado.
    const forzado = await req('PATCH', `/certificates/external/${c1}`, {
      token: e1.token, body: { backingTier: 'corroborated', validationStatus: 'AUTO_VERIFIED', manualReviewStatus: 'corroborated' },
    });
    const trasForzar = psql(`select manual_review_status || '|' || backing_tier from validation_records where resource_id = '${c1}'`);
    check(forzado.status === 400 && trasForzar.startsWith('requested|') && !trasForzar.endsWith('corroborated'),
      'V7.4.5 C17 Enviar AUTO_VERIFIED o CORROBORATED en el cuerpo se rechaza y no cambia nada', json({ s: forzado.status, trasForzar }));

    // --- C20: Dirección aprueba con prueba externa.
    const aprobada = await decidir(director.token, c1, {
      decision: 'corroborated', reason: 'Consulté el registro individual del emisor: código y nombre coinciden.',
      method: 'issuer_official_lookup', proof: 'Registro oficial NA-2026-AA0 consultado el 26/11 en el portal del emisor.',
    });
    const v1b = await vista(e1, c1);
    check(aprobada.status === 200 && v1b?.validationStatus?.status === 'MANUALLY_VERIFIED' && v1b?.backingTier === 'corroborated'
      && v1b?.credentialCheck?.status === 'verified_match' && v1b?.manualReview?.method === 'issuer_official_lookup',
    'V7.4.6 C20 Dirección aprueba con prueba externa: corroborada, con método y prueba; los hallazgos se conservan', json({ s: v1b?.validationStatus, t: v1b?.backingTier }));
    check(await puntos(c1, (p) => p > 0) > 0 && (await exportables(e1)).includes(c1),
      'V7.4.7 C20 Recién aprobada cuenta: suma afinidad y se exporta', json({ p: await puntos(c1) }));

    // --- C28: con decisión, no se recomprueba.
    const recheck = await req('POST', `/validation/manual-reviews/${c1}/recheck`, { token: director.token });
    check(recheck.status === 409 && recheck.data?.code === 'RECHECK_AFTER_DECISION' && psql(`select manual_review_status from validation_records where resource_id = '${c1}'`) === 'corroborated',
      'V7.4.8 C28 Una aprobada no se vuelve a comprobar: la decisión queda intacta', json({ s: recheck.status, c: recheck.data?.code }));

    // --- C21: observar y reenviar.
    const c2 = await enviar(e2, 1);
    await procesar();
    const observada = await decidir(director.token, c2, { decision: 'observed', reason: 'Falta la página con el código: sube el certificado completo.' });
    const v2 = await vista(e2, c2);
    const bandejaE2 = (await req('GET', '/notifications/me', { token: e2.token })).data;
    const aviso = (Array.isArray(bandejaE2) ? bandejaE2 : bandejaE2?.items ?? []).some((n) => /observ|corr[ií]g/i.test(`${n.title} ${n.body}`));
    check(observada.status === 200 && v2?.validationStatus?.status === 'OBSERVED' && /certificado completo/.test(v2?.manualReview?.reason ?? '')
      && aviso && await puntos(c2) === 0,
    'V7.4.9 C21 Observada: el motivo se ve, el estudiante recibe el aviso y no suma', json({ s: v2?.validationStatus, aviso }));
    const corrige = await req('PATCH', `/certificates/external/${c2}`, { token: e2.token, body: { description: 'Subo el certificado completo con la página del código.' } });
    const v2b = await vista(e2, c2);
    check(corrige.status === 200 && v2b?.manualReview?.status === 'requested' && v2b?.previousAttempts >= 1,
      'V7.4.10 C21 Corregida, vuelve a la revisión y la observación queda en el historial', json({ m: v2b?.manualReview?.status, p: v2b?.previousAttempts }));

    // --- C21: rechazar con motivo.
    const c3 = await enviar(e3, 2);
    const rechazo = await decidir(director.token, c3, { decision: 'rejected', reason: 'El emisor informó que ese código pertenece a otra persona.' });
    const v3 = await vista(e3, c3);
    check(rechazo.status === 200 && v3?.validationStatus?.status === 'REJECTED' && v3?.backingTier === 'flagged' && await puntos(c3) === 0,
      'V7.4.11 C21 Rechazada con motivo: señalada, no suma y sigue registrada', json({ s: v3?.validationStatus, t: v3?.backingTier }));

    // --- C22: aprobación revisando solo el documento.
    const c4 = await enviar(e4, 3);
    const doc = await decidir(director.token, c4, { decision: 'approved', reason: 'Revisé el documento y los datos de la oportunidad; no consulté al emisor.', method: 'document_only' });
    const v4 = await vista(e4, c4);
    check(doc.status === 200 && v4?.validationStatus?.status === 'APPROVED' && v4?.backingTier === 'supported'
      && !/verificad|autentic/i.test(v4?.validationStatus?.label ?? '') && await respaldo(c4, (p) => p > 0) > 0 && (await exportables(e4)).includes(c4),
    'V7.4.12 C22 Aprobada solo con el documento: cuenta con respaldo parcial (pesos vigentes, D06), sin «verificada» ni corroboración fuerte', json({ s: v4?.validationStatus, t: v4?.backingTier }));

    // --- C12: el enlace nombra a otra persona; la máquina no decide.
    const c5 = await enviar(e5, 4, { certificateUrl: `${BASE}/v74/otra`, credentialId: 'NA-2026-ZZ9' });
    await procesar();
    const v5 = await vista(e5, c5);
    check((v5?.credentialCheck?.contradictions ?? []).includes('official_holder_mismatch') && v5?.manualReview?.status === 'requested'
      && v5?.validationStatus?.status === 'MANUAL_REVIEW_REQUIRED',
    'V7.4.13 C12 Fuente con otro titular: la discrepancia se ve y la decide Dirección, no la máquina', json({ c: v5?.credentialCheck?.contradictions, s: v5?.validationStatus?.status }));

    // --- Bandeja: todas las presentadas, pendientes primero.
    const bandeja = await req('GET', '/validation/manual-reviews', { token: director.token });
    const items = bandeja.data?.items ?? bandeja.data ?? [];
    const mias = items.filter((x) => [c1, c2, c3, c4, c5].includes(x.certificateId));
    const primerDecidido = items.findIndex((x) => x.reviewStatus !== 'requested');
    const ultimoPendiente = items.map((x) => x.reviewStatus).lastIndexOf('requested');
    const soloPendientes = (await req('GET', '/validation/manual-reviews?estado=pendientes', { token: director.token })).data;
    check(mias.length === 5 && (primerDecidido === -1 || ultimoPendiente < primerDecidido)
      && (soloPendientes?.items ?? soloPendientes ?? []).every((x) => x.reviewStatus === 'requested') && mias.every((x) => Array.isArray(x.phases)),
    'V7.4.14 §5.3 Fase 3 La bandeja muestra todas las presentadas con sus fases, las pendientes primero; filtra por estado', json(mias.map((x) => x.reviewStatus)));

    // --- C23: una antigua corroborada por la máquina no se revoca al desplegar.
    const c6 = await enviar(e1, 0, { activityId: undefined, certificateName: `Antigua corroborada ${L}`, issuer: 'Cisco Networking Academy' });
    psql(`update validation_records set manual_review_status = null, manual_review_requested_at = null, backing_tier = 'corroborated', status = 'completed', skipped_reason = null, credential_check = '{"status":"verified_match","contradictions":[],"pipeline":[],"qr":"qr_absent","aiUsed":false}'::jsonb where resource_id = '${c6}'`);
    const v6 = await vista(e1, c6);
    check(v6?.backingTier === 'corroborated' && v6?.validationStatus?.status === 'AUTO_VERIFIED' && v6?.manualReview?.status === null,
      'V7.4.15 C23 Una credencial antigua corroborada por la máquina conserva su estado: no se revoca en silencio', json({ t: v6?.backingTier, s: v6?.validationStatus }));
  } finally {
    server.close();
  }
}

// ===========================================================================
//  BATCH V7-5 — Documentos institucionales: general / individual (§6.3, §6.4, D05)
// ===========================================================================
async function batch5(ctx) {
  objective('BATCH V7-5 · Certificado general automático, individual por estudiante, sin reemplazos silenciosos, abrir lo recibido');
  const admin = ctx.admin;
  const director = await provisionAndActivate(admin, { firstName: 'Nora', lastName: `Certifica${L}`, email: correoStaff('b5dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(admin, { firstName: 'Raul', lastName: `Entrega${L}`, email: correoStaff('b5doc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: admin, body: { semesters: [1, 2, 3, 4, 5, 6, 7, 8] } });
  const est = [];
  for (const [i, n] of ['Ana', 'Beto', 'Cora', 'Dani'].entries()) {
    const e = await provisionAndActivate(admin, { firstName: n, lastName: `Documento${L}`, email: correoEst(`b5e${i}`), role: 'STUDENT', semester: 4 });
    e.profileId = (await req('GET', '/profiles/me', { token: e.token })).data?.id;
    est.push(e);
  }
  const [e1, e2, e3] = est;
  const cats = ((await req('GET', '/activity-categories?status=active', { token: admin })).data ?? []);
  const cat = cats.find((c) => c.appliesTo === 'academica') ?? cats.find((c) => !c.appliesTo);
  const actividad = async (titulo, modo) => {
    const r = await req('POST', '/activities', {
      token: director.token,
      body: {
        title: `${titulo} ${L}`, type: 'academica', categoryId: cat?.id, status: 'open', activityDate: en(48), endAt: en(50),
        modality: 'presencial', location: 'Aula 300', semesterScope: [1, 2, 3, 4, 5, 6, 7, 8], responsibleUserIds: [docente.userId],
        outcomePolicy: 'institution_issued_certificate', certificateIssuer: 'Universidad del Valle', certificateMode: modo,
      },
    });
    if (r.status !== 201) throw new Error(`No se pudo crear la actividad (${r.status}): ${json(r.data)}`);
    for (const e of est) await req('POST', `/activities/${r.data.id}/register`, { token: e.token, body: {} });
    for (const e of [e1, e2]) await req('PATCH', `/activities/${r.data.id}/confirm-participation`, { token: docente.token, body: { studentProfileId: e.profileId, status: 'confirmed' } });
    await req('PATCH', `/activities/${r.data.id}/confirm-participation`, { token: docente.token, body: { studentProfileId: e3.profileId, status: 'absent' } });
    return r.data;
  };
  const terminar = (a) => req('PATCH', `/activities/${a.id}`, { token: director.token, body: { status: 'finished' } });
  const cerrar = (a) => req('POST', `/activities/${a.id}/attendance/close`, { token: docente.token });
  const entregados = (a) => Number(psql(`select count(*) from internal_constancies where activity_id = '${a.id}'`));
  const estado = async (a) => (await req('GET', `/constancies/internal/institution-certificates/${a.id}/status`, { token: docente.token })).data;
  const subirPdf = async (token, texto) => (await subirArchivo(token, pdfConTexto([texto, `${L}-${Date.now()}`]), 'certificado.pdf')).data?.id;
  const entregar = (a, body, token = docente.token) => req('POST', `/constancies/internal/institution-certificates/${a.id}`, { token, body });

  // --- I03: general sin archivo: pendiente, sin fabricar nada.
  const G1 = await actividad('Seminario general', 'general');
  await terminar(G1);
  await cerrar(G1);
  const s1 = await estado(G1);
  check(entregados(G1) === 0 && s1?.pending === 'falta_archivo' && /no se fabrica/.test(s1?.pendingMessage ?? ''),
    'V7.5.1 I03 General sin archivo: queda pendiente y lo dice; no se fabrica ningún documento', json(s1));

  // --- I02 / I09: al subir el archivo real (ya terminada y cerrada) se entrega a los confirmados, no al ausente.
  const archivoG1 = await subirPdf(docente.token, 'Certificado general del seminario');
  const subida = await req('PUT', `/constancies/internal/institution-certificates/${G1.id}/general-file`, { token: docente.token, body: { storedFileId: archivoG1 } });
  const filasG1 = psql(`select string_agg(student_profile_id::text || ':' || stored_file_id::text, ',') from internal_constancies where activity_id = '${G1.id}'`);
  check(subida.status === 200 && entregados(G1) === 2 && filasG1.includes(`${e1.profileId}:${archivoG1}`) && filasG1.includes(`${e2.profileId}:${archivoG1}`)
    && !filasG1.includes(e3.profileId),
  'V7.5.2 I02/I09 General con archivo real, terminada y lista cerrada: se entrega solo a los confirmados, nunca al ausente', json({ s: subida.status, n: entregados(G1) }));

  // --- Idempotencia: otra vuelta no duplica ni repite avisos.
  const otra = await entregar(G1, {});
  const avisos = Number(psql(`select count(*) from notifications n join users u on u.id = n.recipient_user_id where u.email = '${e1.email}' and n.type = 'CERTIFICATE_DELIVERED'`));
  check(otra.status === 201 && otra.data?.delivered === 0 && otra.data?.alreadyDelivered === 2 && entregados(G1) === 2 && avisos === 1,
    'V7.5.3 I05/I09 Volver a entregar el general no duplica certificados ni avisos', json({ s: otra.status, d: otra.data, avisos }));

  // --- Orden de los disparadores: archivo antes de terminar; termina con la lista abierta; al cerrarla, se entrega.
  const G2 = await actividad('Taller general', 'general');
  await req('PUT', `/constancies/internal/institution-certificates/${G2.id}/general-file`, { token: docente.token, body: { storedFileId: await subirPdf(docente.token, 'Certificado general del taller') } });
  const antes = entregados(G2);
  await terminar(G2);
  const terminadaAbierta = entregados(G2);
  const sAbierta = await estado(G2);
  await cerrar(G2);
  check(antes === 0 && terminadaAbierta === 0 && sAbierta?.pending === 'falta_fin_o_cierre' && entregados(G2) === 2,
    'V7.5.4 D05 Con el archivo listo, se entrega sola cuando se cumplen el fin y el cierre de la lista, sin otro clic', json({ antes, terminadaAbierta, p: sAbierta?.pending, despues: entregados(G2) }));

  // --- DOC-03: no se entrega antes de terminar.
  const I = await actividad('Curso individual', 'individual');
  const temprano = await entregar(I, { profileIds: [e1.profileId], storedFileId: await subirPdf(docente.token, 'Certificado de Ana') });
  check(temprano.status === 409 && temprano.data?.code === 'CERTIFICATE_ACTIVITY_NOT_FINISHED',
    'V7.5.5 DOC-03 Un certificado no se entrega antes de que la actividad termine', json({ s: temprano.status, c: temprano.data?.code }));

  // --- I04: individual, un archivo por estudiante.
  await terminar(I);
  const fAna = await subirPdf(docente.token, 'Certificado de Ana');
  const fBeto = await subirPdf(docente.token, 'Certificado de Beto');
  const aAna = await entregar(I, { profileIds: [e1.profileId], storedFileId: fAna });
  const masivo = await entregar(I, { profileIds: [e1.profileId, e2.profileId], storedFileId: fBeto });
  const mismo = await entregar(I, { profileIds: [e2.profileId], storedFileId: fAna });
  const aBeto = await entregar(I, { profileIds: [e2.profileId], storedFileId: fBeto });
  const filasI = psql(`select string_agg(student_profile_id::text || ':' || stored_file_id::text, ',') from internal_constancies where activity_id = '${I.id}'`);
  check(aAna.status === 201 && masivo.status === 400 && mismo.status === 409 && mismo.data?.code === 'INDIVIDUAL_FILE_REUSED' && aBeto.status === 201
    && filasI.includes(`${e1.profileId}:${fAna}`) && filasI.includes(`${e2.profileId}:${fBeto}`),
  'V7.5.6 I04 Individual: cada estudiante recibe su archivo; no se entrega el mismo a todos ni el de otro', json({ s: [aAna.status, masivo.status, mismo.status, aBeto.status] }));

  // --- I05: repetir no cambia nada; reemplazar exige motivo y versiona.
  const repite = await entregar(I, { profileIds: [e1.profileId], storedFileId: fAna });
  const fAna2 = await subirPdf(docente.token, 'Certificado de Ana corregido');
  const sinMotivo = await entregar(I, { profileIds: [e1.profileId], storedFileId: fAna2 });
  const conMotivo = await entregar(I, { profileIds: [e1.profileId], storedFileId: fAna2, replaceReason: 'El emisor corrigió el número de horas.' });
  const fila = psql(`select version || '|' || jsonb_array_length(previous_versions) || '|' || stored_file_id from internal_constancies where activity_id = '${I.id}' and student_profile_id = '${e1.profileId}'`);
  check(repite.status === 201 && repite.data?.alreadyDelivered === 1 && sinMotivo.status === 409 && sinMotivo.data?.code === 'CERTIFICATE_ALREADY_DELIVERED'
    && conMotivo.status === 201 && fila === `2|1|${fAna2}`,
  'V7.5.7 I05 Repetir no duplica; reemplazar sin motivo es 409; con motivo queda la versión 2 y la anterior en el historial', json({ s: [repite.status, sinMotivo.status, conMotivo.status], fila }));

  // --- I06 / I07: abrir lo recibido, autenticado; nadie más lo abre.
  const mio = ((await req('GET', '/constancies/internal/my', { token: e1.token })).data ?? []).find((c) => c.activityId === I.id);
  const url = `${process.env.API_URL?.replace(/\/api$/, '') ?? 'http://localhost:3020'}${mio?.fileUrl ?? ''}`;
  const abrir = (token) => fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const propio = await abrir(e1.token);
  const ajeno = await abrir(e2.token);
  const sinSesion = await abrir(null);
  check(!!mio?.fileUrl && propio.status === 200 && /pdf/.test(propio.headers.get('content-type') ?? '') && [403, 404].includes(ajeno.status) && sinSesion.status === 401,
    'V7.5.8 I06/I07 El estudiante abre su certificado (PDF, con su sesión); otro estudiante y sin sesión no', json({ propio: propio.status, ajeno: ajeno.status, sinSesion: sinSesion.status }));

  // --- DOC-06: Administración no entrega documentos académicos.
  const deAdmin = await entregar(I, { profileIds: [e2.profileId], storedFileId: fBeto }, admin);
  check(deAdmin.status === 403, 'V7.5.9 DOC-06 Administración no entrega certificados', `status ${deAdmin.status}`);
}

const BATCHES = { batch1, batch2, batch3, batch4, batch5 };

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
