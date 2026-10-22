/**
 * Fotografía los reportes HTML de cada herramienta para el capítulo de
 * control de calidad (Investigación §6). Navegador sin ventana: no interfiere
 * con lo que el usuario esté haciendo.
 *
 *   node scripts/pruebas/capturar-reportes.mjs
 *
 * Las capturas quedan en la carpeta de cada herramienta (capturas/).
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RAIZ } from './entorno.mjs';

const P = join(RAIZ, 'pruebas');
const archivo = (...r) => pathToFileURL(join(P, ...r)).href;
// SonarQube local: la credencial la deja scripts/pruebas/sonar.mjs (ignorada por git).
const CRED = join(P, '07-sonarqube', '.credenciales-local.json');
const sonar = existsSync(CRED) ? { url: 'http://localhost:9100', ...JSON.parse(readFileSync(CRED, 'utf8')) } : null;

/** [carpeta destino, nombre, url, opciones] */
const objetivos = [
  ['02-jest-supertest', '01-reporte-jest', archivo('02-jest-supertest', 'reporte', 'reporte-jest.html'), { esperar: 2500 }],
  ['02-jest-supertest', '02-cobertura-resumen', archivo('02-jest-supertest', 'cobertura', 'index.html')],
  ['03-playwright', '00-reporte-playwright', archivo('03-playwright', 'reporte', 'index.html'), { esperar: 2500 }],
  ['04-postman-newman', '01-reporte-newman', archivo('04-postman-newman', 'reporte-newman.html'), { esperar: 1500 }],
  ['05-k6', '01-corrida-1-fallo', archivo('05-k6', 'corrida-1-fallo', 'reporte-k6.html'), { esperar: 4000 }],
  ['05-k6', '02-corrida-2-correccion', archivo('05-k6', 'corrida-2-correccion', 'reporte-k6.html'), { esperar: 4000 }],
  ['05-k6', '03-corrida-3-final', archivo('05-k6', 'corrida-3-final', 'reporte-k6.html'), { esperar: 4000 }],
  ['06-zap', '01-reporte-zap', archivo('06-zap', 'reporte-zap.html')],
  ['07-sonarqube', '01-panel-sonarqube', sonar && `${sonar.url}/dashboard?id=afinia`, { esperar: 6000, login: true }],
  ['07-sonarqube', '03-medidas-cobertura', sonar && `${sonar.url}/component_measures?id=afinia&metric=coverage&view=list`, { esperar: 6000, login: true }],
  ['07-sonarqube', '02-issues-sonarqube', sonar && `${sonar.url}/project/issues?id=afinia&issueStatuses=OPEN%2CCONFIRMED&types=BUG%2CVULNERABILITY`, { esperar: 6000, login: true }],
];

const navegador = await chromium.launch({ headless: true });
const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-BO' });
const page = await ctx.newPage();
let sonarIniciado = false;

for (const [carpeta, nombre, url, opc = {}] of objetivos) {
  if (!url) { console.log(`– ${nombre}: sin URL (omitido)`); continue; }
  if (url.startsWith('file:') && !existsSync(new URL(url))) { console.log(`– ${nombre}: el reporte no existe todavía`); continue; }
  if (opc.login && !sonarIniciado) {
    await page.goto(`${sonar.url}/sessions/new`);
    await page.fill('input[name=login], #login-input', sonar.user);
    await page.fill('input[name=password], #password-input', sonar.password);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    sonarIniciado = true;
  }
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(opc.esperar ?? 1000);
  const dir = join(P, carpeta, 'capturas');
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${nombre}.png`), fullPage: true });
  console.log(`✓ ${carpeta}/capturas/${nombre}.png`);
}
await navegador.close();
