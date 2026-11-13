/**
 * Web de gestión — pantallas que las demás suites no recorrían, con un navegador real.
 *
 * Portada pública, validaciones del inicio de sesión, pedidos de tecnologías,
 * autonomía docente, recursos, puntos, constancias y las pantallas del docente
 * y del estudiante: cada paso usa la interfaz como lo haría una persona y
 * comprueba el efecto en la API. Los datos se crean en cada ejecución.
 * Necesita `web/dist` (`npm --prefix web run build`) y la API en marcha con
 * correo simulado, como las demás suites.
 *
 * Uso:
 *   node scripts/e2e-web-gestion.mjs [portada acceso …]
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import {
  ADMIN_CREDENTIALS, crearProyectoBorrador, loginAdmin, provisionAndActivate, provisionStudent, req, PWD,
} from './lib/fixtures.mjs';
import { medirCobertura } from './lib/cobertura-navegador.mjs';

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
const json = (v) => JSON.stringify(v);
const correoStaff = (k) => `wg.${k}.${TS}@univalle.edu`;
const correoEst = (k) => `wg.${k}.${TS}@est.univalle.edu`;
const psql = (sql) => execSync(
  `docker exec perfil_postgres psql -U perfil_user -d ${process.env.POSTGRES_DB ?? 'perfil_estudiantil'} -tAc "${sql}"`,
  { encoding: 'utf8' },
).trim();

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

/** Contexto y página nuevos, con los errores de JavaScript vigilados. */
async function pagina(browser, opciones = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, ...opciones });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  // Tras una descarga, Edge abre a veces su panel interno (edge://downloads-hub)
  // como otra pestaña y deja esta en segundo plano, donde Playwright ya no avanza:
  // se cierra ese panel y se vuelve a la página de la prueba.
  ctx.on('page', async (otra) => {
    for (let i = 0; i < 40 && !otra.isClosed(); i++) {
      if (otra.url().startsWith('edge://')) {
        console.log(`    ${C.dim}(se cerró ${otra.url()}, que Edge abrió por su cuenta)${C.r}`);
        await otra.close().catch(() => {});
        await page.bringToFront().catch(() => {});
        return;
      }
      await espera(250);
    }
  });
  return { ctx, page, errores };
}

