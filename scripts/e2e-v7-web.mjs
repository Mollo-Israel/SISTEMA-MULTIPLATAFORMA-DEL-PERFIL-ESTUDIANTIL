/**
 * Cierre V7.1 — lo que la persona ve en la web, con un navegador real.
 *
 * Complementa a `e2e-v7.mjs` (la API). Se ejecuta contra el entorno aislado:
 *
 *   node scripts/pruebas/entorno.mjs api   # :3020, base afinia_test
 *   node scripts/pruebas/entorno.mjs web   # compila contra :3020 y sirve en :5180
 *   API_URL=http://localhost:3020/api WEB_URL=http://localhost:5180 node scripts/e2e-v7-web.mjs [batch1 …]
 */
import { execSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { codigoUniversitario, loginAdmin, provisionAndActivate, provisionStudent, req, ADMIN_CREDENTIALS, PWD, pdfConTexto, subirArchivo } from './lib/fixtures.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5180';
const TS = Date.now();
const L = String.fromCharCode(...String(TS).slice(-6).split('').map((d) => 97 + Number(d)));
const C = { r: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[90m', ok: '\x1b[32m', bad: '\x1b[31m', head: '\x1b[36m' };
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
const correoStaff = (k) => `v71w.${k}.${TS}@univalle.edu`;
const correoEst = (k) => `v71w.${k}.${TS}@est.univalle.edu`;
/** Base de la API en prueba; por omisión la aislada. */
const psql = (sql) => execSync(
  `docker exec perfil_postgres psql -U ${process.env.POSTGRES_USER ?? 'perfil_user'} -d ${process.env.POSTGRES_DB ?? 'afinia_test'} -tAc "${sql.replace(/"/g, '\\"')}"`,
  { encoding: 'utf8' },
).trim();
const json = (x) => JSON.stringify(x ?? null).slice(0, 220);
const en = (h) => new Date(Date.now() + h * 3_600_000).toISOString();

async function navegador() {
  const canales = process.env.E2E_BROWSER ? [process.env.E2E_BROWSER] : ['msedge', 'chrome'];
  for (const channel of canales) {
    try { return await chromium.launch({ channel, headless: true }); } catch { /* el siguiente */ }
  }
  throw new Error('No hay Edge ni Chrome instalados para Playwright.');
}

async function entrar(browser, email, password = PWD) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto(`${WEB}/login`);
  await page.fill('input[type=email]', email);
  await page.fill('input[autocomplete=current-password]', password);
  await page.press('input[autocomplete=current-password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  await page.getByRole('button', { name: 'Omitir' }).click({ timeout: 3000 }).catch(() => {});
  return { ctx, page, errores };
}

/** Espera a que la grilla termine de cargar el filtro pedido. */
async function grillaLista(page) {
  await page.locator('[aria-busy="false"]').first().waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
}
/** Textos de las filas visibles de la primera tabla. */
const filas = async (page) => (await page.locator('tbody tr').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());
const param = (page, k) => new URL(page.url()).searchParams.get(k);

async function cuentaPendiente(admin, { firstName, lastName, k }) {
  const r = await req('POST', '/users', {
    token: admin,
    body: { firstName, lastName, email: correoStaff(k), role: 'TEACHER', universityCode: codigoUniversitario('TEACHER') },
  });
  if (r.status !== 201) throw new Error(`No se pudo crear la cuenta pendiente ${k} (${r.status})`);
  return r.data;
}

// ===========================================================================
//  BATCH V7-1 — Filtros excluyentes en la web (F01–F05)
// ===========================================================================
async function batch1(ctx, browser) {
  objective('BATCH V7-1 · Selector de un solo estado, en la URL, que vuelve a la página 1');
  const admin = ctx.admin;
  const M = `Webfiltro${L}`;
  await provisionAndActivate(admin, { firstName: 'Ana', lastName: M, email: correoStaff('act'), role: 'TEACHER' });
  const sus = await provisionAndActivate(admin, { firstName: 'Carla', lastName: M, email: correoStaff('sus'), role: 'TEACHER' });
  await req('PATCH', `/users/${sus.userId}/status`, { token: admin, body: { status: 'suspended' } });
  await cuentaPendiente(admin, { firstName: 'Elena', lastName: M, k: 'pen' });
  const P = `Webpagina${L}`;
  for (const [i, n] of ['Alba', 'Beto', 'Ciro', 'Dina', 'Eloy', 'Fabi', 'Gael', 'Hugo', 'Ines', 'Juan', 'Kira'].entries()) {
    await cuentaPendiente(admin, { firstName: n, lastName: P, k: `pag${i}` });
  }

  const { ctx: c1, page, errores } = await entrar(browser, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
  await page.goto(`${WEB}/admin/users?q=${M}`);
  await grillaLista(page);
  const porOmision = await filas(page);
  const estadoInicial = await page.getByLabel('Estado de la cuenta').inputValue();
  check(estadoInicial === 'active' && porOmision.length === 1 && porOmision[0].includes('Ana') && !porOmision.some((t) => t.includes('Carla') || t.includes('Elena')),
    'W7.1.1 Por omisión «Activas»: ni la suspendida ni la pendiente', json({ estadoInicial, porOmision }));

  await page.getByLabel('Estado de la cuenta').selectOption('suspended');
  await grillaLista(page);
  const suspendidas = await filas(page);
  check(suspendidas.length === 1 && suspendidas[0].includes('Carla') && param(page, 'status') === 'suspended' && param(page, 'q') === M,
    'W7.1.2 F01 «Suspendidas» muestra solo la suspendida y queda en la URL junto a la búsqueda', json({ suspendidas, url: page.url() }));

  await page.reload();
  await grillaLista(page);
  const trasRecarga = { estado: await page.getByLabel('Estado de la cuenta').inputValue(), buscador: await page.locator('.search-input input, input[type=search]').first().inputValue(), filas: await filas(page) };
  await page.goto(`${WEB}/admin`);
  await page.goBack();
  await grillaLista(page);
  const trasVolver = { estado: await page.getByLabel('Estado de la cuenta').inputValue(), filas: await filas(page) };
  check(trasRecarga.estado === 'suspended' && trasRecarga.buscador === M && trasRecarga.filas.length === 1
    && trasVolver.estado === 'suspended' && trasVolver.filas.length === 1 && trasVolver.filas[0].includes('Carla'),
  'W7.1.3 F05 Los dos filtros se conservan al recargar y al volver atrás', json({ trasRecarga, trasVolver }));

  await page.getByLabel('Estado de la cuenta').selectOption('pending_activation');
  await grillaLista(page);
  const pendientes = await filas(page);
  check(pendientes.length === 1 && pendientes[0].includes('Elena') && !pendientes[0].includes('Carla'),
    'W7.1.4 F02 «Pendientes de activación» no confunde pendiente con suspendida', json({ pendientes }));

  // F04: en la página 2, cambiar el filtro vuelve a la 1.
  await page.goto(`${WEB}/admin/users?status=pending_activation&q=${P}`);
  await grillaLista(page);
  const primera = await filas(page);
  await page.getByRole('button', { name: 'Página 2' }).click();
  await grillaLista(page);
  const segunda = await filas(page);
  const enDos = param(page, 'page');
  await page.getByLabel('Estado de la cuenta').selectOption('all');
  await grillaLista(page);
  const actual = await page.locator('.paginacion [aria-current="page"]').textContent().catch(() => null);
  check(primera.length === 10 && segunda.length === 1 && enDos === '2' && param(page, 'page') === null && actual?.trim() === '1',
    'W7.1.5 F04 10 filas en la página 1, 1 en la 2; al cambiar el filtro vuelve a la página 1', json({ p1: primera.length, p2: segunda.length, enDos, actual }));

  // Un enlace directo (como los del Inicio) abre la grilla ya filtrada.
  await page.goto(`${WEB}/admin/users?status=pending_activation&q=${M}`);
  await grillaLista(page);
  const directo = { estado: await page.getByLabel('Estado de la cuenta').inputValue(), filas: await filas(page) };
  check(directo.estado === 'pending_activation' && directo.filas.length === 1 && directo.filas[0].includes('Elena'),
    'W7.1.6 Un enlace con ?status=pending_activation llega con solo las pendientes', json(directo));

  // Catálogo: «Dadas de baja» y la pestaña conserva el filtro.
  const area = await req('POST', '/academic-areas', { token: admin, body: { name: `Area web baja ${L}`, tags: [`webbaja${L}`] } });
  await req('PATCH', `/academic-areas/${area.data?.id}`, { token: admin, body: { isActive: false } });
  await page.goto(`${WEB}/admin/areas`);
  await grillaLista(page);
  await page.getByLabel('Estado', { exact: true }).first().selectOption('inactive');
  await grillaLista(page);
  await page.locator('.search-input input, input[type=search]').first().fill(`Area web baja ${L}`);
  await page.waitForTimeout(400);
  const bajas = await filas(page);
  const enUrl = param(page, 'status');
  await page.getByRole('tab', { name: /Habilidades/ }).click();
  await grillaLista(page);
  const pestana = { tab: param(page, 'tab'), status: param(page, 'status') };
  check(area.status === 201 && bajas.length === 1 && bajas[0].includes('De baja') && enUrl === 'inactive' && pestana.tab === 'skills' && pestana.status === 'inactive',
    'W7.1.7 F03 Áreas «Dadas de baja» trae la retirada; al cambiar de pestaña el filtro sigue en la URL', json({ bajas, enUrl, pestana }));

  // Actividades: estado de la actividad y revisión, dos selectores, en la URL.
  const cats = ((await req('GET', '/activity-categories?status=active', { token: admin })).data ?? []);
  const cat = cats.find((c) => c.appliesTo === 'academica') ?? cats[0];
  const resp = await provisionAndActivate(admin, { firstName: 'Kevin', lastName: `Webact${L}`, email: correoStaff('resp'), role: 'TEACHER' });
  await req('PUT', `/users/${resp.userId}/semesters`, { token: admin, body: { semesters: [1, 2, 3, 4, 5, 6, 7, 8] } });
  const base = { type: 'academica', categoryId: cat?.id, activityDate: en(72), endAt: en(74), modality: 'presencial', location: 'Aula 301', semesterScope: [1, 2, 3, 4, 5, 6, 7, 8], responsibleUserIds: [resp.userId] };
  await req('POST', '/activities', { token: admin, body: { ...base, title: `Webborrador ${L}`, status: 'draft' } });
  await req('POST', '/activities', { token: admin, body: { ...base, title: `Webabierta ${L}`, status: 'open' } });
  await page.goto(`${WEB}/admin/activities`);
  await page.getByLabel('Estado de la actividad').waitFor({ timeout: 30000 }).catch(() => {});
  await page.locator('.search-input input, input[type=search]').first().fill(L);
  await page.getByLabel('Estado de la actividad').selectOption('draft');
  await page.getByLabel('Revisión', { exact: true }).selectOption('not_required');
  await page.waitForTimeout(300);
  const filtradas = await filas(page);
  const url = { status: param(page, 'status'), review: param(page, 'review') };
  await page.reload();
  await page.getByLabel('Estado de la actividad').waitFor({ timeout: 30000 }).catch(() => {});
  const trasRecargaAct = { estado: await page.getByLabel('Estado de la actividad').inputValue(), revision: await page.getByLabel('Revisión', { exact: true }).inputValue() };
  check(filtradas.some((t) => t.includes(`Webborrador ${L}`)) && !filtradas.some((t) => t.includes(`Webabierta ${L}`))
    && url.status === 'draft' && url.review === 'not_required' && trasRecargaAct.estado === 'draft' && trasRecargaAct.revision === 'not_required',
  'W7.1.8 Actividades: «Estado de la actividad» y «Revisión» separados, combinados y conservados al recargar', json({ filtradas, url, trasRecargaAct }));

  check(errores.length === 0, 'W7.1.9 Sin errores de JavaScript', errores.join(' | '));
  await c1.close();
}

// ===========================================================================
//  BATCH V7-2 — Aprobar publica y abre; Admin en solo lectura; asistencia
// ===========================================================================
async function batch2(ctx, browser) {
  objective('BATCH V7-2 · Aprobar publica y abre; Admin consulta en solo lectura; corregir con la lista abierta');
  const admin = ctx.admin;
  const director = await provisionAndActivate(admin, { firstName: 'Dora', lastName: `Webaprueba${L}`, email: correoStaff('b2dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(admin, { firstName: 'Carlos', lastName: `Webpropone${L}`, email: correoStaff('b2doc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: admin, body: { semesters: [1, 2, 3, 4, 5, 6, 7, 8] } });
  const cats = ((await req('GET', '/activity-categories?status=active', { token: admin })).data ?? []);
  const cat = cats.find((c) => c.appliesTo === 'academica') ?? cats.find((c) => !c.appliesTo);
  const base = { type: 'academica', categoryId: cat?.id, activityDate: en(72), endAt: en(74), modality: 'presencial', location: 'Aula 210', semesterScope: [1, 2, 3, 4, 5, 6, 7, 8] };
  const propuesta = async (titulo) => {
    const p = await req('POST', '/activities', { token: docente.token, body: { ...base, title: `${titulo} ${L}`, status: 'draft' } });
    await req('POST', `/activities/${p.data?.id}/submit`, { token: docente.token, body: {} });
    return p.data;
  };
  const aprobarla = await propuesta('Webtaller aprobar');
  const consultarla = await propuesta('Webtaller consulta');

  // A03: Dirección aprueba desde su bandeja y queda publicada y abierta.
  const { ctx: cd, page: pd, errores: ed } = await entrar(browser, director.email);
  await pd.goto(`${WEB}/director/approvals`);
  const tarjeta = pd.locator('.card', { hasText: aprobarla.title });
  await tarjeta.getByRole('button', { name: 'Decidir' }).click({ timeout: 30000 });
  await tarjeta.getByRole('button', { name: 'Aprobar', exact: true }).click();
  const aviso = await pd.getByText('Actividad aprobada y publicada.').first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  const tras = (await req('GET', `/activities/${aprobarla.id}`, { token: admin })).data;
  check(aviso && tras?.status === 'open' && tras?.reviewStatus === 'approved',
    'W7.2.1 A03 Dirección aprueba en su bandeja: el aviso dice «aprobada y publicada» y queda con inscripciones abiertas', json({ aviso, st: tras?.status, r: tras?.reviewStatus }));
  check(ed.length === 0, 'W7.2.2 Sin errores de JavaScript en la bandeja de Dirección', ed.join(' | '));
  await cd.close();

  // A01: Administración la ve en «En revisión», en solo lectura, sin acciones.
  const { ctx: ca, page: pa, errores: ea } = await entrar(browser, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
  await pa.goto(`${WEB}/admin/activities?review=pending`);
  await pa.getByLabel('Revisión', { exact: true }).waitFor({ timeout: 30000 }).catch(() => {});
  await pa.locator('.search-input input, input[type=search]').first().fill(consultarla.title);
  await pa.waitForTimeout(400);
  const fila = pa.locator('tbody tr', { hasText: consultarla.title });
  const marca = await fila.locator('[data-testid="solo-lectura"]').count();
  const editar = await fila.getByRole('button', { name: `Editar ${consultarla.title}` }).count();
  const verDetalles = await fila.getByRole('button', { name: `Ver detalles de ${consultarla.title}` }).count();
  const selectorEstado = await fila.locator('select').count();
  check(marca === 1 && editar === 0 && verDetalles === 1 && selectorEstado === 0,
    'W7.2.3 A01 Administración ve la propuesta en «En revisión»: marcada solo lectura, sin editar ni cambiar estado; solo «Ver detalles»', json({ marca, editar, verDetalles, selectorEstado }));
  check(ea.length === 0, 'W7.2.4 Sin errores de JavaScript en la gestión de Administración', ea.join(' | '));
  await ca.close();

  // A10: finalizada con la lista abierta, el responsable ve «Marcar ausente».
  const asis = await req('POST', '/activities', { token: director.token, body: { ...base, title: `Webasistencia ${L}`, responsibleUserIds: [docente.userId], status: 'open' } });
  const est = await provisionStudent(admin, { firstName: 'Ivo', lastName: `Webasiste${L}`, email: correoEst('b2est'), semester: 1 });
  await req('POST', `/activities/${asis.data?.id}/register`, { token: est.token, body: {} });
  await req('PATCH', `/activities/${asis.data?.id}/confirm-participation`, { token: docente.token, body: { studentProfileId: est.profileId, status: 'confirmed' } });
  psql(`update activities set status = 'finished' where id = '${asis.data?.id}'`);
  const { ctx: ct, page: pt, errores: et } = await entrar(browser, docente.email);
  await pt.goto(`${WEB}/teacher/my-activities?actividad=${asis.data?.id}`);
  const filaEst = pt.locator('tr, li, .participant-row, div', { hasText: `Webasiste${L}` }).last();
  await filaEst.waitFor({ timeout: 30000 }).catch(() => {});
  const marcarAusente = await pt.getByRole('button', { name: 'Marcar ausente' }).count();
  const consolidada = await pt.getByText('Consolidada: la corrige Dirección').count();
  check(marcarAusente >= 1 && consolidada === 0,
    'W7.2.5 A10 Finalizada con la lista abierta: el responsable todavía ve «Marcar ausente» (no «Consolidada»)', json({ marcarAusente, consolidada }));
  check(et.length === 0, 'W7.2.6 Sin errores de JavaScript en la asistencia del docente', et.join(' | '));
  await ct.close();
}

async function batch3(ctx, browser) {
  objective('BATCH V7-3 · Formulario de credencial vinculada en solo lectura, tres fases y certificado modelo de Dirección');
  const admin = ctx.admin;
  const director = await provisionAndActivate(admin, { firstName: 'Irene', lastName: `Webmodelo${L}`, email: correoStaff('b3dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(admin, { firstName: 'Tomas', lastName: `Webresponsable${L}`, email: correoStaff('b3doc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: admin, body: { semesters: [1, 2, 3, 4, 5, 6, 7, 8] } });
  const est = await provisionStudent(admin, { firstName: 'Valeria', lastName: `Webcredencial${L}`, email: correoEst('b3est'), semester: 5 });
  // La bienvenida se completa por API para que entre directo a sus credenciales.
  await req('POST', '/profiles/me/onboarding/institutional-confirmation', { token: est.token, body: {} });
  const unaSkill = ((await req('GET', '/skills', { token: est.token })).data ?? []).find((s) => s.isActive !== false);
  await req('PUT', '/profiles/me/skill-interests', { token: est.token, body: { items: [{ skillId: unaSkill?.id, kind: 'interest' }] } });
  await req('PATCH', '/profiles/me', { token: est.token, body: { availability: 'open' } });
  await req('POST', '/profiles/me/onboarding/privacy', { token: est.token, body: { peerDiscoverable: true, publicProfileEnabled: false } });
  await req('POST', '/profiles/me/onboarding/complete', { token: est.token });
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const cat = cats.find((c) => c.code === 'curso_externo_recomendado') ?? cats[0];
  const area = (await req('POST', '/academic-areas', { token: admin, body: { name: `Webredes credencial ${L}`, tags: [`wrc${L}`] } })).data;
  const PROVEEDOR = 'Academia Andina de Redes';
  const op = await req('POST', '/activities', {
    token: director.token,
    body: {
      title: `Webfundamentos andinos ${L}`, type: 'academica', categoryId: cat.id, status: 'open', originType: 'external', provider: PROVEEDOR,
      externalUrl: 'https://andina.example.org/cursos', outcomePolicy: 'external_credential_expected', activityDate: en(48), endAt: en(72),
      semesterScope: [1, 2, 3, 4, 5, 6, 7, 8], areaIds: [area.id], responsibleUserIds: [docente.userId],
    },
  });
  if (op.status !== 201) throw new Error(`No se pudo crear la oportunidad (${op.status}): ${json(op.data)}`);
  const A = op.data;
  await req('POST', `/activities/${A.id}/register`, { token: est.token });
  await req('PATCH', `/activities/${A.id}/confirm-participation`, { token: director.token, body: { studentProfileId: est.profileId, status: 'accepted' } });
  await req('PUT', `/activities/${A.id}/validation-reference`, { token: director.token, body: { expectedCourseName: 'Fundamentos de Redes Andinas' } });
  await req('PATCH', `/activities/${A.id}`, { token: director.token, body: { status: 'finished' } });
  // Una histórica ya enviada, para ver sus fases.
  const historica = await req('POST', '/certificates/external', {
    token: est.token, body: { certificateName: `Robotica educativa ${L}`, issuer: 'Club Andino', certificateUrl: `https://club.example.org/c/${L}` },
  });

  const { ctx: ce, page: pe, errores: ee } = await entrar(browser, est.email);
  await pe.goto(`${WEB}/student/evidences`);
  await pe.locator('#cert-origen').waitFor({ timeout: 30000 });
  await pe.locator('#cert-origen').selectOption(A.id);
  const datos = pe.locator('[data-testid="datos-oportunidad"]');
  await datos.waitFor({ timeout: 10000 }).catch(() => {});
  const texto = (await datos.textContent().catch(() => '')) ?? '';
  const camposLibres = await pe.locator('#cert-nombre').count();
  const plegada = await pe.locator('details', { hasText: 'Si tu certificado incluye enlace o código de verificación' }).evaluate((d) => !d.open).catch(() => false);
  check(texto.includes('Fundamentos de Redes Andinas') && texto.includes(PROVEEDOR) && texto.includes(area.name) && camposLibres === 0 && plegada,
    'W7.3.1 C03 Al elegir la oportunidad, nombre, emisor y áreas se muestran en solo lectura; enlace y código van plegados', json({ texto: texto.slice(0, 120), camposLibres, plegada }));

  await pe.getByRole('button', { name: 'Enviar a revisión' }).click();
  const faltaArchivo = await pe.locator('[data-testid="falta-archivo"]').waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
  const creadas = psql(`select count(*) from external_certificates c join student_profiles p on p.id = c.student_profile_id where p.id = '${est.profileId}' and c.activity_id = '${A.id}'`);
  check(faltaArchivo && creadas === '0', 'W7.3.2 C06 Sin archivo, el error aparece en el campo y no se envía nada', json({ faltaArchivo, creadas }));

  const fila = pe.locator('tr, .card, li', { hasText: `Robotica educativa ${L}` }).last();
  await fila.locator('[data-testid="estado-revision"]').waitFor({ timeout: 15000 }).catch(() => {});
  const revision = (await fila.locator('[data-testid="estado-revision"]').textContent().catch(() => '')) ?? '';
  await fila.locator('[data-testid="fases-credencial"] summary').click().catch(() => {});
  const fases = (await fila.locator('[data-testid="fases-credencial"]').textContent().catch(() => '')) ?? '';
  check(historica.status === 201 && /Pendiente de revisión de Dirección/.test(revision) && /No aplica comparación automática/.test(fases) && !/verificad/i.test(fases),
    'W7.3.3 C01 §5.4 La histórica muestra arriba la revisión pendiente y, desplegadas, sus fases «no aplica» (sin checks ficticios)', json({ revision, fases: fases.slice(0, 160) }));
  check(ee.length === 0, 'W7.3.4 Sin errores de JavaScript en «Mis credenciales»', ee.join(' | '));
  await ce.close();

  // D03: solo Dirección ve la acción del modelo; con la oportunidad finalizada.
  const { ctx: cd, page: pd, errores: ed } = await entrar(browser, director.email);
  await pd.goto(`${WEB}/director/activities?status=finished`);
  await pd.getByRole('tab', { name: 'Externas' }).click({ timeout: 10000 }).catch(() => pd.getByText('Externas', { exact: true }).first().click().catch(() => {}));
  await grillaLista(pd);
  await pd.locator('.search-input input, input[type=search]').first().fill(A.title).catch(() => {});
  const boton = pd.getByRole('button', { name: `Certificado modelo de ${A.title}` });
  await boton.waitFor({ timeout: 20000 }).catch(() => {});
  const veBoton = await boton.count();
  if (veBoton) await boton.click();
  const vigente = (await pd.locator('[data-testid="modelo-vigente"]').textContent({ timeout: 10000 }).catch(() => '')) ?? '';
  const pideMotivo = await pd.locator('#modelo-motivo').count();
  check(veBoton === 1 && /sin modelo/.test(vigente) && pideMotivo === 1,
    'W7.3.5 C26 Dirección abre «Certificado modelo» de una oportunidad finalizada: ve el vigente y debe indicar un motivo', json({ veBoton, vigente, pideMotivo }));
  check(ed.length === 0, 'W7.3.6 Sin errores de JavaScript en la gestión de Dirección', ed.join(' | '));
  await cd.close();

  const { ctx: ct, page: pt } = await entrar(browser, docente.email);
  await pt.goto(`${WEB}/teacher/my-activities?status=finished`);
  await pt.getByRole('tab', { name: 'Externas' }).click({ timeout: 5000 }).catch(() => pt.getByText('Externas', { exact: true }).first().click({ timeout: 3000 }).catch(() => {}));
  await grillaLista(pt);
  await pt.locator('tbody tr', { hasText: A.title }).first().waitFor({ timeout: 20000 }).catch(() => {});
  const filaDocente = await pt.locator('tbody tr', { hasText: A.title }).count();
  const botonDocente = await pt.getByRole('button', { name: `Certificado modelo de ${A.title}` }).count();
  check(filaDocente >= 1 && botonDocente === 0, 'W7.3.7 C27 El docente responsable no tiene la acción del certificado modelo', json({ filaDocente, botonDocente }));
  await ct.close();
}

async function batch4(ctx, browser) {
  objective('BATCH V7-4 · Bandeja de Dirección: todas las presentadas, decide solo Dirección, observar y reenviar');
  const admin = ctx.admin;
  const director = await provisionAndActivate(admin, { firstName: 'Olga', lastName: `Webrevisora${L}`, email: correoStaff('b4dir'), role: 'CAREER_DIRECTOR' });
  const est = await provisionStudent(admin, { firstName: 'Andrea', lastName: `Webrevision${L}`, email: correoEst('b4est'), semester: 5 });
  await req('POST', '/profiles/me/onboarding/institutional-confirmation', { token: est.token, body: {} });
  const unaSkill = ((await req('GET', '/skills', { token: est.token })).data ?? []).find((s) => s.isActive !== false);
  await req('PUT', '/profiles/me/skill-interests', { token: est.token, body: { items: [{ skillId: unaSkill?.id, kind: 'interest' }] } });
  await req('PATCH', '/profiles/me', { token: est.token, body: { availability: 'open' } });
  await req('POST', '/profiles/me/onboarding/privacy', { token: est.token, body: { peerDiscoverable: true, publicProfileEnabled: false } });
  await req('POST', '/profiles/me/onboarding/complete', { token: est.token });
  const nombre = `Robotica web ${L}`;
  const cert = await req('POST', '/certificates/external', {
    token: est.token, body: { certificateName: nombre, issuer: 'Club Andino', certificateUrl: `https://club.example.org/c/${L}`, issueDate: '2025-05-02' },
  });
  if (cert.status !== 201) throw new Error(`No se pudo registrar la credencial (${cert.status}): ${json(cert.data)}`);

  // D01: Administración consulta en solo lectura.
  const { ctx: ca, page: pa, errores: ea } = await entrar(browser, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
  await pa.goto(`${WEB}/admin/credential-reviews`);
  const tarjetaA = pa.locator('.card', { hasText: nombre });
  await tarjetaA.waitFor({ timeout: 30000 }).catch(() => {});
  const nota = await pa.locator('[data-testid="revision-solo-lectura"]').count();
  const revisarAdmin = await tarjetaA.getByRole('button', { name: 'Revisar' }).count();
  check(nota === 1 && (await tarjetaA.count()) === 1 && revisarAdmin === 0,
    'W7.4.1 D01 C24 Administración ve la credencial en la bandeja, sin poder decidir (solo lectura)', json({ nota, tarjeta: await tarjetaA.count(), revisarAdmin }));
  check(ea.length === 0, 'W7.4.2 Sin errores de JavaScript en la bandeja de Administración', ea.join(' | '));
  await ca.close();

  // Dirección observa con motivo.
  const { ctx: cd, page: pd, errores: ed } = await entrar(browser, director.email);
  await pd.goto(`${WEB}/director/credential-reviews`);
  const tarjeta = pd.locator('.card', { hasText: nombre });
  await tarjeta.waitFor({ timeout: 30000 }).catch(() => {});
  const pendiente = (await tarjeta.locator('[data-testid="estado-revision-item"]').textContent().catch(() => '')) ?? '';
  await tarjeta.locator('summary', { hasText: 'Comprobaciones' }).click().catch(() => {});
  const fases = (await tarjeta.locator('.fases-credencial').textContent().catch(() => '')) ?? '';
  await tarjeta.getByRole('button', { name: 'Revisar' }).click();
  await tarjeta.locator('textarea').fill('Falta la página con el código: sube el diploma completo, por favor.');
  await tarjeta.getByRole('button', { name: 'Observar (pedir corrección)' }).click();
  await pd.waitForTimeout(800);
  const estadoApi = (await req('GET', `/validation/external_certificate/${cert.data.id}`, { token: est.token })).data;
  check(/Pendiente de revisión/.test(pendiente) && /No aplica comparación automática/.test(fases) && estadoApi?.validationStatus?.status === 'OBSERVED',
    'W7.4.3 §5.3 Dirección ve la pendiente con sus fases y la observa con su motivo', json({ pendiente, s: estadoApi?.validationStatus?.status }));
  await pd.getByRole('tab', { name: 'Observadas' }).click();
  const enObservadas = await pd.locator('.card', { hasText: nombre }).waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  check(enObservadas, 'W7.4.4 La observada pasa a la pestaña «Observadas»');
  check(ed.length === 0, 'W7.4.5 Sin errores de JavaScript en la bandeja de Dirección', ed.join(' | '));
  await cd.close();

  // El estudiante ve la observación arriba, con el motivo.
  const { ctx: ce, page: pe, errores: ee } = await entrar(browser, est.email);
  await pe.goto(`${WEB}/student/evidences`);
  const fila = pe.locator('tr, .card, li', { hasText: nombre }).last();
  await fila.locator('[data-testid="estado-revision"]').waitFor({ timeout: 20000 }).catch(() => {});
  const revision = (await fila.locator('[data-testid="estado-revision"]').textContent().catch(() => '')) ?? '';
  await fila.locator('[data-testid="fases-credencial"] summary').click().catch(() => {});
  const detalle = (await fila.locator('[data-testid="fases-credencial"]').textContent().catch(() => '')) ?? '';
  check(/observó/.test(revision) && /diploma completo/.test(detalle),
    'W7.4.6 C21 El estudiante ve arriba que fue observada y, en el detalle, qué corregir', json({ revision, detalle: detalle.slice(0, 160) }));
  check(ee.length === 0, 'W7.4.7 Sin errores de JavaScript en «Mis credenciales»', ee.join(' | '));
  await ce.close();
}

async function batch5(ctx, browser) {
  objective('BATCH V7-5 · Certificado institucional: pendiente explicado, «Entregado» y abrir lo recibido con la sesión');
  const admin = ctx.admin;
  const docente = await provisionAndActivate(admin, { firstName: 'Raul', lastName: `Webentrega${L}`, email: correoStaff('b5doc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: admin, body: { semesters: [1, 2, 3, 4, 5, 6, 7, 8] } });
  const director = await provisionAndActivate(admin, { firstName: 'Nora', lastName: `Webcertifica${L}`, email: correoStaff('b5dir'), role: 'CAREER_DIRECTOR' });
  const est = await provisionStudent(admin, { firstName: 'Ana', lastName: `Webdocumento${L}`, email: correoEst('b5est'), semester: 4 });
  await req('POST', '/profiles/me/onboarding/institutional-confirmation', { token: est.token, body: {} });
  const unaSkill = ((await req('GET', '/skills', { token: est.token })).data ?? []).find((s) => s.isActive !== false);
  await req('PUT', '/profiles/me/skill-interests', { token: est.token, body: { items: [{ skillId: unaSkill?.id, kind: 'interest' }] } });
  await req('PATCH', '/profiles/me', { token: est.token, body: { availability: 'open' } });
  await req('POST', '/profiles/me/onboarding/privacy', { token: est.token, body: { peerDiscoverable: true, publicProfileEnabled: false } });
  await req('POST', '/profiles/me/onboarding/complete', { token: est.token });
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
    await req('POST', `/activities/${r.data.id}/register`, { token: est.token, body: {} });
    await req('PATCH', `/activities/${r.data.id}/confirm-participation`, { token: docente.token, body: { studentProfileId: est.profileId, status: 'confirmed' } });
    await req('PATCH', `/activities/${r.data.id}`, { token: director.token, body: { status: 'finished' } });
    await req('POST', `/activities/${r.data.id}/attendance/close`, { token: docente.token });
    return r.data;
  };
  const G = await actividad('Webseminario general', 'general');
  const I = await actividad('Webcurso individual', 'individual');
  const archivo = (await subirArchivo(docente.token, pdfConTexto(['Certificado de Ana', `${L}`]), 'ana.pdf')).data?.id;
  await req('POST', `/constancies/internal/institution-certificates/${I.id}`, { token: docente.token, body: { profileIds: [est.profileId], storedFileId: archivo } });

  // El responsable: el general sin archivo dice qué falta; el individual entregado muestra «Entregado».
  const { ctx: cd, page: pd, errores: ed } = await entrar(browser, docente.email);
  await pd.goto(`${WEB}/teacher/my-activities?actividad=${G.id}`);
  const pendiente = await pd.locator('[data-testid="certificado-pendiente"]').textContent({ timeout: 20000 }).catch(() => '');
  check(/no se fabrica/.test(pendiente ?? ''), 'W7.5.1 I03 El certificado general sin archivo muestra qué falta (no se fabrica ningún documento)', pendiente ?? '');
  await pd.goto(`${WEB}/teacher/my-activities?actividad=${I.id}`);
  const panel = pd.locator('[data-testid="certificado-institucional"]');
  await panel.waitFor({ timeout: 20000 }).catch(() => {});
  const entregado = await panel.locator('[data-testid="entregado"]').count();
  const botonEntregar = await panel.getByRole('button', { name: 'Entregar certificado' }).count();
  check(entregado === 1 && botonEntregar === 0, 'W7.5.2 I05 Lo ya entregado muestra «Entregado» con su fecha, no el botón de entregar', json({ entregado, botonEntregar }));
  check(ed.length === 0, 'W7.5.3 Sin errores de JavaScript en la entrega del responsable', ed.join(' | '));
  await cd.close();

  // El estudiante abre su certificado con su sesión.
  const { ctx: ce, page: pe, errores: ee } = await entrar(browser, est.email);
  await pe.goto(`${WEB}/student/evidences?tab=constancias`);
  const ver = pe.getByRole('button', { name: 'Ver certificado' }).first();
  await ver.waitFor({ timeout: 20000 }).catch(() => {});
  const enlacesSueltos = await pe.locator('a', { hasText: 'Ver certificado' }).count();
  const respuesta = pe.waitForResponse((r) => r.url().includes('/files/'), { timeout: 15000 }).catch(() => null);
  const popup = pe.context().waitForEvent('page', { timeout: 8000 }).catch(() => null);
  await ver.click().catch(() => {});
  const r = await respuesta;
  await popup;
  check(r?.status() === 200 && /pdf/.test(r?.headers()['content-type'] ?? '') && enlacesSueltos === 0,
    'W7.5.4 I06 DOC-04 «Ver certificado» abre el PDF con la sesión del estudiante (ya no es un enlace suelto)', json({ s: r?.status(), t: r?.headers()['content-type'], enlacesSueltos }));
  check(ee.length === 0, 'W7.5.5 Sin errores de JavaScript en los certificados recibidos', ee.join(' | '));
  await ce.close();
}

async function batch6(ctx, browser) {
  objective('BATCH V7-6 · Sin «Registros verificables» ni «Verificar»; los enlaces viejos no muestran nada');
  const admin = ctx.admin;
  const director = await provisionAndActivate(admin, { firstName: 'Ivan', lastName: `Webretiro${L}`, email: correoStaff('b6dir'), role: 'CAREER_DIRECTOR' });

  const ctxPub = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pub = await ctxPub.newPage();
  await pub.goto(`${WEB}/`);
  await pub.waitForLoadState('networkidle').catch(() => {});
  const enLanding = await pub.locator('a[href="/verificar"], a', { hasText: /Verificar un registro/ }).count();
  const codigo = psql('select coalesce(min(public_code), \'AF-XXXX-XXXX\') from verifiable_credentials');
  await pub.goto(`${WEB}/verificar/${codigo}`);
  const aviso = await pub.locator('[data-testid="servicio-retirado"]').textContent({ timeout: 15000 }).catch(() => '');
  const cuerpo = await pub.locator('body').innerText().catch(() => '');
  check(enLanding === 0 && /ya no está disponible/.test(aviso ?? '') && !/vigente|revocad|Titular/i.test(cuerpo),
    'W7.6.1 V01 V02 La landing no enlaza «Verificar»; un enlace /verificar viejo muestra un aviso neutro, sin datos', json({ enLanding, aviso: (aviso ?? '').slice(0, 60) }));
  await ctxPub.close();

  const { ctx: cd, page: pd, errores: ed } = await entrar(browser, director.email);
  const menuDir = (await pd.locator('nav').allInnerTexts()).join(' ');
  await pd.goto(`${WEB}/director/credentials`);
  await pd.waitForLoadState('networkidle').catch(() => {});
  const paginaVieja = await pd.getByRole('heading', { name: /Registros verificables/ }).count();
  check(!/Registros verificables/.test(menuDir) && paginaVieja === 0,
    'W7.6.2 V01 Dirección no tiene «Registros verificables» en el menú ni por URL directa', json({ paginaVieja }));
  check(ed.length === 0, 'W7.6.3 Sin errores de JavaScript', ed.join(' | '));
  await cd.close();

  const { ctx: ca, page: pa } = await entrar(browser, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
  const menuAdmin = (await pa.locator('nav').allInnerTexts()).join(' ');
  check(!/Registros verificables/.test(menuAdmin), 'W7.6.4 V01 Administración no tiene «Registros verificables» en el menú');
  await ca.close();
}

async function batch7(ctx, browser) {
  objective('BATCH V7-7 · La lista para activar muestra la falta concreta; las evidencias no tienen «Abrir»');
  const admin = ctx.admin;
  const est = await provisionStudent(admin, { firstName: 'Paz', lastName: `Webproyecto${L}`, email: correoEst('b7est'), semester: 6 });
  await req('POST', '/profiles/me/onboarding/institutional-confirmation', { token: est.token, body: {} });
  const unaSkill = ((await req('GET', '/skills', { token: est.token })).data ?? []).find((s) => s.isActive !== false);
  await req('PUT', '/profiles/me/skill-interests', { token: est.token, body: { items: [{ skillId: unaSkill?.id, kind: 'interest' }] } });
  await req('PATCH', '/profiles/me', { token: est.token, body: { availability: 'open' } });
  await req('POST', '/profiles/me/onboarding/privacy', { token: est.token, body: { peerDiscoverable: true, publicProfileEnabled: false } });
  await req('POST', '/profiles/me/onboarding/complete', { token: est.token });
  const a1 = (await req('POST', '/academic-areas', { token: admin, body: { name: `Webproyarea ${L} Uno`, tags: [`wp1${L}`] } })).data;
  const a2 = (await req('POST', '/academic-areas', { token: admin, body: { name: `Webproyarea ${L} Dos`, tags: [`wp2${L}`] } })).data;
  const sk = (await req('POST', '/skills', { token: admin, body: { name: `Webproybase ${L}`, academicAreaId: a1.id } })).data;
  const titulo = `Webproyecto dos areas ${L}`;
  const p = await req('POST', '/projects', {
    token: est.token,
    body: { title: titulo, areaIds: [a1.id, a2.id], skillIds: [sk.id], repositoryUrl: `https://github.com/afinia-pruebas/lenguaje-x${L}--w${Date.now().toString(36)}`, status: 'draft' },
  });
  await req('POST', `/projects/${p.data?.id}/evidences`, {
    token: est.token, body: { evidenceType: 'link', externalUrl: `https://capturas.example.org/${L}.png`, description: 'Captura del funcionamiento.' },
  });

  const { ctx: ce, page: pe, errores: ee } = await entrar(browser, est.email);
  await pe.goto(`${WEB}/student/projects`);
  const tarjeta = pe.locator('.card', { hasText: titulo }).first();
  await tarjeta.waitFor({ timeout: 30000 }).catch(() => {});
  await tarjeta.locator('.readiness-list').waitFor({ timeout: 15000 }).catch(() => {});
  const fila = (await tarjeta.locator('.readiness-list li.falta', { hasText: 'Cada área con al menos una tecnología' }).textContent().catch(() => '')) ?? '';
  const abrir = await tarjeta.getByRole('link', { name: /Abrir/ }).count();
  const listadas = await tarjeta.locator('[data-testid="evidencia-proyecto"]').count();
  check(new RegExp(`Webproyarea ${L} Dos`).test(fila), 'W7.7.1 P01 PROY-01 La fila «Cada área con al menos una tecnología» aparece en rojo con el área que falta', fila.slice(0, 160));
  check(abrir === 0 && listadas === 1, 'W7.7.2 P11 PROY-07 Las evidencias del proyecto se listan sin el enlace «Abrir»', json({ abrir, listadas }));
  check(ee.length === 0, 'W7.7.3 Sin errores de JavaScript en Proyectos', ee.join(' | '));
  await ce.close();
}

const BATCHES = { batch1, batch2, batch3, batch4, batch5, batch6, batch7 };

async function main() {
  console.log(`${C.bold}Afinia V7.1 — verificación en el navegador (${WEB})${C.r}`);
  const browser = await navegador();
  const ctx = { admin: await loginAdmin() };
  const pedidos = process.argv.slice(2);
  try {
    for (const [nombre, paso] of Object.entries(BATCHES)) {
      if (pedidos.length && !pedidos.includes(nombre)) continue;
      try {
        await paso(ctx, browser);
      } catch (e) {
        failures.push(`${nombre}: ${e.message}`);
        console.log(`  ${C.bad}✗ ${nombre} se interrumpió: ${e.message}${C.r}`);
      }
    }
  } finally {
    await browser.close();
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
