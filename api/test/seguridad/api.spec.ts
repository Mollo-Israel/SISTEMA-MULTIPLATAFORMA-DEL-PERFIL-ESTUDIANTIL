/**
 * Pruebas de seguridad — API real en memoria contra `afinia_test`
 * (capítulo III, sección 3.4).
 *
 * Cada caso lleva el código PS-… de las tablas del documento. Se comprueba el
 * código HTTP y, sobre todo, el efecto en la base: que lo rechazado no haya
 * cambiado nada y que lo que debe quedar registrado haya quedado registrado.
 * Los datos que una prueba modifica se restauran al terminar.
 */
// Primero el .env: los límites de @Throttle se fijan al importar el primer
// módulo que lee identity.config (aquí, AccountTokensService).
import '../../src/load-env';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { AccountTokenPurpose } from '@perfil/shared';
import { resolveJwtSecret } from '../../src/config/security.config';
import { AccountTokensService } from '../../src/identity/account-tokens.service';
import { ADMIN, CLAVE_POBLADA, crearApp, db, entrar } from '../jest/app';

// PNG mínimo válido; los bytes finales lo hacen único por corrida.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const pngUnico = (marca: string) => Buffer.concat([PNG, Buffer.from(`${marca}-${Date.now()}-${Math.random()}`)]);
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

const ANA = 'ana.quispe@est.univalle.edu';
const CAMILA = 'camila.flores@est.univalle.edu';
const GABRIELA = 'gabriela.cruz@est.univalle.edu';
const TOMAS = 'tomas.suarez@est.univalle.edu';
const LUIS = 'luis.mamani@est.univalle.edu';
const DOCENTE = 'carlos.perez@univalle.edu';
const DIRECTOR = 'jorge.vargas@univalle.edu';
const SOCIEDAD = 'lucia.fernandez@univalle.edu';
const PENDIENTE = 'prueba.seguridad@univalle.edu';

