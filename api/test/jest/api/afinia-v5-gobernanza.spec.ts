/**
 * V5 §9, §10, §11 y §13.4: revisión por defecto, solo tres familias de puntos,
 * el análisis de repositorio es opcional y la galería no muestra borradores.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearApp, db, entrar } from '../app';

describe('V5 · Gobernanza, puntos y proyectos', () => {
  let app: INestApplication;
  let director: string;
  let docente: string;
  let estudiante: string;
  let docenteId: string;

  beforeAll(async () => {
    app = await crearApp();
    director = await entrar(app, 'jorge.vargas@univalle.edu');
    docente = await entrar(app, 'carlos.perez@univalle.edu');
    estudiante = await entrar(app, 'ana.quispe@est.univalle.edu');
    [{ id: docenteId }] = await db(app).query(`SELECT id FROM users WHERE email = 'carlos.perez@univalle.edu'`);
  });
  afterAll(async () => { await app.close(); });

  const api = () => request(app.getHttpServer());

  it('un docente empieza en revisión obligatoria en los tres módulos (§9.2)', async () => {
    const r = await api().get('/api/approval-policies/me').set('Authorization', `Bearer ${docente}`);
    expect(r.status).toBe(200);
    // Si una corrida anterior concedió y revocó, lo vigente sigue siendo revisión salvo que haya fila activa.
    const vigentes = Number((await db(app).query(
      `SELECT count(*) AS n FROM approval_policies WHERE teacher_user_id = $1 AND revoked_at IS NULL`, [docenteId],
    ))[0].n);
    if (vigentes === 0) expect(r.body).toEqual({ RESOURCE: 'REQUIRE_REVIEW', GAMIFICATION: 'REQUIRE_REVIEW', ACTIVITY: 'REQUIRE_REVIEW' });
    expect(r.body.ACTIVITY).toBe('REQUIRE_REVIEW');
  });

  it('las actividades no admiten excepción de revisión hasta la decisión institucional (ND-03)', async () => {
    const r = await api().post('/api/approval-policies').set('Authorization', `Bearer ${director}`)
      .send({ teacherUserId: docenteId, module: 'ACTIVITY', justification: 'Prueba de la regla de actividades.' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('ACTIVITY_OVERRIDE_NOT_ENABLED');
  });

  it('un docente no se concede autonomía a sí mismo', async () => {
    const r = await api().post('/api/approval-policies').set('Authorization', `Bearer ${docente}`)
      .send({ teacherUserId: docenteId, module: 'RESOURCE', justification: 'Intento de concederse autonomía.' });
    expect(r.status).toBe(403);
  });

  it('un criterio nuevo no puede usar una familia retirada (§10)', async () => {
    const r = await api().post('/api/gamification-criteria').set('Authorization', `Bearer ${director}`)
      .send({ code: `colab_jest_${Date.now()}`, name: 'Colaborar', trigger: 'colaboracion_aceptada', points: 5 });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    expect(r.body.fields?.trigger).toBeDefined();
  });

  it('analizar un repositorio exige un enlace válido y no guarda nada (§11.1)', async () => {
    const antes = Number((await db(app).query('SELECT count(*) AS n FROM projects'))[0].n);
    const r = await api().post('/api/projects/repository/analyze').set('Authorization', `Bearer ${estudiante}`)
      .send({ repositoryUrl: 'esto no es un enlace' });
    expect(r.status).toBe(400);
    expect(r.body.fields?.repositoryUrl).toBeDefined();
    const despues = Number((await db(app).query('SELECT count(*) AS n FROM projects'))[0].n);
    expect(despues).toBe(antes);
  });

  it('«Proyectos de la carrera» no incluye borradores ni proyectos privados (§13.4, G07)', async () => {
    const r = await api().get('/api/projects/community?page=1').set('Authorization', `Bearer ${estudiante}`);
    expect(r.status).toBe(200);
    expect(r.body.pageSize).toBe(6);
    const ids: string[] = r.body.items.map((p: { id: string }) => p.id);
    if (ids.length) {
      const filas = await db(app).query(`SELECT status, visibility FROM projects WHERE id = ANY($1::uuid[])`, [ids]);
      for (const f of filas) {
        expect(f.status).toBe('active');
        expect(['profile', 'public_link']).toContain(f.visibility);
      }
    }
    expect(JSON.stringify(r.body)).not.toMatch(/@/);
  });
});
