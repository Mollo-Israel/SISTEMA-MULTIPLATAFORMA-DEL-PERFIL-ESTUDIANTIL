/**
 * SuperTest — identidad: inicio de sesión, sesión y recuperación con respuestas genéricas.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CLAVE_POBLADA, crearApp, entrar } from '../app';

describe('Autenticación (API real contra afinia_test)', () => {
  let app: INestApplication;
  beforeAll(async () => { app = await crearApp(); });
  afterAll(async () => { await app.close(); });

  it('credenciales válidas: 200/201 con token de acceso', async () => {
    const r = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: 'ana.quispe@est.univalle.edu', password: CLAVE_POBLADA });
    expect([200, 201]).toContain(r.status);
    expect(typeof r.body.accessToken).toBe('string');
  });

  it('contraseña incorrecta: 401 con un mensaje que no revela si la cuenta existe', async () => {
    const mala = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: 'ana.quispe@est.univalle.edu', password: 'Incorrecta2026*' });
    const inexistente = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: 'nadie.existe@est.univalle.edu', password: 'Incorrecta2026*' });
    expect(mala.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(mala.body.message).toBe(inexistente.body.message);
  });

  it('sin sesión, una ruta protegida responde 401', async () => {
    const r = await request(app.getHttpServer()).get('/api/profiles/me');
    expect(r.status).toBe(401);
  });

  it('con sesión, la misma ruta responde 200 con el perfil propio', async () => {
    const token = await entrar(app, 'ana.quispe@est.univalle.edu');
    const r = await request(app.getHttpServer()).get('/api/profiles/me').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.semester).toBe(1);
  });

  it('recuperar contraseña responde igual exista o no la cuenta (sin enumeración)', async () => {
    const existe = await request(app.getHttpServer()).post('/api/activation/forgot-password').send({ email: 'ana.quispe@est.univalle.edu' });
    const noExiste = await request(app.getHttpServer()).post('/api/activation/forgot-password').send({ email: 'nadie.existe@est.univalle.edu' });
    expect(existe.status).toBe(noExiste.status);
    expect(existe.body.message).toBe(noExiste.body.message);
  });
});
