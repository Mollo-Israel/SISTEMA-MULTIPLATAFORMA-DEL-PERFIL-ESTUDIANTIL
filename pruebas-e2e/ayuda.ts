import { expect, Page, TestInfo } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Valor de la raíz `.env` (la contraseña del administrador nunca va en el código). */
function deEnv(clave: string): string {
  const ruta = '.env'; // Playwright corre desde la raíz del proyecto
  if (!existsSync(ruta)) return '';
  const linea = readFileSync(ruta, 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${clave}=`));
  return linea ? linea.slice(clave.length + 1).trim().replace(/^["']|["']$/g, '') : '';
}

export const CLAVE = 'Univalle2026*';
export const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? 'admin@univalle.edu',
  password: process.env.ADMIN_PASSWORD ?? deEnv('ADMIN_PASSWORD'),
};
export const CUENTAS = {
  estudiante: 'ana.quispe@est.univalle.edu',
  docente: 'carlos.perez@univalle.edu',
  director: 'jorge.vargas@univalle.edu',
  sociedad: 'lucia.fernandez@univalle.edu',
};

/** Captura numerada del paso, por navegador: pruebas/03-playwright/capturas/<navegador>/<archivo>.png */
export async function captura(page: Page, info: TestInfo, nombre: string) {
  const dir = join('pruebas', '03-playwright', 'capturas', info.project.name);
  mkdirSync(dir, { recursive: true });
  // Que terminen las cargas y las animaciones antes de fotografiar.
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(600);
  const ruta = join(dir, `${nombre}.png`);
  await page.screenshot({ path: ruta, fullPage: true });
  await info.attach(nombre, { path: ruta, contentType: 'image/png' });
}

/** Errores de JavaScript de la página: una prueba no pasa si la página falla por dentro. */
export function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  return errores;
}

export async function entrar(page: Page, email: string, password = CLAVE) {
  await page.goto('/login');
  await page.fill('input[type=email]', email);
  await page.fill('input[autocomplete=current-password]', password);
  await page.press('input[autocomplete=current-password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
  await cerrarTutorial(page);
}

/** El tutorial de primera visita se cierra como lo haría una persona. */
export async function cerrarTutorial(page: Page) {
  await page.getByRole('button', { name: 'Omitir' }).click({ timeout: 3000 }).catch(() => {});
}

/** Abre una pantalla, comprueba su título y la fotografía. */
export async function visitar(page: Page, info: TestInfo, ruta: string, titulo: RegExp | string, nombre: string) {
  await page.goto(ruta);
  await cerrarTutorial(page);
  await expect(page.getByRole('heading', { level: 1, name: titulo }).first()).toBeVisible({ timeout: 15_000 });
  await captura(page, info, nombre);
}

const API = process.env.API_URL ?? 'http://localhost:3020/api';

/**
 * Completa la bienvenida del estudiante por API (como `estudianteListo` en
 * scripts/e2e-web.mjs). Es idempotente: si ya estaba completa, no cambia nada.
 */
export async function asegurarBienvenida(email: string, password = CLAVE) {
  const json = async (metodo: string, ruta: string, token?: string, body?: unknown) => {
    const r = await fetch(`${API}${ruta}`, {
      method: metodo,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  const login = await json('POST', '/auth/login', undefined, { email, password });
  const t = login.data?.accessToken as string;
  const estado = await json('GET', '/profiles/me/onboarding', t);
  if (estado.data?.completed) return;
  await json('POST', '/profiles/me/onboarding/institutional-confirmation', t, {});
  const skills = ((await json('GET', '/skills', t)).data ?? []).filter((s: { isActive?: boolean }) => s.isActive !== false);
  await json('PUT', '/profiles/me/skill-interests', t, { items: [{ skillId: skills[0].id, kind: 'interest' }] });
  await json('PATCH', '/profiles/me', t, { availability: 'open' });
  await json('POST', '/profiles/me/onboarding/privacy', t, { peerDiscoverable: true, publicProfileEnabled: true });
  await json('POST', '/profiles/me/onboarding/complete', t);
}
