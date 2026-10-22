/**
 * SuperTest — autorización por rol y alcance docente (TeacherScope).
 * No basta un 200: se comprueba el CONTENIDO filtrado por semestre.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ADMIN, crearApp, db, entrar } from '../app';

describe('Autorización y alcance docente', () => {
  let app: INestApplication;
  let docente1a4: string;
  let estudiante: string;
  let perfilAna: string;
  let perfilCamila: string;

  beforeAll(async () => {
    app = await crearApp();
    docente1a4 = await entrar(app, 'carlos.perez@univalle.edu');
    estudiante = await entrar(app, 'ana.quispe@est.univalle.edu');
    const filas: { email: string; id: string }[] = await db(app).query(
      `SELECT u.email, p.id FROM student_profiles p JOIN users u ON u.id = p.user_id
        WHERE u.email IN ('ana.quispe@est.univalle.edu', 'camila.flores@est.univalle.edu')`,
    );
    perfilAna = filas.find((f) => f.email.startsWith('ana'))!.id;
    perfilCamila = filas.find((f) => f.email.startsWith('camila'))!.id;
  });
  afterAll(async () => { await app.close(); });

  const get = (ruta: string, token?: string) => {
    const r = request(app.getHttpServer()).get(ruta);
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  };

  it('el docente de semestres 1–4 lista solo estudiantes de esos semestres', async () => {
    const r = await get('/api/profiles/students', docente1a4);
    expect(r.status).toBe(200);
    // El alcance declarado son sus semestres; la lista incluye a Ana (1.º) y no a Camila (5.º).
    expect(r.body.scope).toEqual({ restricted: true, semesters: [1, 2, 3, 4] });
    const ids = r.body.students.map((f: { profileId: string }) => f.profileId);
    expect(ids).toContain(perfilAna);
    expect(ids).not.toContain(perfilCamila);
  });

  it('puede ver la afinidad de una estudiante de su alcance (semestre 1)', async () => {
    const r = await get(`/api/affinity/student/${perfilAna}/summary`, docente1a4);
    expect(r.status).toBe(200);
  });

  it('una estudiante fuera de su alcance (semestre 5) se deniega', async () => {
    const r = await get(`/api/affinity/student/${perfilCamila}/summary`, docente1a4);
    expect([403, 404]).toContain(r.status);
  });

  it('un estudiante no consulta la lista de estudiantes ni la auditoría', async () => {
    expect((await get('/api/profiles/students', estudiante)).status).toBe(403);
    expect((await get('/api/audit/events', estudiante)).status).toBe(403);
  });

  it('un estudiante no consulta la afinidad de otro estudiante', async () => {
    const r = await get(`/api/affinity/student/${perfilCamila}/summary`, estudiante);
    expect([403, 404]).toContain(r.status);
  });

  it('Administración sí consulta la auditoría', async () => {
    const admin = await entrar(app, ADMIN.email, ADMIN.password);
    expect((await get('/api/audit/events', admin)).status).toBe(200);
  });
});
