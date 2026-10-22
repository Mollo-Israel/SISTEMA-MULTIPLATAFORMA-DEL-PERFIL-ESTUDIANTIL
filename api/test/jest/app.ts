/**
 * La aplicación NestJS real, configurada como en `main.ts` (prefijo, pipes,
 * filtro de errores), pero en memoria para que SuperTest le hable sin red.
 */
import '../../src/load-env';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/http-exception.filter';
import { mensajesDeValidacion } from '../../src/common/validation-messages';

export const CLAVE_POBLADA = 'Univalle2026*';

export async function crearApp(): Promise<INestApplication> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: mensajesDeValidacion,
  }));
  app.useGlobalFilters(new HttpExceptionFilter(app.get(ConfigService)));
  await app.init();
  return app;
}

/** Inicia sesión y devuelve el token de acceso. */
export async function entrar(app: INestApplication, email: string, password = CLAVE_POBLADA): Promise<string> {
  const r = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
  if (r.status !== 200 && r.status !== 201) throw new Error(`No se pudo iniciar sesión como ${email}: ${r.status}`);
  return r.body.accessToken;
}

export const db = (app: INestApplication) => app.get(DataSource);

/** Credenciales de Administración del .env (nunca se imprimen). */
export const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? 'admin@univalle.edu',
  password: process.env.ADMIN_PASSWORD ?? '', // de .env (load-env); nunca en el código
};
