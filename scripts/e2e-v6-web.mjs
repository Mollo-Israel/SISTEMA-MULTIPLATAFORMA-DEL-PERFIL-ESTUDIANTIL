/**
 * Cierre V6 — lo que la persona ve en la web, con un navegador real.
 *
 * Complementa a `e2e-v6.mjs` (la API): aquí se comprueba que el formulario
 * no ofrece lo que el servidor rechaza. Necesita `web/dist`
 * (`npm --prefix web run build`) y la API en marcha.
 *
 * Uso:
 *   node scripts/e2e-v6-web.mjs [batch2 …]
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { ADMIN_CREDENTIALS, loginAdmin, provisionAndActivate, req, PWD } from './lib/fixtures.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
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
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const correoStaff = (k) => `v6w.${k}.${TS}@univalle.edu`;
const en = (h) => new Date(Date.now() + h * 3_600_000).toISOString();

let servidor = null;
async function servirWeb() {
  try { if ((await fetch(WEB)).ok) return; } catch { /* hay que servirla */ }
  if (!existsSync(join(RAIZ, 'web', 'dist', 'index.html'))) {
    throw new Error('Falta web/dist: ejecute `npm --prefix web run build`.');
  }
  servidor = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', '5173', '--strictPort'], {
    cwd: join(RAIZ, 'web'), stdio: 'ignore', shell: process.platform === 'win32',
  });
  for (let i = 0; i < 40; i++) {
    await espera(500);
    try { if ((await fetch(WEB)).ok) return; } catch { /* aún no */ }
  }
  throw new Error('No se pudo servir la web en 5173 (¿está ocupado el puerto?).');
}

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
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
  await page.getByRole('button', { name: 'Omitir' }).click({ timeout: 3000 }).catch(() => {});
  return { ctx, page, errores };
}

/** Chips pulsados y ofrecidos dentro del bloque de un responsable. */
async function chipsDe(page, userId) {
  const bloque = page.locator(`[data-testid="cobertura-${userId}"]`);
  const todos = (await bloque.locator('button.chip').allTextContents()).map((s) => s.trim());
  const on = (await bloque.locator('button.chip[aria-pressed="true"]').allTextContents()).map((s) => s.trim());
  return { todos: todos.join(','), on: on.join(',') };
}

