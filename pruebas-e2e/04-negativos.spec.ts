import { expect, test } from '@playwright/test';
import { CUENTAS, captura, entrar } from './ayuda';

test.describe('Casos negativos de acceso', () => {
  test('sin sesión, una ruta privada lleva al inicio de sesión', async ({ page }, info) => {
    await page.goto('/student/projects');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await captura(page, info, '04-01-sin-sesion-redirige-login');
  });

  test('un estudiante no entra a la administración', async ({ page }, info) => {
    await entrar(page, CUENTAS.estudiante);
    await page.goto('/admin/users');
    await page.waitForTimeout(1200);
    await expect(page).not.toHaveURL(/\/admin\/users/);
    await captura(page, info, '04-02-estudiante-sin-acceso-admin');
  });

  test('un docente no entra a las aprobaciones de Dirección', async ({ page }, info) => {
    await entrar(page, CUENTAS.docente);
    await page.goto('/director/approvals');
    await page.waitForTimeout(1200);
    await expect(page).not.toHaveURL(/\/director\/approvals/);
    await captura(page, info, '04-03-docente-sin-acceso-direccion');
  });
});
