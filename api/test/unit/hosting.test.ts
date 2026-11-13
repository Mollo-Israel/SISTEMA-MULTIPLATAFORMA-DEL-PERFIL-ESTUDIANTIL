/**
 * Preparación para el hosteo: Cloudflare R2, correo por Brevo y conexión a la
 * base por URL. Sin red: el cliente de R2 y `fetch` se simulan.
 *
 *   npm --prefix api run test:unit
 */
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { R2StorageDriver, readR2Settings } from '../../src/storage/r2-storage.driver';
import { storageDriverFactory } from '../../src/storage/storage-driver.factory';
import { databaseConnection } from '../../src/config/database-connection';
import { readMailSettings } from '../../src/mail/mail.settings';
import { explainBrevoError, MailService } from '../../src/mail/mail.service';

const AJUSTES = { endpoint: 'https://x.r2.cloudflarestorage.com', bucket: 'afinia', accessKeyId: 'a', secretAccessKey: 'b' };

function driver(responder: (c: unknown) => unknown = () => ({})) {
  const enviados: unknown[] = [];
  const client = { send: async (c: unknown) => { enviados.push(c); return responder(c); } } as never;
  return { d: new R2StorageDriver(AJUSTES, client), enviados };
}

describe('Cloudflare R2', () => {
  it('guarda con nombre propio, extensión por tipo y el tipo real', async () => {
    const { d, enviados } = driver();
    const r = await d.save({ buffer: Buffer.from('x'), originalName: '../malo\u0000.pdf', mimeType: 'application/pdf', size: 1 });
    assert.match(r.id, /^[0-9a-f-]{36}\.pdf$/);
    assert.equal(r.url, `/api/files/${r.id}`);
    assert.equal(r.originalName, 'malo.pdf');
    const put = enviados[0] as PutObjectCommand;
    assert.ok(put instanceof PutObjectCommand);
    assert.equal(put.input.Bucket, 'afinia');
    assert.equal(put.input.Key, r.id);
    assert.equal(put.input.ContentType, 'application/pdf');
  });

  it('lee el contenido completo y por partes', async () => {
    const { d } = driver(() => ({ Body: Readable.from([Buffer.from('ho'), Buffer.from('la')]) }));
    assert.equal((await d.read('a.pdf'))?.toString(), 'hola');
    const s = await d.stream('a.pdf');
    assert.ok(s instanceof Readable);
  });

  it('un archivo ausente devuelve null, no un error', async () => {
    const ausente = Object.assign(new Error('x'), { name: 'NoSuchKey' });
    const { d } = driver(() => { throw ausente; });
    assert.equal(await d.read('a.pdf'), null);
    assert.equal(await d.stream('a.pdf'), null);
  });

  it('nunca sale del nombre: descarta rutas y rechaza «..»', async () => {
    const { d, enviados } = driver(() => ({ Body: Readable.from([Buffer.from('x')]) }));
    await d.read('../../secreto.pdf');
    assert.equal((enviados[0] as GetObjectCommand).input.Key, 'secreto.pdf');
    assert.equal(await d.read('..'), null);
    assert.equal(enviados.length, 1);
  });

  it('borra por la clave de la URL y no falla si el proveedor falla', async () => {
    const { d, enviados } = driver();
    await d.remove('/api/files/a.pdf');
    assert.equal((enviados[0] as DeleteObjectCommand).input.Key, 'a.pdf');
    const malo = driver(() => { throw new Error('caído'); });
    await malo.d.remove('a.pdf');
  });

  it('el endpoint sale de la cuenta, y R2_ENDPOINT lo reemplaza', () => {
    const base = { R2_ACCOUNT_ID: 'cuenta', R2_BUCKET: 'b', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's' };
    assert.equal(readR2Settings(new ConfigService(base)).settings.endpoint, 'https://cuenta.r2.cloudflarestorage.com');
    assert.equal(readR2Settings(new ConfigService({ ...base, R2_ENDPOINT: 'http://localhost:9000' })).settings.endpoint, 'http://localhost:9000');
  });

  it('r2 con datos incompletos detiene el arranque y dice qué falta', () => {
    assert.throws(
      () => storageDriverFactory(new ConfigService({ STORAGE_DRIVER: 'r2', R2_BUCKET: 'b' }), 'disco'),
      /R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY/,
    );
  });

  it('r2 completo reemplaza al disco', () => {
    const c = new ConfigService({ STORAGE_DRIVER: 'r2', R2_ACCOUNT_ID: 'c', R2_BUCKET: 'b', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's' });
    assert.ok(storageDriverFactory(c, 'disco') instanceof R2StorageDriver);
  });
});

