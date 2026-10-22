import { expect, test } from '@playwright/test';
import { CLAVE, CUENTAS, captura, entrar, vigilarErrores } from './ayuda';

test.describe('Acceso: inicio de sesión y recuperación', () => {
  test('pantalla de inicio de sesión', async ({ page }, info) => {
    await page.goto('/login');
    await expect(page.locator('input[type=email]')).toBeVisible();
    await captura(page, info, '01-01-login');
  });

  test('contraseña incorrecta: mensaje genérico, sin entrar', async ({ page }, info) => {
    await page.goto('/login');
    await page.fill('input[type=email]', CUENTAS.estudiante);
    await page.fill('input[autocomplete=current-password]', 'Incorrecta2026*');
    await page.press('input[autocomplete=current-password]', 'Enter');
    await expect(page).toHaveURL(/\/login/);
    await page.waitForTimeout(800);
    await captura(page, info, '01-02-login-error');
  });

  test('recuperar contraseña: respuesta que no revela si la cuenta existe', async ({ page }, info) => {
    await page.goto('/recuperar');
    await captura(page, info, '01-03-recuperar-formulario');
    await page.fill('input[type=email]', 'nadie.existe@est.univalle.edu');
    await page.press('input[type=email]', 'Enter');
    await page.waitForTimeout(1200);
    await captura(page, info, '01-04-recuperar-respuesta');
  });

  test('inicio de sesión correcto lleva al panel del estudiante', async ({ page }, info) => {
    const errores = vigilarErrores(page);
    await entrar(page, CUENTAS.estudiante, CLAVE);
    await expect(page).toHaveURL(/\/student/);
    await captura(page, info, '01-05-estudiante-inicio');
    expect(errores).toEqual([]);
  });
});
