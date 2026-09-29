import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { mensajesDeValidacion } from '../../src/common/validation-messages';

describe('Integración API + PostgreSQL', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let config: ConfigService;

const expectedEmail =
  process.env.ADMIN_EMAIL ?? 'admin.qa@univalle.edu';

const expectedPassword =
  process.env.ADMIN_PASSWORD ?? 'AfiniaQA2026*Seguro';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    app.setGlobalPrefix('api');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: mensajesDeValidacion,
      }),
    );

    await app.init();

    dataSource = app.get(DataSource);
    config = app.get(ConfigService);

    const userRows = await dataSource.query(
      'SELECT id FROM users WHERE email = $1',
      [expectedEmail],
    );

    if (userRows.length === 0) {
      throw new Error(
        `No existe el usuario QA ${expectedEmail} en la base de pruebas.`,
      );
    }

    await dataSource.query(
      'DELETE FROM auth_sessions WHERE user_id = $1',
      [userRows[0].id],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('PI-AFI-01: utiliza exclusivamente la base de datos afinia_test', async () => {
    const rows = await dataSource.query('SELECT current_database() AS database');

    expect(rows[0].database).toBe('afinia_test');
  });

  it('PI-AFI-02: health confirma disponibilidad de API y PostgreSQL', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('perfil-estudiantil-api');
    expect(response.body.database).toBe('up');
  });

  it('PI-AFI-03: autentica una cuenta ACTIVE y persiste una sesión', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('User-Agent', 'Afinia-QA-Integration-Test')
      .send({
        email: expectedEmail,
        password: expectedPassword,
      })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));

    expect(response.body.user.email).toBe(expectedEmail);
    expect(response.body.user.role).toBe('ADMIN');
    expect(response.body.user.status).toBe('active');

    const sessions = await dataSource.query(
      `SELECT COUNT(*)::int AS total
       FROM auth_sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE u.email = $1
         AND s.revoked_at IS NULL`,
      [expectedEmail],
    );

    expect(sessions[0].total).toBe(1);
  });

  it('PI-AFI-04: permite consultar un endpoint protegido con el access token emitido', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: expectedEmail,
        password: expectedPassword,
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(response.body.email).toBe(expectedEmail);
    expect(response.body.role).toBe('ADMIN');
    expect(response.body.status).toBe('active');
  });

  it('PI-AFI-05: rechaza credenciales con contraseña incorrecta', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: expectedEmail,
        password: 'ClaveIncorrecta123*',
      })
      .expect(401);
  });
});
