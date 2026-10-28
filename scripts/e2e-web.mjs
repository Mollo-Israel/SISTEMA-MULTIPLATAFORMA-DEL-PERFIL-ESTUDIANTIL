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
import { ADMIN_CREDENTIALS, API, asegurarGithubSimulado, loginAdmin, provisionAndActivate, req, PWD } from './lib/fixtures.mjs';

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
  // V3 B23 · compatibilidad: E2E_BROWSER=msedge|chrome fija el navegador.
  const canales = process.env.E2E_BROWSER ? [process.env.E2E_BROWSER] : ['msedge', 'chrome'];
  for (const channel of canales) {
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
  // V3 §51: un solo «Inicio / Panel académico» con pestañas, sin dos resúmenes repetidos.
  check(['Inicio / Panel académico', 'Mis actividades', 'Ayuda'].every((t) => enlaces.some((e) => e.includes(t)))
    && enlaces.filter((e) => /Panel/.test(e)).length === 1,
  'WEB.10 V3 §51 El docente tiene un solo Inicio / Panel académico, Mis actividades y Ayuda', enlaces.join(' | '));
  check(!enlaces.some((e) => /Reportes del curso|Mensajes/.test(e)), 'WEB.11 §62 §57 Sin «Reportes del curso» ni mensajes');
  await page.click('nav a[href="/teacher"]');
  const pestanasDoc = await page.locator('[role=tab]').allInnerTexts();
  check(['Resumen', 'Por semestre', 'Estudiantes', 'Proyectos visibles', 'Actividades de la carrera', 'Necesidades/equipos'].every((t) => pestanasDoc.some((x) => x.includes(t))),
    'WEB.12 V3 §51 El panel tiene Resumen, Por semestre, Estudiantes, Proyectos visibles, Actividades y Necesidades/equipos', pestanasDoc.join(' | '));
  await page.goto(`${WEB}/teacher/team-needs`);
  await page.waitForURL(/\/teacher\?tab=equipos/, { timeout: 8000 }).catch(() => {});
  check(page.url().includes('/teacher?tab=equipos') && await page.getByText('Lo que buscan los equipos').first().isVisible(),
    'WEB.12b V3 §51 La ruta antigua de necesidades abre su pestaña (drill-down sin enlaces rotos)', page.url());
  // V3.2 §56: cada función del docente tiene su entrada en el menú, sin un segundo panel.
  const enlacesDoc = await page.locator('nav a.nav-link').allInnerTexts();
  check(['Actividades de la carrera', 'Mis actividades', 'Estudiantes', 'Proyectos de estudiantes', 'Necesidades de equipo', 'Reporte por semestre']
    .every((t) => enlacesDoc.some((e) => e.includes(t))) && enlacesDoc.filter((e) => /Panel/.test(e)).length === 1,
  'WEB.12c V3.2 §56 El menú del docente vuelve a tener Actividades de la carrera, estudiantes, proyectos, necesidades y reporte', enlacesDoc.join(' | '));
  await page.click('nav a[href="/teacher?tab=actividades"]');
  await espera(900);
  const activoCarrera = await page.locator('nav a.nav-link.active').allInnerTexts();
  check(page.url().includes('tab=actividades')
    && await page.getByRole('tab', { name: 'Actividades de la carrera', selected: true }).count() === 1
    && activoCarrera.length === 1 && activoCarrera[0].includes('Actividades de la carrera'),
  'WEB.12d V3.2 §25 «Actividades de la carrera» abre su pestaña y queda marcada sola en el menú', `${page.url()} · ${activoCarrera.join(' | ')}`);
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
  // V5 §1.1: «CV / Exportar» pasa a «Resumen de trayectoria» (borrador informativo).
  check(['Mi perfil', 'Equipos', 'Resumen de trayectoria', 'Ayuda'].every((t) => items.some((e) => e.includes(t))),
    'WEB.15 §77 El estudiante tiene Mi perfil, Equipos, Resumen de trayectoria y Ayuda', items.join(' | '));
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
  check(await p3.getByText('Plantilla', { exact: true }).first().isVisible(), 'WEB.18 §61 Resumen de trayectoria abre el generador con plantillas');
  await p3.getByText('Paso 1 · Qué secciones incluir').first().waitFor({ timeout: 8000 }).catch(() => {});
  // Las casillas llegan con la respuesta de secciones: se esperan, no se suponen.
  await p3.getByLabel('Credenciales / cursos externos').first().waitFor({ timeout: 8000 }).catch(() => {});
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
    '/student', '/student/profile', '/student/profile?tab=intereses', '/student/activities', '/student/library', '/student/projects',
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

  objective('V3 B21 · Todos los actores en un teléfono y validación por campo');
  const otros = {
    director: await provisionAndActivate(admin, { firstName: 'Web', lastName: 'Director', email: `web.dir.${TS}@univalle.edu`, role: 'CAREER_DIRECTOR' }),
    sociedad: await provisionAndActivate(admin, { firstName: 'Web', lastName: 'Sociedad', email: `web.soc.${TS}@univalle.edu`, role: 'SCIENTIFIC_SOCIETY' }),
    // Administración no se provisiona (por diseño): se usa la cuenta sembrada.
    admin: { email: ADMIN_CREDENTIALS.email, password: ADMIN_CREDENTIALS.password },
  };
  const rutasPorActor = {
    director: ['/director', '/director/analytics', '/director/analytics?tab=evolucion', '/director/approvals', '/director/constancies'],
    sociedad: ['/society', '/society/activities', '/society/participants', '/society/metrics'],
    admin: ['/admin', '/admin/users', '/admin/areas', '/admin/audit'],
  };
  for (const [actor, rutas] of Object.entries(rutasPorActor)) {
    const tel = await browser.newContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });
    const pt = await tel.newPage();
    const fallos = [];
    pt.on('pageerror', (e) => fallos.push(e.message));
    await entrar(pt, otros[actor].email, otros[actor].password ?? PWD);
    const anchas = [];
    for (const ruta of rutas) {
      await pt.goto(`${WEB}${ruta}`);
      await espera(900);
      const sobra = await pt.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (sobra > 1) anchas.push(`${ruta} (+${sobra}px)`);
    }
    check(anchas.length === 0 && fallos.length === 0, `WEB.22 V3 B21 Las pantallas de ${actor} caben en 375 px y no fallan`, [...anchas, ...fallos].join(', '));
    await tel.close();
  }

  objective('V3.2 §58-§60 · Menús de Sociedad y Administración, y auditoría legible');
  const esc = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const pe = await esc.newPage();
  await entrar(pe, otros.sociedad.email);
  const enlacesSoc = await pe.locator('nav a.nav-link').allInnerTexts();
  check(enlacesSoc.some((e) => e.includes('Mis actividades')) && !enlacesSoc.some((e) => /Crear actividad/.test(e)),
    'WEB.22b V3.2 §58 Sociedad ya no tiene una vista «Crear actividad» aparte de Mis actividades', enlacesSoc.join(' | '));
  await pe.goto(`${WEB}/society/activities`);
  await pe.getByRole('button', { name: /Nueva actividad/ }).first().waitFor({ timeout: 10000 }).catch(() => {});
  check(await pe.getByRole('button', { name: /Nueva actividad/ }).count() > 0,
    'WEB.22c V3.2 §58 Crear sigue disponible como botón dentro de Mis actividades');
  await esc.close();

  const adm = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const pa = await adm.newPage();
  const fallosAdm = [];
  pa.on('pageerror', (e) => fallosAdm.push(e.message));
  await entrar(pa, otros.admin.email, otros.admin.password);
  const enlacesAdm = await pa.locator('nav a.nav-link').allInnerTexts();
  check(!enlacesAdm.some((e) => /Correo/.test(e)),
    'WEB.22d V3.2 §60 «Correo (configuración técnica)» no está en el menú del producto', enlacesAdm.join(' | '));
  await pa.goto(`${WEB}/admin/mail`);
  await espera(900);
  check(!pa.url().includes('/admin/mail') || await pa.getByText(/SMTP|Servidor de correo/).count() === 0,
    'WEB.22e V3.2 §60 Ni escribiendo la ruta se llega a la pantalla técnica del correo', pa.url());
  await pa.goto(`${WEB}/admin/audit`);
  await pa.waitForSelector('table.tabla-apilable tbody tr', { timeout: 10000 }).catch(() => {});
  const columnas = await pa.locator('table.tabla-apilable thead th').allInnerTexts();
  check(['Actor', 'Módulo', 'Acción', 'Fecha', 'Resultado'].every((c) => columnas.some((x) => x.toLowerCase().includes(c.toLowerCase()))),
    'WEB.22f V3.2 §59 La auditoría muestra Actor, Módulo, Acción, Fecha y Resultado', columnas.join(' | '));
  const filas = await pa.locator('table.tabla-apilable tbody > tr:not(.audit-detalle)').count();
  check(filas > 0 && filas <= 10, 'WEB.22g V3.2 §59 De a 10 por página', `filas ${filas}`);
  const primera = await pa.locator('table.tabla-apilable tbody > tr').first().innerText();
  check(!/[A-Z]{3,}_[A-Z_]{3,}/.test(primera) && !/\bentity=|\bdelta\b/.test(primera),
    'WEB.22h V3.2 §59 La fila dice qué pasó en palabras, no con el código técnico', primera.replace(/\s+/g, ' ').slice(0, 160));
  await pa.selectOption('select[aria-label="Módulo"]', 'cuentas');
  await espera(1200);
  const modulos = await pa.locator('table.tabla-apilable tbody > tr:not(.audit-detalle) td:nth-child(2)').allInnerTexts();
  check(modulos.length > 0 && modulos.every((m) => m.includes('Cuentas y acceso')),
    'WEB.22i V3.2 §59 El filtro por módulo funciona', [...new Set(modulos)].join(' | '));
  check(fallosAdm.length === 0, 'WEB.22j Sin errores de JavaScript en la sesión de Administración', fallosAdm.join(' | '));
  await adm.close();

  objective('V3.2 B19 · Las imágenes protegidas se ven (se piden con la sesión)');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'tapa.png');
  const subida = await (await fetch(`${API}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${otros.director.token}` }, body: form })).json();
  const areasCat = (await req('GET', '/academic-areas', { token: admin })).data ?? [];
  const tituloImg = `Recurso con tapa ${TS}`;
  await req('POST', '/learning-resources', {
    token: otros.director.token,
    body: { title: tituloImg, provider: 'Documentación de pruebas', url: `https://docs.example.org/${TS}`, resourceType: 'documentation', academicAreaId: areasCat[0]?.id, imageFileId: subida?.id },
  });
  const estImg = await estudianteListo(admin, 'img');
  const ci = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const pi = await ci.newPage();
  await entrar(pi, estImg.email);
  await pi.goto(`${WEB}/student/library`);
  await pi.getByPlaceholder('Buscar por título, descripción o fuente…').fill(tituloImg);
  await pi.waitForSelector('img[src^="blob:"]', { timeout: 10000 }).catch(() => {});
  const imagenes = await pi.evaluate(() => [...document.querySelectorAll('.content img')].map((i) => ({ src: i.getAttribute('src') ?? '', ok: i.complete && i.naturalWidth > 0 })));
  check(imagenes.some((i) => i.src.startsWith('blob:') && i.ok) && !imagenes.some((i) => i.src.startsWith('/api/files')),
    'WEB.22k V3.2 §35 La imagen de un recurso se carga con la sesión (antes el navegador recibía 401)', JSON.stringify(imagenes.slice(0, 3)));
  await ci.close();

  // =========================================================================
  //  V4.1-1 · Activación → recuperar, textos internos, grillas y aula (A41-001…004)
  // =========================================================================
  objective('V4.1-1 · Recuperar desde «cuenta ya activa», grillas de 10 con orden y aula válida');
  const c41 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p41 = await c41.newPage();
  const fallos41 = [];
  p41.on('pageerror', (e) => fallos41.push(e.message));
  await p41.goto(`${WEB}/activar/solicitar`);
  await p41.fill('input[type=email]', ADMIN_CREDENTIALS.email);
  await p41.getByRole('button', { name: 'Enviarme el correo' }).click();
  await p41.getByText('Tu cuenta ya está activa').first().waitFor({ timeout: 8000 }).catch(() => {});
  const vioActiva = await p41.getByText('Tu cuenta ya está activa').count() > 0;
  await p41.getByRole('link', { name: /Olvidé mi contraseña/ }).click();
  await p41.waitForURL(/\/recuperar$/, { timeout: 8000 }).catch(() => {});
  await espera(400);
  check(vioActiva && p41.url().endsWith('/recuperar')
      && await p41.getByText('Tu cuenta ya está activa').count() === 0
      && await p41.getByText('Recuperar el acceso').first().isVisible()
      && await p41.locator('input[type=email]').inputValue() === '',
  'WEB.41.1 B01 A41-001 «Olvidé mi contraseña» desde una cuenta activa abre /recuperar limpio', p41.url());

  await entrar(p41, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
  // Perfil de navegador nuevo: el tutorial de bienvenida se cierra como haría la persona.
  await p41.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  await p41.goto(`${WEB}/admin/areas`);
  await espera(900);
  check(!/V3\.2|V4\.1|§\s?\d/.test(await p41.locator('.content').innerText()),
    'WEB.41.2 A41-002 Áreas y habilidades no muestra nombres internos de versión ni secciones');

  const grilla = async (ruta, filasSel) => {
    await p41.goto(`${WEB}${ruta}`);
    await p41.waitForSelector('nav.paginacion', { timeout: 10000 }).catch(() => {});
    const filas = await p41.locator(filasSel).count();
    const pie = await p41.locator('nav.paginacion span').first().innerText().catch(() => '');
    const ths = await p41.locator('th[aria-sort]').count();
    return { filas, pie, ths };
  };
  const cat = await grilla('/admin/activity-categories', 'table tbody tr');
  check(cat.filas > 0 && cat.filas <= 10 && /^1–\d+ de \d+ categorías/.test(cat.pie) && cat.ths >= 4,
    'WEB.41.3 B02 A41-003 Categorías: 10 por página, total y columnas ordenables', JSON.stringify(cat));
  const primeraAntes = await p41.locator('table tbody tr td strong').first().innerText();
  await p41.locator('th[aria-sort] button', { hasText: 'Nombre' }).click();
  await espera(300);
  const primeraDesc = await p41.locator('table tbody tr td strong').first().innerText();
  const sortNombre = await p41.locator('th[aria-sort]', { hasText: 'Nombre' }).getAttribute('aria-sort');
  check(sortNombre === 'descending' && primeraDesc !== primeraAntes,
    'WEB.41.4 B02 Ordenar por nombre invierte el orden', `${primeraAntes} → ${primeraDesc} (${sortNombre})`);
  await p41.getByRole('button', { name: 'Página 2' }).click();
  await espera(300);
  const pie2 = await p41.locator('nav.paginacion span').first().innerText();
  check(/^11–\d+ de \d+/.test(pie2), 'WEB.41.5 B02 La página 2 empieza en el registro 11', pie2);
  await p41.getByPlaceholder('Buscar categoría o código…').fill('taller');
  await espera(500);
  const pieFiltro = await p41.locator('nav.paginacion span').first().innerText().catch(() => '');
  check(/^1–/.test(pieFiltro), 'WEB.41.6 B02 Al filtrar vuelve a la página 1', pieFiltro);

  const rec = await grilla('/admin/resources', 'table tbody tr');
  check(rec.filas > 0 && rec.filas <= 10 && / de \d+ recursos/.test(rec.pie) && rec.ths >= 4,
    'WEB.41.7 A41-003 Recursos: 10 por página, total y columnas ordenables', JSON.stringify(rec));
  const act = await grilla('/admin/activities', 'table tbody tr');
  check(act.ths >= 7, 'WEB.41.8 A41-003 Actividades: las columnas de la gestión se pueden ordenar', JSON.stringify(act));

  await p41.goto(`${WEB}/admin/activities?nuevo=1`);
  await p41.getByRole('button', { name: /Nueva actividad/ }).first().click().catch(() => {});
  const lugar = p41.locator('[data-campo="location"] input');
  await lugar.waitFor({ timeout: 8000 }).catch(() => {});
  if (await lugar.count()) {
    await lugar.fill('123123');
    await p41.getByRole('button', { name: /Guardar borrador|Guardar/ }).first().click().catch(() => {});
    await espera(500);
    const err = await p41.locator('[data-campo="location"] .field-error').innerText().catch(() => '');
    check(/aula o lugar reconocible/i.test(err), 'WEB.41.9 B04 A41-004 «123123» como aula muestra el error debajo del campo', err);
  } else {
    check(false, 'WEB.41.9 B04 A41-004 «123123» como aula muestra el error debajo del campo', 'no apareció el campo de aula');
  }
  check(fallos41.length === 0, 'WEB.41.10 Sin errores de JavaScript en V4.1-1', fallos41.join(' | '));
  await c41.close();

  // =========================================================================
  //  V4.1-2 · Editar hidrata habilidades; varias imágenes, carrusel y tarjeta (A41-005, 006)
  // =========================================================================
  objective('V4.1-2 · La edición muestra lo guardado; hasta 5 imágenes con portada y carrusel');
  const pngBase = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const subirDe = async (token, k) => {
    const f = new FormData();
    f.append('file', new Blob([Buffer.concat([pngBase, Buffer.from(`web-v41-${TS}-${k}`)])], { type: 'image/png' }), `v41-${k}.png`);
    return (await (await fetch(`${API}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${otros.director.token}` }, body: f })).json())?.id;
  };
  const imgs = [await subirDe(otros.director.token, 1), await subirDe(otros.director.token, 2), await subirDe(otros.director.token, 3)];
  const catAreas = (await req('GET', '/academic-areas', { token: admin })).data ?? [];
  const catSkills = (await req('GET', '/skills', { token: admin })).data ?? [];
  const cats41 = (await req('GET', '/activity-categories', { token: otros.director.token })).data ?? [];
  const aBd = catAreas.find((x) => x.code === 'bases_de_datos');
  const aRedes = catAreas.find((x) => /redes/i.test(x.code));
  const sMongo = catSkills.find((x) => x.code === 'mongodb') ?? catSkills.find((x) => x.academicAreaId === aBd.id);
  const sRedes = catSkills.find((x) => x.academicAreaId === aRedes.id && x.isActive !== false);
  const titulo41 = `Taller BD y Redes ${TS}`;
  const inicio = new Date(Date.now() + 72 * 3_600_000).toISOString();
  const fin = new Date(Date.now() + 74 * 3_600_000).toISOString();
  await req('POST', '/activities', {
    token: otros.director.token,
    body: {
      title: titulo41, type: 'academica', categoryId: (cats41.find((c) => c.code === 'taller_academico') ?? cats41[0]).id,
      semesterScope: [3], modality: 'presencial', location: 'Aula 201', activityDate: inicio, endAt: fin, status: 'open',
      areaIds: [aBd.id, aRedes.id], skillIds: [sMongo.id, sRedes.id],
      skillContexts: [{ skillId: sMongo.id, areaId: aBd.id }, { skillId: sRedes.id, areaId: aRedes.id }],
      imageFileIds: imgs,
    },
  });

  const c42 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p42 = await c42.newPage();
  const fallos42 = [];
  p42.on('pageerror', (e) => fallos42.push(e.message));
  await entrar(p42, otros.director.email);
  await p42.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  await p42.goto(`${WEB}/director/activities`);
  await p42.getByPlaceholder('Buscar por título, lugar, categoría o etiqueta…').fill(titulo41);
  await espera(500);
  await p42.getByRole('button', { name: `Editar ${titulo41}` }).click();
  await espera(1500);
  const chipsOn = await p42.locator('button.chip[aria-pressed="true"]').allInnerTexts();
  check(chipsOn.some((t) => t.includes(sMongo.name)) && chipsOn.some((t) => t.includes(sRedes.name)),
    'WEB.42.1 B05 A41-005 Al editar, las habilidades guardadas aparecen marcadas en su área', chipsOn.join(' | '));
  const miniaturas = await p42.locator('ul.activity-images-edit li').count();
  const portada = await p42.locator('ul.activity-images-edit li').first().innerText();
  check(miniaturas === 3 && /Portada/.test(portada), 'WEB.42.2 B08 A41-006 El formulario muestra las 3 imágenes y la portada', `${miniaturas} · ${portada}`);
  await c42.close();

  const estImg2 = await estudianteListo(admin, 'car');
  const c43 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p43 = await c43.newPage();
  p43.on('pageerror', (e) => fallos42.push(e.message));
  await entrar(p43, estImg2.email);
  await p43.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  await p43.goto(`${WEB}/student/activities?tab=todas`);
  await p43.getByRole('tab', { name: 'Todas' }).first().click().catch(() => {});
  await p43.getByPlaceholder('Buscar por título, descripción o lugar…').fill(titulo41);
  await espera(800);
  const tarjeta = p43.locator('article.activity-card', { hasText: titulo41 }).first();
  await tarjeta.waitFor({ timeout: 8000 }).catch(() => {});
  const tituloEnImagen = await tarjeta.locator('.activity-card-img').innerText().catch(() => '');
  check(await tarjeta.count() > 0 && !tituloEnImagen.includes(titulo41) && await tarjeta.locator('.activity-card-body').innerText().then((t) => t.includes(titulo41)),
    'WEB.42.3 B09 La tarjeta muestra la imagen en su propia región y el texto fuera de ella', tituloEnImagen.slice(0, 60));
  await tarjeta.getByRole('button', { name: 'Ver detalle' }).click();
  const carr = p43.locator('[aria-roledescription="carrusel"]');
  await carr.waitFor({ timeout: 8000 }).catch(() => {});
  const t1 = await carr.locator('[aria-live]').innerText().catch(() => '');
  await carr.getByRole('button', { name: 'Imagen siguiente' }).click();
  const t2 = await carr.locator('[aria-live]').innerText().catch(() => '');
  await carr.focus();
  await p43.keyboard.press('ArrowRight');
  const t3 = await carr.locator('[aria-live]').innerText().catch(() => '');
  await p43.waitForSelector('[aria-roledescription="carrusel"] img[src^="blob:"]', { timeout: 8000 }).catch(() => {});
  const visible = await carr.locator('img[src^="blob:"]').count();
  check(t1 === 'Imagen 1 de 3' && t2 === 'Imagen 2 de 3' && t3 === 'Imagen 3 de 3' && visible === 1,
    'WEB.42.4 B08 A41-006 El detalle tiene carrusel con botones y teclado, y carga la imagen con la sesión', `${t1} → ${t2} → ${t3} · img=${visible}`);
  check(fallos42.length === 0, 'WEB.42.5 Sin errores de JavaScript en V4.1-2', fallos42.join(' | '));

  // ===== V4.1-3 · Pestañas por origen × carácter (A41-012), resultado sin opción redundante (A41-013), duplicar (A41-010)
  objective('V4.1-3 · Tres pestañas de actividades, resultado interno sin «credencial esperada» y Duplicar');
  await p43.keyboard.press('Escape');
  await p43.goto(`${WEB}/student/activities?tab=todas`);
  await espera(800);
  const chips43 = await p43.locator('.chip-row button.chip').allInnerTexts();
  check(['Académicas internas', 'Extracurriculares internas', 'Oportunidades externas'].every((t) => chips43.some((c) => c.includes(t))),
    'WEB.43.1 A41-012 El estudiante ve Académicas internas, Extracurriculares internas y Oportunidades externas', chips43.join(' | '));
  const pedidoExternas = p43.waitForRequest((r) => r.url().includes('/activities?') && r.url().includes('originType=external'), { timeout: 8000 }).catch(() => null);
  await p43.locator('.chip-row button.chip', { hasText: 'Oportunidades externas' }).click();
  const reqExt = await pedidoExternas;
  const pedidoAcad = p43.waitForRequest((r) => r.url().includes('originType=internal') && r.url().includes('type=academica'), { timeout: 8000 }).catch(() => null);
  await p43.locator('.chip-row button.chip', { hasText: 'Académicas internas' }).click();
  const reqAcad = await pedidoAcad;
  check(!!reqExt && !!reqAcad, 'WEB.43.2 A41-012 Cada pestaña filtra por origen y carácter (internas ≠ externas)', `${!!reqExt} / ${!!reqAcad}`);
  await c43.close();

  const c44 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p44 = await c44.newPage();
  await entrar(p44, otros.director.email);
  await p44.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  await p44.goto(`${WEB}/director/activities`);
  await p44.locator('button[aria-label^="Duplicar "]').first().waitFor({ timeout: 10000 }).catch(() => {});
  check(await p44.locator('button[aria-label^="Duplicar "]').count() > 0, 'WEB.43.3 A41-010 La gestión ofrece «Duplicar» en cada actividad');
  await p44.getByRole('button', { name: /Nueva actividad/ }).first().click();
  await p44.locator('#op-resultado').waitFor({ timeout: 8000 }).catch(() => {});
  const opciones = await p44.locator('#op-resultado option').allInnerTexts();
  check(opciones.length > 0 && !opciones.some((o) => /Credencial externa esperada/.test(o)),
    'WEB.43.4 A41-013 Una actividad interna ya no ofrece «Credencial externa esperada»', opciones.join(' | '));
  await c44.close();

  // ===== V4.1-4 · Acta de asistencia: regularización, «Cerrar asistencia» y corrección (A41-011)
  objective('V4.1-4 · El docente cierra el acta tras terminar; Dirección corrige con motivo');
  const docActa = await provisionAndActivate(admin, { firstName: 'Web', lastName: 'Acta', email: `web.acta.${TS}@univalle.edu`, role: 'TEACHER' });
  await req('PUT', `/users/${docActa.userId}/semesters`, { token: admin, body: { semesters: [3] } });
  const estActa = await estudianteListo(admin, 'acta');
  const perfilActa = (await req('GET', '/profiles/me', { token: estActa.token })).data;
  const actaAct = await req('POST', '/activities', {
    token: otros.director.token,
    body: {
      title: `Charla con acta ${TS}`, type: 'academica', categoryId: (cats41.find((c) => c.code === 'taller_academico') ?? cats41[0]).id,
      semesterScope: [3], modality: 'presencial', location: 'Aula 201', activityDate: inicio, endAt: fin, status: 'open',
      areaIds: [aBd.id], skillIds: [], responsibleUserIds: [docActa.userId],
    },
  });
  await req('POST', `/activities/${actaAct.data?.id}/register`, { token: estActa.token });
  await req('PATCH', `/activities/${actaAct.data?.id}/confirm-participation`, { token: docActa.token, body: { studentProfileId: perfilActa?.id, status: 'confirmed' } });
  await req('PATCH', `/activities/${actaAct.data?.id}`, { token: otros.director.token, body: { status: 'finished' } });

  const c45 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p45 = await c45.newPage();
  const fallos45 = [];
  p45.on('pageerror', (e) => fallos45.push(e.message));
  await entrar(p45, docActa.email);
  await p45.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  await p45.goto(`${WEB}/teacher/my-activities?actividad=${actaAct.data?.id}`);
  const botonCerrar = p45.locator('.inline-note').getByRole('button', { name: 'Cerrar asistencia' });
  await botonCerrar.waitFor({ timeout: 10000 }).catch(() => {});
  const veCerrar = await botonCerrar.count() > 0;
  const sinAusente = await p45.getByRole('button', { name: 'Marcar ausente' }).count() === 0;
  if (veCerrar) {
    await botonCerrar.click();
    await p45.getByRole('dialog').getByRole('button', { name: 'Cerrar asistencia' }).click().catch(() => {});
  }
  await p45.locator('[data-testid="acta-cerrada"]').waitFor({ timeout: 8000 }).catch(() => {});
  check(veCerrar && sinAusente && await p45.locator('[data-testid="acta-cerrada"]').count() > 0,
    'WEB.44.1 B17 B19 A41-011 Terminada la actividad, el docente ve «Cerrar asistencia», no puede marcar ausente lo consolidado y cierra el acta',
    JSON.stringify({ veCerrar, sinAusente }));
  await c45.close();

  const c46 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p46 = await c46.newPage();
  p46.on('pageerror', (e) => fallos45.push(e.message));
  await entrar(p46, otros.director.email);
  await p46.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  await p46.goto(`${WEB}/director/activities?actividad=${actaAct.data?.id}`);
  const corregirBtn = p46.getByRole('button', { name: 'Corregir' });
  await corregirBtn.first().waitFor({ timeout: 10000 }).catch(() => {});
  let corrigio = false;
  if (await corregirBtn.count()) {
    await corregirBtn.first().click();
    await p46.locator('#corr-motivo').fill('La lista firmada muestra que no asistió.');
    await p46.getByRole('button', { name: 'Aplicar corrección' }).click();
    await espera(1500);
    const filas = (await req('GET', `/activities/${actaAct.data?.id}/participants`, { token: otros.director.token })).data ?? [];
    corrigio = (Array.isArray(filas) ? filas : filas.items ?? []).some((r) => r.status === 'absent');
  }
  check(corrigio, 'WEB.44.2 B18 A41-011 Dirección corrige la participación consolidada con un motivo');
  check(fallos45.length === 0, 'WEB.44.3 Sin errores de JavaScript en V4.1-4', fallos45.join(' | '));
  await c46.close();

  // ===== V4.1-5 · Recursos: validación inline, propuesta docente, bandeja y «Para ti» (A41-014)
  objective('V4.1-5 · El docente propone recursos, Dirección los revisa y el estudiante tiene «Para ti»');
  const tituloProp = `Guía propuesta ${TS}`;
  await req('POST', '/learning-resources', {
    token: docActa.token,
    body: { title: tituloProp, provider: 'Docente de la carrera', url: `https://docs.example.org/prop/${TS}`, resourceType: 'guide', academicAreaId: aBd.id, semesterScope: [3] },
  });
  const c47 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p47 = await c47.newPage();
  const fallos47 = [];
  p47.on('pageerror', (e) => fallos47.push(e.message));
  await entrar(p47, docActa.email);
  await p47.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  const enlacesDocente = await p47.locator('nav a.nav-link').allInnerTexts();
  await p47.goto(`${WEB}/teacher/resources`);
  await p47.getByRole('heading', { name: 'Proponer recursos' }).first().waitFor({ timeout: 8000 }).catch(() => {});
  const chipsSem = await p47.locator('[aria-labelledby="lr-semestres"] button.chip').allInnerTexts();
  check(enlacesDocente.some((e) => e.includes('Proponer recursos')) && chipsSem.join() === '3º',
    'WEB.45.1 A41-014 El docente tiene «Proponer recursos» y solo ofrece sus semestres', `${chipsSem.join()} · ${enlacesDocente.join(' | ')}`);
  await p47.locator('#learning-resources-titulo').fill('123456');
  await p47.locator('#learning-resources-quien-lo-publica').fill('!!!!');
  await p47.getByRole('button', { name: /Guardar cambios|Incorporar al catálogo|Enviar propuesta/ }).last().click();
  await espera(400);
  const errTitulo = await p47.locator('#learning-resources-titulo-error').innerText().catch(() => '');
  const errProv = await p47.locator('#learning-resources-quien-lo-publica-error').innerText().catch(() => '');
  check(/palabras/.test(errTitulo) && /palabras/.test(errProv), 'WEB.45.2 B20 Título y quién publica sin palabras muestran el error debajo de cada campo', `${errTitulo} | ${errProv}`);
  await c47.close();

  const c48 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p48 = await c48.newPage();
  p48.on('pageerror', (e) => fallos47.push(e.message));
  await entrar(p48, otros.director.email);
  await p48.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  await p48.goto(`${WEB}/director/resources`);
  const filaProp = p48.locator('[data-testid="recurso-pendiente"]', { hasText: tituloProp });
  await filaProp.waitFor({ timeout: 10000 }).catch(() => {});
  const veProp = await filaProp.count() > 0;
  if (veProp) await filaProp.getByRole('button', { name: 'Aprobar' }).click();
  await espera(1200);
  const enBiblio = ((await req('GET', `/library?q=${encodeURIComponent(tituloProp)}`, { token: estActa.token })).data?.items ?? []).length;
  check(veProp && enBiblio === 1, 'WEB.45.3 §9.4 Dirección ve la propuesta en su bandeja y, al aprobarla, llega a la Biblioteca', `${veProp} · ${enBiblio}`);
  await c48.close();

  const c49 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p49 = await c49.newPage();
  p49.on('pageerror', (e) => fallos47.push(e.message));
  await entrar(p49, estActa.email);
  await p49.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  await p49.goto(`${WEB}/student/library`);
  const pedidoParaTi = p49.waitForRequest((r) => r.url().includes('/library?') && r.url().includes('forMe=true'), { timeout: 8000 }).catch(() => null);
  await p49.getByRole('tab', { name: 'Para ti' }).click();
  check(!!(await pedidoParaTi), 'WEB.45.4 B23 A41-014 La Biblioteca tiene «Para ti» (Todos / Para ti / Mis favoritos)');
  check(fallos47.length === 0, 'WEB.45.5 Sin errores de JavaScript en V4.1-5', fallos47.join(' | '));
  await c49.close();

  // ===== V4.1-7 · Gamificación: sin Retos y recompensas, propuestas y bandeja única (A41-016/017)
  objective('V4.1-7 · «Puntos de estudiantes» reemplaza «Retos y recompensas»; Dirección decide en Aprobaciones');
  const fallos50 = [];
  const c50 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p50 = await c50.newPage();
  p50.on('pageerror', (e) => fallos50.push(e.message));
  await entrar(p50, docActa.email);
  await p50.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  const navDoc = await p50.locator('nav a.nav-link').allInnerTexts();
  await p50.goto(`${WEB}/teacher/recognitions`);
  await p50.getByRole('heading', { name: 'Puntos de estudiantes' }).first().waitFor({ timeout: 8000 }).catch(() => {});
  const urlDoc = new URL(p50.url()).pathname;
  check(navDoc.some((e) => e.includes('Puntos de estudiantes')) && !navDoc.some((e) => /Retos y recompensas/.test(e)) && urlDoc === '/teacher/points',
    'WEB.46.1 A41-017 El docente ya no tiene «Retos y recompensas»: la ruta antigua lleva a «Puntos de estudiantes»', `${urlDoc} · ${navDoc.join(' | ')}`);
  await p50.getByRole('tab', { name: 'Mis propuestas' }).click();
  // V5 §10: la misma tarjeta propone por un proyecto o por un recurso completado.
  const formProp = await p50.getByText('Proponer puntos').first().waitFor({ timeout: 6000 }).then(() => true).catch(() => false)
    && await p50.getByRole('radio', { name: 'Un proyecto' }).isChecked().catch(() => false);
  check(formProp, 'WEB.46.2 §9.3 El docente propone puntos por un proyecto (no los otorga)');
  await c50.close();

  const c51 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p51 = await c51.newPage();
  p51.on('pageerror', (e) => fallos50.push(e.message));
  await entrar(p51, otros.director.email);
  await p51.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  const navDir = await p51.locator('nav a.nav-link').allInnerTexts();
  await p51.goto(`${WEB}/director/approvals`);
  await p51.getByRole('tab', { name: /Pendientes — Gamificación/ }).click({ timeout: 8000 }).catch(() => {});
  const bandejaPuntos = await p51.getByText('Propuestas de los docentes').first().waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
  check(bandejaPuntos && navDir.some((e) => e.includes('Criterios de puntos')),
    'WEB.46.3 §9.4 Aprobaciones de Dirección tiene «Pendientes — Gamificación», y Dirección configura los criterios', navDir.join(' | '));
  await c51.close();

  const c52 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p52 = await c52.newPage();
  p52.on('pageerror', (e) => fallos50.push(e.message));
  await entrar(p52, estActa.email);
  await p52.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  await p52.goto(`${WEB}/student/progress`);
  await p52.getByRole('tab', { name: 'Mi trayectoria' }).first().waitFor({ timeout: 8000 }).catch(() => {});
  const pestanasProgreso = await p52.getByRole('tab').allInnerTexts();
  check(pestanasProgreso.length > 0 && !pestanasProgreso.some((t) => /Recompensas/.test(t)), 'WEB.46.4 A41-017 El estudiante ya no tiene la pestaña «Recompensas»', pestanasProgreso.join(' | '));
  check(fallos50.length === 0, 'WEB.46.5 Sin errores de JavaScript en V4.1-7', fallos50.join(' | '));
  await c52.close();

  // ===== V4.1-8 · Credenciales: la revisión exige prueba externa (A41-018, B32)
  objective('V4.1-8 · Revisión de credenciales con método y prueba externa; Administración como excepción');
  const fallos53 = [];
  const c53 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p53 = await c53.newPage();
  p53.on('pageerror', (e) => fallos53.push(e.message));
  await entrar(p53, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
  await p53.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  const navAdmin = await p53.locator('nav a.nav-link').allInnerTexts();
  await p53.goto(`${WEB}/admin/credential-reviews`);
  await p53.getByRole('heading', { name: 'Revisión de credenciales' }).first().waitFor({ timeout: 8000 }).catch(() => {});
  const textoRevision = await p53.locator('.content').first().innerText().catch(() => '');
  check(navAdmin.some((e) => e.includes('Revisión de credenciales')) && /prueba externa independiente/.test(textoRevision),
    'WEB.47.1 A41-018 Administración tiene la revisión como excepción y la página exige prueba externa independiente', navAdmin.join(' | '));
  const revisar = p53.getByRole('button', { name: 'Revisar' }).first();
  if (await revisar.count()) {
    await revisar.click();
    await p53.locator('select[id^="metodo-"]').first().selectOption('document_only');
    await p53.locator('textarea[id^="motivo-"]').first().fill('El documento parece auténtico y tiene el logo del emisor.');
    const bloqueado = await p53.getByRole('button', { name: 'Verificada con prueba externa' }).first().isDisabled();
    check(bloqueado, 'WEB.47.2 B32 «Solo revisé el documento» no permite marcarla como verificada');
  } else {
    check(true, 'WEB.47.2 B32 (sin pendientes: la regla se cubre en e2e-v4-1 batch8)');
  }
  check(fallos53.length === 0, 'WEB.47.3 Sin errores de JavaScript en V4.1-8', fallos53.join(' | '));
  await c53.close();

  // ===== V4.1-9 · Proyectos: el dueño edita título y repositorio desde la web (A41-019, B33)
  objective('V4.1-9 · Editar un proyecto (también el repositorio) desde su tarjeta');
  const fallos54 = [];
  const estProy = await estudianteListo(admin, 'proyedit');
  const borradorWeb = await req('POST', '/projects', { token: estProy.token, body: { title: `Borrador web ${TS}`, status: 'draft' } });
  const c54 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p54 = await c54.newPage();
  p54.on('pageerror', (e) => fallos54.push(e.message));
  await entrar(p54, estProy.email);
  await p54.goto(`${WEB}/student/projects`);
  await p54.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  await p54.getByRole('button', { name: 'Editar proyecto' }).first().click({ timeout: 8000 });
  const encabezado = await p54.getByText(`Editar «Borrador web ${TS}»`).first().isVisible().catch(() => false);
  await p54.fill('#pr-titulo', `Borrador web editado ${TS}`);
  await p54.fill('#pr-repo', `https://github.com/afinia-pruebas/web-edit-${TS}`);
  await p54.getByRole('button', { name: 'Guardar cambios' }).click();
  await espera(1500);
  const guardado = (await req('GET', `/projects/${borradorWeb.data?.id}`, { token: estProy.token })).data;
  check(encabezado && guardado?.title === `Borrador web editado ${TS}` && guardado?.repositoryUrl?.includes(`web-edit-${TS}`),
    'WEB.48.1 B33 §10.3 El dueño edita título y repositorio desde la tarjeta y se guardan', JSON.stringify({ e: encabezado, t: guardado?.title }));
  check(fallos54.length === 0, 'WEB.48.2 Sin errores de JavaScript en V4.1-9', fallos54.join(' | '));
  await c54.close();

  // ===== V4.1-10 · Sugerencias de GitHub con procedencia (A41-020, B34)
  objective('V4.1-10 · La validación técnica muestra señales como sugerencias, con por qué');
  const fallos55 = [];
  await asegurarGithubSimulado();
  const estGh = await estudianteListo(admin, 'github');
  const catGh = ((await req('GET', '/skills', { token: estGh.token })).data ?? []).filter((s) => s.isActive !== false && s.academicAreaId);
  const reactGh = catGh.find((s) => s.name === 'React');
  await req('POST', '/projects', {
    token: estGh.token,
    body: { title: `Turnos web ${TS}`, areaIds: [reactGh.academicAreaId], skillIds: [reactGh.id], repositoryUrl: `https://github.com/afinia-pruebas/py-web-${TS}`, status: 'draft' },
  });
  const c55 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p55 = await c55.newPage();
  p55.on('pageerror', (e) => fallos55.push(e.message));
  await entrar(p55, estGh.email);
  await p55.goto(`${WEB}/student/projects`);
  await p55.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  await p55.getByRole('button', { name: /Validación técnica/ }).first().click({ timeout: 8000 });
  const panel = p55.locator('[data-testid="sugerencias-github"]');
  await panel.waitFor({ timeout: 8000 }).catch(() => {});
  const textoPanel = await panel.innerText().catch(() => '');
  check(/requirements\.txt/.test(textoPanel) && /no prueba que la usaste/.test(textoPanel) && (await p55.getByRole('button', { name: 'La usé' }).count()) > 0,
    'WEB.49.1 B34 §11.2 Las señales aparecen como sugerencias con su procedencia y se aceptan a mano', textoPanel.slice(0, 160));
  check(fallos55.length === 0, 'WEB.49.2 Sin errores de JavaScript en V4.1-10', fallos55.join(' | '));
  await c55.close();

  // ===== V4.1-11 · Equipo con búsqueda, candidatos y exclusión con motivo (A41-022, A41-023)
  objective('V4.1-11 · Elegir equipo con búsqueda, ver sus miembros como candidatos y excluir con motivo');
  const fallos56 = [];
  const lider = await estudianteListo(admin, 'liderequipo');
  const companeros = [await estudianteListo(admin, 'companeraa'), await estudianteListo(admin, 'companerob')];
  const perfilDe = async (t) => (await req('GET', '/profiles/me', { token: t })).data?.id;
  const necesidad = (await req('POST', '/team-needs', { token: lider.token, body: { purpose: `Equipo web ${TS}`, maxMembers: 4 } })).data;
  const nombreEquipo = `Equipo Web ${String(TS).slice(-6).split('').map((d) => String.fromCharCode(65 + Number(d))).join('')}`;
  const equipoWeb = (await req('POST', `/team-needs/${necesidad.id}/team`, { token: lider.token, body: { name: nombreEquipo } })).data;
  for (const c of companeros) {
    const inv = (await req('POST', `/teams/${equipoWeb.id}/invitations`, { token: lider.token, body: { invitedProfileId: await perfilDe(c.token) } })).data;
    await req('PATCH', `/teams/invitations/${inv.id}`, { token: c.token, body: { decision: 'accept' } });
  }
  const c56 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p56 = await c56.newPage();
  p56.on('pageerror', (e) => fallos56.push(e.message));
  await entrar(p56, lider.email);
  await p56.goto(`${WEB}/student/projects`);
  await p56.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  // V5-28: el origen de los colaboradores se elige primero (Individual / Equipo / Contactos).
  await p56.getByRole('radio', { name: 'De un equipo' }).click({ timeout: 8000 });
  await p56.locator('#pr-equipo-buscar').waitFor({ timeout: 8000 });
  await espera(1000);
  await p56.locator('#pr-equipo-buscar').fill(nombreEquipo);
  await p56.locator('#pr-equipo-opciones button').first().click({ timeout: 8000 });
  const candidatos = p56.locator('[data-testid="candidatos-equipo"] li');
  await candidatos.first().waitFor({ timeout: 6000 }).catch(() => {});
  const nCandidatos = await candidatos.count();
  await candidatos.first().locator('input[type=checkbox]').uncheck();
  const pideMotivo = await p56.locator('[data-testid="candidatos-equipo"] input[aria-label^="Motivo para no incluir"]').count();
  check(nCandidatos === 2 && pideMotivo === 1,
    'WEB.50.1 A41-022 23.8 El equipo se elige con búsqueda, sus miembros aparecen como candidatos y quitar a uno pide motivo', `candidatos ${nCandidatos} · motivo ${pideMotivo}`);
  check(fallos56.length === 0, 'WEB.50.2 Sin errores de JavaScript en V4.1-11', fallos56.join(' | '));
  await c56.close();

  // ===== V4.1-12 · Evidencias en pestañas, QR en Mi perfil, Colaboración agrupada, visibilidad clara (A41-024..026)
  objective('V4.1-12 · Pestañas de evidencias, QR en Mi perfil → Visibilidad y ayudas de visibilidad');
  const fallos57 = [];
  const estPriv = await estudianteListo(admin, 'privacidad');
  const c57 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p57 = await c57.newPage();
  p57.on('pageerror', (e) => fallos57.push(e.message));
  await entrar(p57, estPriv.email);
  await p57.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  const navEst = await p57.locator('nav a.nav-link').allInnerTexts();
  await p57.goto(`${WEB}/student/evidences`);
  await p57.getByRole('tab', { name: /Credenciales externas/ }).first().waitFor({ timeout: 8000 }).catch(() => {});
  const pestanasEv = await p57.getByRole('tab').allInnerTexts();
  const tieneValidacion = await p57.getByText('Mis credenciales y su validación').first().isVisible().catch(() => false);
  check(['Evidencias de proyectos', 'Credenciales externas', 'Constancias y certificados institucionales recibidos'].every((t) => pestanasEv.some((x) => x.includes(t))) && tieneValidacion,
    'WEB.51.1 A41-025 §15 Evidencias en tres pestañas sobre los mismos datos', pestanasEv.join(' | '));
  await p57.goto(`${WEB}/student/profile?tab=visibilidad`);
  const qrPerfil = await p57.locator('.qr-lienzo svg').first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  await p57.goto(`${WEB}/student/collaboration`);
  const enlaceRapido = p57.locator('[data-testid="acceso-rapido-qr"] a[href="/student/profile?tab=visibilidad"]');
  await enlaceRapido.first().waitFor({ timeout: 8000 }).catch(() => {});
  const accesoRapido = await enlaceRapido.count();
  check(qrPerfil && accesoRapido === 1 && navEst.some((t) => t.includes('Contactos')) && navEst.some((t) => t.includes('Equipos')),
    'WEB.51.2 A41-026 §16 El QR vive en Mi perfil → Visibilidad; Colaboración da un acceso rápido; Contactos y Equipos agrupados', `${qrPerfil} · ${accesoRapido} · ${navEst.join(' | ')}`);
  await p57.goto(`${WEB}/student/projects`);
  const ayudaVis = await p57.locator('[data-testid="ayuda-visibilidad"]').innerText({ timeout: 8000 }).catch(() => '');
  check(/no tu repositorio/.test(ayudaVis) && /borrador nunca se publica/.test(ayudaVis),
    'WEB.51.3 A41-024 §14 La visibilidad explica que es del registro en Afinia, no de GitHub, y que un borrador no se publica', ayudaVis.slice(0, 160));
  check(fallos57.length === 0, 'WEB.51.4 Sin errores de JavaScript en V4.1-12', fallos57.join(' | '));
  await c57.close();

  // ===== V4.1-13 · Currículo: nada entra solo (A41-029, §17.4)
  objective('V4.1-13 · El currículo lista lo elegible sin marcar nada por omisión');
  const fallos58 = [];
  const c58 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p58 = await c58.newPage();
  p58.on('pageerror', (e) => fallos58.push(e.message));
  await entrar(p58, estActa.email);
  await p58.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  await p58.goto(`${WEB}/student/progress?tab=resumen`);
  await p58.getByText('Paso 2 · Qué ítems de cada sección').first().waitFor({ timeout: 8000 }).catch(() => {});
  await espera(800);
  const paso2 = p58.locator('.card', { hasText: 'Paso 2 · Qué ítems de cada sección' }).first();
  const casillas = paso2.locator('input[type=checkbox]');
  const total = await casillas.count();
  let marcadas = 0;
  for (let i = 0; i < total; i += 1) if (await casillas.nth(i).isChecked()) marcadas += 1;
  const textoPaso2 = await paso2.innerText().catch(() => '');
  check(marcadas === 0 && /nada entra solo/.test(textoPaso2),
    'WEB.52.1 A41-029 §17.4 Ningún ítem viene marcado: el estudiante elige qué entra al currículo', `marcadas ${marcadas} de ${total}`);
  check(fallos58.length === 0, 'WEB.52.2 Sin errores de JavaScript en V4.1-13', fallos58.join(' | '));
  await c58.close();

  const val = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const pv = await val.newPage();
  const estVal = await estudianteListo(admin, 'val');
  await entrar(pv, estVal.email);
  await pv.goto(`${WEB}/student/projects`);
  // El tutorial de primera visita se cierra como lo haría la persona.
  await pv.getByRole('button', { name: 'Omitir' }).click({ timeout: 4000 }).catch(() => {});
  await pv.getByRole('button', { name: 'Guardar borrador' }).waitFor({ timeout: 8000 });
  let nativo = false;
  pv.on('dialog', () => { nativo = true; });
  await pv.getByRole('button', { name: 'Guardar borrador' }).click();
  await espera(300);
  const errorTitulo = await pv.locator('#pr-titulo + .field-error').textContent().catch(() => null);
  const foco = await pv.evaluate(() => document.activeElement?.id);
  check(!!errorTitulo && errorTitulo.includes('Completa «Título»') && foco === 'pr-titulo' && !nativo,
    'WEB.23 V3 §67 El error aparece debajo del campo, con su nombre, y el foco va a él', `${errorTitulo} · foco ${foco}`);
  await pv.fill('#pr-titulo', 'Plataforma de prueba');
  check(await pv.locator('#pr-titulo + .field-error').count() === 0 && await pv.locator('#pr-titulo[aria-invalid=true]').count() === 0,
    'WEB.24 V3 §67 Al corregirlo, el error se va solo');
  const sinAsociar = await pv.evaluate(() => Array.from(document.querySelectorAll('label'))
    .filter((l) => !l.htmlFor && !l.querySelector('input,select,textarea')).map((l) => l.textContent?.trim()));
  check(sinAsociar.length === 0, 'WEB.25 V3 B21 Cada etiqueta del formulario está asociada a su campo', sinAsociar.join(' | '));
  await val.close();
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