describe('Pruebas de seguridad de la API (afinia_test)', () => {
  let app: INestApplication;
  let tAna: string;
  let tAdmin: string;
  let secreto: string;
  const ids: Record<string, string> = {};

  const srv = () => app.getHttpServer();
  const con = (r: request.Test, token: string) => r.set('Authorization', `Bearer ${token}`);
  const login = (email: string, password = CLAVE_POBLADA, cabeceras: Record<string, string> = {}) =>
    request(srv()).post('/api/auth/login').set(cabeceras).send({ email, password });
  const idDe = async (email: string) =>
    (await db(app).query('SELECT id FROM users WHERE email = $1', [email]))[0]?.id as string;
  const auditoria = async (tipo: string, entidad: string, desde: Date) =>
    db(app).query(
      'SELECT actor_user_id, metadata, created_at FROM audit_events WHERE event_type = $1 AND entity_id = $2 AND created_at >= $3 ORDER BY created_at DESC',
      [tipo, entidad, desde],
    );

  beforeAll(async () => {
    app = await crearApp();
    secreto = resolveJwtSecret(app.get(ConfigService));
    tAna = await entrar(app, ANA);
    tAdmin = await entrar(app, ADMIN.email, ADMIN.password);
    for (const email of [ANA, CAMILA, GABRIELA, TOMAS, ADMIN.email]) ids[email] = await idDe(email);
  });
  afterAll(async () => { await app.close(); });

  // =====================================================================
  describe('PS-AUT · Autenticación y cuentas', () => {
    it('PS-AUT-01 las contraseñas se guardan con bcrypt (costo ≥ 10) y nunca en texto plano', async () => {
      const filas: { password_hash: string }[] = await db(app).query('SELECT password_hash FROM users');
      expect(filas.length).toBeGreaterThan(0);
      for (const { password_hash: h } of filas) {
        const m = /^\$2[aby]\$(\d{2})\$[./A-Za-z0-9]{53}$/.exec(h);
        expect(m).not.toBeNull();
        expect(Number(m![1])).toBeGreaterThanOrEqual(10);
        expect(h).not.toContain(CLAVE_POBLADA);
      }
    });

    it('PS-AUT-02 el inicio de sesión responde igual si la contraseña es incorrecta o si la cuenta no existe', async () => {
      const mala = await login(ANA, 'Incorrecta-2026*');
      const inexistente = await login('nadie.existe@est.univalle.edu', 'Incorrecta-2026*');
      expect(mala.status).toBe(401);
      expect(inexistente.status).toBe(401);
      expect(mala.body.message).toBe(inexistente.body.message);
      expect(mala.body.accessToken).toBeUndefined();
    });

    it('PS-AUT-03 al suspender una cuenta, su token vigente y su sesión dejan de valer de inmediato y el cambio queda auditado', async () => {
      const desde = new Date(Date.now() - 1000);
      const sesion = await login(TOMAS);
      expect(sesion.status).toBe(200);
      const { accessToken, refreshToken } = sesion.body;
      expect((await con(request(srv()).get('/api/auth/me'), accessToken)).status).toBe(200);
      try {
        const susp = await con(request(srv()).patch(`/api/users/${ids[TOMAS]}/status`), tAdmin).send({ status: 'suspended' });
        expect(susp.status).toBe(200);
        expect((await con(request(srv()).get('/api/auth/me'), accessToken)).status).toBe(401);
        expect((await request(srv()).post('/api/auth/refresh').send({ refreshToken })).status).toBe(401);
        const otra = await login(TOMAS);
        expect(otra.status).toBe(401);
        expect(otra.body.accessToken).toBeUndefined();
        const eventos = await auditoria('USER_STATUS_CHANGED', ids[TOMAS], desde);
        expect(eventos.length).toBeGreaterThanOrEqual(1);
        expect(eventos[0].actor_user_id).toBe(ids[ADMIN.email]);
        expect(eventos[0].metadata).toMatchObject({ from: 'active', to: 'suspended' });
      } finally {
        const rea = await con(request(srv()).patch(`/api/users/${ids[TOMAS]}/status`), tAdmin).send({ status: 'active' });
        expect(rea.status).toBe(200);
      }
      expect((await login(TOMAS)).status).toBe(200);
    });

    it('PS-AUT-04 la aplicación móvil solo admite cuentas de estudiantes', async () => {
      const movil = { 'X-Afinia-Client': 'mobile' };
      const docente = await login(DOCENTE, CLAVE_POBLADA, movil);
      expect(docente.status).toBe(403);
      expect(docente.body.code).toBe('MOBILE_STUDENT_ONLY');
      expect(docente.body.accessToken).toBeUndefined();
      expect((await login(LUIS, CLAVE_POBLADA, movil)).status).toBe(200);
    });

    it('PS-AUT-05 no existe un registro público de cuentas', async () => {
      expect((await request(srv()).post('/api/auth/register').send({ email: 'nuevo@est.univalle.edu', password: 'Clave-Nueva-2026*' })).status).toBe(404);
      expect((await request(srv()).post('/api/users').send({ email: 'nuevo@est.univalle.edu' })).status).toBe(401);
    });

    it('PS-AUT-06 ni siquiera Administración puede crear otra cuenta de administrador desde la API', async () => {
      const r = await con(request(srv()).post('/api/users'), tAdmin).send({
        firstName: 'Otro', firstSurname: 'Administrador', email: 'otro.admin@univalle.edu',
        role: 'ADMIN', universityCode: 'ADM-SEGUR01',
      });
      expect(r.status).toBe(400);
      const [{ n }] = await db(app).query(`SELECT count(*)::int AS n FROM users WHERE email = 'otro.admin@univalle.edu'`);
      expect(n).toBe(0);
    });

    it('PS-AUT-07 la política de contraseñas se aplica también al restablecerla', async () => {
      const r = await request(srv()).post('/api/activation/reset-password').send({ email: ANA, code: '123456', password: 'debil' });
      expect(r.status).toBe(400);
      expect(JSON.stringify(r.body)).toMatch(/al menos 12/);
    });
  });

  // =====================================================================
  describe('PS-SES · Sesiones y tokens', () => {
    it('PS-SES-01 el token de renovación se guarda solo como huella SHA-256', async () => {
      const r = await login(GABRIELA);
      const rt: string = r.body.refreshToken;
      expect(rt.length).toBeGreaterThanOrEqual(64); // 48 bytes aleatorios en base64url
      const [{ n: conHuella }] = await db(app).query('SELECT count(*)::int AS n FROM auth_sessions WHERE refresh_token_hash = $1', [sha256(rt)]);
      const [{ n: enClaro }] = await db(app).query(
        'SELECT count(*)::int AS n FROM auth_sessions WHERE refresh_token_hash = $1 OR previous_refresh_token_hash = $1', [rt]);
      expect(conHuella).toBe(1);
      expect(enClaro).toBe(0);
    });

    it('PS-SES-02 cada renovación entrega un token nuevo y el anterior deja de servir al vencer la gracia', async () => {
      const rt1: string = (await login(GABRIELA)).body.refreshToken;
      const r2 = await request(srv()).post('/api/auth/refresh').send({ refreshToken: rt1 });
      expect(r2.status).toBe(200);
      const rt2: string = r2.body.refreshToken;
      expect(rt2).not.toBe(rt1);
      await esperar(2600); // gracia reducida a 2 s para la prueba (60 s por defecto)
      expect((await request(srv()).post('/api/auth/refresh').send({ refreshToken: rt1 })).status).toBe(401);
      expect((await request(srv()).post('/api/auth/refresh').send({ refreshToken: rt2 })).status).toBe(200);
    });

    it('PS-SES-03 cerrar sesión revoca el token de renovación', async () => {
      const rt: string = (await login(GABRIELA)).body.refreshToken;
      expect((await request(srv()).post('/api/auth/logout').send({ refreshToken: rt })).status).toBe(200);
      expect((await request(srv()).post('/api/auth/refresh').send({ refreshToken: rt })).status).toBe(401);
    });

    it('PS-SES-04 «cerrar todas las sesiones» revoca cada sesión abierta y queda auditado', async () => {
      const desde = new Date(Date.now() - 1000);
      const a = (await login(GABRIELA)).body;
      const b = (await login(GABRIELA)).body;
      const r = await con(request(srv()).delete('/api/auth/sessions'), a.accessToken);
      expect(r.status).toBe(200);
      expect(r.body.revoked).toBeGreaterThanOrEqual(2);
      expect((await request(srv()).post('/api/auth/refresh').send({ refreshToken: a.refreshToken })).status).toBe(401);
      expect((await request(srv()).post('/api/auth/refresh').send({ refreshToken: b.refreshToken })).status).toBe(401);
      const eventos = await auditoria('ALL_SESSIONS_REVOKED', ids[GABRIELA], desde);
      expect(eventos.length).toBeGreaterThanOrEqual(1);
    });

    it('PS-SES-05 un token alterado para suplantar a otra cuenta se rechaza', async () => {
      const [cab, carga, firma] = tAna.split('.');
      const datos = JSON.parse(Buffer.from(carga, 'base64url').toString());
      const alterado = `${cab}.${b64({ ...datos, sub: ids[ADMIN.email], role: 'ADMIN' })}.${firma}`;
      expect((await con(request(srv()).get('/api/auth/me'), alterado)).status).toBe(401);
      expect((await con(request(srv()).get('/api/users'), alterado)).status).toBe(401);
    });

    it('PS-SES-06 un token sin firma (algoritmo «none») se rechaza', async () => {
      const ahora = Math.floor(Date.now() / 1000);
      const sinFirma = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: ids[ANA], email: ANA, role: 'STUDENT', iat: ahora, exp: ahora + 600 })}.`;
      expect((await con(request(srv()).get('/api/auth/me'), sinFirma)).status).toBe(401);
    });

    it('PS-SES-07 un token firmado con otra clave se rechaza', async () => {
      const ajeno = jwt.sign({ sub: ids[ANA], email: ANA, role: 'STUDENT' }, 'clave-de-un-atacante-con-mas-de-32-caracteres', { expiresIn: '10m' });
      expect((await con(request(srv()).get('/api/auth/me'), ajeno)).status).toBe(401);
    });

    it('PS-SES-08 un token vencido se rechaza aunque la firma sea válida', async () => {
      const ahora = Math.floor(Date.now() / 1000);
      const vencido = jwt.sign({ sub: ids[ANA], email: ANA, role: 'STUDENT', iat: ahora - 3600, exp: ahora - 60 }, secreto);
      expect((await con(request(srv()).get('/api/auth/me'), vencido)).status).toBe(401);
    });

    it('PS-SES-09 el rol escrito dentro de un token válido no otorga permisos: se lee de la base', async () => {
      const conRolFalso = jwt.sign({ sub: ids[ANA], email: ANA, role: 'ADMIN' }, secreto, { expiresIn: '10m' });
      expect((await con(request(srv()).get('/api/users'), conRolFalso)).status).toBe(403);
      const yo = await con(request(srv()).get('/api/auth/me'), conRolFalso);
      expect(yo.status).toBe(200);
      expect(yo.body.role ?? yo.body.user?.role).toBe('STUDENT');
    });

    it('PS-SES-10 la web recibe la renovación en una cookie HttpOnly limitada a /api/auth, nunca en el cuerpo', async () => {
      const web = { 'X-Session-Transport': 'cookie' };
      const r = await login(GABRIELA, CLAVE_POBLADA, web);
      expect(r.status).toBe(200);
      expect(r.body.refreshToken).toBeUndefined();
      const cookie = ([] as string[]).concat(r.headers['set-cookie'] ?? []).find((c) => c.startsWith('afinia_rt='));
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Path=\/api\/auth/);
      expect(cookie).toMatch(/SameSite=Lax/i);
      const renovada = await request(srv()).post('/api/auth/refresh').set(web).set('Cookie', cookie!.split(';')[0]).send({});
      expect(renovada.status).toBe(200);
      expect(renovada.body.refreshToken).toBeUndefined();
      expect(typeof renovada.body.accessToken).toBe('string');
    });
  });

  // =====================================================================
  describe('PS-ACC · Control de acceso', () => {
    it('PS-ACC-01 un estudiante no accede a la gestión de cuentas ni puede elevar su propio rol', async () => {
      expect((await con(request(srv()).get('/api/users'), tAna)).status).toBe(403);
      expect((await con(request(srv()).patch(`/api/users/${ids[ANA]}`), tAna).send({ role: 'ADMIN' })).status).toBe(403);
      expect((await con(request(srv()).patch(`/api/users/${ids[CAMILA]}/status`), tAna).send({ status: 'suspended' })).status).toBe(403);
      const [{ rol }] = await db(app).query('SELECT r.name AS rol FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1', [ids[ANA]]);
      expect(rol).toBe('STUDENT');
    });

    it('PS-ACC-02 Docente, Dirección y Sociedad Científica no acceden a la gestión de cuentas', async () => {
      for (const email of [DOCENTE, DIRECTOR, SOCIEDAD]) {
        const t = await entrar(app, email);
        expect((await con(request(srv()).get('/api/users'), t)).status).toBe(403);
      }
      const docente = await entrar(app, DOCENTE);
      expect((await con(request(srv()).get('/api/audit/events'), docente)).status).toBe(403);
    });

    it('PS-ACC-03 un estudiante no modifica el proyecto de otra persona', async () => {
      const [p] = await db(app).query(`SELECT id, title FROM projects WHERE title = 'Plataforma web de gestión de proyectos'`);
      const r = await con(request(srv()).patch(`/api/projects/${p.id}`), tAna).send({ title: 'Alterado por otra cuenta' });
      expect([403, 404]).toContain(r.status);
      const [despues] = await db(app).query('SELECT title FROM projects WHERE id = $1', [p.id]);
      expect(despues.title).toBe(p.title);
    });

    it('PS-ACC-04 el borrador privado de otro estudiante no es visible', async () => {
      const [p] = await db(app).query(`SELECT id FROM projects WHERE title = 'Prototipo personal de asistente de estudio'`);
      const r = await con(request(srv()).get(`/api/projects/${p.id}`), tAna);
      expect([403, 404]).toContain(r.status);
      expect(JSON.stringify(r.body)).not.toContain('asistente de estudio');
    });

    it('PS-ACC-05 los campos no permitidos se rechazan (asignación masiva)', async () => {
      expect((await con(request(srv()).patch('/api/profiles/me'), tAna).send({ bio: 'Hola', role: 'ADMIN' })).status).toBe(400);
      expect((await con(request(srv()).patch('/api/profiles/me'), tAna).send({ userId: ids[CAMILA] })).status).toBe(400);
      expect((await con(request(srv()).patch('/api/profiles/me'), tAna).send({ semester: 8 })).status).toBe(400);
      const [{ semester }] = await db(app).query('SELECT semester FROM student_profiles WHERE user_id = $1', [ids[ANA]]);
      expect(semester).toBe(1);
    });

    it('PS-ACC-06 un identificador mal formado se rechaza sin provocar un error interno', async () => {
      expect((await con(request(srv()).get('/api/users/no-es-un-uuid'), tAdmin)).status).toBe(400);
      const r = await con(request(srv()).get(`/api/projects/${encodeURIComponent("1' OR '1'='1")}`), tAna);
      expect(r.status).toBeLessThan(500);
    });
  });

  // =====================================================================
  describe('PS-INY · Inyección y validación de entradas', () => {
    const lista = (cuerpo: unknown): unknown[] =>
      (Array.isArray(cuerpo) ? cuerpo : ((cuerpo as { items?: unknown[] })?.items ?? (cuerpo as { results?: unknown[] })?.results ?? [])) as unknown[];

    it.each([
      ["' OR '1'='1"],
      ["%' OR 1=1 --"],
      ["x'); DROP TABLE users; --"],
    ])('PS-INY-01 una inyección SQL en la búsqueda se trata como texto: %s', async (carga) => {
      const [{ n: antes }] = await db(app).query('SELECT count(*)::int AS n FROM users');
      const r = await con(request(srv()).get('/api/contacts/search').query({ q: carga }), tAna);
      expect(r.status).toBe(200);
      expect(lista(r.body)).toHaveLength(0);
      expect(JSON.stringify(r.body)).not.toMatch(/syntax|QueryFailed|postgres/i);
      const responsables = await con(request(srv()).get('/api/activities/responsibles').query({ q: carga }), tAna);
      expect(responsables.status).toBe(200);
      expect(lista(responsables.body)).toHaveLength(0);
      const [{ n: despues }] = await db(app).query('SELECT count(*)::int AS n FROM users');
      expect(despues).toBe(antes);
    });

    it('PS-INY-02 una inyección en el inicio de sesión se rechaza por validación, sin error interno', async () => {
      const sql = await request(srv()).post('/api/auth/login').send({ email: "admin@univalle.edu' OR '1'='1", password: 'x'.repeat(8) });
      const objeto = await request(srv()).post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
      expect(sql.status).toBe(400);
      expect(objeto.status).toBe(400);
      expect(sql.body.accessToken).toBeUndefined();
      expect(objeto.body.accessToken).toBeUndefined();
    });

    it('PS-INY-03 el HTML escrito por un usuario se guarda como texto y se devuelve como JSON', async () => {
      const [{ bio: original }] = await db(app).query('SELECT bio FROM student_profiles WHERE user_id = $1', [ids[ANA]]);
      const carga = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
      try {
        expect((await con(request(srv()).patch('/api/profiles/me'), tAna).send({ bio: carga })).status).toBe(200);
        const r = await con(request(srv()).get('/api/profiles/me'), tAna);
        expect(r.headers['content-type']).toMatch(/application\/json/);
        expect(typeof r.body.bio).toBe('string');
      } finally {
        await con(request(srv()).patch('/api/profiles/me'), tAna).send({ bio: original ?? '' });
      }
    });

    it('PS-INY-04 un cuerpo JSON mal formado se rechaza sin exponer detalles internos', async () => {
      const r = await request(srv()).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": "ana@', );
      expect(r.status).toBe(400);
      const texto = JSON.stringify(r.body);
      expect(texto).not.toMatch(/node_modules|\bat [\w.<>]+ \(|stack/i);
    });

    it('PS-INY-05 una ruta de archivo con recorrido de directorios no sale del almacenamiento', async () => {
      for (const ruta of ['..%2F..%2F..%2F.env', '%2e%2e%2f%2e%2e%2fpackage.json', '....%2F%2F....%2F%2Fapi%2Fsrc%2Fmain.ts']) {
        const r = await con(request(srv()).get(`/api/files/${ruta}`), tAna);
        expect([400, 403, 404]).toContain(r.status);
        expect(r.text).not.toMatch(/POSTGRES|JWT_|NestFactory|"dependencies"/);
      }
    });
  });

  // =====================================================================
  describe('PS-ARC · Archivos y evidencias', () => {
    const subir = (contenido: Buffer, nombre: string, tipo: string, token = tAna) =>
      con(request(srv()).post('/api/uploads'), token).attach('file', contenido, { filename: nombre, contentType: tipo });

    it('PS-ARC-01 un ejecutable con extensión .pdf se rechaza por su contenido real', async () => {
      const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(126, 0x90)]);
      expect((await subir(exe, 'constancia.pdf', 'application/pdf')).status).toBe(400);
    });

    it('PS-ARC-02 un SVG o un HTML con código se rechazan aunque se declaren como imagen', async () => {
      const svg = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      const html = Buffer.from('<!doctype html><html><body><script>alert(1)</script></body></html>');
      expect((await subir(svg, 'foto.svg', 'image/svg+xml')).status).toBe(400);
      expect((await subir(svg, 'foto.png', 'image/png')).status).toBe(400);
      expect((await subir(html, 'certificado.jpg', 'image/jpeg')).status).toBe(400);
    });

    it('PS-ARC-03 un archivo cuyo tipo declarado no coincide con su contenido se rechaza', async () => {
      expect((await subir(pngUnico('tipo'), 'documento.pdf', 'application/pdf')).status).toBe(400);
    });

    it('PS-ARC-04 un archivo de más de 10 MB se rechaza', async () => {
      const grande = Buffer.alloc(10 * 1024 * 1024 + 1, 0x20);
      grande.write('%PDF-1.7\n', 0, 'latin1');
      const r = await subir(grande, 'grande.pdf', 'application/pdf');
      expect([400, 413]).toContain(r.status);
    });

    it('PS-ARC-05 un archivo vacío se rechaza', async () => {
      expect((await subir(Buffer.alloc(0), 'vacio.png', 'image/png')).status).toBe(400);
    });

    it('PS-ARC-06 el nombre enviado por el usuario no decide dónde se guarda el archivo', async () => {
      const r = await subir(pngUnico('ruta'), '../../../../evil.png', 'image/png');
      expect([200, 201]).toContain(r.status);
      const [fila] = await db(app).query('SELECT storage_key FROM stored_files WHERE id = $1', [r.body.id]);
      expect(fila.storage_key).toMatch(/^[0-9a-f-]{36}\.png$/);
      const almacen = process.env.STORAGE_LOCAL_PATH!;
      expect(existsSync(join(almacen, fila.storage_key))).toBe(true);
      expect(existsSync(resolve(almacen, '../../../../evil.png'))).toBe(false);
    });

    it('PS-ARC-07 la evidencia la descarga su titular con cabeceras seguras; otra cuenta recibe lo mismo que si no existiera', async () => {
      const r = await subir(pngUnico('evidencia'), 'captura.png', 'image/png');
      const ev = await con(request(srv()).post('/api/evidences'), tAna)
        .send({ evidenceType: 'file', storedFileId: r.body.id, description: 'Evidencia de la prueba de seguridad PS-ARC-07' });
      expect([200, 201]).toContain(ev.status);
      const [fila] = await db(app).query('SELECT storage_key FROM stored_files WHERE id = $1', [r.body.id]);
      const d = await con(request(srv()).get(`/api/files/${fila.storage_key}`), tAna);
      expect(d.status).toBe(200);
      expect(d.headers['x-content-type-options']).toBe('nosniff');
      expect(d.headers['content-type']).toMatch(/^image\/png/);
      expect(d.headers['content-disposition']).toMatch(/^(inline|attachment); filename="/);
      const tCamila = await entrar(app, CAMILA);
      const ajena = await con(request(srv()).get(`/api/files/${fila.storage_key}`), tCamila);
      const inexistente = await con(request(srv()).get('/api/files/00000000-0000-4000-8000-000000000000.png'), tCamila);
      expect(ajena.status).toBe(404);
      expect(ajena.body.message).toBe(inexistente.body.message);
    });

    it('PS-ARC-08 un archivo subido que no pertenece a ninguna evidencia no se entrega, ni siquiera a quien lo subió', async () => {
      const r = await subir(pngUnico('suelto'), 'suelto.png', 'image/png');
      const [fila] = await db(app).query('SELECT storage_key FROM stored_files WHERE id = $1', [r.body.id]);
      expect((await con(request(srv()).get(`/api/files/${fila.storage_key}`), tAna)).status).toBe(404);
      expect((await request(srv()).get(`/api/files/${fila.storage_key}`)).status).toBe(401);
    });
  });

  // =====================================================================
  describe('PS-ABU · Abuso de los flujos de cuenta', () => {
    let idPendiente: string;

    beforeAll(async () => {
      const previo = await idDe(PENDIENTE);
      if (previo) await con(request(srv()).delete(`/api/users/${previo}`).query({ hard: 'true' }), tAdmin);
      const r = await con(request(srv()).post('/api/users'), tAdmin).send({
        firstName: 'Prueba', firstSurname: 'Seguridad', email: PENDIENTE,
        role: 'TEACHER', teacherSemesters: [1], universityCode: 'DOC-SEGUR01',
      });
      expect(r.status).toBe(201);
      expect(r.body.status ?? r.body.user?.status).toBe('pending_activation');
      idPendiente = await idDe(PENDIENTE);
    });
    afterAll(async () => {
      if (idPendiente) await con(request(srv()).delete(`/api/users/${idPendiente}`).query({ hard: 'true' }), tAdmin);
    });

    it('PS-ABU-01 la activación y la recuperación solo atienden correos institucionales', async () => {
      const [{ n: antes }] = await db(app).query('SELECT count(*)::int AS n FROM mail_jobs');
      for (const email of ['alguien@gmail.com', 'alguien@univalle.edu.atacante.com', 'alguien@falso-univalle.edu']) {
        expect((await request(srv()).post('/api/activation/request').send({ email })).status).toBe(400);
        expect((await request(srv()).post('/api/activation/forgot-password').send({ email })).status).toBe(400);
      }
      const [{ n: despues }] = await db(app).query('SELECT count(*)::int AS n FROM mail_jobs');
      expect(despues).toBe(antes);
    });

    it('PS-ABU-02 pedir de nuevo la activación respeta la espera entre reenvíos y no duplica correos', async () => {
      const contar = async () => (await db(app).query('SELECT count(*)::int AS n FROM mail_jobs WHERE user_id = $1', [idPendiente]))[0].n;
      const antes = await contar();
      expect(antes).toBeGreaterThanOrEqual(1); // el de la creación de la cuenta
      for (let i = 0; i < 3; i++) {
        const r = await request(srv()).post('/api/activation/request').send({ email: PENDIENTE });
        expect(r.status).toBe(200);
        expect(r.body.retryAfterSeconds).toBeGreaterThan(0);
      }
      expect(await contar()).toBe(antes);
    });

    // El correo de activación lo envía el proceso de correo, apagado en las
    // pruebas: aquí se emite el token como lo haría ese envío, y así la prueba
    // conoce el código verdadero que recibiría el titular.
    const emitir = () => app.get(AccountTokensService).issue(idPendiente, AccountTokenPurpose.ACCOUNT_ACTIVATION);

    it('PS-ABU-03 el código de 6 dígitos se anula tras 10 intentos fallidos: después ni el código correcto sirve', async () => {
      const { code } = await emitir();
      const incorrectos = Array.from({ length: 11 }, (_, i) => String((Number(code) + 1 + i) % 1_000_000).padStart(6, '0')).slice(0, 10);
      for (const intento of incorrectos) {
        const r = await request(srv()).post('/api/activation/activate')
          .send({ email: PENDIENTE, code: intento, password: 'Trayectoria-Segura-2026*' });
        expect(r.status).toBeGreaterThanOrEqual(400);
        expect(r.status).toBeLessThan(500);
      }
      const anulados = await db(app).query(
        `SELECT count(*)::int AS n FROM account_tokens WHERE user_id = $1 AND revoked_reason = 'too_many_attempts'`, [idPendiente]);
      expect(anulados[0].n).toBe(1);
      const correcto = await request(srv()).post('/api/activation/activate')
        .send({ email: PENDIENTE, code, password: 'Trayectoria-Segura-2026*' });
      expect(correcto.status).toBeGreaterThanOrEqual(400);
      const [{ status }] = await db(app).query('SELECT status FROM users WHERE id = $1', [idPendiente]);
      expect(status).toBe('pending_activation');
    });

    it('PS-ABU-04 enlaces y códigos se guardan como huellas, y pedir uno nuevo anula el anterior', async () => {
      const primero = await emitir();
      const segundo = await emitir();
      const filas: { token_hash: string; code_hash: string | null; revoked_reason: string | null }[] = await db(app).query(
        'SELECT token_hash, code_hash, revoked_reason FROM account_tokens WHERE user_id = $1', [idPendiente]);
      expect(filas.length).toBeGreaterThanOrEqual(3);
      for (const f of filas) {
        expect(f.token_hash).toMatch(/^[0-9a-f]{64}$/);
        if (f.code_hash !== null) expect(f.code_hash).toMatch(/^[0-9a-f]{64}$/);
        expect([primero.token, segundo.token, primero.code, segundo.code]).not.toContain(f.token_hash);
      }
      expect(filas.filter((f) => f.revoked_reason === 'replaced').length).toBeGreaterThanOrEqual(1);
      expect(filas.filter((f) => f.revoked_reason === null).length).toBe(1);
      // El enlace anterior ya no sirve; el vigente sí se reconoce.
      const viejo = await request(srv()).post('/api/activation/check').send({ token: primero.token, purpose: 'activation' });
      const vigente = await request(srv()).post('/api/activation/check').send({ token: segundo.token, purpose: 'activation' });
      expect(viejo.body.state).not.toBe('valid');
      expect(vigente.body.state).toBe('valid');
    });
  });

  // =====================================================================
  describe('PS-AUD · Auditoría', () => {
    it('PS-AUD-01 un estudiante no puede consultar, alterar ni borrar la auditoría', async () => {
      expect((await con(request(srv()).get('/api/audit/events'), tAna)).status).toBe(403);
      expect((await con(request(srv()).delete('/api/audit/events'), tAna)).status).toBeGreaterThanOrEqual(400);
      expect((await con(request(srv()).patch('/api/audit/events'), tAna).send({})).status).toBeGreaterThanOrEqual(400);
    });

    it('PS-AUD-02 los cambios de cuenta y el cierre de sesiones quedan con actor y fecha', async () => {
      const filas: { event_type: string; actor_user_id: string | null; created_at: Date }[] = await db(app).query(
        `SELECT event_type, actor_user_id, created_at FROM audit_events
          WHERE event_type IN ('USER_STATUS_CHANGED', 'ALL_SESSIONS_REVOKED') AND created_at > now() - interval '15 minutes'`);
      const tipos = new Set(filas.map((f) => f.event_type));
      expect(tipos.has('USER_STATUS_CHANGED')).toBe(true);
      expect(tipos.has('ALL_SESSIONS_REVOKED')).toBe(true);
      for (const f of filas) {
        expect(f.actor_user_id).toBeTruthy();
        expect(f.created_at).toBeTruthy();
      }
    });
  });

  // =====================================================================
  describe('PS-PRI · Privacidad del perfil', () => {
    const publico = (slug: string) => request(srv()).get(`/api/public/profiles/${slug}`);

    it('PS-PRI-01 el perfil compartible está desactivado por defecto y responde como si no existiera', async () => {
      const [{ public_profile_enabled: activo, public_profile_slug: slug }] = await db(app).query(
        'SELECT public_profile_enabled, public_profile_slug FROM student_profiles WHERE user_id = $1', [ids[CAMILA]]);
      expect(activo).toBe(false);
      const r = await publico(slug);
      const inventado = await publico('zzzzzzzzzzzz');
      expect(r.status).toBe(404);
      expect(inventado.status).toBe(404);
      expect(r.body.message).toBe(inventado.body.message);
    });

    it('PS-PRI-02 publicado, no expone el correo ni el código universitario; al rotar el enlace, el anterior deja de funcionar', async () => {
      const [perfil] = await db(app).query('SELECT university_code FROM student_profiles WHERE user_id = $1', [ids[ANA]]);
      try {
        expect((await con(request(srv()).put('/api/profiles/me/visibility'), tAna).send({ publicProfileEnabled: true })).status).toBe(200);
        const viejo: string = (await con(request(srv()).get('/api/profiles/me/public-link'), tAna)).body.slug;
        const visto = await publico(viejo);
        expect(visto.status).toBe(200);
        const texto = JSON.stringify(visto.body);
        expect(texto).not.toContain(ANA);
        if (perfil.university_code) expect(texto).not.toContain(perfil.university_code);
        const rotado = await con(request(srv()).post('/api/profiles/me/public-link/rotate'), tAna);
        expect(rotado.status).toBe(200);
        const nuevo: string = rotado.body.slug;
        expect(nuevo).not.toBe(viejo);
        expect(nuevo).toMatch(/^[23456789bcdfghjkmnpqrstvwxyz]{12}$/);
        expect((await publico(viejo)).status).toBe(404);
        expect((await publico(nuevo)).status).toBe(200);
      } finally {
        await con(request(srv()).put('/api/profiles/me/visibility'), tAna).send({ publicProfileEnabled: false });
      }
    });

    it('PS-PRI-03 la búsqueda de compañeros nunca devuelve correos', async () => {
      const r = await con(request(srv()).get('/api/contacts/search').query({ q: 'Mamani' }), tAna);
      expect(r.status).toBe(200);
      expect(JSON.stringify(r.body)).not.toMatch(/@(est\.)?univalle\.edu/);
    });
  });
});
