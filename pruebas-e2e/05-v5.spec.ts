import { expect, test } from '@playwright/test';
import { ADMIN, CUENTAS, captura, entrar, visitar, vigilarErrores } from './ayuda';

/**
 * Cierre V5: las pantallas nuevas y los flujos que cambiaron, por rol, en los
 * tres navegadores. Solo se lee y se prueba la interfaz: nada se publica ni se
 * concede, para que la base de pruebas quede igual.
 */
test.describe('V5: pantallas nuevas y flujos que cambiaron', () => {
  test('estudiante: proyectos de la carrera, alta guiada por repositorio e imágenes', async ({ page }, info) => {
    const errores = vigilarErrores(page);
    await entrar(page, CUENTAS.estudiante);
    await visitar(page, info, '/proyectos', /Proyectos de la carrera/, '05-01-estudiante-proyectos-carrera');
    await expect(page.getByLabel('Filtrar por área')).toBeVisible();

    await page.goto('/student/projects');
    // El repositorio es la primera sección del alta y analizarlo es opcional.
    await expect(page.getByRole('button', { name: 'Analizar repositorio' })).toBeVisible();
    await page.getByRole('button', { name: 'Analizar repositorio' }).click();
    await expect(page.getByText('Escribe primero el enlace del repositorio.')).toBeVisible();
    await page.fill('#pr-repo', 'https://github.com/afinia-pruebas/proyecto-de-prueba');
    await page.getByRole('button', { name: 'Analizar repositorio' }).click();
    // Sin GitHub disponible el análisis no bloquea: queda un estado legible.
    await page.waitForTimeout(2500);
    await captura(page, info, '05-02-estudiante-analizar-repositorio');
    const visibilidad = (await page.locator('#pr-visibilidad option').allTextContents()).join(' | ');
    expect(visibilidad).toContain('Toda la comunidad Afinia');
    expect(visibilidad).not.toContain('Además');

    const botonImagenes = page.getByRole('button', { name: 'Imágenes del proyecto' }).first();
    if (await botonImagenes.isVisible().catch(() => false)) {
      await botonImagenes.click();
      await captura(page, info, '05-03-estudiante-imagenes-proyecto');
    }
    expect(errores).toEqual([]);
  });

  test('estudiante: biblioteca con material y resumen con su aviso', async ({ page }, info) => {
    const errores = vigilarErrores(page);
    await entrar(page, CUENTAS.estudiante);
    await visitar(page, info, '/student/library', /Biblioteca/, '05-04-estudiante-biblioteca');
    await page.goto('/student/progress?tab=resumen');
    await page.waitForTimeout(1500);
    await captura(page, info, '05-05-estudiante-resumen-trayectoria');
    expect(errores).toEqual([]);
  });

  test('docente: proponer puntos por proyecto o recurso completado', async ({ page }, info) => {
    const errores = vigilarErrores(page);
    await entrar(page, CUENTAS.docente);
    await page.goto('/teacher/points?tab=propuestas');
    await expect(page.getByRole('radio', { name: 'Un proyecto' })).toBeChecked();
    await page.getByRole('radio', { name: 'Un recurso completado' }).check();
    await expect(page.getByText('Abrirlo, descargarlo o guardarlo en favoritos no cuenta.', { exact: false })).toBeVisible();
    await captura(page, info, '05-06-docente-recurso-completado');
    await visitar(page, info, '/teacher/resources', /recursos/i, '05-07-docente-recursos');
    expect(errores).toEqual([]);
  });

  test('dirección: autonomía docente, recursos por semestre e historial de puntos', async ({ page }, info) => {
    const errores = vigilarErrores(page);
    await entrar(page, CUENTAS.director);
    await visitar(page, info, '/director/autonomy', /Autonomía docente/, '05-08-direccion-autonomia');
    await expect(page.getByRole('option', { name: /Publicar actividades/ })).toBeDisabled();

    await page.goto('/director/resources');
    await page.getByRole('radio', { name: 'Semestres específicos' }).check();
    await expect(page.getByRole('group', { name: 'Semestres' })).toBeVisible();
    await expect(page.getByLabel('Archivo (PDF o imagen)')).toBeAttached();
    await captura(page, info, '05-09-direccion-recurso-alcance');

    await page.goto('/director/points');
    const verHistorial = page.getByRole('button', { name: /Ver historial de/ }).first();
    if (await verHistorial.isVisible({ timeout: 8000 }).catch(() => false)) {
      await verHistorial.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.waitForTimeout(800);
      await captura(page, info, '05-10-direccion-historial-puntos');
    }
    expect(errores).toEqual([]);
  });

  test('administración: la autonomía docente es de Dirección', async ({ page }, info) => {
    const errores = vigilarErrores(page);
    await entrar(page, ADMIN.email, ADMIN.password);
    await visitar(page, info, '/proyectos', /Proyectos de la carrera/, '05-11-admin-proyectos-carrera');
    // Administración no tiene la pantalla de conceder: esa autoridad es académica.
    const enMenu = await page.locator('nav a[href="/director/autonomy"]').count();
    expect(enMenu).toBe(0);
    expect(errores).toEqual([]);
  });
});