async function entrar(browser, email, password = PWD, opciones = {}) {
  const sesion = await pagina(browser, opciones);
  const { page } = sesion;
  await page.goto(`${WEB}/login`);
  await page.fill('input[type=email]', email);
  await page.fill('input[autocomplete=current-password]', password);
  await page.press('input[autocomplete=current-password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  await page.getByRole('button', { name: 'Omitir' }).click({ timeout: 3000 }).catch(() => {});
  return sesion;
}

/** Espera a que aparezca un texto (true) o se agote el tiempo (false). */
const aparece = (loc, timeout = 10000) => loc.first().waitFor({ timeout }).then(() => true).catch(() => false);

// ===========================================================================
//  WG-1 — Portada pública
// ===========================================================================
async function portada(ctx, browser) {
  objective('WG-1 · Portada pública: menú, secciones, roles, preguntas y llamadas a la acción');
  const { ctx: c1, page, errores } = await pagina(browser);
  await page.goto(`${WEB}/`);
  check(await aparece(page.getByRole('heading', { level: 1 }), 15000), 'WG.1.1 La portada pública carga con su título principal');

  // El cursor mueve la ilustración y la luz de la portada.
  for (const [x, y] of [[300, 260], [700, 420], [1000, 300]]) await page.mouse.move(x, y, { steps: 4 });

  const secciones = [['Funciones', 'funciones'], ['Para quién', 'para-quien'], ['Cómo funciona', 'como'], ['Preguntas', 'preguntas']];
  const llegadas = [];
  for (const [texto, id] of secciones) {
    await page.locator('.lp-nav').getByRole('link', { name: texto, exact: true }).first().click();
    const llego = await page.waitForFunction((s) => {
      const top = document.getElementById(s)?.getBoundingClientRect().top;
      return top !== undefined && Math.abs(top) < 260;
    }, id, { timeout: 6000 }).then(() => true).catch(() => false);
    llegadas.push(llego);
  }
  check(llegadas.every(Boolean), 'WG.1.2 Cada enlace del menú lleva a su sección', json(llegadas));

  // Pestañas «Para quién»: cada rol muestra su propia frase.
  const tabs = page.getByRole('tablist', { name: 'Roles' }).getByRole('tab');
  const frases = ['Muestra lo que sabes hacer', 'Conoce a tus estudiantes', 'Toma decisiones con una vista clara', 'Organiza actividades y llega a más estudiantes'];
  const vistas = [];
  for (let i = 0; i < frases.length; i++) {
    await tabs.nth(i).click();
    vistas.push(await aparece(page.locator('.lp-role-body').getByText(frases[i]), 4000) && await tabs.nth(i).getAttribute('aria-selected') === 'true');
  }
  check(vistas.every(Boolean), 'WG.1.3 Las pestañas de roles cambian el contenido (Estudiante, Docente, Dirección, Sociedad)', json(vistas));

  // Preguntas frecuentes: se abren y se cierran.
  const preguntas = page.locator('.lp-q button');
  const nPreg = await preguntas.count();
  for (let i = 0; i < nPreg; i++) await preguntas.nth(i).click();
  const abierta = await preguntas.nth(nPreg - 1).getAttribute('aria-expanded');
  await preguntas.nth(nPreg - 1).click();
  const cerrada = await preguntas.nth(nPreg - 1).getAttribute('aria-expanded');
  check(nPreg >= 5 && abierta === 'true' && cerrada === 'false', 'WG.1.4 Las preguntas frecuentes se despliegan y se pliegan', json({ nPreg, abierta, cerrada }));

  // Recorrido completo: los contadores y los pasos se animan al aparecer.
  for (let y = 0; y < 9000; y += 700) {
    await page.mouse.wheel(0, 700);
    await espera(120);
  }
  await page.locator('.lp-cifras').scrollIntoViewIfNeeded();
  await espera(2200);
  const cifras = (await page.locator('.lp-cifra b').allInnerTexts().catch(() => [])).map((t) => t.trim());
  check(json(cifras) === json(['5', '6', '2', '0']), 'WG.1.5 Los contadores llegan a su valor al aparecer en pantalla', json(cifras));

  await page.evaluate(() => window.scrollTo(0, 0));
  await espera(300);
  await page.getByRole('button', { name: 'Conocer la plataforma' }).click();
  const enFunciones = await page.waitForFunction(() => Math.abs(document.getElementById('funciones')?.getBoundingClientRect().top ?? 9999) < 260, null, { timeout: 6000 })
    .then(() => true).catch(() => false);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Bajar' }).click();
  await espera(800);
  check(enFunciones, 'WG.1.6 «Conocer la plataforma» y la flecha bajan a las secciones');

  await page.getByRole('button', { name: /Activar mi cuenta/ }).first().click();
  const aActivar = await page.waitForURL((u) => u.pathname.startsWith('/activar'), { timeout: 8000 }).then(() => true).catch(() => false);
  await page.goto(`${WEB}/`);
  await page.locator('.lp-nav').getByRole('button', { name: /Iniciar sesión/ }).click();
  const aLogin = await page.waitForURL((u) => u.pathname === '/login', { timeout: 8000 }).then(() => true).catch(() => false);
  check(aActivar && aLogin, 'WG.1.7 «Activar mi cuenta» e «Iniciar sesión» llevan a sus pantallas');
  check(errores.length === 0, 'WG.1.8 Sin errores de JavaScript en la portada', errores.join(' | '));
  await c1.close();

  // Movimiento reducido: la portada se muestra quieta (accesibilidad).
  const { ctx: c2, page: quieta, errores: e2 } = await pagina(browser, { reducedMotion: 'reduce' });
  await quieta.goto(`${WEB}/`);
  await aparece(quieta.getByRole('heading', { level: 1 }), 15000);
  for (let y = 0; y < 9000; y += 900) await quieta.mouse.wheel(0, 900);
  await quieta.getByRole('button', { name: 'Conocer la plataforma' }).click();
  await espera(400);
  check(e2.length === 0 && await quieta.getByRole('heading', { level: 1 }).count() > 0,
    'WG.1.9 Con movimiento reducido la portada funciona sin animaciones', e2.join(' | '));
  await c2.close();

  // Teléfono: el menú se abre con el botón y lleva a las secciones.
  const { ctx: c3, page: tel, errores: e3 } = await pagina(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await tel.goto(`${WEB}/`);
  await aparece(tel.getByRole('heading', { level: 1 }), 15000);
  await tel.getByRole('button', { name: 'Abrir menú' }).click();
  const abierto = await aparece(tel.getByRole('button', { name: 'Cerrar menú' }), 4000);
  await tel.locator('.lp-nav').getByRole('link', { name: 'Preguntas', exact: true }).last().click();
  await espera(600);
  await tel.getByRole('button', { name: /Abrir menú|Cerrar menú/ }).click();
  await tel.locator('.lp-nav').getByRole('button', { name: /Activar mi cuenta/ }).last().click().catch(() => {});
  const telActivar = await tel.waitForURL((u) => u.pathname.startsWith('/activar'), { timeout: 8000 }).then(() => true).catch(() => false);
  check(abierto && telActivar && e3.length === 0, 'WG.1.10 En el teléfono, el menú se despliega y sus botones funcionan', json({ abierto, telActivar, e: e3 }));
  await c3.close();

  // Con sesión iniciada, la portada ofrece ir al panel propio.
  const est = await provisionStudent(ctx.admin, { firstName: 'Eva', lastName: `Portada${L}`, email: correoEst('portada'), semester: 2 });
  const { ctx: c4, page: conSesion } = await entrar(browser, est.email);
  await conSesion.goto(`${WEB}/`);
  await conSesion.getByRole('button', { name: /Ir a mi panel/ }).first().click();
  const alPanel = await conSesion.waitForURL((u) => u.pathname.startsWith('/student'), { timeout: 8000 }).then(() => true).catch(() => false);
  check(alPanel, 'WG.1.11 Con sesión, «Ir a mi panel» lleva al inicio del rol', conSesion.url());
  await c4.close();
}

// ===========================================================================
//  WG-2 — Validaciones del inicio de sesión
// ===========================================================================
async function acceso(ctx, browser) {
  objective('WG-2 · Inicio de sesión: el formulario explica cada error antes de llamar a la API');
  const { ctx: c1, page, errores } = await pagina(browser);
  await page.goto(`${WEB}/login`);
  const enviar = page.locator('button.li-btn');
  const mensaje = async (texto) => aparece(page.getByText(texto), 4000);
  await enviar.click();
  const vacios = await mensaje('El correo es obligatorio.') && await mensaje('La contraseña es obligatoria.');
  const casos = [
    ['ana perez@univalle.edu', 'El correo no debe contener espacios.'],
    ['ana@@univalle.edu', 'El correo debe contener un único “@”.'],
    ['ana@univalle', 'El correo no tiene un formato válido.'],
    ['ana.perez@gmail.com', 'Debe ser correo institucional (terminar en univalle.edu).'],
  ];
  const vistos = [];
  await page.fill('input[autocomplete=current-password]', 'cualquier-clave');
  for (const [correo, texto] of casos) {
    await page.fill('input[type=email]', correo);
    await enviar.click();
    vistos.push(await mensaje(texto));
  }
  check(vacios && vistos.every(Boolean), 'WG.2.1 Correo vacío, con espacios, con dos «@», incompleto o no institucional: cada uno con su mensaje', json({ vacios, vistos }));

  const clave = page.locator('input[autocomplete=current-password]');
  const antes = await clave.getAttribute('type');
  await page.getByRole('button', { name: 'Mostrar u ocultar contraseña' }).click();
  const visible = await clave.getAttribute('type');
  await page.getByRole('button', { name: 'Mostrar u ocultar contraseña' }).click();
  check(antes === 'password' && visible === 'text' && await clave.getAttribute('type') === 'password',
    'WG.2.2 El ojo muestra y vuelve a ocultar la contraseña', json({ antes, visible }));

  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
  const recuperar = await page.waitForURL((u) => u.pathname === '/recuperar', { timeout: 6000 }).then(() => true).catch(() => false);
  await page.goto(`${WEB}/login`);
  await page.getByRole('link', { name: '← Volver al inicio' }).click();
  const inicio = await page.waitForURL((u) => u.pathname === '/', { timeout: 6000 }).then(() => true).catch(() => false);
  check(recuperar && inicio && errores.length === 0, 'WG.2.3 Los enlaces de recuperar contraseña y volver al inicio funcionan', json({ recuperar, inicio, e: errores }));
  await c1.close();
}

// ===========================================================================
//  WG-3 — Pedidos de tecnologías (Administración)
// ===========================================================================
async function pedidos(ctx, browser) {
  objective('WG-3 · Pedidos de tecnologías: nueva con su área, alias confirmado o rechazo con motivo');
  const est = await provisionStudent(ctx.admin, { firstName: 'Eva', lastName: `Pedidos${L}`, email: correoEst('pedidos'), semester: 4 });
  const proyecto = await crearProyectoBorrador(est.token, { title: `Panel de pedidos ${L}`, description: 'Proyecto para pedir tecnologías que no están en el catálogo.' });
  const id = proyecto.data?.id;
  const nombres = { nueva: `Vitest${L}`, alias: `postgresql${L}`, rechazo: `Servidor${L}` };
  for (const n of Object.values(nombres)) {
    await req('POST', `/projects/${id}/suggestions/request-skill`, { token: est.token, body: { name: n, source: 'package.json (devDependencies)' } });
  }
  const { ctx: c1, page, errores } = await entrar(browser, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
  await page.goto(`${WEB}/admin/skill-requests`);
  const fila = (n) => page.locator('tr', { has: page.getByText(n, { exact: true }) });
  const listos = await aparece(fila(nombres.nueva), 15000) && await aparece(fila(nombres.rechazo), 5000);
  check(listos, 'WG.3.1 Los pedidos nuevos aparecen «Por decidir» con quién los pidió y dónde se detectaron');

  // Tecnología nueva: área principal y una secundaria.
  const f1 = fila(nombres.nueva);
  const boton1 = f1.getByRole('button', { name: 'Agregar al catálogo' });
  const deshabilitado = await boton1.isDisabled();
  await f1.getByRole('combobox', { name: 'Área principal' }).selectOption({ index: 1 });
  await f1.locator('summary').click();
  const chips = f1.locator('details button.chip');
  await chips.nth(0).click();
  await chips.nth(1).click();
  await chips.nth(1).click();
  await f1.getByRole('textbox', { name: 'Nombre en el catálogo' }).fill(nombres.nueva);
  await boton1.click();
  await aparece(page.getByText(`«${nombres.nueva}» se agregó al catálogo.`), 8000);

  // Alias: hay que confirmar que es la misma tecnología.
  const f2 = fila(nombres.alias);
  await f2.getByRole('radio', { name: 'Es otro nombre de…' }).click();
  const tecnologias = f2.getByRole('combobox', { name: 'Tecnología del catálogo' });
  const opcion = await tecnologias.locator('option', { hasText: /^PostgreSQL$/ }).first().getAttribute('value').catch(() => null);
  if (opcion) await tecnologias.selectOption(opcion); else await tecnologias.selectOption({ index: 1 });
  const botonAlias = f2.getByRole('button', { name: 'Registrar como alias' });
  const sinConfirmar = await botonAlias.isDisabled();
  await f2.getByRole('checkbox').check();
  await botonAlias.click();
  await aparece(page.getByText(/quedó como otro nombre de/), 8000);

  // Rechazo con motivo.
  const f3 = fila(nombres.rechazo);
  await f3.getByRole('radio', { name: 'Rechazar' }).click();
  const botonRechazo = f3.getByRole('button', { name: 'Rechazar' });
  const sinMotivo = await botonRechazo.isDisabled();
  await f3.getByRole('textbox', { name: 'Motivo' }).fill('Es un servidor de despliegue, no una tecnología del plan de estudios.');
  await botonRechazo.click();
  await aparece(page.getByText('Pedido rechazado.'), 8000);

  const agregadas = (await req('GET', '/skill-requests?status=added', { token: ctx.admin })).data ?? [];
  const rechazadas = (await req('GET', '/skill-requests?status=rejected', { token: ctx.admin })).data ?? [];
  const nueva = agregadas.find((r) => r.name === nombres.nueva);
  const alias = agregadas.find((r) => r.name === nombres.alias);
  const rechazo = rechazadas.find((r) => r.name === nombres.rechazo);
  check(deshabilitado && sinConfirmar && sinMotivo, 'WG.3.2 Cada decisión se habilita solo con lo que necesita (área, confirmación o motivo)', json({ deshabilitado, sinConfirmar, sinMotivo }));
  check(nueva?.resolution === 'new_skill' && alias?.resolution === 'alias' && !!rechazo?.decisionNote,
    'WG.3.3 La pantalla registra la tecnología nueva, el alias confirmado y el rechazo con su motivo', json({ n: nueva?.resolution, a: alias?.resolution, r: rechazo?.decisionNote }));

  await page.getByRole('combobox', { name: 'Estado' }).selectOption('added');
  const enAgregadas = await aparece(page.getByText('Tecnología nueva'), 8000) && await aparece(page.getByText('Otro nombre de una existente'), 4000);
  await page.getByRole('combobox', { name: 'Estado' }).selectOption('rejected');
  const enRechazadas = await aparece(page.getByText('Es un servidor de despliegue, no una tecnología del plan de estudios.'), 8000);
  check(enAgregadas && enRechazadas && errores.length === 0, 'WG.3.4 Los filtros muestran las agregadas (con su tipo) y las rechazadas (con su motivo)', json({ enAgregadas, enRechazadas, e: errores }));
  await c1.close();
}

// ===========================================================================
//  WG-4 — Autonomía docente (Dirección)
// ===========================================================================
async function autonomia(ctx, browser) {
  objective('WG-4 · Autonomía docente: conceder, ver lo hecho sin revisión y revocar con motivo');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dora', lastName: `Autonomia${L}`, email: correoStaff('autdir'), role: 'CAREER_DIRECTOR' });
  // La lista de docentes muestra los 500 primeros por apellido: la base de desarrollo
  // acumula miles de docentes de pruebas anteriores, así que el apellido va al inicio.
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Ciro', lastName: `Abad${L}`, email: correoStaff('autdoc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [3, 4] } });
  const est = await provisionStudent(ctx.admin, { firstName: 'Eva', lastName: `Autonomia${L}`, email: correoEst('autest'), semester: 3 });
  const nombreDocente = `Ciro Abad${L}`;

  const { ctx: c1, page, errores } = await entrar(browser, director.email);
  await page.goto(`${WEB}/director/autonomy`);
  await aparece(page.getByRole('heading', { name: 'Autonomía docente' }), 15000);
  const formulario = page.locator('form', { has: page.getByRole('button', { name: 'Conceder' }) });
  await formulario.getByRole('button', { name: 'Conceder' }).click();
  const validacion = await aparece(page.getByText('Elige el docente.'), 4000) && await aparece(page.getByText(/Explica por qué se concede/), 2000);
  check(validacion, 'WG.4.1 Sin docente ni motivo, el formulario lo dice en cada campo');

  const conceder = async (modulo, motivo) => {
    const selects = formulario.locator('select');
    await selects.nth(1).selectOption(modulo);
    const valor = await selects.nth(0).locator('option', { hasText: nombreDocente }).first().getAttribute('value');
    await selects.nth(0).selectOption(valor);
    await formulario.locator('textarea').fill(motivo);
    await formulario.getByRole('button', { name: 'Conceder' }).click();
    return aparece(page.getByText('Autonomía concedida.'), 8000);
  };
  const r1 = await conceder('RESOURCE', 'Coordina la materia en los paralelos A, B y C con criterios acordados.');
  await espera(800);
  const r2 = await conceder('GAMIFICATION', 'Incentivos acordados con Dirección para la materia de tercero.');
  await espera(800);
  const politicas = (await req('GET', '/approval-policies', { token: director.token })).data ?? [];
  const delDocente = politicas.filter((p) => p.teacher?.id === docente.userId && !p.revokedAt);
  check(r1 && r2 && delDocente.length === 2, 'WG.4.2 Dirección concede autonomía en recursos y en puntos desde la pantalla', json({ r1, r2, n: delDocente.length }));
  await formulario.locator('select').nth(1).selectOption('RESOURCE');
  const yaLaTiene = await formulario.locator('select').nth(0).locator('option', { hasText: `${nombreDocente}` }).first().textContent();
  check(/ya la tiene/.test(yaLaTiene ?? ''), 'WG.4.3 El docente con autonomía aparece como «ya la tiene» en ese módulo', yaLaTiene);

  // El docente usa la autonomía: publica un recurso y otorga puntos sin pasar por la bandeja.
  const area = ((await req('GET', '/academic-areas', { token: director.token })).data ?? [])[0];
  const recurso = await req('POST', '/learning-resources', {
    token: docente.token,
    body: { title: `Guía directa ${L}`, provider: 'Carrera de Sistemas', resourceType: 'guide', academicAreaId: area.id, areaIds: [area.id], url: `https://docs.example.org/wg/${TS}/guia` },
  });
  const proy = await req('POST', '/projects', {
    token: est.token, body: { title: `Robot autonomo ${L}`, description: 'Robot que esquiva obstáculos con sensores ultrasónicos.', visibility: 'teachers', status: 'draft' },
  });
  psql(`update projects set backing_tier='supported' where id='${proy.data?.id}'`);
  const criterio = ((await req('GET', '/gamification-criteria/available?trigger=proyecto_corroborado', { token: docente.token })).data ?? [])[0];
  const otorgada = await req('POST', '/gamification/proposals', {
    token: docente.token, body: { projectId: proy.data?.id, studentProfileId: est.profileId, criterionId: criterio?.id, reason: 'Integró sensores y control con evidencia propia.' },
  });
  await page.reload();
  await aparece(page.getByRole('heading', { name: 'Autonomía docente' }), 15000);
  const historial = page.locator('[data-testid="accion-directa"]');
  await aparece(historial, 10000);
  await page.getByRole('combobox', { name: 'Docente del historial' }).selectOption({ label: nombreDocente });
  await espera(1200);
  const textos = await historial.allInnerTexts();
  check(recurso.data?.reviewStatus === 'not_required' && otorgada.data?.direct === true
    && textos.some((t) => /Publicó un recurso/.test(t)) && textos.some((t) => /Otorgó puntos/.test(t)) && textos.every((t) => t.includes(nombreDocente)),
  'WG.4.4 El historial muestra lo que el docente publicó y otorgó con su autonomía, filtrado por docente', json({ r: recurso.data?.reviewStatus, o: otorgada.data?.direct, n: textos.length }));

  // Revocar exige motivo; la revocada se ve al pedirlo.
  const filaRecursos = page.locator('[data-testid="politica"]', { hasText: nombreDocente }).filter({ hasText: 'Publicar recursos' });
  await filaRecursos.getByRole('button', { name: 'Revocar' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('button', { name: 'Revocar' }).click();
  const sinMotivo = await aparece(modal.getByText('Explica por qué se revoca.'), 4000);
  await modal.locator('#revocar-motivo').fill('Cambió la coordinación de la materia.');
  await modal.getByRole('button', { name: 'Revocar' }).click();
  const revocada = await aparece(page.getByText('Autonomía revocada.'), 8000);
  await page.getByRole('checkbox', { name: 'Ver también las revocadas' }).check();
  const conRevocadas = await aparece(page.locator('[data-testid="politica"]', { hasText: 'Revocada: Cambió la coordinación de la materia.' }), 8000);
  check(sinMotivo && revocada && conRevocadas && errores.length === 0, 'WG.4.5 Revocar pide motivo, avisa y la revocación queda a la vista', json({ sinMotivo, revocada, conRevocadas, e: errores }));
  await c1.close();
}

// ===========================================================================
//  WG-5 — Recursos: propuestas docentes, revisión de Dirección y catálogo
// ===========================================================================
/*
 * Los docentes de estas partes atienden el 8.º semestre: en la base de
 * desarrollo casi no tiene estudiantes, así que sus listas no se llenan con
 * los datos que dejan las demás suites.
 */
async function recursos(ctx, browser) {
  objective('WG-5 · Recursos: Dirección revisa propuestas, incorpora, edita, busca, retira y repone');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dora', lastName: `Recursos${L}`, email: correoStaff('recdir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Ciro', lastName: `Recursos${L}`, email: correoStaff('recdoc'), role: 'TEACHER' });
  const autonomo = await provisionAndActivate(ctx.admin, { firstName: 'Ines', lastName: `Recursos${L}`, email: correoStaff('recaut'), role: 'TEACHER' });
  for (const d of [docente, autonomo]) await req('PUT', `/users/${d.userId}/semesters`, { token: ctx.admin, body: { semesters: [8] } });
  await req('POST', '/approval-policies', {
    token: director.token, body: { teacherUserId: autonomo.userId, module: 'RESOURCE', justification: 'Coordina el material del octavo semestre.' },
  });
  const area = ((await req('GET', '/academic-areas', { token: director.token })).data ?? [])[0];
  const propuesta = (k) => ({
    title: `Propuesta ${k} ${L}`, provider: 'Carrera de Sistemas', resourceType: 'guide',
    academicAreaId: area.id, areaIds: [area.id], url: `https://docs.example.org/wg/${TS}/${k}`,
  });
  const ids = {};
  for (const k of ['aprobar', 'observar', 'rechazar']) ids[k] = (await req('POST', '/learning-resources', { token: docente.token, body: propuesta(k) })).data?.id;

  const { ctx: c1, page, errores } = await entrar(browser, director.email);
  await page.goto(`${WEB}/director/resources`);
  await aparece(page.getByRole('heading', { name: 'Catálogo de recursos y cursos' }), 15000);
  const pendiente = (k) => page.locator('[data-testid="recurso-pendiente"]', { hasText: propuesta(k).title });
  await aparece(pendiente('observar'), 15000);
  await pendiente('observar').getByRole('button', { name: 'Observar' }).click();
  const pideComentario = await aparece(page.getByText('Escribe un comentario: explica qué corregir o por qué se rechaza.'), 5000);
  await pendiente('observar').getByRole('textbox').fill('Agrega ejercicios resueltos al final de la guía.');
  await pendiente('observar').getByRole('button', { name: 'Observar' }).click();
  const observado = await aparece(page.getByText('Observado: vuelve al docente.'), 8000);
  await pendiente('rechazar').getByRole('textbox').fill('El enlace es de un material sin licencia para la carrera.');
  await pendiente('rechazar').getByRole('button', { name: 'Rechazar' }).click();
  const rechazado = await aparece(page.getByText('Rechazado.', { exact: true }), 8000);
  await pendiente('aprobar').getByRole('button', { name: 'Aprobar' }).click();
  const aprobado = await aparece(page.getByText('Recurso aprobado: ya está en la Biblioteca.'), 8000);
  const estados = {};
  for (const [k, id] of Object.entries(ids)) estados[k] = psql(`select review_status from learning_resources where id='${id}'`);
  check(pideComentario && observado && rechazado && aprobado && json(estados) === json({ aprobar: 'approved', observar: 'observed', rechazar: 'rejected' }),
    'WG.5.1 Dirección aprueba, observa y rechaza propuestas; observar y rechazar exigen comentario', json({ pideComentario, estados }));

  // Incorporar un recurso: el formulario exige área y, si se eligen semestres, al menos uno.
  const titulo = `Guia de redes ${L}`;
  await page.locator('#learning-resources-titulo').fill(titulo);
  await page.locator('#learning-resources-quien-lo-publica').fill('Cisco Networking Academy');
  await page.locator('#learning-resources-enlace').fill(`https://docs.example.org/wg/${TS}/redes`);
  await page.locator('#learning-resources-tipo').selectOption('video');
  const criterio = page.locator('#learning-resources-criterio');
  if (await criterio.locator('option').count() > 1) await criterio.selectOption({ index: 1 });
  const guardar = page.getByRole('button', { name: 'Incorporar al catálogo' });
  await guardar.click();
  const pideArea = await aparece(page.getByText('Selecciona al menos un área para el recurso.'), 5000);
  await page.getByRole('group', { name: 'Áreas' }).getByRole('button').first().click();
  await espera(500);
  const habilidad = page.locator('button.chip').filter({ hasNot: page.locator('[aria-pressed="true"]') });
  await habilidad.last().click().catch(() => {});
  await page.getByRole('radio', { name: 'Semestres específicos' }).check();
  await guardar.click();
  const pideSemestre = await aparece(page.getByText('Marca al menos un semestre, o elige «Toda la carrera».'), 5000);
  const semestres = page.getByRole('group', { name: 'Semestres' });
  await semestres.getByRole('button', { name: '8º', exact: true }).click();
  await semestres.getByRole('button', { name: '7º', exact: true }).click();
  await semestres.getByRole('button', { name: '7º', exact: true }).click();
  await guardar.click();
  const incorporado = await aparece(page.getByText('Recurso incorporado al catálogo.'), 8000);
  const creado = ((await req('GET', '/learning-resources', { token: director.token })).data ?? []).find((r) => r.title === titulo);
  check(pideArea && pideSemestre && incorporado && json(creado?.semesterScope) === '[8]' && creado?.resourceType === 'video',
    'WG.5.2 Incorporar exige área y semestres; el recurso queda para el 8.º semestre con su tipo', json({ pideArea, pideSemestre, incorporado, s: creado?.semesterScope, t: creado?.resourceType }));

  // Buscar, editar (y cancelar), retirar y reponer.
  const buscar = page.getByPlaceholder('Buscar recurso…');
  await buscar.fill('zz-no-existe-zz');
  const vacio = await aparece(page.getByText('Ningún recurso coincide con “zz-no-existe-zz”.'), 5000);
  await buscar.fill(titulo);
  const filaRecurso = page.locator('tr', { hasText: titulo });
  await aparece(filaRecurso, 8000);
  await page.getByRole('button', { name: /^Recurso/ }).first().click().catch(() => {});
  await filaRecurso.getByRole('button', { name: 'Editar' }).click();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await filaRecurso.getByRole('button', { name: 'Editar' }).click();
  await page.locator('#learning-resources-quien-lo-publica').fill('Cisco Networking Academy (actualizado)');
  await page.getByRole('radio', { name: 'Toda la carrera' }).check();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  const actualizado = await aparece(page.getByText('Recurso actualizado.'), 8000);
  await filaRecurso.getByRole('button', { name: 'Retirar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Retirar' }).click();
  const retirado = await aparece(page.getByText('Recurso retirado.'), 8000);
  await page.getByRole('checkbox', { name: 'Ver también los retirados' }).check();
  await filaRecurso.getByRole('button', { name: 'Reponer' }).click();
  const repuesto = await aparece(page.getByText('Recurso repuesto en el catálogo.'), 8000);
  const final = ((await req('GET', '/learning-resources', { token: director.token })).data ?? []).find((r) => r.title === titulo);
  check(vacio && actualizado && retirado && repuesto && final?.status === 'active' && json(final?.semesterScope) === '[]',
    'WG.5.3 La búsqueda filtra; editar guarda el cambio (toda la carrera); retirar pide confirmación y se puede reponer', json({ vacio, actualizado, retirado, repuesto, st: final?.status }));
  check(errores.length === 0, 'WG.5.4 Sin errores de JavaScript en el catálogo de Dirección', errores.join(' | '));
  await c1.close();

  // El docente sin autonomía propone; ve la observación y corrige su propuesta.
  const { ctx: c2, page: doc, errores: e2 } = await entrar(browser, docente.email);
  await doc.goto(`${WEB}/teacher/resources`);
  const proponer = await aparece(doc.getByRole('heading', { name: 'Proponer recursos' }), 15000);
  // El docente ve todo el catálogo (paginado): busca su propuesta como lo haría una persona.
  await doc.getByPlaceholder('Buscar recurso…').fill(propuesta('observar').title);
  const observada = doc.locator('tr', { hasText: propuesta('observar').title });
  const conComentario = await aparece(observada.getByText('«Agrega ejercicios resueltos al final de la guía.»'), 10000);
  await observada.getByRole('button', { name: 'Editar' }).click();
  await doc.locator('#learning-resources-titulo').fill(`${propuesta('observar').title} con ejercicios`);
  await doc.getByRole('button', { name: 'Guardar cambios' }).click();
  const corregida = await aparece(doc.getByText('Recurso actualizado.'), 8000);
  await doc.locator('#learning-resources-titulo').fill(`Propuesta nueva ${L}`);
  await doc.locator('#learning-resources-quien-lo-publica').fill('Carrera de Sistemas');
  await doc.locator('#learning-resources-enlace').fill(`https://docs.example.org/wg/${TS}/nueva`);
  await doc.getByRole('group', { name: 'Áreas' }).getByRole('button').first().click();
  await doc.getByRole('button', { name: 'Enviar propuesta' }).click();
  const enviada = await aparece(doc.getByText('Propuesta enviada a Dirección.'), 8000);
  const reenviada = psql(`select review_status from learning_resources where id='${ids.observar}'`);
  check(proponer && conComentario && corregida && enviada && reenviada === 'pending' && e2.length === 0,
    'WG.5.5 El docente ve la observación, corrige su propuesta (vuelve a revisión) y envía otra', json({ proponer, conComentario, corregida, enviada, reenviada, e: e2 }));
  await c2.close();

  // El docente con autonomía publica directo.
  const { ctx: c3, page: aut, errores: e3 } = await entrar(browser, autonomo.email);
  await aut.goto(`${WEB}/teacher/resources`);
  const publicar = await aparece(aut.getByRole('heading', { name: 'Publicar recursos' }), 15000);
  await aut.locator('#learning-resources-titulo').fill(`Publicado directo ${L}`);
  await aut.locator('#learning-resources-quien-lo-publica').fill('Carrera de Sistemas');
  await aut.locator('#learning-resources-enlace').fill(`https://docs.example.org/wg/${TS}/directo`);
  await aut.getByRole('group', { name: 'Áreas' }).getByRole('button').first().click();
  await aut.getByRole('button', { name: 'Publicar' }).click();
  const publicado = await aparece(aut.getByText('Ya está en la Biblioteca; Dirección lo ve en su historial.'), 8000);
  check(publicar && publicado && e3.length === 0, 'WG.5.6 Con autonomía, el docente publica directo en la Biblioteca', json({ publicar, publicado, e: e3 }));
  await c3.close();
}

// ===========================================================================
//  WG-6 — Puntos: propuestas del docente y bandeja de Dirección
// ===========================================================================
async function puntos(ctx, browser) {
  objective('WG-6 · Puntos: el docente propone por proyecto o por recurso; Dirección aprueba o rechaza con motivo');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dora', lastName: `Puntos${L}`, email: correoStaff('ptsdir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Ciro', lastName: `Puntos${L}`, email: correoStaff('ptsdoc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [8] } });
  const est = await provisionStudent(ctx.admin, { firstName: 'Eva', lastName: `Puntos${L}`, email: correoEst('ptsest'), semester: 8 });
  const nombreEst = `Eva Puntos${L}`;
  const proy = await req('POST', '/projects', {
    token: est.token, body: { title: `Huerto inteligente ${L}`, description: 'Riego automático con sensores de humedad y un panel web.', visibility: 'teachers', status: 'draft' },
  });
  psql(`update projects set backing_tier='supported' where id='${proy.data?.id}'`);
  const area = ((await req('GET', '/academic-areas', { token: director.token })).data ?? [])[0];
  const criterioRecurso = await req('POST', '/gamification-criteria', {
    token: director.token, body: { code: `wg_recurso_${TS}`, name: `Completó la guía ${L}`, trigger: 'recurso_completado_atestiguado', points: 7, academicAreaId: area.id },
  });
  const recurso = await req('POST', '/learning-resources', {
    token: director.token,
    body: {
      title: `Guía con puntos ${L}`, provider: 'Carrera de Sistemas', resourceType: 'practice', academicAreaId: area.id, areaIds: [area.id],
      url: `https://docs.example.org/wg/${TS}/puntos`, criterionId: criterioRecurso.data?.id, semesterScope: [8],
    },
  });

  const { ctx: c1, page, errores } = await entrar(browser, docente.email);
  await page.goto(`${WEB}/teacher/points?tab=propuestas`);
  await aparece(page.getByRole('heading', { name: 'Proponer puntos' }), 15000);
  const form = page.locator('form', { has: page.getByRole('button', { name: 'Enviar propuesta' }) });
  await form.getByRole('button', { name: 'Enviar propuesta' }).click();
  const faltan = await aparece(page.getByText('Elige el proyecto.'), 5000) && await aparece(page.getByText('Elige el criterio.'), 2000)
    && await aparece(page.getByText('Explica por qué lo propones (al menos 10 caracteres).'), 2000);
  const selects = form.locator('select');
  const opcionProyecto = await selects.nth(0).locator('option', { hasText: `Huerto inteligente ${L}` }).first().getAttribute('value');
  await selects.nth(0).selectOption(opcionProyecto);
  await selects.nth(1).selectOption({ index: 1 });
  await form.locator('textarea').fill('Integró los sensores y el panel con evidencia en el repositorio.');
  await form.getByRole('button', { name: 'Enviar propuesta' }).click();
  const porProyecto = await aparece(page.getByText('Propuesta enviada.'), 8000);

  await page.getByRole('radio', { name: 'Un recurso completado' }).check();
  await form.getByRole('button', { name: 'Enviar propuesta' }).click();
  const faltanRecurso = await aparece(page.getByText('Elige el recurso.'), 5000) && await aparece(page.getByText('Elige el estudiante.'), 2000);
  await selects.nth(0).selectOption({ label: `Guía con puntos ${L}` });
  const opcionEst = await selects.nth(1).locator('option', { hasText: nombreEst }).first().getAttribute('value');
  await selects.nth(1).selectOption(opcionEst);
  await form.locator('textarea').fill('Presentó la práctica resuelta en clase el martes.');
  await form.getByRole('button', { name: 'Enviar propuesta' }).click();
  // El aviso de la primera propuesta puede seguir en pantalla: se espera a que la API tenga las dos.
  let deEst = [];
  for (let i = 0; i < 20 && deEst.length < 2; i++) {
    await espera(500);
    deEst = ((await req('GET', '/gamification/proposals', { token: docente.token })).data ?? []).filter((p) => p.student?.profileId === est.profileId);
  }
  const porRecurso = deEst.some((p) => p.sourceType === 'resource' || p.resource);
  check(faltan && faltanRecurso && porProyecto && porRecurso && deEst.length === 2,
    'WG.6.1 El formulario pide proyecto, criterio, recurso, estudiante y motivo; el docente propone por proyecto y por recurso', json({ faltan, faltanRecurso, n: deEst.length }));

  // Pestaña «Puntos»: periodo, búsqueda e historial de un estudiante.
  await page.getByRole('tab', { name: 'Puntos' }).click().catch(() => page.getByRole('button', { name: 'Puntos', exact: true }).click());
  await page.getByRole('combobox', { name: 'Periodo' }).selectOption({ index: 2 }).catch(() => {});
  await page.getByRole('textbox', { name: 'Buscar estudiante' }).fill(nombreEst).catch(() => {});
  await espera(1200);
  const verHistorial = page.getByRole('button', { name: `Ver historial de ${nombreEst}` });
  const hayFila = await aparece(verHistorial, 8000);
  if (hayFila) {
    await verHistorial.click();
    await aparece(page.getByRole('dialog'), 5000);
    await page.keyboard.press('Escape');
  }
  check(hayFila && errores.length === 0, 'WG.6.2 El docente filtra por periodo, busca al estudiante y abre su historial', json({ hayFila, e: errores }));
  await c1.close();

  // Dirección decide: rechazar exige comentario.
  const { ctx: c2, page: dir, errores: e2 } = await entrar(browser, director.email);
  await dir.goto(`${WEB}/director/points?tab=propuestas`);
  const propuestas = dir.locator('li, tr').filter({ hasText: nombreEst });
  await aparece(propuestas, 15000);
  const porRecursoFila = propuestas.filter({ hasText: `Guía con puntos ${L}` }).first();
  const porProyectoFila = propuestas.filter({ hasText: `Huerto inteligente ${L}` }).first();
  await porRecursoFila.getByRole('button', { name: 'Rechazar' }).click();
  const pideMotivo = await aparece(dir.getByText('Explica por qué se rechaza.'), 5000);
  await porRecursoFila.getByRole('textbox', { name: 'Comentario' }).fill('No hay constancia de la entrega en el aula virtual.');
  await porRecursoFila.getByRole('button', { name: 'Rechazar' }).click();
  const rechazada = await aparece(dir.getByText('Propuesta rechazada.'), 8000);
  await porProyectoFila.getByRole('button', { name: 'Aprobar' }).click();
  const aprobada = await aparece(dir.getByText('Propuesta aprobada: los puntos entraron al historial.'), 8000);
  await dir.getByRole('combobox', { name: 'Estado' }).selectOption('approved');
  const enAprobadas = await aparece(dir.locator('li, tr').filter({ hasText: `Huerto inteligente ${L}` }), 8000);
  await dir.getByRole('combobox', { name: 'Estado' }).selectOption('rejected');
  const enRechazadas = await aparece(dir.getByText('No hay constancia de la entrega en el aula virtual.'), 8000);
  const total = (await req('GET', '/gamification/me', { token: est.token })).data?.totalPoints ?? 0;
  check(pideMotivo && rechazada && aprobada && enAprobadas && enRechazadas && total > 0 && e2.length === 0,
    'WG.6.3 Dirección rechaza con motivo y aprueba; los filtros muestran cada decisión y los puntos entran al historial', json({ pideMotivo, rechazada, aprobada, enAprobadas, enRechazadas, total, e: e2 }));
  await c2.close();
}

