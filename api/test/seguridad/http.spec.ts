/**
 * Pruebas de seguridad — API arrancada como en producción (capítulo III, 3.4).
 *
 * `npm run pruebas:seguridad` levanta `api/dist/main.js` con NODE_ENV=production
 * contra `afinia_test` (los límites de peticiones son los de producción y el
 * correo queda apagado) y deja su dirección en SEGURIDAD_API_URL. Aquí se
 * prueba lo que solo existe con la aplicación completa: cabeceras de Helmet,
 * CORS, límite del cuerpo, cookies seguras, Swagger cerrado, forma de los
 * errores y limitación de intentos.
 *
 * Cada grupo usa su propia dirección de origen (cabecera X-Forwarded-For, que la
 * API acepta de un proxy de confianza) para que los límites de un grupo no
 * afecten a otro.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { CLAVE_POBLADA } from '../jest/app';

const URL_API = process.env.SEGURIDAD_API_URL ?? '';
const ORIGEN = URL_API.replace(/\/api\/?$/, '');
const WEB_PERMITIDA = process.env.SEGURIDAD_WEB_ORIGIN ?? 'http://localhost:5180';
const EVIDENCIA = join(__dirname, '..', '..', '..', 'pruebas', '11-seguridad');

const desde = (ip: string) => ({ 'X-Forwarded-For': ip });

describe('Pruebas de seguridad HTTP con el perfil de producción', () => {
  beforeAll(() => {
    if (!URL_API) throw new Error('Falta SEGURIDAD_API_URL: ejecute «npm run pruebas:seguridad».');
  });

  const evidencia: Record<string, unknown> = {};
  afterAll(() => {
    mkdirSync(EVIDENCIA, { recursive: true });
    writeFileSync(join(EVIDENCIA, 'cabeceras-produccion.json'), JSON.stringify(evidencia, null, 2));
  });

  describe('PS-CFG · Configuración expuesta', () => {
    it('PS-CFG-05 las respuestas llevan las cabeceras de seguridad y no revelan la tecnología del servidor', async () => {
      const r = await request(ORIGEN).get('/api/health').set(desde('198.51.100.1'));
      expect(r.status).toBe(200);
      evidencia.health = r.headers;
      expect(r.headers['x-content-type-options']).toBe('nosniff');
      expect(r.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(r.headers['strict-transport-security']).toMatch(/max-age=\d+/);
      expect(r.headers['referrer-policy']).toBe('no-referrer');
      expect(r.headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(r.headers['x-permitted-cross-domain-policies']).toBe('none');
      expect(r.headers['x-dns-prefetch-control']).toBe('off');
      expect(r.headers['x-powered-by']).toBeUndefined();
      expect(r.headers['x-request-id']).toMatch(/.{8,}/);
    });

    it('PS-CFG-06 CORS solo autoriza el origen de la aplicación web', async () => {
      const permitido = await request(ORIGEN).options('/api/auth/login').set(desde('198.51.100.2'))
        .set('Origin', WEB_PERMITIDA).set('Access-Control-Request-Method', 'POST');
      const ajeno = await request(ORIGEN).options('/api/auth/login').set(desde('198.51.100.2'))
        .set('Origin', 'https://sitio-atacante.example').set('Access-Control-Request-Method', 'POST');
      evidencia.corsPermitido = permitido.headers;
      evidencia.corsAjeno = ajeno.headers;
      expect(permitido.headers['access-control-allow-origin']).toBe(WEB_PERMITIDA);
      expect(permitido.headers['access-control-allow-credentials']).toBe('true');
      expect(ajeno.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('PS-CFG-07 la documentación interactiva (Swagger) no se publica en producción', async () => {
      expect((await request(ORIGEN).get('/api/docs').set(desde('198.51.100.3'))).status).toBe(404);
      expect((await request(ORIGEN).get('/api/docs-json').set(desde('198.51.100.3'))).status).toBe(404);
    });

    it('PS-CFG-08 los errores tienen una forma única, con identificador y sin detalles internos', async () => {
      const r = await request(ORIGEN).get('/api/ruta-que-no-existe').set(desde('198.51.100.4'));
      expect(r.status).toBe(404);
      expect(r.body).toEqual(expect.objectContaining({ code: expect.any(String), message: expect.any(String), requestId: expect.any(String) }));
      const malFormado = await request(ORIGEN).post('/api/auth/login').set(desde('198.51.100.4'))
        .set('Content-Type', 'application/json').send('{"email": ');
      evidencia.errorJsonMalFormado = { status: malFormado.status, body: malFormado.body ?? malFormado.text };
      expect(malFormado.status).toBe(400);
      for (const texto of [JSON.stringify(r.body), malFormado.text]) {
        expect(texto).not.toMatch(/node_modules|\bat [\w.<>]+ \(|"stack"/i);
      }
    });

    it('PS-CFG-09 un cuerpo JSON de más de 256 KB se rechaza antes de procesarse', async () => {
      const r = await request(ORIGEN).post('/api/auth/login').set(desde('198.51.100.5'))
        .set('Content-Type', 'application/json').send(JSON.stringify({ email: 'a@univalle.edu', password: 'x'.repeat(300 * 1024) }));
      expect(r.status).toBe(413);
      expect(r.text).not.toMatch(/node_modules|\bat [\w.<>]+ \(/);
    });

    it('PS-CFG-10 en producción la cookie de sesión de la web solo viaja por HTTPS', async () => {
      const r = await request(ORIGEN).post('/api/auth/login').set(desde('198.51.100.6'))
        .set('X-Session-Transport', 'cookie').send({ email: 'luis.mamani@est.univalle.edu', password: CLAVE_POBLADA });
      expect(r.status).toBe(200);
      const cookie = ([] as string[]).concat(r.headers['set-cookie'] ?? []).find((c) => c.startsWith('afinia_rt='));
      evidencia.cookieProduccion = cookie?.replace(/^afinia_rt=[^;]+/, 'afinia_rt=[valor omitido]');
      expect(cookie).toMatch(/;\s*Secure/i);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Path=\/api\/auth/);
    });
  });

  describe('PS-ABU · Limitación de intentos (valores de producción)', () => {
    it('PS-ABU-05 tras 10 intentos de inicio de sesión en un minuto, la misma dirección recibe 429', async () => {
      const ip = '203.0.113.10';
      const estados: number[] = [];
      for (let i = 0; i < 11; i++) {
        const r = await request(ORIGEN).post('/api/auth/login').set(desde(ip))
          .send({ email: 'ana.quispe@est.univalle.edu', password: `Incorrecta-${i}-2026*` });
        estados.push(r.status);
        if (i === 10) {
          evidencia.loginLimitado = { status: r.status, retryAfter: r.headers['retry-after'] ?? null, body: r.body };
        }
      }
      evidencia.loginEstados = estados;
      expect(estados.slice(0, 10).every((s) => s === 401)).toBe(true);
      expect(estados[10]).toBe(429);
      // Incluso con la contraseña correcta, esa dirección sigue bloqueada durante la ventana.
      const correcta = await request(ORIGEN).post('/api/auth/login').set(desde(ip))
        .send({ email: 'ana.quispe@est.univalle.edu', password: CLAVE_POBLADA });
      expect(correcta.status).toBe(429);
    });

    it('PS-ABU-06 tras 5 solicitudes de activación o recuperación en un minuto, la misma dirección recibe 429', async () => {
      const ip = '203.0.113.20';
      const estados: number[] = [];
      for (let i = 0; i < 6; i++) {
        const r = await request(ORIGEN).post('/api/activation/forgot-password').set(desde(ip))
          .send({ email: 'nadie.existe@est.univalle.edu' });
        estados.push(r.status);
      }
      evidencia.recuperacionEstados = estados;
      expect(estados.slice(0, 5).every((s) => s === 200)).toBe(true);
      expect(estados[5]).toBe(429);
    });
  });
});