// ===========================================================================
//  BATCH V6-2 — El formulario por responsable (§3.4)
// ===========================================================================
async function batch2(ctx, browser) {
  objective('BATCH V6-2 · Cada responsable con sus semestres; «Toda la carrera» explícita');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dora', lastName: `Web${L}`, email: correoStaff('dir'), role: 'CAREER_DIRECTOR' });
  const carlos = await provisionAndActivate(ctx.admin, { firstName: 'Carlos', lastName: `Web${L}`, email: correoStaff('carlos'), role: 'TEACHER' });
  const maria = await provisionAndActivate(ctx.admin, { firstName: 'Maria', lastName: `Web${L}`, email: correoStaff('maria'), role: 'TEACHER' });
  await req('PUT', `/users/${carlos.userId}/semesters`, { token: ctx.admin, body: { semesters: [1, 2, 3, 4] } });
  await req('PUT', `/users/${maria.userId}/semesters`, { token: ctx.admin, body: { semesters: [5, 6, 7, 8] } });
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const cat = cats.find((c) => c.appliesTo === 'academica') ?? cats[0];
  const titulo = `Ambos web ${L}`;
  const publicada = await req('POST', '/activities', {
    token: director.token,
    body: {
      title: titulo, type: 'academica', categoryId: cat.id, activityDate: en(72), endAt: en(74), status: 'open',
      semesterScope: [1, 2, 3, 4, 5, 6, 7, 8], responsibleUserIds: [carlos.userId, maria.userId],
    },
  });

  const { ctx: c1, page, errores } = await entrar(browser, director.email);
  await page.goto(`${WEB}/director/activities`);
  const editar = page.getByRole('button', { name: `Editar ${titulo}` });
  await editar.waitFor({ timeout: 45000 }).catch(() => {});
  await editar.click().catch(() => {});
  await page.locator(`[data-testid="cobertura-${maria.userId}"]`).waitFor({ timeout: 10000 }).catch(() => {});

  // ACT-01 / Caso B: editar recupera la cobertura real de cada uno.
  const cc = await chipsDe(page, carlos.userId);
  const cm = await chipsDe(page, maria.userId);
  check(cc.todos === '1º,2º,3º,4º' && cc.on === '1º,2º,3º,4º' && cm.todos === '5º,6º,7º,8º' && cm.on === '5º,6º,7º,8º',
    'V6W.2.1 Caso B Al editar, cada docente muestra solo sus semestres y su asignación guardada', JSON.stringify({ cc, cm }));
  const carrera = page.locator('[data-testid="audiencia-modo"] input[type=radio]').first();
  check(await carrera.isDisabled().catch(() => false),
    'V6W.2.2 §3.4 Con solo docentes, «Toda la carrera» no se puede marcar (no se finge cobertura)');
  const final = await page.locator('[data-testid="audiencia-final"]').textContent().catch(() => '');
  check(/1\.º, 2\.º, 3\.º, 4\.º, 5\.º, 6\.º, 7\.º, 8\.º/.test(final ?? ''), 'V6W.2.3 El público final es la suma de lo asignado (solo lectura)', final);

  // Caso C: quitar a María avisa qué queda sin responsable y no guarda en silencio.
  await page.getByRole('button', { name: `Quitar a Maria Web${L}` }).click();
  const aviso = page.getByText('Quedan sin responsable: 5.º, 6.º, 7.º, 8.º.');
  await aviso.waitFor({ timeout: 5000 }).catch(() => {});
  check(await aviso.count() > 0, 'V6W.2.4 ACT-02 Quitar a María avisa que 5.º–8.º quedan sin responsable');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.waitFor({ timeout: 5000 }).catch(() => {});
  const texto = await dialogo.textContent().catch(() => '');
  check(/deja de dirigirse/.test(texto ?? '') && /5\.º, 6\.º, 7\.º, 8\.º/.test(texto ?? ''),
    'V6W.2.5 Regla 5 En una publicada se pide confirmar antes de dejar fuera 5.º–8.º', texto?.slice(0, 160));
  await dialogo.getByRole('button', { name: /Cancelar/ }).click().catch(() => {});
  const guardada = (await req('GET', `/activities/${publicada.data?.id}`, { token: director.token })).data;
  check(JSON.stringify(guardada?.semesterScope) === '[1,2,3,4,5,6,7,8]' && (guardada?.responsibles ?? []).length === 2,
    'V6W.2.6 Cancelar no guarda nada', JSON.stringify(guardada?.semesterScope));

  // Guardar de verdad: Carlos deja de atender el 4.º; se confirma y el servidor lo guarda así.
  await page.goto(`${WEB}/director/activities`);
  await editar.waitFor({ timeout: 45000 }).catch(() => {});
  await editar.click().catch(() => {});
  const bloqueCarlos = page.locator(`[data-testid="cobertura-${carlos.userId}"]`);
  await bloqueCarlos.waitFor({ timeout: 10000 }).catch(() => {});
  await bloqueCarlos.locator('button.chip', { hasText: '4º' }).click();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar de todas formas' }).click({ timeout: 5000 }).catch(() => {});
  let tras = null;
  for (let i = 0; i < 20; i++) {
    tras = (await req('GET', `/activities/${publicada.data?.id}`, { token: director.token })).data;
    if (JSON.stringify(tras?.semesterScope) !== '[1,2,3,4,5,6,7,8]') break;
    await espera(500);
  }
  const asign = Object.fromEntries((tras?.responsibles ?? []).map((r) => [r.id, r.assignedSemesters]));
  check(JSON.stringify(tras?.semesterScope) === '[1,2,3,5,6,7,8]' && JSON.stringify(asign[carlos.userId]) === '[1,2,3]'
    && JSON.stringify(asign[maria.userId]) === '[5,6,7,8]',
  'V6W.2.6b Confirmado, se guarda lo que muestra el formulario: Carlos 1.º–3.º, María 5.º–8.º', JSON.stringify({ s: tras?.semesterScope, asign }));

  // Caso A / regla 4: en una nueva, Carlos solo ofrece 1..4; con Dirección vuelve «Toda la carrera».
  await page.goto(`${WEB}/director/activities`);
  await page.getByRole('button', { name: /Nueva actividad/ }).first().click({ timeout: 45000 });
  const buscar = page.locator('[data-campo="responsibleUserIds"] input[role=combobox]');
  await buscar.fill(`Web${L}`);
  await page.getByRole('option', { name: new RegExp(`Carlos Web${L}`) }).click({ timeout: 10000 });
  await page.locator(`[data-testid="cobertura-${carlos.userId}"]`).waitFor({ timeout: 5000 }).catch(() => {});
  const nueva = await chipsDe(page, carlos.userId);
  check(nueva.todos === '1º,2º,3º,4º' && nueva.on === '1º,2º,3º,4º',
    'V6W.2.7 Caso A Al elegir a Carlos se ofrecen solo 1.º–4.º (como Área → Tecnologías)', JSON.stringify(nueva));
  await buscar.fill(`Web${L}`);
  await page.getByRole('option', { name: new RegExp(`Dora Web${L}`) }).click({ timeout: 10000 });
  const habilitada = await page.locator('[data-testid="audiencia-modo"] input[type=radio]').first().isEnabled().catch(() => false);
  const dora = await page.locator(`[data-testid="cobertura-${director.userId}"]`).textContent().catch(() => '');
  check(habilitada && /atiende todo el público/.test(dora ?? ''),
    'V6W.2.8 Caso E Con Dirección se puede elegir «Toda la carrera» y Dirección atiende todo el público', dora);
  await page.locator('[data-testid="audiencia-modo"] input[type=radio]').nth(1).check();
  await page.locator('[data-testid="audiencia-semestres"] button.chip', { hasText: '2º' }).click();
  const conDos = await chipsDe(page, carlos.userId);
  check(conDos.todos === '2º', 'V6W.2.9 Con «Semestres específicos» = 2.º, Carlos solo puede atender el 2.º', JSON.stringify(conDos));
  check(errores.length === 0, 'V6W.2.10 Sin errores de JavaScript en la página', errores.join(' | '));
  await c1.close();
}

