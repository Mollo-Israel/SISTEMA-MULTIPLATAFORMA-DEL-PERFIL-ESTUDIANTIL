/**
 * Pruebas de seguridad — reglas puras (capítulo III, sección 3.4).
 *
 * Política de contraseñas, arranque seguro en producción y protección del
 * verificador de enlaces frente a SSRF. No usan base de datos ni red externa:
 * el único servidor es uno local que la propia prueba levanta para simular
 * una redirección maliciosa.
 */
import { ConfigService } from '@nestjs/config';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { LinkCheckStatus } from '@perfil/shared';
import { passwordPolicyError } from '../../src/common/validation';
import { resolveCorsOptions, resolveJwtSecret } from '../../src/config/security.config';
import { resolveRefreshSecret } from '../../src/config/identity.config';
import { assertEnvironment } from '../../src/config/environment.check';
import { LinkCheckerService } from '../../src/validation/link-checker.service';

/** ConfigService mínimo: solo lo que se le pasa existe. */
const config = (valores: Record<string, string>): ConfigService =>
  ({ get: (clave: string, porDefecto?: unknown) => (clave in valores ? valores[clave] : porDefecto) }) as unknown as ConfigService;

const SECRETO_A = 'a'.repeat(24) + 'Afinia-Prueba-1';
const SECRETO_B = 'b'.repeat(24) + 'Afinia-Prueba-2';

/** Configuración de producción completa (valores ficticios, sin envío real). */
const PRODUCCION: Record<string, string> = {
  NODE_ENV: 'production',
  POSTGRES_HOST: 'localhost', POSTGRES_DB: 'afinia', POSTGRES_USER: 'afinia',
  WEB_ORIGINS: 'https://afinia.example.org',
  WEB_APP_URL: 'https://afinia.example.org',
  INSTITUTIONAL_EMAIL_DOMAINS: 'univalle.edu',
  MAIL_TRANSPORT: 'smtp', SMTP_HOST: 'smtp.example.org', SMTP_PORT: '587',
  SMTP_USER: 'avisos@univalle.edu', SMTP_PASSWORD: 'clave-ficticia', SMTP_FROM: 'avisos@univalle.edu',
  JWT_ACCESS_SECRET: SECRETO_A, JWT_REFRESH_SECRET: SECRETO_B,
};

describe('PS-CON · Política de contraseñas', () => {
  const contexto = { email: 'ana.quispe@est.univalle.edu', universityCode: 'EST-38DJ1HA' };

  it.each([
    ['PS-CON-01', 'con menos de 12 caracteres', 'Corta-2026*'],
    ['PS-CON-02', 'sin mayúsculas', 'sinmayusculas-2026*'],
    ['PS-CON-03', 'sin minúsculas', 'SINMINUSCULAS-2026*'],
    ['PS-CON-04', 'sin números', 'SinNumerosNunca*'],
    ['PS-CON-05', 'sin símbolos', 'SinSimbolos2026Ab'],
    ['PS-CON-06', 'con espacios', 'Con Espacios 2026*'],
    ['PS-CON-07', 'que contiene el correo', 'Ana.Quispe-2026*x'],
    ['PS-CON-08', 'que contiene el código universitario', 'Clave-EST-38DJ1HA*'],
  ])('%s se rechaza una contraseña %s', (_codigo, _motivo, clave) => {
    // El motivo forma parte del nombre de la prueba («con menos de…», «sin…», «que contiene…»).
    expect(passwordPolicyError(clave, contexto)).not.toBeNull();
  });

  it('PS-CON-09 se acepta una contraseña que cumple la política', () => {
    expect(passwordPolicyError('Trayectoria-Segura-2026*', contexto)).toBeNull();
  });
});