describe('Correo por Brevo', () => {
  const original = globalThis.fetch;
  afterEach(() => { globalThis.fetch = original; });
  const base = {
    MAIL_TRANSPORT: 'brevo', BREVO_API_KEY: 'llave', MAIL_FROM: 'no-responder@afinia.org',
    INSTITUTIONAL_EMAIL_DOMAINS: 'univalle.edu', NODE_ENV: 'production',
  };

  it('sin llave o sin remitente real es un problema de configuración', () => {
    assert.match(readMailSettings(new ConfigService({ ...base, BREVO_API_KEY: '' })).problems.join(), /BREVO_API_KEY/);
    assert.match(readMailSettings(new ConfigService({ ...base, MAIL_FROM: '' })).problems.join(), /MAIL_FROM/);
  });

  it('auto: SMTP si hay servidor; Brevo si solo hay llave; si no, consola', () => {
    const t = (v: Record<string, string>) => readMailSettings(new ConfigService(v)).transport;
    assert.equal(t({ SMTP_HOST: 'smtp.x.org', SMTP_USER: 'a@x.org', SMTP_PASSWORD: 'p', BREVO_API_KEY: 'l' }), 'smtp');
    assert.equal(t({ BREVO_API_KEY: 'l' }), 'brevo');
    assert.equal(t({}), 'console');
  });

  it('envía por HTTPS con la llave, remitente y ambos cuerpos', async () => {
    let url = ''; let init: RequestInit = {};
    globalThis.fetch = (async (u: string, i: RequestInit) => {
      url = String(u); init = i;
      return new Response(JSON.stringify({ messageId: '<m1>' }), { status: 201 });
    }) as typeof fetch;
    const r = await new MailService(new ConfigService(base)).send({ to: 'ana@univalle.edu', subject: 'S', text: 'T', html: '<b>H</b>' });
    assert.deepEqual(r, { transport: 'brevo', messageId: '<m1>' });
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
    assert.equal((init.headers as Record<string, string>)['api-key'], 'llave');
    const cuerpo = JSON.parse(String(init.body));
    assert.deepEqual(cuerpo.sender, { name: 'Afinia', email: 'no-responder@afinia.org' });
    assert.deepEqual(cuerpo.to, [{ email: 'ana@univalle.edu' }]);
    assert.equal(cuerpo.textContent, 'T');
    assert.equal(cuerpo.htmlContent, '<b>H</b>');
  });

  it('la regla de dominios institucionales también rige con Brevo', async () => {
    globalThis.fetch = (async () => { throw new Error('no debe llamarse'); }) as typeof fetch;
    await assert.rejects(new MailService(new ConfigService(base)).send({ to: 'x@gmail.com', subject: 'S', text: 'T' }), /institucionales/);
  });

  it('un rechazo del proveedor lanza un motivo claro, para que la cola reintente', async () => {
    globalThis.fetch = (async () => new Response('{}', { status: 401 })) as typeof fetch;
    await assert.rejects(new MailService(new ConfigService(base)).send({ to: 'ana@univalle.edu', subject: 'S', text: 'T' }), /BREVO_API_KEY/);
    assert.match(explainBrevoError(400, '{"message":"sender not valid"}'), /MAIL_FROM/);
  });
});

