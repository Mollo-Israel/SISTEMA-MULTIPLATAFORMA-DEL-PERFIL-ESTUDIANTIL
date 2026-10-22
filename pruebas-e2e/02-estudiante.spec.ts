import { expect, test } from '@playwright/test';
import { CUENTAS, asegurarBienvenida, captura, entrar, visitar, vigilarErrores } from './ayuda';

test.describe('Estudiante: perfil, actividades, proyectos, evidencias, afinidad y recomendaciones', () => {
  test('primera vez: el estudiante llega a la bienvenida (onboarding) antes que al resto', async ({ page }, info) => {
    await entrar(page, CUENTAS.estudiante);
    await page.goto('/student/profile');
    await page.waitForTimeout(1500);
    await captura(page, info, '02-00-bienvenida-onboarding');
    await asegurarBienvenida(CUENTAS.estudiante);
  });


  test('recorrido completo del estudiante', async ({ page }, info) => {
    await asegurarBienvenida(CUENTAS.estudiante);
    await entrar(page, CUENTAS.estudiante);
    const errores = vigilarErrores(page);
    await visitar(page, info, '/student/profile', /Mi perfil/, '02-01-perfil');
    await visitar(page, info, '/student/profile?tab=visibilidad', /Mi perfil/, '02-02-perfil-visibilidad-qr');
    await visitar(page, info, '/student/activities', /Actividades/, '02-03-actividades');
    await visitar(page, info, '/student/projects', /Proyectos/, '02-04-proyectos');
    await visitar(page, info, '/student/evidences', /Evidencias/, '02-05-evidencias-credenciales');
    await page.getByRole('tab', { name: /Constancias/ }).first().click();
    await captura(page, info, '02-06-evidencias-constancias');
    await visitar(page, info, '/student/affinity', /afinidad/i, '02-07-afinidad');
    await visitar(page, info, '/student/recommendations', /sugerencias/i, '02-08-recomendaciones');
    await visitar(page, info, '/student/library', /Biblioteca/, '02-09-biblioteca');
    await visitar(page, info, '/student/progress', /progreso/i, '02-10-trayectoria');
    await visitar(page, info, '/student/progress?tab=progreso', /progreso/i, '02-11-puntos');
    await visitar(page, info, '/student/progress?tab=resumen', /progreso/i, '02-12-curriculo');
    await visitar(page, info, '/student/collaboration?tab=equipos', /Colaboración/, '02-13-colaboracion-equipos');
    expect(errores).toEqual([]);
  });
});
