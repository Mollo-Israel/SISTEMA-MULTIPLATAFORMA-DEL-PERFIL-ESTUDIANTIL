/**
 * SuperTest — integración API + base + almacenamiento (Investigación §3.1, tabla
 * «Prueba prioritaria»): área de mejora, INTERESTED/REGISTERED, CONFIRMED,
 * archivo duplicado y archivo privado sin autorización.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearApp, db, entrar } from '../app';

// PNG mínimo válido; los bytes finales lo hacen único por corrida.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

describe('Integridad de reglas de negocio', () => {
  let app: INestApplication;
  let ana: string;
  let otro: string;

  beforeAll(async () => {
    app = await crearApp();
    ana = await entrar(app, 'ana.quispe@est.univalle.edu');
    otro = await entrar(app, 'camila.flores@est.univalle.edu');
  });
  afterAll(async () => { await app.close(); });

  const conToken = (r: request.Test, t: string) => r.set('Authorization', `Bearer ${t}`);
  const resumen = async () => (await conToken(request(app.getHttpServer()).get('/api/affinity/me/summary'), ana)).body;
  const crudo = (s: { areas?: { academicAreaId: string; rawPoints: number }[] }, area: string) =>
    Number((s.areas ?? []).find((a) => a.academicAreaId === area)?.rawPoints ?? 0);

  it('marcar un área de mejora no incrementa la afinidad', async () => {
    const [area] = await db(app).query(`SELECT id FROM academic_areas WHERE is_active ORDER BY name LIMIT 1 OFFSET 3`);
    await conToken(request(app.getHttpServer()).post('/api/affinity/recalculate/me'), ana);
    const antes = crudo(await resumen(), area.id);
    const r = await conToken(request(app.getHttpServer()).patch('/api/profiles/me'), ana).send({ improvementAreaIds: [area.id] });
    expect(r.status).toBe(200);
    await conToken(request(app.getHttpServer()).post('/api/affinity/recalculate/me'), ana);
    expect(crudo(await resumen(), area.id)).toBe(antes);
  });

  it('INTERESTED y REGISTERED no cuentan como experiencia; CONFIRMED sí (trayectoria)', async () => {
    const r = await conToken(request(app.getHttpServer()).get('/api/trajectory/me'), ana);
    expect(r.status).toBe(200);
    const actividades = (r.body.entries ?? []).filter((e: { kind: string }) => e.kind === 'activity');
    const porTitulo = (t: string) => actividades.find((e: { title: string }) => e.title.includes(t));
    expect(porTitulo('Taller de Desarrollo Web')?.level).toBe('corroborated');
    expect(porTitulo('Taller de Desarrollo Web')?.cvEligible).toBe(true);
    for (const t of ['Charla de Ciberseguridad', 'Reto de Bases de Datos']) {
      const e = porTitulo(t);
      if (e) {
        expect(e.level).not.toBe('corroborated');
        expect(e.cvEligible).toBe(false);
      }
    }
  });

  it('subir el mismo archivo dos veces no lo multiplica: el segundo queda marcado como duplicado', async () => {
    const contenido = Buffer.concat([PNG, Buffer.from(`jest-${Date.now()}`)]);
    const subir = () => conToken(request(app.getHttpServer()).post('/api/uploads'), ana)
      .attach('file', contenido, { filename: 'captura.png', contentType: 'image/png' });
    const a = await subir();
    const b = await subir();
    expect([200, 201]).toContain(a.status);
    expect(a.body.duplicateOfId).toBeNull();
    expect(b.body.duplicateOfId).toBe(a.body.id);
    expect(b.body.sha256).toBe(a.body.sha256);
  });

  it('un archivo privado no se descarga sin sesión ni con la sesión de otra persona', async () => {
    const contenido = Buffer.concat([PNG, Buffer.from(`privado-${Date.now()}`)]);
    const subido = await conToken(request(app.getHttpServer()).post('/api/uploads'), ana)
      .attach('file', contenido, { filename: 'privado.png', contentType: 'image/png' });
    const [fila] = await db(app).query('SELECT storage_key FROM stored_files WHERE id = $1', [subido.body.id]);
    const ruta = `/api/files/${fila.storage_key}`;
    expect((await request(app.getHttpServer()).get(ruta)).status).toBe(401);
    expect([403, 404]).toContain((await conToken(request(app.getHttpServer()).get(ruta), otro)).status);
  });
});
