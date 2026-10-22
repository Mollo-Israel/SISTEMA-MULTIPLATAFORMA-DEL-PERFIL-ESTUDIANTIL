import { expect, test } from '@playwright/test';
import { ADMIN, CUENTAS, captura, entrar, visitar, vigilarErrores } from './ayuda';

test.describe('Paneles del personal según sus permisos', () => {
  test('docente: panel académico, estudiantes de su alcance, actividades y puntos', async ({ page }, info) => {
    const errores = vigilarErrores(page);
    await entrar(page, CUENTAS.docente);
    await visitar(page, info, '/teacher', /Panel|Inicio/, '03-01-docente-panel');
    await visitar(page, info, '/teacher?tab=estudiantes', /Panel|Inicio/, '03-02-docente-estudiantes-alcance');
    await visitar(page, info, '/teacher/my-activities', /Mis actividades/, '03-03-docente-mis-actividades');
    await visitar(page, info, '/teacher/points', /Puntos de estudiantes/, '03-04-docente-puntos');
    expect(errores).toEqual([]);
  });

  test('dirección: aprobaciones, actividades, credenciales y analítica', async ({ page }, info) => {
    const errores = vigilarErrores(page);
    await entrar(page, CUENTAS.director);
    await visitar(page, info, '/director', /Inicio/, '03-05-direccion-inicio');
    await visitar(page, info, '/director/approvals', /Aprobaciones/, '03-06-direccion-aprobaciones');
    await visitar(page, info, '/director/activities', /Actividades/, '03-07-direccion-actividades');
    await visitar(page, info, '/director/credential-reviews', /Revisión de credenciales/, '03-08-direccion-credenciales');
    await visitar(page, info, '/director/analytics', /Analítica/, '03-09-direccion-analitica');
    expect(errores).toEqual([]);
  });

  test('sociedad científica: inicio, actividades y participantes', async ({ page }, info) => {
    const errores = vigilarErrores(page);
    await entrar(page, CUENTAS.sociedad);
    await visitar(page, info, '/society', /Inicio/, '03-10-sociedad-inicio');
    await visitar(page, info, '/society/activities', /actividades/i, '03-11-sociedad-actividades');
    await visitar(page, info, '/society/participants', /Participantes/, '03-12-sociedad-participantes');
    expect(errores).toEqual([]);
  });

  test('administración: usuarios, importación con previsualización, criterios y auditoría', async ({ page }, info) => {
    const errores = vigilarErrores(page);
    await entrar(page, ADMIN.email, ADMIN.password);
    await visitar(page, info, '/admin/users', /usuarios/i, '03-13-admin-usuarios');
    await visitar(page, info, '/admin/imports', /Importar padrón/, '03-14-admin-importar');
    // Padrón con una fila nueva, una actualización y una inválida. Solo se previsualiza: no se aplica.
    const csv = [
      'university_code,first_name,last_name,institutional_email,semester',
      'EST-9PRUEBA,Nadia,Prueba Web,nadia.pruebaweb@est.univalle.edu,3',
      'EST-38DJ1HB,Luis,Mamani,luis.mamani@est.univalle.edu,4',
      'EST-0000001,Correo,Invalido,no-es-un-correo,2',
    ].join('\n');
    await page.locator('input[type=file]').setInputFiles({ name: 'padron-prueba.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await expect(page.getByText(/Previsualización/).first()).toBeVisible({ timeout: 15_000 });
    await captura(page, info, '03-15-admin-importar-previsualizacion');
    await page.getByRole('button', { name: 'Descartar' }).click();
    await visitar(page, info, '/admin/gamification', /Puntos y reconocimientos/, '03-16-admin-criterios-puntos');
    await visitar(page, info, '/admin/audit', /Auditoría/, '03-17-admin-auditoria');
    expect(errores).toEqual([]);
  });
});
