/**
 * Capítulo III, §3.2.3 — Integración API + PostgreSQL.
 * Casos PI-AFI-01 a PI-AFI-05 del documento de grado. La cuenta usada es la de
 * Administración del entorno de pruebas; su contraseña se lee del .env y no se
 * escribe en el código ni en la salida.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ADMIN, crearApp, db } from '../app';

describe('Integración API + PostgreSQL', () => {
  let app: INestApplication;
  let base: DataSource;

  beforeAll(async () => {
    if (!ADMIN.password) throw new Error('Falta ADMIN_PASSWORD en el .env del entorno de pruebas.');
    app = await crearApp();
    base = db(app);
    const [usuario] = await base.query('SELECT id FROM users WHERE email = $1', [ADMIN.email]);
    if (!usuario) throw new Error('La cuenta de Administración no existe en afinia_test.');
    // Punto de partida conocido: sin sesiones previas de esta cuenta.
    await base.query('DELETE FROM auth_sessions WHERE user_id = $1', [usuario.id]);
  });

  afterAll(async () => { await app.close(); });

  it('PI-AFI-01: utiliza exclusivamente la base de datos afinia_test', async () => {
    const [fila] = await base.query('SELECT current_database() AS base');
    expect(fila.base).toBe('afinia_test');
  });

  it('PI-AFI-02: el endpoint de estado confirma la API y PostgreSQL', async () => {
    const r = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(r.body.status).toBe('ok');
    expect(r.body.database).toBe('up');
  });

  it('PI-AFI-03: autentica una cuenta activa y persiste una sesión', async () => {
    const r = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: ADMIN.email, password: ADMIN.password });
    expect([200, 201]).toContain(r.status);
    expect(typeof r.body.accessToken).toBe('string');
    expect(r.body.user.role).toBe('ADMIN');
    const [sesiones] = await base.query(
      `SELECT COUNT(*)::int AS total FROM auth_sessions s JOIN users u ON u.id = s.user_id
        WHERE u.email = $1 AND s.revoked_at IS NULL`, [ADMIN.email]);
    expect(sesiones.total).toBe(1);
  });

  it('PI-AFI-04: el token emitido permite consultar un endpoint protegido', async () => {
    const login = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: ADMIN.email, password: ADMIN.password });
    const r = await request(app.getHttpServer()).get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`).expect(200);
    expect(r.body.email).toBe(ADMIN.email);
    expect(r.body.role).toBe('ADMIN');
  });

  it('PI-AFI-05: rechaza una contraseña incorrecta con 401', async () => {
    const r = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: ADMIN.email, password: 'ClaveIncorrecta2026*' });
    expect(r.status).toBe(401);
  });
});
