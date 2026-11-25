/**
 * Cierre V7.1 — lo que la persona ve en la web, con un navegador real.
 *
 * Complementa a `e2e-v7.mjs` (la API). Se ejecuta contra el entorno aislado:
 *
 *   node scripts/pruebas/entorno.mjs api   # :3020, base afinia_test
 *   node scripts/pruebas/entorno.mjs web   # compila contra :3020 y sirve en :5180
 *   API_URL=http://localhost:3020/api WEB_URL=http://localhost:5180 node scripts/e2e-v7-web.mjs [batch1 …]
 */
import { chromium } from 'playwright-core';
import { codigoUniversitario, loginAdmin, provisionAndActivate, req, ADMIN_CREDENTIALS, PWD } from './lib/fixtures.mjs';

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

const BATCHES = { batch1 };

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