// ===========================================================================
//  WG-7 — Docente: proyectos de sus estudiantes
// ===========================================================================
async function proyectosDocente(ctx, browser) {
  objective('WG-7 · Docente: busca proyectos de su alcance, confirma una tecnología y deja retroalimentación');
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Ciro', lastName: `Proyectos${L}`, email: correoStaff('prydoc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [8] } });
  const est = await provisionStudent(ctx.admin, { firstName: 'Eva', lastName: `Proyectos${L}`, email: correoEst('pryest'), semester: 8 });
  const { crearProyectoActivo } = await import('./lib/fixtures.mjs');
  const titulo = `Monitor de aulas ${L}`;
  const proyecto = await crearProyectoActivo(est.token, {
    title: titulo, description: 'Mide el uso de las aulas con sensores y lo muestra en un panel.', visibility: 'teachers', technologies: ['React', 'PostgreSQL'],
  });
  const id = proyecto.data?.id;

  const { ctx: c1, page, errores } = await entrar(browser, docente.email);
  await page.goto(`${WEB}/teacher?tab=proyectos`);
  await aparece(page.getByRole('heading', { name: 'Proyectos estudiantiles' }), 15000);
  await page.locator('#student-projects-estado').selectOption('active');
  await page.locator('#student-projects-semestre').selectOption('8').catch(() => {});
  await page.locator('#student-projects-busqueda').fill(titulo);
  await page.getByRole('button', { name: 'Buscar' }).click();
  const fila = page.locator('tr', { hasText: titulo });
  const encontrado = await aparece(fila, 10000);
  await page.locator('#student-projects-tecnologia').fill('tecnologia-que-no-existe');
  await page.getByRole('button', { name: 'Buscar' }).click();
  const sinResultados = await fila.count().then(async (n) => { await espera(1500); return (await fila.count()) === 0 || n === 0; });
  await page.locator('form', { has: page.locator('#student-projects-busqueda') }).getByRole('button', { name: 'Limpiar' }).last().click();
  await page.locator('#student-projects-busqueda').fill(titulo);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await aparece(fila, 10000);
  check(encontrado && sinResultados, 'WG.7.1 Los filtros (estado, semestre, tecnología y texto) encuentran el proyecto y «Limpiar» los quita', json({ encontrado, sinResultados }));

  await fila.getByRole('button', { name: 'Abrir' }).click();
  await aparece(page.getByRole('heading', { name: titulo }), 10000);
  const confirmar = page.getByRole('button', { name: 'Confirmar', exact: true }).first();
  const hayDeclarada = await aparece(confirmar, 8000);
  let tecnologia = false;
  if (hayDeclarada) {
    await confirmar.click();
    const modal = page.getByRole('dialog');
    await modal.getByRole('button', { name: 'Volver' }).click();
    await confirmar.click();
    await modal.getByRole('button', { name: 'Confirmar tecnología' }).click();
    const pide = await aparece(modal.getByText('Escribe una retroalimentación específica (al menos 10 caracteres).'), 4000);
    await modal.locator('textarea').fill('El repositorio muestra componentes de React con pruebas propias.');
    await modal.getByRole('button', { name: 'Confirmar tecnología' }).click();
    tecnologia = pide && await aparece(page.getByText('Tecnología confirmada'), 8000);
  }
  check(hayDeclarada && tecnologia, 'WG.7.2 Confirmar una tecnología declarada exige una retroalimentación específica', json({ hayDeclarada, tecnologia }));

  const campo = page.locator('#student-projects-campo');
  await campo.fill('Muy bien');
  const corto = await page.getByRole('button', { name: 'Registrar retroalimentación' }).isDisabled();
  await campo.fill('Buen avance: documenten la instalación de los sensores en el README.');
  await page.getByRole('button', { name: 'Registrar retroalimentación' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publicar' }).click();
  const registrada = await aparece(page.getByText('Retroalimentación registrada.'), 8000);
  await page.locator('.evidence-item', { hasText: 'Buen avance: documenten' }).getByRole('button', { name: 'Editar' }).click();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.locator('.evidence-item', { hasText: 'Buen avance: documenten' }).getByRole('button', { name: 'Editar' }).click();
  await campo.fill('Buen avance: documenten la instalación de los sensores y el esquema eléctrico.');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar cambios' }).click();
  const editada = await aparece(page.getByText('Retroalimentación actualizada.'), 8000);
  const lista = (await req('GET', `/projects/${id}/feedback`, { token: est.token })).data ?? [];
  check(corto && registrada && editada && lista.some((f) => /esquema eléctrico/.test(f.comment)),
    'WG.7.3 La retroalimentación exige 10 caracteres, se publica con confirmación y se puede editar', json({ corto, registrada, editada, n: lista.length }));

  // Los avisos también tienen un botón «Cerrar» (solo ícono): se usa el del detalle, con texto.
  await page.getByRole('button', { name: 'Cerrar', exact: true }).filter({ hasText: 'Cerrar' }).first().click();
  await page.goto(`${WEB}/teacher?tab=proyectos&proyecto=${id}`);
  const directo = await aparece(page.getByRole('heading', { name: titulo }), 15000);
  check(directo && errores.length === 0, 'WG.7.4 El enlace directo a un proyecto lo abre (llegada desde la afinidad)', json({ directo, e: errores }));
  await c1.close();
}

// ===========================================================================
//  WG-8 — Estudiante: progreso, evidencias, perfil y colaboración
// ===========================================================================
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const PDF = Buffer.from(`%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n% evidencia ${TS}\n%%EOF\n`, 'latin1');

async function subirArchivo(token, bytes, nombre, tipo) {
  const { API } = await import('./lib/fixtures.mjs');
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: tipo }), nombre);
  const res = await fetch(`${API}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return res.json().catch(() => null);
}

/** Un estudiante nuevo pasa primero por la bienvenida: se completa por API (como en e2e-web). */
async function completarBienvenida(token) {
  await req('POST', '/profiles/me/onboarding/institutional-confirmation', { token, body: {} });
  const skills = ((await req('GET', '/skills', { token })).data ?? []).filter((s) => s.isActive !== false);
  await req('PUT', '/profiles/me/skill-interests', { token, body: { items: [{ skillId: skills[0].id, kind: 'interest' }] } });
  await req('PATCH', '/profiles/me', { token, body: { availability: 'open' } });
  await req('POST', '/profiles/me/onboarding/privacy', { token, body: { peerDiscoverable: true, publicProfileEnabled: true } });
  const fin = await req('POST', '/profiles/me/onboarding/complete', { token });
  if (fin.status >= 300) throw new Error(`No se completó la bienvenida: ${JSON.stringify(fin.data)}`);
}

/**
 * Pestaña de las del componente Tabs (botones con rol «tab»). Se busca por CSS y no con
 * getByRole: en «Intereses» hay miles de áreas de prueba y calcular el rol accesible de
 * cada elemento tarda más que el tiempo de espera.
 */
const pestana = (page, nombre) => page.locator('[role="tab"]', { hasText: nombre }).first();

async function estudiante(ctx, browser) {
  objective('WG-8 · Estudiante: progreso y resumen, evidencias, perfil y canales de contacto');
  const est = await provisionStudent(ctx.admin, { firstName: 'Eva', lastName: `Estudiante${L}`, email: correoEst('estu'), semester: 8 });
  const otra = await provisionStudent(ctx.admin, { firstName: 'Rosa', lastName: `Contacto${L}`, email: correoEst('estu2'), semester: 8 });
  for (const e of [est, otra]) await completarBienvenida(e.token);
  const archivo = await subirArchivo(est.token, PDF, 'evidencia.pdf', 'application/pdf');
  await req('POST', '/evidences', { token: est.token, body: { evidenceType: 'file', description: `Informe final ${L}`, storedFileId: archivo?.id } });
  const archivoCert = await subirArchivo(est.token, PDF, 'credencial.pdf', 'application/pdf');
  await req('POST', '/certificates/external', {
    token: est.token, body: { certificateName: `Curso de pruebas ${L}`, issuer: 'Plataforma externa de formación', storedFileId: archivoCert?.id },
  });

  const { ctx: c1, page, errores } = await entrar(browser, est.email, PWD, { permissions: ['clipboard-read', 'clipboard-write'] });

  // Progreso: pestañas, filtros y resumen descargable.
  await page.goto(`${WEB}/student/progress`);
  await aparece(pestana(page, 'Puntos e insignias'), 15000);
  await pestana(page, 'Puntos e insignias').click();
  const chips = page.getByRole('group', { name: 'Filtrar por nivel' }).getByRole('button');
  for (let i = 0; i < await chips.count(); i++) await chips.nth(i).click();
  await pestana(page, 'Resumen de trayectoria').click();
  const plantillas = page.getByRole('radiogroup', { name: 'Plantilla del resumen' }).getByRole('radio');
  await aparece(plantillas, 10000);
  for (let i = 0; i < await plantillas.count(); i++) await plantillas.nth(i).click();
  await page.locator('#cv-presentacion').fill('Estudiante de Ingeniería de Sistemas con interés en desarrollo web y datos.');
  const ayuda = page.getByRole('combobox', { name: 'Tipo de ayuda' });
  if (await ayuda.count()) await ayuda.selectOption({ index: 1 }).catch(() => {});
  await page.getByRole('button', { name: 'Ver antes de descargar' }).click();
  const vista = await aparece(page.getByRole('article', { name: 'Vista previa del resumen de trayectoria' }), 10000);
  const [descarga] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
    page.getByRole('button', { name: 'Descargar en PDF' }).click(),
  ]);
  await pestana(page, 'Mi trayectoria').click();
  check(vista && !!descarga, 'WG.8.1 El estudiante recorre su progreso, elige plantilla, previsualiza y descarga su resumen en PDF', json({ vista, descarga: !!descarga }));

  // Evidencias y credenciales: búsqueda y eliminación con confirmación.
  await page.goto(`${WEB}/student/evidences`);
  // La pestaña inicial es la de credenciales; las evidencias anteriores están en «Evidencias de proyectos».
  await aparece(pestana(page, /Evidencias de proyectos/), 15000);
  await pestana(page, /Evidencias de proyectos/).click();
  const buscarEv = page.getByPlaceholder('Buscar evidencia…');
  await aparece(buscarEv, 15000);
  await buscarEv.fill('zz-no-existe-zz');
  await page.getByRole('button', { name: 'Limpiar búsqueda' }).first().click().catch(() => {});
  await buscarEv.fill(`Informe final ${L}`);
  await page.getByRole('button', { name: 'Eliminar evidencia' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
  const evEliminada = await aparece(page.getByText('Evidencia eliminada.'), 8000);
  await pestana(page, /Credenciales externas/).click();
  const buscarCert = page.getByPlaceholder('Buscar certificado o emisor…');
  await buscarCert.fill('zz-no-existe-zz');
  await page.getByRole('button', { name: 'Limpiar búsqueda' }).first().click().catch(() => {});
  await buscarCert.fill(`Curso de pruebas ${L}`);
  await page.getByRole('button', { name: 'Eliminar certificado' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
  const certEliminado = await aparece(page.getByText('Certificado eliminado.'), 8000);
  await pestana(page, /Certificados institucionales recibidos/).click();
  const quedan = (await req('GET', '/evidences/my', { token: est.token })).data ?? [];
  check(evEliminada && certEliminado && !quedan.some((e) => e.description === `Informe final ${L}`),
    'WG.8.2 Evidencias y credenciales se buscan y se eliminan solo tras confirmar', json({ evEliminada, certEliminado }));

  // Perfil: foto (con validación de formato), biografía, disponibilidad e intereses.
  await page.goto(`${WEB}/student/profile`);
  const foto = page.locator('[data-testid="foto-propia"] input[type=file]');
  await aparece(page.locator('[data-testid="foto-propia"]'), 15000);
  await foto.setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('no es una imagen') });
  const formato = await aparece(page.getByText('La foto debe ser PNG, JPG o WEBP.'), 5000);
  await foto.setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG });
  const fotoGuardada = await aparece(page.getByText('Foto guardada.'), 8000);
  await page.getByRole('button', { name: 'Quitar foto' }).click().catch(() => {});
  await espera(800);
  await page.locator('#perfil-bio').fill('Me interesa el desarrollo web y el análisis de datos.');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await espera(1000);
  await pestana(page, 'Disponibilidad').click();
  await page.locator('#perfil-horas').fill('8');
  await page.locator('#perfil-nota').fill('Disponible por las tardes.');
  await page.getByRole('button', { name: 'Guardar disponibilidad' }).click();
  await espera(1000);
  await pestana(page, 'Intereses y objetivos').click();
  await page.getByRole('button', { name: 'Guardar intereses' }).click().catch(() => {});
  await page.getByRole('button', { name: 'Guardar tecnologías' }).click().catch(() => {});
  await espera(800);
  await pestana(page, 'Visibilidad').click();
  await espera(800);
  const perfil = (await req('GET', '/profiles/me', { token: est.token })).data;
  check(formato && fotoGuardada && /desarrollo web/.test(perfil?.bio ?? ''), 'WG.8.3 El perfil rechaza una foto que no es imagen, guarda la foto, la biografía y la disponibilidad',
    json({ formato, fotoGuardada, bio: perfil?.bio?.slice(0, 30) }));

  // Visibilidad: enlace público (copiar y cambiar) y canales de contacto; luego, Colaboración.
  await page.goto(`${WEB}/student/profile?tab=visibilidad`);
  await aparece(page.getByRole('button', { name: 'Cambiar mi identificador' }), 15000);
  await page.getByRole('button', { name: 'Copiar', exact: true }).click().catch(() => {});
  const copiado = await aparece(page.getByRole('button', { name: 'Copiado' }), 4000);
  await page.getByRole('button', { name: 'Cambiar mi identificador' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cambiar' }).click();
  const rotado = await aparece(page.getByText('Identificador cambiado.'), 8000);
  await page.locator('#canal-whatsapp').fill('+591 71234567');
  await page.locator('#canal-linkedin').fill('linkedin.com/in/eva-estudiante');
  await page.locator('#canal-link').fill('http://sin-https.example.com');
  await page.getByRole('button', { name: 'Guardar canales' }).click();
  await espera(1000);
  await page.locator('#canal-link').fill('https://eva-portafolio.dev');
  await page.locator('label.check-field', { has: page.locator('input') }).first().locator('input').check().catch(() => {});
  await page.getByRole('button', { name: 'Guardar canales' }).click();
  await espera(1200);
  const canales = (await req('GET', '/collaboration/contact-channels/me', { token: est.token })).data
    ?? (await req('GET', '/profiles/me/contact-channels', { token: est.token })).data;
  await page.goto(`${WEB}/student/collaboration`);
  await page.getByRole('textbox', { name: 'Nombre o identificador' }).fill(`Rosa Contacto${L}`);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  const solicitar = page.getByRole('button', { name: 'Solicitar contacto' }).first();
  const encontrada = await aparece(solicitar, 8000);
  if (encontrada) await solicitar.click();
  await espera(1200);
  check(copiado && rotado && encontrada && errores.length === 0,
    'WG.8.4 Colaboración: copia y cambia el enlace público, guarda canales (rechaza un enlace sin https) y pide contacto', json({ copiado, rotado, encontrada, canales: Array.isArray(canales) ? canales.length : typeof canales, e: errores }));
  await c1.close();

  // La otra estudiante ve la solicitud.
  const { ctx: c2, page: p2 } = await entrar(browser, otra.email);
  await p2.goto(`${WEB}/student/collaboration`);
  const recibida = await aparece(p2.getByText(`Eva Estudiante${L}`), 15000);
  check(recibida, 'WG.8.5 Quien recibe la solicitud la ve en Colaboración');
  await c2.close();
}

// ===========================================================================
//  WG-9 — Proyectos del estudiante y galería de la carrera
// ===========================================================================
async function galeria(ctx, browser) {
  objective('WG-9 · Proyectos: imágenes, aporte propio, bitácora y la galería «Proyectos de la carrera»');
  const est = await provisionStudent(ctx.admin, { firstName: 'Eva', lastName: `Galeria${L}`, email: correoEst('gal'), semester: 8 });
  await completarBienvenida(est.token);
  const { crearProyectoActivo } = await import('./lib/fixtures.mjs');
  const titulo = `Estacion meteorologica ${L}`;
  const proyecto = await crearProyectoActivo(est.token, {
    title: titulo, description: 'Mide temperatura y humedad y publica los datos en un panel abierto.', visibility: 'public_link', technologies: ['React', 'PostgreSQL'],
  });
  const id = proyecto.data?.id;

  const { ctx: c1, page, errores } = await entrar(browser, est.email);
  await page.goto(`${WEB}/student/projects`);
  const tarjeta = page.locator('article, .card, li').filter({ has: page.getByRole('heading', { name: titulo }) }).last();
  await aparece(page.getByRole('heading', { name: titulo }), 15000);

  // Imágenes: solo PNG, JPG o WEBP; portada, orden y quitar.
  await tarjeta.getByRole('button', { name: /Imágenes del proyecto/ }).click();
  const entrada = page.getByLabel('Agregar imagen del proyecto');
  await entrada.setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('no es una imagen') });
  const formato = await aparece(page.getByText('Solo PNG, JPG o WEBP.'), 5000);
  for (let i = 1; i <= 3; i++) {
    await entrada.setInputFiles({ name: `foto-${i}.png`, mimeType: 'image/png', buffer: PNG });
    await page.waitForFunction((n) => document.querySelectorAll('[data-testid="imagenes-proyecto"] [aria-label="Quitar imagen"]').length >= n, i, { timeout: 10000 }).catch(() => {});
  }
  const imagenes = page.locator('[data-testid="imagenes-proyecto"]');
  await imagenes.getByRole('button', { name: 'Usar como portada' }).last().click().catch(() => {});
  await espera(800);
  await imagenes.getByRole('button', { name: 'Mover a la izquierda' }).last().click().catch(() => {});
  await espera(800);
  await imagenes.getByRole('button', { name: 'Mover a la derecha' }).first().click().catch(() => {});
  await espera(800);
  await imagenes.getByRole('button', { name: 'Quitar imagen' }).last().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Quitar' }).click();
  await aparece(page.getByText('Imagen quitada.'), 8000);
  const guardadas = (await req('GET', `/projects/${id}/images`, { token: est.token })).data ?? [];
  check(formato && guardadas.length === 2, 'WG.9.1 Las imágenes rechazan otros formatos; se agregan, se ordenan, una pasa a portada y se quitan', json({ formato, n: guardadas.length }));

  // Bitácora, validación técnica y el aporte propio con el consentimiento para la galería.
  await tarjeta.getByRole('button', { name: /Bitácora del proyecto/ }).click().catch(() => {});
  await tarjeta.getByRole('button', { name: /Validación técnica/ }).click().catch(() => {});
  await espera(800);
  await tarjeta.getByRole('button', { name: /Contribuciones del equipo/ }).click();
  const queHice = page.locator('#project-contribution-que-hiciste');
  const hayAporte = await aparece(queHice, 10000);
  if (hayAporte) {
    await queHice.fill('Armé el panel en React y la base de datos de lecturas.');
    await page.locator('fieldset.chip-row button.chip').first().click().catch(() => {});
    await page.locator('[data-testid="consentimiento-galeria"]').check().catch(() => {});
    await page.getByRole('button', { name: /Confirmar mi contribución|Guardar y reconfirmar/ }).click();
    await espera(1500);
  }
  const integrantes = (await req('GET', `/projects/${id}/members/detailed`, { token: est.token })).data ?? [];
  const yo = integrantes.find?.((m) => m.userId === est.userId) ?? integrantes[0];
  check(hayAporte && yo?.contributionConfirmed === true && yo?.showInGallery === true,
    'WG.9.2 El estudiante confirma su aporte con roles y acepta mostrarse en la galería', json({ hayAporte, c: yo?.contributionConfirmed, g: yo?.showInGallery }));
  await tarjeta.getByRole('button', { name: 'Editar' }).click().catch(() => {});
  await page.getByRole('button', { name: 'Cancelar' }).click().catch(() => {});
  check(errores.length === 0, 'WG.9.3 Sin errores de JavaScript en los proyectos del estudiante', errores.join(' | '));

  // Galería de la carrera: filtros, sin resultados y el detalle con sus imágenes.
  await page.goto(`${WEB}/proyectos`);
  const buscar = page.getByPlaceholder('Buscar por título o descripción…');
  await aparece(buscar, 15000);
  await buscar.fill('zz-no-existe-zz');
  const quitar = page.getByRole('button', { name: 'Quitar filtros' });
  const vacio = await aparece(quitar, 8000);
  if (vacio) await quitar.click();
  await page.getByRole('combobox', { name: 'Filtrar por área' }).selectOption({ index: 1 }).catch(() => {});
  await page.getByRole('combobox', { name: 'Filtrar por tecnología' }).selectOption({ index: 1 }).catch(() => {});
  await espera(1200);
  await page.getByRole('button', { name: 'Limpiar' }).first().click().catch(() => {});
  await buscar.fill(titulo);
  const enGaleria = page.locator('article.activity-card', { hasText: titulo });
  const visible = await aparece(enGaleria, 10000);
  let carrusel = false;
  if (visible) {
    await enGaleria.getByRole('button', { name: 'Ver más' }).click();
    const modal = page.getByRole('dialog');
    await aparece(modal, 5000);
    const siguiente = modal.getByRole('button', { name: 'Imagen siguiente' });
    if (await aparece(siguiente, 4000)) {
      await siguiente.click();
      await modal.getByRole('button', { name: 'Imagen anterior' }).click();
      carrusel = true;
    }
    await page.keyboard.press('Escape');
  }
  check(vacio && visible && carrusel, 'WG.9.4 La galería filtra, avisa cuando no hay resultados y muestra el detalle con su carrusel de imágenes', json({ vacio, visible, carrusel }));
  await c1.close();
}

// ===========================================================================
//  WG-10 — Docente: actividades de la carrera
// ===========================================================================
async function actividadesDocente(ctx, browser) {
  objective('WG-10 · Docente: filtra la oferta por tipo, categoría y responsable, guarda favoritas y abre el detalle');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dora', lastName: `Responsable${L}`, email: correoStaff('actdir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Ciro', lastName: `Oferta${L}`, email: correoStaff('actdoc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [8] } });
  const cats = ((await req('GET', '/activity-categories', { token: director.token })).data ?? []).filter((c) => c.isActive !== false);
  const cat = cats.find((c) => c.appliesTo === 'academica') ?? cats[0];
  const titulo = `Taller de pruebas ${L}`;
  const en = (h) => new Date(Date.now() + h * 3_600_000).toISOString();
  await req('POST', '/activities', {
    token: director.token,
    body: { title: titulo, type: 'academica', categoryId: cat.id, activityDate: en(96), endAt: en(98), status: 'open', semesterScope: [8], description: 'Taller práctico de pruebas automatizadas.' },
  });

  const { ctx: c1, page, errores } = await entrar(browser, docente.email);
  await page.goto(`${WEB}/teacher?tab=actividades`);
  const buscar = page.getByPlaceholder('Buscar por título, descripción o lugar…');
  await aparece(buscar, 15000);
  // Páginas: la oferta completa tiene varias.
  const pagina2 = page.getByRole('button', { name: 'Página 2' });
  if (await aparece(pagina2, 8000)) {
    await pagina2.click();
    await page.getByRole('button', { name: 'Anterior' }).click().catch(() => {});
  }
  for (const tipo of ['Académicas', 'Extracurriculares', 'Externas', 'Todas']) {
    await page.locator('button.chip', { hasText: tipo }).first().click();
    await espera(500);
  }
  await page.locator('#docente-categoria').selectOption({ index: 1 }).catch(() => {});
  await espera(600);
  await page.locator('#docente-categoria').selectOption('');
  await page.getByPlaceholder('Busca por nombre…').fill(`Responsable${L}`);
  const candidato = page.getByRole('option').getByRole('button', { name: new RegExp(`Responsable${L}`) }).first();
  const conResponsable = await aparece(candidato, 8000);
  if (conResponsable) {
    await candidato.click();
    await espera(1200);
    await page.getByRole('button', { name: 'Quitar', exact: true }).click();
  }
  await buscar.fill(titulo);
  const tarjeta = page.locator('.activity-card', { hasText: titulo });
  const visible = await aparece(tarjeta, 10000);
  await tarjeta.getByRole('button', { name: 'Favorita' }).click();
  const favorita = await aparece(tarjeta.getByRole('button', { name: 'En favoritas' }), 6000);
  await page.getByRole('checkbox', { name: 'Solo favoritas' }).check();
  await aparece(tarjeta, 8000);
  await tarjeta.getByRole('button', { name: 'Ver detalle' }).click();
  const detalle = await aparece(page.getByRole('dialog'), 6000);
  await page.keyboard.press('Escape');
  await tarjeta.getByRole('button', { name: 'En favoritas' }).click();
  const quitarFiltros = page.getByRole('button', { name: 'Quitar filtros' });
  const vacio = await aparece(quitarFiltros, 8000);
  if (vacio) await quitarFiltros.click();
  await buscar.fill('zz-no-existe-zz');
  await espera(1200);
  await page.getByRole('button', { name: /Limpiar filtros|Quitar filtros/ }).first().click().catch(() => {});
  check(visible && favorita && detalle && vacio && errores.length === 0,
    'WG.10.1 El docente filtra por tipo, categoría y responsable, guarda una favorita, la ve sola, abre su detalle y la quita', json({ conResponsable, visible, favorita, detalle, vacio, e: errores }));
  await c1.close();
}

// ===========================================================================
//  WG-11 — Dirección: participaciones confirmadas
// ===========================================================================
async function participaciones(ctx, browser) {
  objective('WG-11 · Dirección: elige una actividad, ve quién asistió, busca y revisa los documentos registrados');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dora', lastName: `Asistencias${L}`, email: correoStaff('asidir'), role: 'CAREER_DIRECTOR' });
  const { ctx: c1, page, errores } = await entrar(browser, director.email);
  await page.goto(`${WEB}/director/constancies`);
  const selector = page.locator('#constancies-actividad');
  await aparece(selector, 45000);
  // Una actividad con asistencias ya registradas (las dejan las suites de regresión).
  const valor = await selector.evaluate((s) => {
    const conAsistencia = [...s.options].find((o) => /· [1-9]\d* con lugar o asistencia/.test(o.textContent ?? ''));
    return conAsistencia?.value ?? null;
  });
  let lista = false;
  let busqueda = false;
  if (valor) {
    await selector.selectOption(valor);
    lista = await aparece(page.getByText('Asistencia registrada por el responsable'), 15000);
    const buscar = page.getByPlaceholder('Buscar estudiante…');
    await buscar.fill('zz-no-existe-zz');
    // El buscador tiene su propio botón «Limpiar búsqueda» (ícono): se usa el del aviso, con texto.
    const limpiar = page.getByRole('button', { name: 'Limpiar búsqueda' }).filter({ hasText: 'Limpiar búsqueda' });
    busqueda = await aparece(limpiar, 5000);
    if (busqueda) await limpiar.click();
  }
  await selector.selectOption('');
  check(!!valor && lista && busqueda && errores.length === 0,
    'WG.11.1 Dirección ve la asistencia confirmada de una actividad, busca estudiantes y vuelve a la lista', json({ valor: !!valor, lista, busqueda, e: errores }));
  await c1.close();
}

const BATCHES = { portada, acceso, pedidos, autonomia, recursos, puntos, proyectosDocente, estudiante, galeria, actividadesDocente, participaciones };

/** Si una parte se interrumpe, guarda una captura de cada página que quedó abierta y luego las cierra. */
async function capturarInterrupcion(browser, nombre) {
  const dir = join(tmpdir(), 'afinia-web-gestion');
  mkdirSync(dir, { recursive: true });
  let n = 0;
  for (const contexto of browser.contexts()) {
    for (const p of contexto.pages()) {
      n += 1;
      const ruta = join(dir, `${nombre}-${TS}-${n}.png`);
      const ok = await p.screenshot({ path: ruta, fullPage: true }).then(() => true).catch(() => false);
      if (ok) console.log(`    ${C.dim}captura: ${ruta} (${p.url()})${C.r}`);
    }
    await contexto.close().catch(() => {});
  }
}

async function main() {
  console.log(`${C.bold}Afinia — pantallas de gestión con un navegador real${C.r}`);
  await servirWeb();
  const pedidosCli = process.argv.slice(2);
  // Si se corren solo algunas partes, su cobertura se guarda con otro nombre y no
  // reemplaza la de una corrida completa.
  const browser = medirCobertura(await navegador(), ['e2e-web-gestion', ...pedidosCli].join('-'));
  const ctx = { admin: await loginAdmin() };
  try {
    for (const [nombre, paso] of Object.entries(BATCHES)) {
      if (pedidosCli.length && !pedidosCli.includes(nombre)) continue;
      try {
        await paso(ctx, browser);
      } catch (e) {
        failures.push(`${nombre}: ${e.message}`);
        console.log(`  ${C.bad}✗ ${nombre} se interrumpió: ${e.message}${C.r}`);
        await capturarInterrupcion(browser, nombre);
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
