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
import { codigoUniversitario, loginAdmin, provisionAndActivate, req } from './lib/fixtures.mjs';

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

  const adminPend = await gest(admin, { review: 'pending' });
  check(adminPend.status === 200 && !ids(adminPend.data).includes(propuesta.data.id),
    'V7.1.24 La propuesta del docente no entra en la gestión de Administración (su consulta de solo lectura es V7-2)', json({ s: adminPend.status }));

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

const BATCHES = { batch1 };

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
