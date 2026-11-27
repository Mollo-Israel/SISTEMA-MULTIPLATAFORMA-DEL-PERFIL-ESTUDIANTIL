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
import { codigoUniversitario, crearProyectoActivo, loginAdmin, provisionAndActivate, provisionStudent, repoDePrueba, req, ADMIN_CREDENTIALS, PWD, pdfConTexto, subirArchivo } from './lib/fixtures.mjs';

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

async function batch8(ctx, browser) {
  objective('BATCH V7-8 · Afinidad explicada en palabras, detalle técnico aparte e intereses sin «prioridad N»');
  const admin = ctx.admin;
  const est = await provisionStudent(admin, { firstName: 'Lia', lastName: `Webafinidad${L}`, email: correoEst('b8est'), semester: 5 });
  const area = (await req('POST', '/academic-areas', { token: admin, body: { name: `Webafarea ${L}`, tags: [`wa8${L}`] } })).data;
  await req('POST', '/profiles/me/onboarding/institutional-confirmation', { token: est.token, body: {} });
  const unaSkill = ((await req('GET', '/skills', { token: est.token })).data ?? []).find((s) => s.isActive !== false);
  await req('PUT', '/profiles/me/skill-interests', { token: est.token, body: { items: [{ skillId: unaSkill?.id, kind: 'interest' }] } });
  await req('PUT', '/profiles/me/interests', { token: est.token, body: { items: [{ academicAreaId: area.id, priority: 1 }] } });
  await req('PATCH', '/profiles/me', { token: est.token, body: { availability: 'open' } });
  await req('POST', '/profiles/me/onboarding/privacy', { token: est.token, body: { peerDiscoverable: true, publicProfileEnabled: false } });
  await req('POST', '/profiles/me/onboarding/complete', { token: est.token });

  // PERF-07: una actividad con tecnología y asistencia confirmada da un chip con su procedencia real.
  const director = await provisionAndActivate(admin, { firstName: 'Rosa', lastName: `Webafinidad${L}`, email: correoStaff('b8dir'), role: 'CAREER_DIRECTOR' });
  const skChip = (await req('POST', '/skills', { token: admin, body: { name: `Chiptec ${L}`, academicAreaId: area.id } })).data;
  const cats = (await req('GET', '/activity-categories?status=active', { token: admin })).data ?? [];
  const cat = cats.find((c) => c.appliesTo === 'academica') ?? cats.find((c) => !c.appliesTo);
  const act = (await req('POST', '/activities', {
    token: director.token,
    body: {
      title: `Practica de chips ${L}`, type: 'academica', categoryId: cat?.id, status: 'open', activityDate: en(48), endAt: en(50), modality: 'presencial',
      location: 'Aula 2', semesterScope: [5], areaIds: [area.id], skillIds: [skChip.id], outcomePolicy: 'participation_only',
    },
  })).data;
  const perfilId = (await req('GET', '/profiles/me', { token: est.token })).data?.id;
  await req('POST', `/activities/${act?.id}/register`, { token: est.token, body: {} });
  await req('PATCH', `/activities/${act?.id}/confirm-participation`, { token: director.token, body: { studentProfileId: perfilId, status: 'confirmed' } });

  const { ctx: ce, page: pe, errores: ee } = await entrar(browser, est.email);
  await pe.goto(`${WEB}/student/affinity`);
  await pe.getByRole('tab', { name: 'Cómo se calcula' }).or(pe.getByRole('button', { name: 'Cómo se calcula' })).first().click({ timeout: 20000 });
  const explicacion = pe.locator('[data-testid="como-se-calcula"]');
  await explicacion.waitFor({ timeout: 20000 }).catch(() => {});
  const texto = ((await explicacion.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ');
  const detalle = pe.locator('[data-testid="detalle-tecnico"]');
  const cerrado = await detalle.evaluate((d) => !d.open).catch(() => null);
  const antesDelDetalle = await pe.evaluate(() => {
    const a = document.querySelector('[data-testid="como-se-calcula"]');
    const b = document.querySelector('[data-testid="detalle-tecnico"]');
    return !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  check(/No mide cuánto sabes/.test(texto) && /10, la segunda 7, la tercera 5/.test(texto) && /no baja por no usar/i.test(texto) && /No significa dominio/.test(texto),
    'W7.8.1 PERF-05 «Cómo se calcula» explica en palabras qué suma, qué no, cuándo baja y qué significa el tope', texto.slice(0, 160));
  check(cerrado === true && antesDelDetalle, 'W7.8.2 PERF-05 Las ponderaciones técnicas quedan en «Detalle técnico», cerrado y después de la explicación', json({ cerrado, antesDelDetalle }));
  check(!/prioridad \d/i.test(texto), 'W7.8.3 La explicación no muestra prioridades numéricas');
  check(ee.length === 0, 'W7.8.4 Sin errores de JavaScript en Afinidad', ee.join(' | '));
  await pe.goto(`${WEB}/student/profile?tab=intereses`);
  const chipPerfil = pe.locator('[data-testid="tecnologia-respaldada"]', { hasText: `Chiptec ${L}` }).first();
  await chipPerfil.waitFor({ timeout: 20000 }).catch(() => {});
  const chipTxt = ((await chipPerfil.textContent().catch(() => '')) ?? '').trim();
  check(/relacionada con tu participación en una actividad/.test(chipTxt), 'W7.8.7 PERF-07 El chip de tecnología respaldada dice de dónde viene, en palabras', chipTxt);
  await ce.close();

  const docente = await provisionAndActivate(admin, { firstName: 'Tito', lastName: `Webafinidad${L}`, email: correoStaff('b8doc'), role: 'TEACHER' });
  // Un docente ve los estudiantes de los semestres que tiene asignados.
  await req('PUT', `/users/${docente.userId ?? docente.id}/semesters`, { token: admin, body: { semesters: [5] } });
  const { ctx: cd, page: pd, errores: ed } = await entrar(browser, docente.email);
  await pd.goto(`${WEB}/teacher?tab=estudiantes`);
  await pd.getByPlaceholder('Buscar por nombre, correo o semestre…').fill(`Webafinidad${L}`, { timeout: 20000 });
  await pd.locator('tr', { hasText: est.email }).getByRole('button', { name: 'Ver perfil' }).click({ timeout: 20000 });
  const chip = pd.locator('.badge, [class*="badge"]', { hasText: `Webafarea ${L}` }).first();
  await chip.waitFor({ timeout: 20000 }).catch(() => {});
  const chipTexto = ((await chip.textContent().catch(() => '')) ?? '').trim();
  check(/mucho/i.test(chipTexto) && !/prioridad/i.test(chipTexto), 'W7.8.5 PERF-08 El docente ve el interés del estudiante como «mucho», sin «prioridad 1»', chipTexto);
  check(ed.length === 0, 'W7.8.6 Sin errores de JavaScript en Estudiantes del docente', ed.join(' | '));
  await cd.close();
}

// ===========================================================================
//  BATCH V7-9 — Filtros «Publicado por» y «Responsable» en la web (§11)
// ===========================================================================
async function batch9(ctx, browser) {
  objective('BATCH V7-9 · Biblioteca por publicador y Proyectos de la carrera por responsable, en el navegador');
  const admin = ctx.admin;
  const area = (await req('POST', '/academic-areas', { token: admin, body: { name: `Webfiltro ${L}`, tags: [`wf9${L}`] } })).data;
  const onboarding = async (est) => {
    await req('POST', '/profiles/me/onboarding/institutional-confirmation', { token: est.token, body: {} });
    // La bienvenida pide al menos un interés.
    await req('PUT', '/profiles/me/interests', { token: est.token, body: { items: [{ academicAreaId: area.id, priority: 1 }] } });
    await req('PATCH', '/profiles/me', { token: est.token, body: { availability: 'open' } });
    await req('POST', '/profiles/me/onboarding/privacy', { token: est.token, body: { peerDiscoverable: true, publicProfileEnabled: false } });
    await req('POST', '/profiles/me/onboarding/complete', { token: est.token });
  };
  const pubA = await provisionAndActivate(admin, { firstName: 'Bárbara', lastName: `Webpub${L}`, email: correoStaff('b9pa'), role: 'CAREER_DIRECTOR' });
  const pubB = await provisionAndActivate(admin, { firstName: 'Otto', lastName: `Webotro${L}`, email: correoStaff('b9pb'), role: 'CAREER_DIRECTOR' });
  const recursos = [];
  for (const [token, k] of [[pubA.token, 'a1'], [pubA.token, 'a2'], [pubA.token, 'a3'], [pubB.token, 'b1']]) {
    recursos.push((await req('POST', '/learning-resources', {
      token, body: { title: `Webrecurso ${k} ${L}`, provider: 'Editorial', url: `https://example.org/w79-${TS}-${k}`, academicAreaId: area.id, resourceType: 'guide' },
    })).data);
  }
  const est = await provisionStudent(admin, { firstName: 'Rita', lastName: `Webfiltro${L}`, email: correoEst('b9est'), semester: 4 });
  await onboarding(est);
  await req('PUT', `/library/${recursos[0]?.id}/favorite`, { token: est.token });

  const { ctx: ce, page: pe, errores: ee } = await entrar(browser, est.email);
  await pe.goto(`${WEB}/student/library`);
  await pe.getByPlaceholder('Buscar por título, descripción o fuente…').fill(L, { timeout: 20000 });
  const tarjetas = pe.locator('article.resource-card');
  const contar = async (n) => {
    for (let i = 0; i < 40; i++) {
      if ((await tarjetas.count()) === n) return n;
      await pe.waitForTimeout(250);
    }
    return tarjetas.count();
  };
  const sinFiltro = await contar(4);
  const campo = pe.locator('[data-testid="filtro-publicador"] input');
  await campo.fill(`zzz${L}`);
  const nadie = await pe.getByText('Nadie con ese nombre.').waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  await campo.fill(`webpub${L}, barbara`);
  await pe.locator('[data-testid="filtro-publicador"]').getByRole('option').first().click({ timeout: 10000 });
  const filtradas = await contar(3);
  const publicados = await pe.locator('[data-testid="publicado-por"]').allTextContents();
  check(sinFiltro === 4 && filtradas === 3 && publicados.length === 3 && publicados.every((t) => t === `Publicado por Bárbara Webpub${L}`),
    'W7.9.1 B01 «Publicado por» se elige escribiendo el nombre sin tildes y con coma; filtra y cada tarjeta dice quién lo publicó',
    json({ sinFiltro, filtradas, publicados }));
  check(nadie, 'W7.9.2 B01 Sin coincidencias se dice «Nadie con ese nombre.» y no se lista a nadie');
  await pe.getByRole('tab', { name: 'Mis favoritos' }).click();
  const enFavoritos = await contar(1);
  await pe.getByRole('button', { name: 'Limpiar', exact: true }).click();
  await pe.waitForTimeout(600);
  const pestana = await pe.getByRole('tab', { name: 'Mis favoritos' }).getAttribute('aria-selected');
  const campoVacio = await campo.inputValue().catch(() => null);
  check(enFavoritos === 1 && pestana === 'true' && campoVacio === '',
    'W7.9.3 B01 Se combina con «Mis favoritos» y «Limpiar» quita el publicador sin cambiar de pestaña', json({ enFavoritos, pestana, campoVacio }));
  check(ee.length === 0, 'W7.9.4 Sin errores de JavaScript en Biblioteca', ee.join(' | '));
  await ce.close();

  // --- B02 · Proyectos de la carrera
  const [duena, otra, mira] = await Promise.all([
    ['b9due', 'Álvaro', `Webresp${L}`], ['b9otra', 'Iris', `Webajena${L}`], ['b9mira', 'Leo', `Webmira${L}`],
  ].map(([k, firstName, lastName]) => provisionStudent(admin, { firstName, lastName, email: correoEst(k), semester: 4 })));
  for (const [token, k] of [[duena.token, 'uno'], [duena.token, 'dos'], [otra.token, 'tres']]) {
    const p = await crearProyectoActivo(token, { title: `Webproyecto ${k} ${L}`, visibility: 'profile', repositoryUrl: repoDePrueba(`w79-${k}-${TS}`) });
    if (p.status !== 201) throw new Error(`No se pudo activar el proyecto ${k} (${p.status}): ${json(p.data)}`);
  }
  await onboarding(mira);
  const { ctx: cp, page: pp, errores: ep } = await entrar(browser, mira.email);
  await pp.goto(`${WEB}/proyectos`);
  await pp.getByPlaceholder('Buscar por título o descripción…').fill(L, { timeout: 20000 });
  const proyectos = pp.locator('[data-testid="proyectos-carrera"] article');
  const contarP = async (n) => {
    for (let i = 0; i < 40; i++) {
      if ((await proyectos.count()) === n) return n;
      await pp.waitForTimeout(250);
    }
    return proyectos.count();
  };
  const todos = await contarP(3);
  await pp.locator('[data-testid="filtro-responsable"] input').fill(`WEBRESP${L} alvaro`);
  await pp.locator('[data-testid="filtro-responsable"]').getByRole('option').first().click({ timeout: 10000 });
  const deElla = await contarP(2);
  const elegido = await pp.locator('[data-testid="filtro-responsable-elegido"]').textContent().catch(() => null);
  await pp.getByRole('button', { name: 'Limpiar', exact: true }).click();
  // «Limpiar» quita también la búsqueda: vuelve la primera página de toda la galería.
  await pp.locator('[data-testid="filtro-responsable"] input').waitFor({ timeout: 10000 }).catch(() => {});
  const busqueda = await pp.getByPlaceholder('Buscar por título o descripción…').inputValue();
  const despues = await contarP(6);
  check(todos === 3 && deElla === 2 && elegido === `Álvaro Webresp${L}` && busqueda === '' && despues > deElla
    && (await pp.locator('[data-testid="filtro-responsable-elegido"]').count()) === 0,
    'W7.9.5 B02 «Responsable» filtra los proyectos de quien los lleva y «Limpiar» restaura todos los filtros', json({ todos, deElla, elegido, busqueda, despues }));
  check(ep.length === 0, 'W7.9.6 Sin errores de JavaScript en Proyectos de la carrera', ep.join(' | '));
  await cp.close();
}

// ===========================================================================
//  BATCH V7-10 — Contactos por nombre, QR al perfil y equipos en vistas (§12)
// ===========================================================================
async function batch10(ctx, browser) {
  objective('BATCH V7-10 · Contactos por nombre y apellidos, solicitud desde el perfil del QR y equipos en cuatro vistas');
  const admin = ctx.admin;
  const area = (await req('POST', '/academic-areas', { token: admin, body: { name: `Webcontacto ${L}`, tags: [`wc0${L}`] } })).data;
  const listo = async (k, firstName, lastName) => {
    const e = await provisionStudent(admin, { firstName, lastName, email: correoEst(k), semester: 6 });
    await req('POST', '/profiles/me/onboarding/institutional-confirmation', { token: e.token, body: {} });
    await req('PUT', '/profiles/me/interests', { token: e.token, body: { items: [{ academicAreaId: area.id, priority: 1 }] } });
    await req('PATCH', '/profiles/me', { token: e.token, body: { availability: 'open' } });
    await req('POST', '/profiles/me/onboarding/privacy', { token: e.token, body: { peerDiscoverable: true, publicProfileEnabled: true } });
    await req('POST', '/profiles/me/onboarding/complete', { token: e.token });
    e.slug = (await req('GET', '/profiles/me/public-link', { token: e.token })).data?.slug;
    return e;
  };
  const yo = await listo('b10yo', 'Leo', `Webbusca${L}`);
  const ana = await listo('b10ana', 'Ána', `Quíspe${L}`);
  const eva = await listo('b10eva', 'Eva', `Webqr${L}`);
  const duena = await listo('b10due', 'Rosa', `Webequipo${L}`);
  for (let i = 1; i <= 11; i++) {
    await req('POST', '/team-needs', { token: duena.token, body: { purpose: `Webnecesidad ${String(i).padStart(2, '0')} ${L}`, maxMembers: 3, targetSemesters: [6] } });
  }

  const { ctx: c1, page, errores } = await entrar(browser, yo.email);
  await page.goto(`${WEB}/student/collaboration`);
  const caja = page.getByLabel('Nombre y apellidos');
  await caja.waitFor({ timeout: 30000 }).catch(() => {});
  const sinIdentificador = (await page.getByLabel('Identificador del perfil').count()) === 0
    && !/identificador/i.test((await page.locator('main').textContent().catch(() => '')) ?? '');
  await caja.fill(`quispe${L}, ana`);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  const resultados = page.locator('[data-testid="resultados-busqueda"]');
  await resultados.waitFor({ timeout: 10000 }).catch(() => {});
  const texto = ((await resultados.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ');
  await resultados.getByRole('button', { name: 'Solicitar contacto' }).first().click({ timeout: 10000 }).catch(() => {});
  const pendiente = await resultados.getByText('Solicitud pendiente').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  check(sinIdentificador && texto.includes(`Ána Quíspe${L}`) && !texto.includes('@') && pendiente,
    'W7.10.1 T01/T03 Sin formulario de identificador: «quispe, ana» encuentra a Ána Quíspe y se le solicita contacto',
    json({ sinIdentificador, texto: texto.slice(0, 120), pendiente }));

  // T03: el enlace y el QR de Mi perfil siguen intactos.
  await page.goto(`${WEB}/student/profile?tab=visibilidad`);
  await page.locator('.qr-lienzo svg').first().waitFor({ timeout: 15000 }).catch(() => {});
  const qr = await page.locator('.qr-lienzo svg').count();
  const enlace = ((await page.locator('code.enlace-publico').first().textContent().catch(() => '')) ?? '').includes(yo.slug);
  check(qr > 0 && enlace, 'W7.10.2 T03 Mi perfil → Visibilidad conserva el QR y el enlace compartible', json({ qr, enlace }));

  // El QR lleva al perfil: desde ahí se solicita, sin agregar a nadie.
  await page.goto(`${WEB}/p/${eva.slug}`);
  const accion = page.locator('[data-testid="solicitar-desde-perfil"]');
  await accion.waitFor({ timeout: 15000 }).catch(() => {});
  await accion.getByRole('button', { name: 'Solicitar contacto' }).click({ timeout: 10000 }).catch(() => {});
  const enviada = await accion.getByText('Solicitud enviada.', { exact: false }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  const sinContacto = ((await req('GET', '/contacts', { token: eva.token })).data ?? []).length === 0;
  const pedida = ((await req('GET', '/contacts/requests/received', { token: eva.token })).data ?? []).length === 1;
  await page.goto(`${WEB}/p/${yo.slug}`);
  await page.waitForLoadState('networkidle').catch(() => {});
  const enElPropio = await page.locator('[data-testid="solicitar-desde-perfil"]').count();
  check(enviada && sinContacto && pedida && enElPropio === 0,
    'W7.10.3 T04 Desde el perfil abierto por el enlace o QR se solicita contacto; no agrega solo y en el propio perfil no se ofrece',
    json({ enviada, sinContacto, pedida, enElPropio }));
  const anon = await browser.newContext();
  const pa = await anon.newPage();
  await pa.goto(`${WEB}/p/${eva.slug}`);
  await pa.waitForLoadState('networkidle').catch(() => {});
  const sinSesion = await pa.locator('[data-testid="solicitar-desde-perfil"]').count();
  const ve = ((await pa.locator('body').textContent().catch(() => '')) ?? '').includes(`Webqr${L}`);
  await anon.close();
  check(ve && sinSesion === 0, 'W7.10.4 Sin sesión el perfil compartible se ve, pero sin acciones autenticadas', json({ ve, sinSesion }));

  // T09: equipos en cuatro vistas, de a 10.
  await page.goto(`${WEB}/student/collaboration?tab=equipos`);
  await page.getByRole('tab', { name: /^Mis equipos/ }).waitFor({ timeout: 20000 }).catch(() => {});
  const pestanas = (await page.getByRole('tab').allTextContents()).map((t) => t.replace(/\s*\(\d+\)$/, ''));
  await page.getByRole('tab', { name: /^Todas las necesidades/ }).click({ timeout: 15000 });
  const totalVisibles = await page.locator('[data-testid="equipos-todas"] .necesidad').count();
  await page.getByRole('button', { name: /Siguiente/i }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
  const enSegunda = await page.locator('[data-testid="equipos-todas"] .necesidad').count();
  const nuestrasTotal = ((await req('GET', '/team-needs', { token: yo.token })).data ?? []).filter((n) => !n.isOwner).length;
  check(['Para ti', 'Todas las necesidades', 'Mis necesidades', 'Mis equipos'].every((t) => pestanas.includes(t))
    && totalVisibles === Math.min(10, nuestrasTotal) && enSegunda === Math.min(10, nuestrasTotal - 10) && nuestrasTotal >= 11,
    'W7.10.5 T09 Equipos: «Para ti / Todas / Mis necesidades / Mis equipos», 10 por página',
    json({ pestanas, totalVisibles, enSegunda, nuestrasTotal}));
  check(errores.length === 0, 'W7.10.6 Sin errores de JavaScript en Colaboración y en el perfil compartible', errores.join(' | '));
  await c1.close();
}

// ===========================================================================
//  BATCH V7-11 — Inicio de Administración: «Detalles», filtros y menú (§3)
// ===========================================================================
async function batch11(ctx, browser) {
  objective('BATCH V7-11 · Inicio de Administración: tarjetas con «Detalles», destinos filtrados, menú por subtítulos');
  const admin = ctx.admin;
  await cuentaPendiente(admin, { firstName: 'Ines', lastName: `Webinicio${L}`, k: 'b11pen' });

  const { ctx: c1, page, errores } = await entrar(browser, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
  await page.goto(`${WEB}/admin`);
  await page.locator('[data-testid="tarjeta-cuentas"]').waitFor({ timeout: 20000 });
  const tarjetas = await page.locator('[data-testid^="tarjeta-"]').count();
  const texto = ((await page.locator('.content').textContent()) ?? '').replace(/\s+/g, ' ');
  const detalles = await page.getByRole('button', { name: 'Detalles', exact: true }).count();
  const enlacesIr = await page.locator('.content a', { hasText: /^\s*Ir\s*$/ }).count();
  const rol = await page.locator('[data-testid="cuentas-por-rol"] tbody tr').count();
  // A01 y A03–A15 (14) más «Actividades en revisión» global; A02 es la tabla por rol.
  check(tarjetas === 15 && detalles === 15 && enlacesIr === 0 && rol === 5
    && !/Envío real \(SMTP\)|Simulado: los correos no salen/.test(texto) && !/\bCorreo\b/.test(texto),
  'W7.11.1 §3 El Inicio muestra las tarjetas con «Detalles» (no «Ir»), «Cuentas por rol» y ya no la tarjeta Correo',
  json({ tarjetas, detalles, enlacesIr, rol }));

  // H14: teclado, foco dentro, Escape y regreso al botón.
  const boton = page.locator('[data-testid="tarjeta-cuentas"] button', { hasText: 'Detalles' });
  await boton.focus();
  await page.keyboard.press('Enter');
  const dialogo = page.getByRole('dialog');
  await dialogo.waitFor({ timeout: 10000 });
  await page.locator('[data-testid="detalles-filas"], .detalles-vacio').first().waitFor({ timeout: 15000 }).catch(() => {});
  const focoDentro = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  const nFilas = await page.locator('[data-testid="detalles-filas"] li').count();
  const totalTexto = ((await page.locator('[data-testid="detalles-total"]').textContent()) ?? '').replace(/\s+/g, ' ');
  const sinAcciones = (await dialogo.getByRole('button', { name: /Aprobar|Reenviar|Dar de baja|Eliminar|Suspender/i }).count()) === 0;
  await page.keyboard.press('Escape');
  await dialogo.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  const cerrado = (await page.getByRole('dialog').count()) === 0;
  const focoVuelve = await page.evaluate(() => document.activeElement?.textContent?.trim() === 'Detalles'
    && !!document.activeElement?.closest('[data-testid="tarjeta-cuentas"]'));
  check(focoDentro && nFilas >= 1 && nFilas <= 10 && /más recientes de \d+|registro/.test(totalTexto) && sinAcciones && cerrado && focoVuelve,
    'W7.11.2 H14 «Detalles» se abre con el teclado, el foco queda dentro, no ofrece acciones; Escape cierra y el foco vuelve al botón',
    json({ focoDentro, nFilas, totalTexto, sinAcciones, cerrado, focoVuelve }));

  // H01/H02: «Ir a gestionar» lleva a Usuarios solo con las pendientes de activación.
  await boton.click();
  await page.getByTestId('detalles-ir').click();
  await page.waitForURL((u) => u.pathname === '/admin/users', { timeout: 15000 });
  await grillaLista(page);
  const filtro = await page.getByLabel('Estado de la cuenta').inputValue();
  const filasUsuarios = await filas(page);
  check(param(page, 'status') === 'pending_activation' && filtro === 'pending_activation' && filasUsuarios.length > 0
    && filasUsuarios.every((f) => /pendiente|sin activar/i.test(f)),
  'W7.11.3 H02 «Ir a cuentas sin activar» abre Usuarios filtrado solo a las pendientes de activación', json({ url: page.url(), filtro, n: filasUsuarios.length }));

  // H03: una celda de «Cuentas por rol» abre ese rol con su métrica y su destino filtrado.
  await page.goto(`${WEB}/admin`);
  await page.locator('[data-testid="cuentas-por-rol"]').waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: /^Docente: \d+ sin activar/ }).click();
  await page.getByRole('dialog').waitFor({ timeout: 10000 });
  const tituloRol = (await page.getByRole('dialog').locator('h2, h3').first().textContent()) ?? '';
  await page.getByTestId('detalles-ir').click();
  await page.waitForURL((u) => u.pathname === '/admin/users', { timeout: 15000 });
  await grillaLista(page);
  check(/Docente/.test(tituloRol) && /sin activar/i.test(tituloRol) && param(page, 'role') === 'TEACHER' && param(page, 'status') === 'pending_activation',
    'W7.11.4 H03 La fila Docente / Sin activar abre su detalle y lleva a Usuarios con el rol y el estado', json({ tituloRol, url: page.url() }));

  // Credenciales: vista elegida en el modal → la misma pestaña en la bandeja.
  await page.goto(`${WEB}/admin`);
  await page.locator('[data-testid="tarjeta-credenciales"] button', { hasText: 'Detalles' }).click();
  await page.getByRole('dialog').getByRole('tab', { name: 'Observadas' }).click();
  await page.getByTestId('detalles-ir').click();
  await page.waitForURL((u) => u.pathname === '/admin/credential-reviews', { timeout: 15000 });
  const pestana = await page.getByRole('tab', { selected: true }).first().textContent().catch(() => '');
  const soloLectura = await page.getByTestId('revision-solo-lectura').count();
  check(param(page, 'estado') === 'observadas' && /Observadas/.test(pestana ?? '') && soloLectura === 1,
    'W7.11.5 A11 «Observadas» lleva a la revisión de credenciales en esa pestaña, en solo lectura para Administración', json({ url: page.url(), pestana }));

  // §3.3: menú por subtítulos, sin «Registros verificables»; /admin/mail sigue por URL (H11).
  const secciones = (await page.locator('.nav-section').allTextContents()).map((t) => t.trim());
  const menu = ((await page.locator('nav').first().textContent()) ?? '');
  await page.goto(`${WEB}/admin/mail`);
  await page.waitForLoadState('networkidle').catch(() => {});
  const correo = ((await page.locator('.content').textContent().catch(() => '')) ?? '');
  check(['Identidad', 'Catálogos', 'Gestión', 'Seguimiento', 'Ayuda'].every((s) => secciones.map((x) => x.toLowerCase()).includes(s.toLowerCase()))
    && !/Registros verificables|Correo/.test(menu) && /correo/i.test(correo) && !/no encontrada|404/i.test(correo),
  'W7.11.6 §3.3/H11 Menú con Identidad, Catálogos, Gestión y Seguimiento, sin Registros verificables ni Correo; /admin/mail sigue por URL',
  json({ secciones }));

  // H13: si un detalle falla, se dice y se puede reintentar; una tarjeta con error no muestra un cero.
  await page.route('**/reports/admin/home/academicas/**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"INTERNAL_ERROR"}' }));
  await page.route('**/reports/admin/home', async (r) => {
    const res = await r.fetch();
    const cuerpo = await res.json();
    cuerpo.tarjetas.recursos = { error: 'No se pudo cargar este resumen.' };
    await r.fulfill({ response: res, json: cuerpo });
  });
  await page.goto(`${WEB}/admin`);
  await page.locator('[data-testid="tarjeta-recursos"]').waitFor({ timeout: 20000 });
  const recursos = ((await page.locator('[data-testid="tarjeta-recursos"]').textContent()) ?? '');
  const otraBien = await page.getByTestId('total-proyectos').count();
  await page.locator('[data-testid="tarjeta-academicas"] button', { hasText: 'Detalles' }).click();
  const alerta = page.getByRole('dialog').getByRole('alert');
  await alerta.waitFor({ timeout: 10000 }).catch(() => {});
  const conError = ((await alerta.textContent().catch(() => '')) ?? '');
  const ceroFalso = await page.getByRole('dialog').getByTestId('detalles-total').count();
  check(/No se pudo cargar/.test(recursos) && !(await page.getByTestId('total-recursos').count()) && otraBien === 1
    && /No se pudo cargar/.test(conError) && /Reintentar/.test(conError) && ceroFalso === 0,
  'W7.11.7 H13 Una tarjeta o un detalle que fallan lo dicen con «Reintentar», sin mostrar ceros; las demás tarjetas siguen',
  json({ recursos: recursos.slice(0, 80), otraBien, conError: conError.slice(0, 80), ceroFalso }));
  await page.keyboard.press('Escape');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  check(errores.length === 0, 'W7.11.8 Sin errores de JavaScript en el Inicio de Administración', errores.join(' | '));
  await c1.close();

  // H14: en el teléfono el modal entra en la pantalla y se cierra.
  const movil = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pm = await movil.newPage();
  await pm.goto(`${WEB}/login`);
  await pm.fill('input[type=email]', ADMIN_CREDENTIALS.email);
  await pm.fill('input[autocomplete=current-password]', ADMIN_CREDENTIALS.password);
  await pm.press('input[autocomplete=current-password]', 'Enter');
  await pm.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  await pm.getByRole('button', { name: 'Omitir' }).click({ timeout: 3000 }).catch(() => {});
  await pm.goto(`${WEB}/admin`);
  await pm.getByRole('button', { name: 'Omitir' }).click({ timeout: 3000 }).catch(() => {});
  await pm.locator('[data-testid="tarjeta-externas"] button', { hasText: 'Detalles' }).click({ timeout: 20000 });
  await pm.getByRole('dialog').waitFor({ timeout: 10000 });
  await pm.getByRole('dialog').getByRole('tab', { name: 'Cobertura' }).click();
  await pm.locator('[data-testid="detalles-filas"], .detalles-vacio').first().waitFor({ timeout: 15000 }).catch(() => {});
  const medidas = await pm.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')?.getBoundingClientRect();
    return { ancho: d?.width ?? 0, izq: d?.left ?? -1, der: d?.right ?? 9999, scroll: document.documentElement.scrollWidth, vista: window.innerWidth };
  });
  const irVisible = await pm.getByTestId('detalles-ir').isVisible();
  await pm.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).last().click();
  const cerradoMovil = (await pm.getByRole('dialog').count()) === 0;
  check(medidas.izq >= 0 && medidas.der <= medidas.vista && medidas.scroll <= medidas.vista && irVisible && cerradoMovil,
    'W7.11.9 H14 En el teléfono el detalle entra en la pantalla, sin desplazamiento lateral, y se cierra', json(medidas));
  await movil.close();
}

// ===========================================================================
//  BATCH V7-12 — Inicio de Dirección: «Detalles», destinos filtrados, sin permisos de Administración (§13)
// ===========================================================================
async function batch12(ctx, browser) {
  objective('BATCH V7-12 · Inicio de Dirección: tarjetas con «Detalles», destinos con filtro y alcance propio');
  const admin = ctx.admin;
  const director = await provisionAndActivate(admin, { firstName: 'Nadia', lastName: `Webdireccion${L}`, email: correoStaff('b12dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(admin, { firstName: 'Tomas', lastName: `Webdireccion${L}`, email: correoStaff('b12doc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: admin, body: { semesters: [1, 2, 3, 4, 5, 6, 7, 8] } });
  const cats = ((await req('GET', '/activity-categories?status=active', { token: admin })).data ?? []);
  const cat = cats.find((c) => c.appliesTo === 'academica') ?? cats.find((c) => !c.appliesTo);
  // Una propuesta académica en revisión y una actividad de Dirección con una asistencia confirmada.
  const propuesta = (await req('POST', '/activities', {
    token: docente.token,
    body: { type: 'academica', categoryId: cat?.id, title: `Propuesta web ${L}`, status: 'draft', activityDate: en(96), endAt: en(98), modality: 'presencial', location: 'Aula 4', semesterScope: [1, 2, 3, 4, 5, 6, 7, 8] },
  })).data;
  await req('POST', `/activities/${propuesta?.id}/submit`, { token: docente.token, body: {} });
  const propia = (await req('POST', '/activities', {
    token: director.token,
    body: { type: 'academica', categoryId: cat?.id, title: `Seminario web ${L}`, status: 'open', activityDate: en(48), endAt: en(50), modality: 'presencial', location: 'Aula 8', semesterScope: [1, 2, 3, 4, 5, 6, 7, 8], responsibleUserIds: [docente.userId] },
  })).data;
  const est = await provisionAndActivate(admin, { firstName: 'Pia', lastName: `Webdireccion${L}`, email: correoEst('b12est'), role: 'STUDENT', semester: 4 });
  const perfil = (await req('GET', '/profiles/me', { token: est.token })).data?.id;
  await req('POST', `/activities/${propia?.id}/register`, { token: est.token, body: {} });
  await req('PATCH', `/activities/${propia?.id}/confirm-participation`, { token: docente.token, body: { studentProfileId: perfil, status: 'confirmed' } });

  const { ctx: c1, page, errores } = await entrar(browser, director.email ?? correoStaff('b12dir'));
  await page.goto(`${WEB}/director`);
  await page.locator('[data-testid="tarjeta-aprobaciones"]').waitFor({ timeout: 20000 });
  const tarjetas = await page.locator('[data-testid^="tarjeta-"]').count();
  const detalles = await page.getByRole('button', { name: 'Detalles', exact: true }).count();
  const contenido = ((await page.locator('.content').textContent()) ?? '').replace(/\s+/g, ' ');
  const enlacesIr = await page.locator('.content a', { hasText: /^\s*Ir\s*$/ }).count();
  check(tarjetas === 10 && detalles === 10 && enlacesIr === 0 && !/Revisión manual excepcional/.test(contenido)
    && !/Cuentas sin activar|Padrón|Auditoría/.test(contenido),
  'W7.12.1 §13 El Inicio de Dirección muestra sus diez tarjetas con «Detalles» (no «Ir»), sin tarjetas de Administración',
  json({ tarjetas, detalles, enlacesIr }));

  // H14: teclado, foco dentro, sin acciones; Escape y regreso al botón.
  const boton = page.locator('[data-testid="tarjeta-aprobaciones"] button', { hasText: 'Detalles' });
  await boton.focus();
  await page.keyboard.press('Enter');
  const dialogo = page.getByRole('dialog');
  await dialogo.waitFor({ timeout: 10000 });
  await page.locator('[data-testid="detalles-filas"], .detalles-vacio').first().waitFor({ timeout: 15000 }).catch(() => {});
  const focoDentro = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  const textoModal = ((await dialogo.textContent()) ?? '').replace(/\s+/g, ' ');
  const sinAcciones = (await dialogo.getByRole('button', { name: /Aprobar|Observar|Rechazar|Revocar|Conceder/i }).count()) === 0;
  await page.keyboard.press('Escape');
  await dialogo.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  const focoVuelve = await page.evaluate(() => document.activeElement?.textContent?.trim() === 'Detalles'
    && !!document.activeElement?.closest('[data-testid="tarjeta-aprobaciones"]'));
  check(focoDentro && textoModal.includes(`Propuesta web ${L}`) && /Tomas/.test(textoModal) && sinAcciones && (await page.getByRole('dialog').count()) === 0 && focoVuelve,
    'W7.12.2 H12/H14 «Actividades por aprobar» se abre con el teclado, lista la propuesta con quién la propone, no decide nada; Escape devuelve el foco',
    json({ focoDentro, sinAcciones, focoVuelve }));

  // §13: «Ir a Aprobaciones» lleva con el tipo elegido.
  await boton.click();
  await page.getByRole('dialog').getByRole('tab', { name: 'Académicas' }).click();
  await page.getByTestId('detalles-ir').click();
  await page.waitForURL((u) => u.pathname === '/director/approvals', { timeout: 15000 });
  await page.getByText(`Propuesta web ${L}`).first().waitFor({ timeout: 15000 }).catch(() => {});
  const tipo = await page.getByLabel('Tipo').inputValue().catch(() => '');
  const titulos = (await page.locator('.card-title, .card h3').allTextContents()).map((t) => t.trim());
  check(param(page, 'tipo') === 'academica' && tipo === 'academica' && titulos.includes(`Propuesta web ${L}`),
    'W7.12.3 §13 «Ir a Aprobaciones» abre la bandeja filtrada por el tipo elegido en el modal', json({ url: page.url(), tipo }));

  // §13 / D01: credenciales, en su pestaña y con decisión (es Dirección, no solo lectura).
  await page.goto(`${WEB}/director`);
  const credTexto = ((await page.locator('[data-testid="tarjeta-credenciales"]').textContent()) ?? '');
  await page.locator('[data-testid="tarjeta-credenciales"] button', { hasText: 'Detalles' }).click();
  await page.getByRole('dialog').getByRole('tab', { name: 'Observadas' }).click();
  await page.getByTestId('detalles-ir').click();
  await page.waitForURL((u) => u.pathname === '/director/credential-reviews', { timeout: 15000 });
  const pestana = await page.getByRole('tab', { selected: true }).first().textContent().catch(() => '');
  check(param(page, 'estado') === 'observadas' && /Observadas/.test(pestana ?? '') && (await page.getByTestId('revision-solo-lectura').count()) === 0
    && /pendientes de decisión/.test(credTexto) && !/excepcional/i.test(credTexto),
  'W7.12.4 D01 «Credenciales en revisión» cuenta las pendientes y lleva a la pestaña elegida, donde Dirección decide',
  json({ url: page.url(), pestana }));

  // §13: una participación abre Participaciones con su actividad ya elegida.
  await page.goto(`${WEB}/director`);
  await page.locator('[data-testid="tarjeta-participaciones"] button', { hasText: 'Detalles' }).click();
  await page.locator('[data-testid="detalles-filas"]').waitFor({ timeout: 15000 });
  const filaPart = page.locator('.detalles-fila', { hasText: `Seminario web ${L}` }).first();
  await filaPart.getByRole('link', { name: /Ver la actividad/ }).click();
  await page.waitForURL((u) => u.pathname === '/director/constancies', { timeout: 15000 });
  await page.locator('#constancies-actividad').waitFor({ timeout: 15000 });
  await page.waitForFunction((id) => document.querySelector('#constancies-actividad')?.value === id, propia?.id, { timeout: 15000 }).catch(() => {});
  const elegida = await page.locator('#constancies-actividad').inputValue();
  await page.reload();
  await page.locator('#constancies-actividad').waitFor({ timeout: 15000 });
  await page.waitForFunction((id) => document.querySelector('#constancies-actividad')?.value === id, propia?.id, { timeout: 15000 }).catch(() => {});
  const trasRecargar = await page.locator('#constancies-actividad').inputValue();
  check(param(page, 'actividad') === propia?.id && elegida === propia?.id && trasRecargar === propia?.id,
    'W7.12.5 §13 Una participación abre Participaciones con su actividad ya elegida, y se conserva al recargar', json({ url: page.url(), elegida, trasRecargar }));

  // §13: Analítica, cada fila abre su pestaña.
  await page.goto(`${WEB}/director`);
  await page.locator('[data-testid="tarjeta-analitica"] button', { hasText: 'Detalles' }).click();
  await page.locator('[data-testid="detalles-filas"]').waitFor({ timeout: 15000 });
  const filasAna = await page.locator('[data-testid="detalles-filas"] li').count();
  const sinFecha = (await page.getByRole('dialog').getByText('Sin fecha').count()) === 0;
  await page.locator('.detalles-fila', { hasText: 'Afinidad' }).first().getByRole('link', { name: /Abrir esta pestaña/ }).click();
  await page.waitForURL((u) => u.pathname === '/director/analytics', { timeout: 15000 });
  const pestanaAna = await page.getByRole('tab', { selected: true }).first().textContent().catch(() => '');
  check(filasAna === 5 && sinFecha && param(page, 'tab') === 'afinidad' && /Afinidad/.test(pestanaAna ?? ''),
    'W7.12.6 §13 «Cómo va la carrera»: una fila por pestaña de Analítica, sin fechas inventadas, y cada una abre su pestaña', json({ filasAna, sinFecha, url: page.url() }));

  // H13: una tarjeta o un detalle que fallan lo dicen; las demás siguen.
  await page.route('**/reports/director/home/actividades/**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"INTERNAL_ERROR"}' }));
  await page.route('**/reports/director/home', async (r) => {
    const res = await r.fetch();
    const cuerpo = await res.json();
    cuerpo.tarjetas.recursos = { error: 'No se pudo cargar este resumen.' };
    await r.fulfill({ response: res, json: cuerpo });
  });
  await page.goto(`${WEB}/director`);
  await page.locator('[data-testid="tarjeta-recursos"]').waitFor({ timeout: 20000 });
  const recursos = ((await page.locator('[data-testid="tarjeta-recursos"]').textContent()) ?? '');
  const otraBien = await page.getByTestId('total-puntos').count();
  await page.locator('[data-testid="tarjeta-actividades"] button', { hasText: 'Detalles' }).click();
  const alerta = page.getByRole('dialog').getByRole('alert');
  await alerta.waitFor({ timeout: 10000 }).catch(() => {});
  const conError = ((await alerta.textContent().catch(() => '')) ?? '');
  check(/No se pudo cargar/.test(recursos) && !(await page.getByTestId('total-recursos').count()) && otraBien === 1
    && /Reintentar/.test(conError) && (await page.getByRole('dialog').getByTestId('detalles-total').count()) === 0,
  'W7.12.7 H13 Una tarjeta o un detalle de Dirección que fallan lo dicen con «Reintentar», sin ceros; las demás siguen',
  json({ recursos: recursos.slice(0, 80), otraBien, conError: conError.slice(0, 80) }));
  await page.keyboard.press('Escape');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  check(errores.length === 0, 'W7.12.8 Sin errores de JavaScript en el Inicio de Dirección', errores.join(' | '));
  await c1.close();

  // H12: Administración no abre el Inicio de Dirección por la URL.
  const { ctx: c2, page: pa } = await entrar(browser, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
  await pa.goto(`${WEB}/director`);
  await pa.waitForLoadState('networkidle').catch(() => {});
  const tarjetasAdmin = await pa.locator('[data-testid="tarjeta-aprobaciones"], [data-testid="tarjeta-autonomia"]').count();
  check(tarjetasAdmin === 0 && !new URL(pa.url()).pathname.startsWith('/director'),
    'W7.12.9 H12 Administración no entra al Inicio de Dirección: reutilizar el componente no le da sus tarjetas', json({ url: pa.url(), tarjetasAdmin }));
  await c2.close();

  // H14: en el teléfono el modal entra en la pantalla y se cierra.
  const movil = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pm = await movil.newPage();
  await pm.goto(`${WEB}/login`);
  await pm.fill('input[type=email]', correoStaff('b12dir'));
  await pm.fill('input[autocomplete=current-password]', PWD);
  await pm.press('input[autocomplete=current-password]', 'Enter');
  await pm.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  await pm.getByRole('button', { name: 'Omitir' }).click({ timeout: 3000 }).catch(() => {});
  await pm.goto(`${WEB}/director`);
  await pm.getByRole('button', { name: 'Omitir' }).click({ timeout: 3000 }).catch(() => {});
  await pm.locator('[data-testid="tarjeta-participaciones"] button', { hasText: 'Detalles' }).click({ timeout: 20000 });
  await pm.getByRole('dialog').waitFor({ timeout: 10000 });
  await pm.getByRole('dialog').getByRole('tab', { name: 'Asistencia' }).click();
  await pm.locator('[data-testid="detalles-filas"], .detalles-vacio').first().waitFor({ timeout: 15000 }).catch(() => {});
  const medidas = await pm.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')?.getBoundingClientRect();
    return { izq: d?.left ?? -1, der: d?.right ?? 9999, scroll: document.documentElement.scrollWidth, vista: window.innerWidth };
  });
  const irVisible = await pm.getByTestId('detalles-ir').isVisible();
  await pm.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).last().click();
  const cerradoMovil = (await pm.getByRole('dialog').count()) === 0;
  check(medidas.izq >= 0 && medidas.der <= medidas.vista && medidas.scroll <= medidas.vista && irVisible && cerradoMovil,
    'W7.12.10 H14 En el teléfono el detalle de Dirección entra en la pantalla, sin desplazamiento lateral, y se cierra', json(medidas));
  await movil.close();
}

const BATCHES = { batch1, batch2, batch3, batch4, batch5, batch6, batch7, batch8, batch9, batch10, batch11, batch12 };

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
