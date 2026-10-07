/**
 * Pruebas de navegador de la web (V2 §66, §77, BATCH 16) con Playwright.
 *
 * Usa `playwright-core` con el Microsoft Edge (o Chrome) instalado en la
 * máquina: no descarga navegadores. Sirve la build de `web/dist` en el puerto
 * 5173 (el único origen que CORS permite en desarrollo) contra la API en 3010.
 *
 * Verifica lo que una suite de API no puede ver:
 *   - el diálogo vive en <body> (portal), atrapa el foco, Escape lo cierra y
 *     no deja fondos huérfanos (§66.2);
 *   - con «reducir movimiento» no hay animación de desplazamiento (§66.3);
 *   - el tutorial aparece una vez y se reabre desde Ayuda (§65);
 *   - navegación por actor y pestañas por URL (§77);
 *   - sin desplazamiento horizontal en un teléfono (§66).
 *
 * Uso: npm --prefix web run build && node scripts/e2e-web.mjs
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { loginAdmin, provisionAndActivate, req, PWD } from './lib/fixtures.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = 'http://localhost:5173';
const TS = Date.now();
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

// ---------------------------------------------------------------------------
let servidor = null;
async function servirWeb() {
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
  for (const channel of ['msedge', 'chrome']) {
    try { return await chromium.launch({ channel, headless: true }); } catch { /* el siguiente */ }
  }
  throw new Error('No hay Edge ni Chrome instalados para Playwright.');
}