// ===========================================================================
//  BATCH V6-3 — «Ver detalles» para el responsable que no edita (§3.6)
// ===========================================================================
async function batch3(ctx, browser) {
  objective('BATCH V6-3 · El responsable de una actividad ajena la consulta sin editarla');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dora', lastName: `Det${L}`, email: correoStaff('b3dir'), role: 'CAREER_DIRECTOR' });
  const carlos = await provisionAndActivate(ctx.admin, { firstName: 'Carlos', lastName: `Det${L}`, email: correoStaff('b3carlos'), role: 'TEACHER' });
  await req('PUT', `/users/${carlos.userId}/semesters`, { token: ctx.admin, body: { semesters: [1, 2, 3, 4] } });
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const cat = cats.find((c) => c.appliesTo === 'academica') ?? cats[0];
  const titulo = `Ajena web ${L}`;
  await req('POST', '/activities', {
    token: director.token,
    body: {
      title: titulo, type: 'academica', categoryId: cat.id, activityDate: en(72), endAt: en(74), status: 'open',
      semesterScope: [1, 2, 3, 4, 5, 6, 7, 8], responsibleUserIds: [director.userId, carlos.userId], capacity: 30,
    },
  });
  const { ctx: c1, page, errores } = await entrar(browser, carlos.email);
  await page.goto(`${WEB}/teacher/my-activities`);
  const ver = page.getByRole('button', { name: `Ver detalles de ${titulo}` });
  await ver.waitFor({ timeout: 45000 }).catch(() => {});
  check(await ver.count() === 1 && await page.getByRole('button', { name: `Editar ${titulo}` }).count() === 0,
    'V6W.3.1 §3.6 En «Mis actividades» hay «Ver detalles» y no «Editar» en la actividad ajena');
  await ver.click().catch(() => {});
  const modal = page.locator('[data-testid="detalle-actividad"]');
  await modal.waitFor({ timeout: 8000 }).catch(() => {});
  await page.getByText('atiende 1.º, 2.º, 3.º, 4.º').waitFor({ timeout: 8000 }).catch(() => {});
  const texto = (await modal.textContent().catch(() => '')) ?? '';
  check(/Carlos Det\w+ \(tú\)/.test(texto) && /atiende 1\.º, 2\.º, 3\.º, 4\.º/.test(texto) && /30 lugares/.test(texto) && /Abierta/.test(texto) && /Presencial|Virtual|Híbrida/.test(texto),
    'V6W.3.2 El detalle dice su semestre asignado, cupo, admisión y modalidad', texto.slice(0, 200));
  check(await modal.locator('input, select, textarea').count() === 0, 'V6W.3.3 Es de solo lectura (sin campos editables)');
  await page.keyboard.press('Escape');
  await modal.waitFor({ state: 'detached', timeout: 4000 }).catch(() => {});
  check(await modal.count() === 0, 'V6W.3.4 Se cierra con Escape (modal accesible)');
  check(errores.length === 0, 'V6W.3.5 Sin errores de JavaScript en la página', errores.join(' | '));
  await c1.close();
}