describe('Correo por SMTP', () => {
  // Sin servidor de verdad: se reemplaza la creación del transporte y se mira qué se pidió.
  const nodemailer = require('nodemailer') as typeof import('nodemailer');
  const original = nodemailer.createTransport;
  let opciones: Record<string, any> = {};
  let enviado: Record<string, any> | null = null;
  let falla: Error | null = null;
  const falso = (o: Record<string, any>) => {
    opciones = o;
    return {
      verify: async () => { if (falla) throw falla; return true; },
      sendMail: async (m: Record<string, any>) => { if (falla) throw falla; enviado = m; return { messageId: '<s1>' }; },
      close: () => undefined,
    };
  };
  afterEach(() => { (nodemailer as any).createTransport = original; opciones = {}; enviado = null; falla = null; });
  const base = {
    MAIL_TRANSPORT: 'smtp', SMTP_HOST: 'smtp.ejemplo.org', SMTP_USER: 'cuenta@ejemplo.org', SMTP_PASSWORD: 'clave',
    MAIL_FROM: 'Afinia <cuenta@ejemplo.org>', INSTITUTIONAL_EMAIL_DOMAINS: 'univalle.edu', NODE_ENV: 'production',
  };
  const servicio = (v: Record<string, string>) => {
    (nodemailer as any).createTransport = falso;
    const s = new MailService(new ConfigService(v));
    assert.equal(s.prepare(), true);
    return s;
  };

  it('con usuario y contraseña: login, STARTTLS en 587 y ritmo moderado', async () => {
    const s = servicio(base);
    assert.deepEqual(opciones.auth, { user: 'cuenta@ejemplo.org', pass: 'clave' });
    assert.equal(opciones.port, 587);
    assert.equal(opciones.secure, false);
    assert.equal(opciones.requireTLS, true);
    assert.equal(opciones.pool, true);
    assert.equal(await s.verify(), true);
    const r = await s.send({ to: 'ana@univalle.edu', subject: 'S', text: 'T', html: '<b>H</b>' });
    assert.deepEqual(r, { transport: 'smtp', messageId: '<s1>' });
    assert.equal(enviado?.from, '"Afinia" <cuenta@ejemplo.org>');
    assert.equal(enviado?.headers['Auto-Submitted'], 'auto-generated');
  });

  it('con OAuth2 entrega las credenciales de la aplicación', () => {
    servicio({
      ...base, SMTP_AUTH: 'oauth2', SMTP_PASSWORD: '',
      SMTP_OAUTH_CLIENT_ID: 'id', SMTP_OAUTH_CLIENT_SECRET: 'secreto', SMTP_OAUTH_REFRESH_TOKEN: 'renovar',
    });
    assert.deepEqual(opciones.auth, { type: 'OAuth2', user: 'cuenta@ejemplo.org', clientId: 'id', clientSecret: 'secreto', refreshToken: 'renovar' });
  });

  it('sin autenticación (servidor local) no exige STARTTLS ni manda credenciales', () => {
    servicio({ ...base, SMTP_AUTH: 'none', SMTP_PORT: '465' });
    assert.equal(opciones.auth, undefined);
    assert.equal(opciones.secure, true);
    assert.equal(opciones.requireTLS, false);
  });

  it('si el servidor rechaza, la verificación y el envío lo explican', async () => {
    const s = servicio(base);
    falla = Object.assign(new Error('Invalid login'), { code: 'EAUTH', responseCode: 535 });
    assert.equal(await s.verify(), false);
    await assert.rejects(s.send({ to: 'ana@univalle.edu', subject: 'S', text: 'T' }));
  });
});

describe('Conexión a la base', () => {
  const de = (v: Record<string, string>) => databaseConnection((k) => v[k]);
  it('sin variables conserva los valores de siempre', () => {
    assert.deepEqual(de({}), { host: 'localhost', port: 5432, username: 'perfil_user', password: 'perfil_pass', database: 'perfil_estudiantil', ssl: undefined });
  });
  it('DATABASE_URL tiene prioridad', () => {
    assert.deepEqual(de({ DATABASE_URL: 'postgres://u:p@h/db', POSTGRES_HOST: 'otro' }), { url: 'postgres://u:p@h/db', ssl: undefined });
  });
  it('DATABASE_SSL activa el cifrado, verificando el certificado', () => {
    assert.deepEqual(de({ DATABASE_SSL: 'true' }).ssl, { rejectUnauthorized: true });
    assert.deepEqual(de({ DATABASE_SSL: 'true', DATABASE_SSL_REJECT_UNAUTHORIZED: 'false' }).ssl, { rejectUnauthorized: false });
  });
});