async function entrar(page, email, password = PWD) {
  await page.goto(`${WEB}/login`);
  await page.fill('input[type=email]', email);
  await page.fill('input[autocomplete=current-password]', password);
  await page.press('input[autocomplete=current-password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
}

/** Completa la bienvenida V2 por API para que el estudiante entre directo. */
async function estudianteListo(admin, k) {
  const est = await provisionAndActivate(admin, { firstName: 'Web', lastName: k, email: `web.${k}.${TS}@est.univalle.edu`, role: 'STUDENT', semester: 3 });
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

// ---------------------------------------------------------------------------
async function pruebas(browser) {
  const admin = await loginAdmin();
  const docente = await provisionAndActivate(admin, { firstName: 'Web', lastName: 'Docente', email: `web.doc.${TS}@univalle.edu`, role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: admin, body: { semesters: [3] } });

  objective('§65 · Tutorial de primer uso y centro de ayuda');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await entrar(page, docente.email);
  const dialogo = page.getByRole('dialog', { name: 'Cómo funciona Afinia' });
  await dialogo.waitFor({ timeout: 8000 }).catch(() => {});
  check(await dialogo.isVisible(), 'WEB.1 El tutorial aparece la primera vez');
  const enBody = await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    return !!d && d.parentElement?.parentElement === document.body;
  });
  check(enBody, 'WEB.2 §66.2 El diálogo vive en <body> (portal): ningún ancestro animado lo mueve');
  const focoDentro = await page.evaluate(() => !!document.querySelector('[role=dialog]')?.contains(document.activeElement));
  check(focoDentro, 'WEB.3 §66.2 El foco entra al diálogo');
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  check(await page.evaluate(() => !!document.querySelector('[role=dialog]')?.contains(document.activeElement)),
    'WEB.4 §66.2 Tabular no saca el foco del diálogo');
  await page.keyboard.press('Escape');
  await espera(400);
  check(await page.locator('[role=dialog]').count() === 0 && await page.locator('.modal-backdrop').count() === 0,
    'WEB.5 §66.2 Escape lo cierra y no deja fondos huérfanos');
  await page.reload();
  await espera(1200);
  check(await page.getByRole('dialog', { name: 'Cómo funciona Afinia' }).count() === 0, 'WEB.6 §65 Visto una vez, no vuelve solo');

  await page.click('a[href="/ayuda"]');
  await page.waitForURL(/\/ayuda$/);
  check(await page.getByRole('heading', { name: 'Ayuda' }).first().isVisible(), 'WEB.7 §65 El centro de ayuda abre desde el menú');
  check(await page.locator('details.help-topic').count() > 0, 'WEB.8 §65 Con preguntas frecuentes del actor');
  await page.getByRole('button', { name: 'Ver el tutorial otra vez' }).click();
  check(await page.getByRole('dialog', { name: 'Cómo funciona Afinia' }).isVisible(), 'WEB.9 §65 El tutorial se reabre desde Ayuda');
  await page.getByRole('button', { name: 'Omitir' }).click();

  objective('§77 · Navegación del docente');
  const enlaces = await page.locator('nav a.nav-link').allInnerTexts();
  check(['Panel académico', 'Necesidades de equipo', 'Mis actividades', 'Ayuda'].every((t) => enlaces.some((e) => e.includes(t))),
    'WEB.10 §77 El docente tiene Panel académico, Necesidades de equipo, Mis actividades y Ayuda', enlaces.join(' | '));
  check(!enlaces.some((e) => /Reportes del curso|Mensajes/.test(e)), 'WEB.11 §62 §57 Sin «Reportes del curso» ni mensajes');
  await page.click('a[href="/teacher/team-needs"]');
  check(await page.getByRole('heading', { name: 'Necesidades de equipo' }).first().isVisible(), 'WEB.12 §62 La página de necesidades abre');
  check(errores.length === 0, 'WEB.13 Sin errores de JavaScript en la sesión', errores.join(' | '));
  await ctx.close();

  objective('§66.3 · Movimiento reducido');
  const lento = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
  const p2 = await lento.newPage();
  await entrar(p2, docente.email);
  await p2.evaluate(() => window.dispatchEvent(new Event('afinia:tutorial')));
  await p2.waitForSelector('[role=dialog]');
  const transform = await p2.evaluate(() => getComputedStyle(document.querySelector('[role=dialog]')).transform);
  check(transform === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(transform),
    'WEB.14 §66.3 Con «reducir movimiento» el diálogo aparece sin desplazarse', transform);
  await lento.close();

  objective('§77 · Estudiante: accesos directos y pestañas por URL');
  const est = await estudianteListo(admin, 'nav');
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p3 = await ctx3.newPage();
  await entrar(p3, est.email);
  // Primera vez del estudiante: el tutorial aparece; se omite como lo haría una persona.
  const omitir = p3.getByRole('button', { name: 'Omitir' });
  await omitir.waitFor({ timeout: 8000 }).catch(() => {});
  check(await omitir.isVisible(), 'WEB.14b §65 El estudiante también recibe su tutorial');
  await omitir.click();
  const items = await p3.locator('nav a.nav-link').allInnerTexts();
  check(['Mi perfil', 'Equipos', 'CV / Exportar', 'Ayuda'].every((t) => items.some((e) => e.includes(t))),
    'WEB.15 §77 El estudiante tiene Mi perfil, Equipos, CV / Exportar y Ayuda', items.join(' | '));
  check(!items.some((e) => /Preferencias|Privacidad/.test(e)),
    'WEB.15b V3 §11.1 Intereses y privacidad viven dentro de Mi perfil: sin entradas duplicadas en el menú', items.join(' | '));
  // V3 §11.1: Mi perfil en cuatro pestañas; los enlaces antiguos llegan a la suya.
  await p3.goto(`${WEB}/student/privacy`);
  await p3.waitForURL(/tab=visibilidad/);
  const pestanas = await p3.locator('[role=tab]').allInnerTexts();
  check(['Sobre mí', 'Intereses y objetivos', 'Disponibilidad', 'Visibilidad'].every((t) => pestanas.some((x) => x.includes(t))),
    'WEB.15c V3 §11.1 Mi perfil: Sobre mí, Intereses y objetivos, Disponibilidad y Visibilidad', pestanas.join(' | '));
  await p3.getByText('Perfil compartible').first().waitFor({ timeout: 8000 }).catch(() => {});
  check(await p3.getByText('Perfil compartible').first().isVisible(),
    'WEB.15d V3 §11.1 /student/privacy abre la pestaña Visibilidad con la configuración', p3.url());
  await p3.click('a[href="/student/collaboration?tab=equipos"]');
  await p3.waitForURL(/tab=equipos/);
  const activos = await p3.locator('nav a.nav-link.active').allInnerTexts();
  check(activos.length === 1 && activos[0].includes('Equipos'), 'WEB.16 §77 Solo «Equipos» queda marcado en el menú', activos.join(' | '));
  check(await p3.getByText('¿Qué le falta a tu equipo?').isVisible(), 'WEB.17 §77 Y abre directo la pestaña de equipos');
  await p3.click('a[href="/student/progress?tab=resumen"]');
  check(await p3.getByText('Plantilla', { exact: true }).first().isVisible(), 'WEB.18 §61 CV / Exportar abre el generador con plantillas');
  await p3.getByText('Paso 1 · Qué secciones incluir').first().waitFor({ timeout: 8000 }).catch(() => {});
  check(await p3.getByText('Paso 1 · Qué secciones incluir').first().isVisible()
    && await p3.getByLabel('Credenciales / cursos externos').first().isVisible(),
  'WEB.18b V3 §43 El currículo se elige en dos niveles, con casillas etiquetadas');
  await p3.click('nav a[href="/student/progress"]');
  await p3.getByText('Cómo leer tu trayectoria').first().waitFor({ timeout: 8000 }).catch(() => {});
  check(await p3.getByText('Cómo leer tu trayectoria').first().isVisible(),
    'WEB.18c V3 §42 «Mi progreso» abre en Mi trayectoria, con los niveles explicados');
  check(!(await p3.content()).includes('Mensajes'), 'WEB.19 §57 Ninguna pestaña de mensajes');

  objective('Cambio de vista sin parpadeo');
  // Primera pasada: cada vista carga y queda en la memoria de la sesión.
  const vistas = ['/student/activities', '/student/projects', '/student/affinity', '/student'];
  for (const r of vistas) { await p3.click(`nav a[href="${r}"]`); await espera(1200); }
  // Segunda pasada, cuadro a cuadro: ni el contenido se vuelve transparente
  // ni aparece un esqueleto en lugar de lo que ya se había mostrado.
  const malas = [];
  for (const r of vistas) {
    await p3.evaluate(() => {
      window.__cuadros = [];
      const fin = performance.now() + 700;
      const tick = () => {
        const c = document.querySelector('.content');
        let minimo = c ? Number(getComputedStyle(c).opacity) : 0;
        c?.querySelectorAll('*').forEach((el, i) => { if (i < 400) minimo = Math.min(minimo, Number(getComputedStyle(el).opacity)); });
        window.__cuadros.push({ minimo, esqueleto: !!c?.querySelector('.skeleton, .skeleton-cards, .skeleton-table, .async-wait') });
        if (performance.now() < fin) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await p3.click(`nav a[href="${r}"]`);
    await espera(800);
    const cuadros = await p3.evaluate(() => window.__cuadros);
    const t = cuadros.filter((x) => x.minimo < 0.6).length;
    const e = cuadros.filter((x) => x.esqueleto).length;
    if (t || e) malas.push(`${r} (${t} transparentes, ${e} con esqueleto)`);
  }
  check(malas.length === 0, 'WEB.19b Volver a una vista ya vista la pinta al instante: sin fundido ni esqueleto', malas.join(', '));

  objective('§18 · Recargar la página no cierra la sesión');
  const rechazos = [];
  p3.on('response', (r) => { if (r.url().includes('/auth/refresh') && r.status() !== 200) rechazos.push(r.status()); });
  // Cinco F5 seguidos, cada uno en cuanto la página termina de cargar.
  for (let i = 0; i < 5; i++) await p3.reload({ waitUntil: 'load' });
  await p3.waitForTimeout(1500);
  check(!p3.url().includes('/login') && await p3.locator('nav a.nav-link').count() > 0,
    'WEB.19c Cinco recargas seguidas: la sesión sigue abierta', p3.url());

  // F5 justo mientras la sesión se renueva: la petición llega al servidor, que
  // rota el token, pero la respuesta con la cookie nueva nunca llega al
  // navegador. Se reproduce tal cual: el canje se hace por fuera del navegador
  // (su Set-Cookie se pierde) y la petición de la página se corta.
  let perdidas = 0;
  await p3.route('**/api/auth/refresh', async (route) => {
    // Solo se pierde la primera respuesta, como en un F5 real.
    if (perdidas > 0) return route.continue();
    const h = await route.request().allHeaders();
    const canje = await fetch(route.request().url(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: h.cookie ?? '', 'x-session-transport': 'cookie', origin: WEB },
      body: '{}',
    });
    if (canje.status === 200) perdidas += 1;
    await route.abort('connectionreset');
  });
  await p3.reload({ waitUntil: 'load' });
  await p3.waitForTimeout(800);
  await p3.unroute('**/api/auth/refresh');
  await p3.reload({ waitUntil: 'load' });
  await p3.waitForTimeout(2000);
  check(perdidas > 0 && !p3.url().includes('/login') && await p3.locator('nav a.nav-link').count() > 0,
    'WEB.19d F5 en medio de la renovación (el servidor rotó, el navegador no recibió la cookie): la sesión sigue abierta', p3.url());
  // Y no se quedó viva por casualidad: tras la carrera, otra recarga normal renueva bien.
  await p3.reload({ waitUntil: 'load' });
  await p3.waitForTimeout(1500);
  check(!p3.url().includes('/login') && rechazos.length === 0,
    'WEB.19e Ninguna renovación fue rechazada en todo el recorrido', rechazos.join(', '));
  await ctx3.close();

  objective('§66 · Teléfono: sin desplazamiento horizontal');
  const tel = await browser.newContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });
  const p4 = await tel.newPage();
  await entrar(p4, est.email);
  const rutas = [
    '/student', '/student/profile', '/student/profile?tab=intereses', '/student/activities', '/student/projects',
    '/student/evidences', '/student/affinity', '/student/recommendations', '/student/collaboration',
    '/student/collaboration?tab=equipos', '/student/progress', '/student/progress?tab=resumen', '/student/privacy', '/ayuda',
  ];
  const anchas = [];
  for (const ruta of rutas) {
    await p4.goto(`${WEB}${ruta}`);
    await espera(700);
    const sobra = await p4.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (sobra > 1) anchas.push(`${ruta} (+${sobra}px)`);
  }
  check(anchas.length === 0, `WEB.20 §66 Las ${rutas.length} pantallas del estudiante caben en 375 px`, anchas.join(', '));
  await tel.close();

  const telDoc = await browser.newContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });
  const p5 = await telDoc.newPage();
  await entrar(p5, docente.email);
  const anchasDoc = [];
  for (const ruta of ['/teacher', '/teacher/my-activities', '/teacher/reports', '/teacher/team-needs', '/ayuda']) {
    await p5.goto(`${WEB}${ruta}`);
    await espera(700);
    const sobra = await p5.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (sobra > 1) anchasDoc.push(`${ruta} (+${sobra}px)`);
  }
  check(anchasDoc.length === 0, 'WEB.21 §66 Las pantallas del docente también caben en un teléfono', anchasDoc.join(', '));
  await telDoc.close();
}

async function main() {
  console.log(`${C.bold}Web en navegador (Playwright · V2 §65, §66, §77)${C.r}`);
  let browser = null;
  try {
    await servirWeb();
    browser = await navegador();
    await pruebas(browser);
  } catch (e) {
    failures.push(`Error: ${e.message}`);
    console.error(e);
  } finally {
    await browser?.close();
    if (servidor) {
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(servidor.pid), '/T', '/F']);
      else servidor.kill();
    }
  }
  console.log(`\n${C.bold}${passed} comprobaciones correctas, ${failures.length} fallidas${C.r}`);
  for (const f of failures) console.log(`  ${C.bad}- ${f}${C.r}`);
  process.exit(failures.length ? 1 : 0);
}

main();