/** Estudiante con la bienvenida completa, para que entre directo. */
async function estudianteListo(admin, k) {
  const est = await provisionAndActivate(admin, { firstName: 'Web', lastName: `${k}${L}`, email: `v6w.${k}.${TS}@est.univalle.edu`, role: 'STUDENT', semester: 3 });
  const t = est.token;
  await req('POST', '/profiles/me/onboarding/institutional-confirmation', { token: t, body: {} });
  const skills = ((await req('GET', '/skills', { token: t })).data ?? []).filter((s) => s.isActive !== false);
  await req('PUT', '/profiles/me/skill-interests', { token: t, body: { items: [{ skillId: skills[0].id, kind: 'interest' }] } });
  await req('PATCH', '/profiles/me', { token: t, body: { availability: 'open' } });
  await req('POST', '/profiles/me/onboarding/privacy', { token: t, body: { peerDiscoverable: true, publicProfileEnabled: false } });
  const fin = await req('POST', '/profiles/me/onboarding/complete', { token: t });
  if (fin.status >= 300) throw new Error(`No se completó la bienvenida: ${JSON.stringify(fin.data)}`);
  return est;
}

// ===========================================================================
//  BATCH V6-4 — Admisión y cupo en el formulario y en la tarjeta (§4.1, §4.3)
// ===========================================================================
async function batch4(ctx, browser) {
  objective('BATCH V6-4 · Externas con selector de admisión; la tarjeta dice la regla del cupo');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dora', lastName: `Cupo${L}`, email: correoStaff('b4dir'), role: 'CAREER_DIRECTOR' });
  const { ctx: c1, page, errores } = await entrar(browser, director.email);
  await page.goto(`${WEB}/director/activities?vista=externa`);
  await page.getByRole('button', { name: /Nueva oportunidad externa/ }).first().click({ timeout: 45000 });
  const admision = page.locator('#activity-manager-admision');
  await admision.waitFor({ timeout: 8000 }).catch(() => {});
  check(await admision.count() === 1, 'V6W.4.1 V6-ACT-03 El formulario de Externas tiene el selector de Admisión');
  const regla = async () => ((await page.locator('[data-testid="admision-regla"]').textContent().catch(() => '')) ?? '');
  check(/proveedor/.test(await regla()), 'V6W.4.2 En una externa se explica que la plaza la confirma el proveedor', await regla());

  await page.goto(`${WEB}/director/activities`);
  await page.getByRole('button', { name: /Nueva actividad/ }).first().click({ timeout: 45000 });
  await page.locator('#activity-manager-cupo').fill('20');
  check(/por orden de solicitud/.test(await regla()), 'V6W.4.3 Abierta con cupo: «por orden de solicitud hasta llenar el cupo»', await regla());
  await page.locator('#activity-manager-admision').selectOption('approval');
  check(/pendientes hasta que las admitas/.test(await regla()), 'V6W.4.4 Por aprobación: las solicitudes quedan pendientes', await regla());
  check(errores.length === 0, 'V6W.4.5 Sin errores de JavaScript en el formulario', errores.join(' | '));
  await c1.close();

  // La tarjeta del estudiante: plazas y regla de admisión, separadas.
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const cat = cats.find((c) => c.appliesTo === 'academica') ?? cats[0];
  const titulo = `Taller abierto web ${L}`;
  await req('POST', '/activities', {
    token: director.token,
    body: { title: titulo, type: 'academica', categoryId: cat.id, semesterScope: [3], activityDate: en(72), endAt: en(74), status: 'open', capacity: 20 },
  });
  const est = await estudianteListo(ctx.admin, 'cupo');
  const { ctx: c2, page: pe, errores: e2 } = await entrar(browser, est.email);
  await pe.goto(`${WEB}/student/activities?tab=todas`);
  await pe.getByPlaceholder('Buscar por título, descripción o lugar…').fill(titulo, { timeout: 45000 }).catch(() => {});
  const tarjeta = pe.locator('article', { hasText: titulo }).first();
  await tarjeta.waitFor({ timeout: 45000 }).catch(() => {});
  const plazas = (await tarjeta.locator('[data-testid="plazas"]').textContent().catch(() => '')) ?? '';
  check(/20 de 20 plazas libres/.test(plazas) && /Admisión abierta, por orden de solicitud/.test(plazas),
    'V6W.4.6 La tarjeta dice «20 de 20 plazas libres · Admisión abierta, por orden de solicitud»', plazas);
  check(e2.length === 0, 'V6W.4.7 Sin errores de JavaScript en la oferta del estudiante', e2.join(' | '));
  await c2.close();
}