describe('PS-CFG · Arranque seguro en producción', () => {
  it('PS-CFG-01 sin secreto de firma, o con el valor de ejemplo, la API no arranca en producción', () => {
    expect(() => resolveJwtSecret(config({ NODE_ENV: 'production' }))).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => resolveJwtSecret(config({ NODE_ENV: 'production', JWT_ACCESS_SECRET: 'cambiar_este_secreto_de_acceso' })))
      .toThrow(/JWT_ACCESS_SECRET/);
    expect(() => resolveJwtSecret(config({ NODE_ENV: 'production', JWT_ACCESS_SECRET: 'corto' }))).toThrow();
    expect(resolveJwtSecret(config({ NODE_ENV: 'production', JWT_ACCESS_SECRET: SECRETO_A }))).toBe(SECRETO_A);
  });

  it('PS-CFG-02 el secreto de renovación debe ser propio y distinto del de acceso', () => {
    expect(() => resolveRefreshSecret(config({ NODE_ENV: 'production', JWT_REFRESH_SECRET: SECRETO_A }), SECRETO_A))
      .toThrow(/JWT_REFRESH_SECRET/);
    expect(resolveRefreshSecret(config({ NODE_ENV: 'production', JWT_REFRESH_SECRET: SECRETO_B }), SECRETO_A)).toBe(SECRETO_B);
  });

  it('PS-CFG-03 en producción CORS exige una lista explícita de orígenes', () => {
    expect(() => resolveCorsOptions(config({ NODE_ENV: 'production' }))).toThrow(/WEB_ORIGINS/);
    expect(resolveCorsOptions(config({ NODE_ENV: 'production', WEB_ORIGINS: 'https://afinia.example.org' })))
      .toEqual({ origin: ['https://afinia.example.org'], credentials: true });
    // Un comodín nunca se combina con credenciales.
    expect(resolveCorsOptions(config({ NODE_ENV: 'production', WEB_ORIGINS: '*' }))).toEqual({ origin: true, credentials: false });
  });

  it('PS-CFG-04 una configuración de producción incompleta o insegura detiene el arranque', () => {
    expect(() => assertEnvironment(config(PRODUCCION))).not.toThrow();
    expect(() => assertEnvironment(config({ ...PRODUCCION, MAIL_TRANSPORT: 'console' }))).toThrow(/MAIL_TRANSPORT=console/);
    expect(() => assertEnvironment(config({ ...PRODUCCION, WEB_APP_URL: 'http://afinia.example.org' }))).toThrow(/https/);
    const sinDominios = { ...PRODUCCION };
    delete sinDominios.INSTITUTIONAL_EMAIL_DOMAINS;
    expect(() => assertEnvironment(config(sinDominios))).toThrow(/INSTITUTIONAL_EMAIL_DOMAINS/);
  });
});

describe('PS-SSRF · Verificador de enlaces frente a solicitudes a recursos internos', () => {
  // Perfil de producción: sin orígenes de prueba, la protección no tiene excepciones.
  const verificador = new LinkCheckerService(config({ NODE_ENV: 'production', LINK_CHECK_ENABLED: 'true', LINK_CHECK_TIMEOUT_MS: '3000' }));

  it.each([
    ['PS-SSRF-01', 'servicio de metadatos de la nube', 'http://169.254.169.254/latest/meta-data/'],
    ['PS-SSRF-02', 'bucle local por nombre', 'http://localhost:5432/'],
    ['PS-SSRF-03', 'bucle local por dirección', 'http://127.0.0.1:3010/api/users'],
    ['PS-SSRF-04', 'red privada 10.0.0.0/8', 'http://10.0.0.5/'],
    ['PS-SSRF-05', 'red privada 192.168.0.0/16', 'http://192.168.0.1/admin'],
    ['PS-SSRF-06', 'red privada 172.16.0.0/12', 'http://172.16.4.2/'],
    ['PS-SSRF-07', 'bucle local en IPv6', 'http://[::1]:3010/'],
    ['PS-SSRF-08', 'IPv4 escondida en IPv6', 'http://[::ffff:127.0.0.1]/'],
    ['PS-SSRF-09', 'esquema file://', 'file:///etc/passwd'],
    ['PS-SSRF-10', 'credenciales incrustadas en la dirección', 'http://usuario:clave@example.org/'],
  ])('%s se bloquea: %s', async (_codigo, _caso, url) => {
    const r = await verificador.check(url);
    expect(r.status).toBe(LinkCheckStatus.BLOCKED);
    expect(r.httpStatus).toBeNull();
    expect(r.blockedReason).toBeTruthy();
  });

  describe('redirección hacia una dirección interna', () => {
    let servidor: Server;
    let puerto: number;
    let pedidos = 0;

    beforeAll(async () => {
      // Servidor «externo» simulado que intenta llevar al verificador a la red interna.
      servidor = createServer((_req, res) => {
        pedidos += 1;
        res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/iam/' });
        res.end();
      });
      await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
      puerto = (servidor.address() as AddressInfo).port;
    });
    afterAll(async () => { await new Promise((ok) => servidor.close(ok)); });

    it('PS-SSRF-11 una redirección hacia el servicio de metadatos se bloquea en el segundo salto', async () => {
      const origen = `emisor.afinia-pruebas.org:${puerto}`;
      const conOrigenDePrueba = new LinkCheckerService(config({
        NODE_ENV: 'development', LINK_CHECK_ENABLED: 'true', LINK_CHECK_TIMEOUT_MS: '3000',
        LINK_CHECK_TEST_ORIGINS: `${origen}=127.0.0.1:${puerto}`,
      }));
      const r = await conOrigenDePrueba.check(`http://${origen}/credencial/123`);
      expect(pedidos).toBe(1); // se consultó el primer salto…
      expect(r.status).toBe(LinkCheckStatus.BLOCKED); // …y el segundo no se siguió
      expect(r.finalUrl).toContain('169.254.169.254');
    });
  });
});
