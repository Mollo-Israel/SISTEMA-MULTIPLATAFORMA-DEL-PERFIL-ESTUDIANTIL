/**
 * Playwright Test — E2E web en Chromium, Firefox y WebKit (Investigación §3.3).
 *
 * Corre contra el entorno aislado (scripts/pruebas/entorno.mjs): web en :5180 y
 * API en :3020 sobre la base afinia_test. Las capturas de cada paso quedan en
 * pruebas/03-playwright/capturas/<navegador>/ y el reporte HTML en
 * pruebas/03-playwright/reporte.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './pruebas-e2e',
  outputDir: './pruebas/03-playwright/resultados',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [
    ['list'],
    ['html', { outputFolder: './pruebas/03-playwright/reporte', open: 'never' }],
    ['json', { outputFile: './pruebas/03-playwright/resultados.json' }],
  ],
  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:5180',
    headless: true,
    viewport: { width: 1366, height: 860 },
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1366, height: 860 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1366, height: 860 } } },
  ],
});