// ===========================================================================
//  BATCH V6-5 — Cambios sin guardar (§4.4) y listados vigentes (§5.1, §5.2)
// ===========================================================================
async function batch5(ctx, browser) {
  objective('BATCH V6-5 · No se pierde lo escrito; los listados muestran lo vigente');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dora', lastName: `Guarda${L}`, email: correoStaff('b5dir'), role: 'CAREER_DIRECTOR' });
  const { ctx: c1, page, errores } = await entrar(browser, director.email);
  await page.goto(`${WEB}/director/activities`);
  const nueva = page.getByRole('button', { name: /Nueva actividad/ }).first();
  const dialogo = page.getByRole('dialog', { name: 'Tienes cambios sin guardar' });
  const otroEnlace = page.locator('a[href^="/director"]:not([href^="/director/activities"])').first();

  // Sin cambios: abrir y salir no pregunta.
  await nueva.click({ timeout: 45000 });
  await page.locator('#activity-manager-titulo, input[name="title"]').first().waitFor({ timeout: 8000 }).catch(() => {});
  const destino = await otroEnlace.getAttribute('href');
  await otroEnlace.click();
  await page.waitForURL((u) => u.pathname === destino, { timeout: 8000 }).catch(() => {});
  check(new URL(page.url()).pathname === destino && await dialogo.count() === 0,
    'V6W.5.1 §4.4 Abrir el formulario y salir sin cambios no pregunta nada', page.url());

  // Con cambios: el menú pregunta; «Continuar editando» conserva lo escrito.
  await page.goto(`${WEB}/director/activities`);
  await nueva.click({ timeout: 45000 });
  const titulo = page.getByLabel(/Título/).first();
  await titulo.fill(`Borrador sin guardar ${L}`);
  await otroEnlace.click();
  await dialogo.waitFor({ timeout: 5000 }).catch(() => {});
  const botones = (await dialogo.getByRole('button').allTextContents()).map((s) => s.trim());
  check(botones.includes('Continuar editando') && botones.includes('Descartar cambios y salir'),
    'V6W.5.2 Con cambios, el menú pregunta con el diálogo propio: «Continuar editando» / «Descartar cambios y salir»', botones.join(' | '));
  await dialogo.getByRole('button', { name: 'Continuar editando' }).click();
  check(new URL(page.url()).pathname === '/director/activities' && await titulo.inputValue() === `Borrador sin guardar ${L}`,
    'V6W.5.3 «Continuar editando» se queda en el formulario con lo escrito', page.url());

  // Cambiar de pestaña también pregunta, y descartar limpia y cambia.
  await page.getByRole('tab', { name: 'Externas' }).click();
  await dialogo.waitFor({ timeout: 5000 }).catch(() => {});
  check(await dialogo.count() === 1, 'V6W.5.4 Cambiar de pestaña con cambios pregunta');
  await dialogo.getByRole('button', { name: 'Descartar cambios y salir' }).click();
  await page.waitForURL((u) => u.search.includes('vista=externa'), { timeout: 5000 }).catch(() => {});
  check(page.url().includes('vista=externa'), 'V6W.5.5 «Descartar cambios y salir» cambia de pestaña', page.url());
  await page.getByRole('tab', { name: 'Académicas' }).click();
  await nueva.click({ timeout: 45000 });
  check(await page.getByLabel(/Título/).first().inputValue() === '', 'V6W.5.6 Tras descartar, el formulario vuelve vacío (no rehidrata lo descartado)');
  check(errores.length === 0, 'V6W.5.7 Sin errores de JavaScript', errores.join(' | '));
  await c1.close();

  // §5.1: áreas, categorías y usuarios vigentes por omisión.
  const area = await req('POST', '/academic-areas', { token: ctx.admin, body: { name: `Area de baja ${L}`, tags: [`baja${L}`] } });
  await req('PATCH', `/academic-areas/${area.data?.id}`, { token: ctx.admin, body: { isActive: false } });
  const codigo = `cat_baja_${L}`;
  const cat = await req('POST', '/activity-categories', { token: ctx.admin, body: { code: codigo, name: `Categoria de baja ${L}`, appliesTo: 'academica' } });
  await req('PATCH', `/activity-categories/${cat.data?.id}`, { token: ctx.admin, body: { isActive: false } });
  const suspendido = await provisionAndActivate(ctx.admin, { firstName: 'Susi', lastName: `Pendida${L}`, email: correoStaff('b5susp'), role: 'TEACHER' });
  await req('PATCH', `/users/${suspendido.userId}/status`, { token: ctx.admin, body: { status: 'suspended' } });

  const { ctx: c2, page: pa, errores: e2 } = await entrar(browser, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
  const filaVisible = async (texto) => (await pa.locator('tbody tr', { hasText: texto }).count()) > 0;
  const buscarEn = async (texto) => {
    await pa.locator('.search-input input, input[type=search]').first().fill(texto).catch(() => {});
    await espera(400);
  };
  await pa.goto(`${WEB}/admin/areas`);
  await pa.locator('tbody tr').first().waitFor({ timeout: 30000 }).catch(() => {});
  await buscarEn(`Area de baja ${L}`);
  const sinBaja = await filaVisible(`Area de baja ${L}`);
  await pa.getByLabel('Mostrar también las dadas de baja').first().check();
  await espera(300);
  check(area.status === 201 && !sinBaja && await filaVisible(`Area de baja ${L}`),
    'V6W.5.8 §5.1 Áreas: la dada de baja no aparece por omisión; «Mostrar también las dadas de baja» la trae', json5({ s: area.status, sinBaja }));

  await pa.goto(`${WEB}/admin/activity-categories`);
  await pa.locator('tbody tr').first().waitFor({ timeout: 30000 }).catch(() => {});
  await buscarEn(`Categoria de baja ${L}`);
  const catOculta = !(await filaVisible(`Categoria de baja ${L}`));
  await pa.getByLabel('Mostrar también las dadas de baja').first().check();
  await espera(300);
  check(cat.status === 201 && catOculta && await filaVisible(`Categoria de baja ${L}`),
    'V6W.5.9 Categorías: igual, vigentes por omisión', json5({ s: cat.status, catOculta }));

  await pa.goto(`${WEB}/admin/users`);
  await pa.locator('tbody tr').first().waitFor({ timeout: 45000 }).catch(() => {});
  // §5.2: «Apellidos por separar» solo si hay alguno (se mira sin búsqueda: cuenta lo listado).
  const usuarios = (await req('GET', '/users', { token: ctx.admin })).data ?? [];
  const pendientes = usuarios.filter((u) => u.surnamesPending).length;
  const boton = await pa.locator('[data-testid="apellidos-por-separar"]').count();
  check((pendientes > 0) === (boton === 1), `V6W.5.11 §5.2 «Apellidos por separar» se muestra solo si hay (hay ${pendientes})`, `botón=${boton}`);
  await buscarEn(`Pendida${L}`);
  await espera(1500);
  const susOculto = !(await filaVisible(`Pendida${L}`));
  await pa.getByLabel('Mostrar también las suspendidas').first().check();
  await espera(300);
  check(susOculto && await filaVisible(`Pendida${L}`), 'V6W.5.10 Usuarios: las suspendidas solo con «Mostrar también las suspendidas»', json5({ susOculto }));

  const sinPendientes = await pa.locator('[data-testid="apellidos-por-separar"]').count();
  check(sinPendientes === 0, 'V6W.5.11b Con una búsqueda sin apellidos por separar, el botón no aparece', `botón=${sinPendientes}`);
  check(e2.length === 0, 'V6W.5.12 Sin errores de JavaScript en los listados', e2.join(' | '));
  await c2.close();
}

const json5 = (x) => JSON.stringify(x);

const BATCHES = { batch2, batch3, batch4, batch5 };

async function main() {
  console.log(`${C.bold}Afinia V6 — la web con un navegador real${C.r}`);
  await servirWeb();
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
    servidor?.kill();
  }
  console.log(`\n${C.bold}${passed} comprobaciones correctas, ${failures.length} fallidas${C.r}`);
  if (failures.length) {
    for (const f of failures) console.log(`  ${C.bad}- ${f}${C.r}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  servidor?.kill();
  process.exit(1);
});
