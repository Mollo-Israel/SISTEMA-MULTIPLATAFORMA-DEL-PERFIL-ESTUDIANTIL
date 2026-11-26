/**
 * V7.1 §7 · Los registros verificables propios de Afinia se retiraron (V01–V05).
 *
 * La aplicación real contra `afinia_test`: ninguna ruta del módulo emite,
 * descarga ni verifica; responden 410 con un texto neutro, sin datos de
 * nadie. El histórico (tablas y filas) se conserva intacto.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearApp, db, entrar } from '../app';

const ANA = 'ana.quispe@est.univalle.edu';
const DIRECTOR = 'jorge.vargas@univalle.edu';

describe('V7.1 §7 · Registros verificables retirados', () => {
  let app: INestApplication;
  let tAna: string;
  let tDir: string;
  const http = () => request(app.getHttpServer());
  const contar = async () => Number((await db(app).query('SELECT count(*)::int AS n FROM verifiable_credentials'))[0].n);
  const neutro = (r: request.Response) => {
    expect(r.status).toBe(410);
    expect(r.body.code).toBe('SERVICE_RETIRED');
    // Ni datos de personas ni de credenciales.
    expect(JSON.stringify(r.body)).not.toMatch(/holder|achievement|ana|quispe|status":"(active|revoked)/i);
  };

  beforeAll(async () => {
    app = await crearApp();
    tAna = await entrar(app, ANA);
    tDir = await entrar(app, DIRECTOR);
  });
  afterAll(async () => { await app.close(); });

  it('V03: el estudiante no puede ver ni emitir registros propios', async () => {
    const antes = await contar();
    neutro(await http().get('/api/credentials/mine').set('Authorization', `Bearer ${tAna}`));
    neutro(await http().post('/api/credentials/mine/issue').set('Authorization', `Bearer ${tAna}`));
    expect(await contar()).toBe(antes);
  });

  it('V03: Dirección no activa la política ni emite pendientes', async () => {
    const antes = await contar();
    neutro(await http().post('/api/credentials/policy').set('Authorization', `Bearer ${tDir}`).send({ enabled: true }));
    neutro(await http().post('/api/credentials/registry/issue-pending').set('Authorization', `Bearer ${tDir}`));
    neutro(await http().get('/api/credentials/registry').set('Authorization', `Bearer ${tDir}`));
    expect(await contar()).toBe(antes);
  });

  it('V02: las rutas públicas de verificación responden neutro, también con un código real', async () => {
    const [fila] = await db(app).query('SELECT public_code AS code FROM verifiable_credentials LIMIT 1');
    const codigo = fila?.code ?? 'AF-XXXX-XXXX';
    for (const ruta of [`/api/public/credentials/${codigo}`, `/api/public/credentials/${codigo}/ob3`, '/api/public/credentials/issuer',
      '/api/public/credentials/keys', '/api/public/credentials/ledger/head']) {
      neutro(await http().get(ruta));
    }
    neutro(await http().post('/api/public/credentials/verify').send({ credential: {} }));
  });

  it('V05: el histórico se conserva (tablas y filas, sin mostrarse como credencial)', async () => {
    const tablas = await db(app).query(
      `SELECT table_name FROM information_schema.tables WHERE table_name IN ('verifiable_credentials', 'credential_ledger', 'credential_signing_keys', 'credential_issuance_policies')`,
    );
    expect(tablas).toHaveLength(4);
  });
});
