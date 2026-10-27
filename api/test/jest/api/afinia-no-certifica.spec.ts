/**
 * V5 §1 y §7 (H01–H03): Afinia registra la participación; no emite
 * constancias nuevas. Lo ya emitido se conserva como historia.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearApp, db, entrar } from '../app';

describe('V5 §1, §7 · Afinia no certifica', () => {
  let app: INestApplication;
  let director: string;

  beforeAll(async () => {
    app = await crearApp();
    director = await entrar(app, 'jorge.vargas@univalle.edu');
  });
  afterAll(async () => { await app.close(); });

  const conToken = (r: request.Test) => r.set('Authorization', `Bearer ${director}`);
  const contar = async () => Number((await db(app).query('SELECT count(*) AS n FROM internal_constancies'))[0].n);

  it('una actividad nueva no puede elegir «constancia interna»', async () => {
    const [cat] = await db(app).query(`SELECT id FROM activity_categories WHERE applies_to = 'academica' LIMIT 1`);
    const [area] = await db(app).query(`SELECT id FROM academic_areas WHERE is_active ORDER BY name LIMIT 1`);
    const r = await conToken(request(app.getHttpServer()).post('/api/activities')).send({
      title: `V5 Jest constancia ${Date.now()}`, type: 'academica', categoryId: cat.id, areaIds: [area.id],
      outcomePolicy: 'internal_constancy',
    });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('CONSTANCY_ISSUANCE_DISABLED');
  });

  it('pedir una constancia nueva en una actividad antigua que las emitía se rechaza (H02)', async () => {
    // Precondición en la base de pruebas: una asistencia confirmada sin constancia
    // en una actividad antigua que las emitía (las sembradas ya tienen la suya).
    const [act] = await db(app).query(`
      SELECT a.id FROM activities a
       WHERE a.outcome_policy = 'internal_constancy' AND a.origin_type = 'internal'
         AND a.status NOT IN ('draft', 'cancelled') AND a.review_status IN ('approved', 'not_required')
       LIMIT 1`);
    const [perfil] = await db(app).query(`
      SELECT sp.id FROM student_profiles sp
       WHERE NOT EXISTS (SELECT 1 FROM activity_registrations r WHERE r.activity_id = $1 AND r.student_profile_id = sp.id)
       LIMIT 1`, [act.id]);
    const [reg] = await db(app).query(
      `INSERT INTO activity_registrations (activity_id, student_profile_id, status) VALUES ($1, $2, 'confirmed') RETURNING id`,
      [act.id, perfil.id],
    );
    try {
      const antes = await contar();
      const r = await conToken(request(app.getHttpServer()).post('/api/constancies/internal')).send({
        profileId: perfil.id, activityId: act.id, description: 'Participó en la actividad de prueba.',
      });
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('CONSTANCY_ISSUANCE_DISABLED');
      expect(await contar()).toBe(antes);
    } finally {
      await db(app).query('DELETE FROM activity_registrations WHERE id = $1', [reg.id]);
    }
  });

  it('las constancias ya emitidas se conservan y se pueden consultar (H03)', async () => {
    const [c] = await db(app).query(`SELECT activity_id FROM internal_constancies WHERE status = 'authorized' LIMIT 1`);
    const r = await conToken(request(app.getHttpServer()).get(`/api/constancies/internal/activity/${c.activity_id}`));
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
  });

  it('duplicar una actividad antigua con constancia deja la copia en «solo participación»', async () => {
    const [a] = await db(app).query(`
      SELECT a.id FROM activities a JOIN users u ON u.id = a.creator_id
       WHERE a.outcome_policy = 'internal_constancy' AND a.origin_type = 'internal' AND u.email = 'jorge.vargas@univalle.edu'
       LIMIT 1`);
    if (!a) return; // la base sembrada no siempre tiene una propia de Dirección
    const r = await conToken(request(app.getHttpServer()).post(`/api/activities/${a.id}/duplicate`));
    expect(r.status).toBe(201);
    expect(r.body.outcomePolicy).toBe('participation_only');
  });
});
