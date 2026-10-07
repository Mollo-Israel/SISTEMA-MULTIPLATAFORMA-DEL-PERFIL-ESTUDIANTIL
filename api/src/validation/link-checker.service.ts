import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { LinkCheckStatus } from '@perfil/shared';
import type { LinkCheckResult } from '../entities/validation-record.entity';

/**
 * Comprobación de enlaces externos (especificacion §31).
 *
 * Este servicio hace peticiones a direcciones que escribe un usuario. Sin
 * cuidado eso es una falsificación de peticiones del lado del servidor: el
 * atacante no puede alcanzar la red interna, pero el servidor sí, y aquí se le
 * está pidiendo que vaya a donde le digan. Por eso:
 *
 *   - solo HTTP y HTTPS;
 *   - se resuelve el DNS **antes** de conectar y se rechaza toda IP privada,
 *     de bucle local, enlace local o reservada;
 *   - se comprueba cada salto de una redirección, no solo el primero, porque
 *     un servidor externo puede redirigir a `127.0.0.1` a propósito;
 *   - número de saltos, tiempo y tamaño de respuesta acotados.
 *
 * `BLOCKED` es un estado distinto de `UNAVAILABLE` a propósito: si fueran el
 * mismo, la respuesta diría si una dirección interna existe o no, y el
 * verificador se convertiría en un escáner de la red a disposición de
 * cualquiera.
 */

const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * Rangos que nunca se consultan.
 *
 * `169.254.169.254` merece mención aparte: es el servicio de metadata de AWS,
 * GCP y Azure, y desde dentro de una instancia entrega credenciales. Está
 * cubierto por el rango enlace-local, pero se comprueba explícitamente porque
 * es el objetivo concreto de este tipo de ataque.
 */
const CLOUD_METADATA = new Set(['169.254.169.254', 'fd00:ec2::254', '100.100.100.200']);

/** Motivo que no es un bloqueo de seguridad sino un servidor ausente. */
const NO_RESUELVE = 'No se pudo resolver el nombre del servidor.';

/** Lo consultado más el cuerpo, que se usa para comparar y nunca se guarda. */
export interface FetchedPage {
  result: LinkCheckResult;
  body: string | null;
  contentType: string | null;
}

@Injectable()
export class LinkCheckerService {
  private readonly logger = new Logger(LinkCheckerService.name);
  private readonly timeoutMs: number;
  private readonly enabled: boolean;
  /**
   * Orígenes `host:puerto` que las suites de integración levantan en local
   * para simular un verificador oficial. En producción se ignora siempre,
   * aunque alguien lo configure: ahí la protección SSRF no tiene excepciones.
   */
  private readonly testOrigins: Map<string, string>;

  constructor(config: ConfigService) {
    const raw = Number(config.get<string>('LINK_CHECK_TIMEOUT_MS'));
    this.timeoutMs = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
    // Permite apagarlo donde no haya salida a internet. Apagado, todo queda
    // UNVERIFIED, que es honesto: no se comprobó.
    this.enabled = config.get<string>('LINK_CHECK_ENABLED', 'true') !== 'false';
    const pruebas = (config.get<string>('LINK_CHECK_TEST_ORIGINS') ?? '')
      .split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    const produccion = (config.get<string>('NODE_ENV') ?? process.env.NODE_ENV) === 'production';
    if (pruebas.length && produccion) {
      this.logger.warn('LINK_CHECK_TEST_ORIGINS se ignora en producción.');
    }
    // `host:puerto` permite ese origen tal cual; `nombre:puerto=ip:puerto`
    // además lo dirige a una IP local, para probar con un nombre de dominio
    // sin depender del DNS público.
    this.testOrigins = new Map(
      (produccion ? [] : pruebas).map((x) => {
        const [origen, destino] = x.split('=');
        return [origen, destino ?? origen] as [string, string];
      }),
    );
  }

  async check(url: string): Promise<LinkCheckResult> {
    return (await this.fetchPage(url)).result;
  }

  /**
   * Igual que `check`, pero devuelve también el cuerpo (como mucho 256 KB)
   * para comparar la página oficial con lo declarado (V3 §18.2). El cuerpo
   * no se persiste: puede contener datos de terceros.
   */
  async fetchPage(url: string): Promise<FetchedPage> {
    const ahora = new Date().toISOString();
    const base: LinkCheckResult = {
      status: LinkCheckStatus.UNVERIFIED,
      finalUrl: null,
      httpStatus: null,
      title: null,
      blockedReason: null,
      checkedAt: ahora,
    };

    const sinCuerpo = (result: LinkCheckResult): FetchedPage => ({ result, body: null, contentType: null });
    if (!this.enabled) return sinCuerpo(base);

    let actual: URL;
    try {
      actual = new URL(url);
    } catch {
      return sinCuerpo({ ...base, status: LinkCheckStatus.BLOCKED, blockedReason: 'La dirección no es válida.' });
    }

    for (let salto = 0; salto <= MAX_REDIRECTS; salto += 1) {
      const veredicto = await this.assertSafe(actual);
      if (veredicto) {
        // Que un nombre no resuelva no es un bloqueo de seguridad: es un
        // servidor que no esta. Llamarlo BLOCKED mezclaria «me niego a ir»
        // con «no existe», que es justo lo que §31 separa.
        const inexistente = veredicto === NO_RESUELVE;
        return sinCuerpo({
          ...base,
          status: inexistente ? LinkCheckStatus.UNAVAILABLE : LinkCheckStatus.BLOCKED,
          blockedReason: inexistente ? null : veredicto,
          finalUrl: actual.toString(),
        });
      }

      let respuesta: Response;
      try {
        respuesta = await this.fetchOnce(actual);
      } catch (error) {
        return sinCuerpo({
          ...base,
          status: LinkCheckStatus.UNAVAILABLE,
          finalUrl: actual.toString(),
          blockedReason: null,
          title: null,
          httpStatus: null,
          ...(this.logFallo(actual, error) ?? {}),
        });
      }

      const redireccion = respuesta.status >= 300 && respuesta.status < 400;
      const destino = respuesta.headers.get('location');
      if (redireccion && destino) {
        if (salto === MAX_REDIRECTS) {
          return sinCuerpo({
            ...base,
            status: LinkCheckStatus.UNAVAILABLE,
            finalUrl: actual.toString(),
            httpStatus: respuesta.status,
          });
        }
        try {
          actual = new URL(destino, actual);
        } catch {
          return sinCuerpo({ ...base, status: LinkCheckStatus.UNAVAILABLE, finalUrl: actual.toString() });
        }
        continue;
      }

      const tipo = respuesta.headers.get('content-type');
      const texto = await this.readBody(respuesta);
      return {
        result: {
          ...base,
          status: respuesta.ok ? LinkCheckStatus.AVAILABLE : LinkCheckStatus.UNAVAILABLE,
          finalUrl: actual.toString(),
          httpStatus: respuesta.status,
          title: tipo?.includes('html') && texto ? this.titleOf(texto) : null,
        },
        body: respuesta.ok ? texto : null,
        contentType: tipo,
      };
    }

    return sinCuerpo({ ...base, status: LinkCheckStatus.UNAVAILABLE, finalUrl: actual.toString() });
  }

  // ====================================================================

  /**
   * Decide si es seguro consultar esta dirección.
   *
   * Devuelve el motivo del rechazo, o `null` si puede consultarse.
   */
  private async assertSafe(url: URL): Promise<string | null> {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'Solo se comprueban direcciones HTTP y HTTPS.';
    }
    if (url.username || url.password) {
      return 'No se comprueban direcciones con credenciales incrustadas.';
    }

    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!host) return 'La dirección no tiene servidor.';
    if (this.testOrigins.size) {
      const puerto = url.port || (url.protocol === 'https:' ? '443' : '80');
      if (this.testOrigins.has(`${host}:${puerto}`)) return null;
    }
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
      return 'No se consultan direcciones locales.';
    }
    if (CLOUD_METADATA.has(host)) {
      return 'No se consulta el servicio de metadata de la nube.';
    }

    // Si el host ya es una IP, se comprueba tal cual. Si es un nombre, hay que
    // resolverlo: un dominio publico puede apuntar a 127.0.0.1 a proposito.
    const direcciones: string[] = [];
    if (isIP(host)) {
      direcciones.push(host);
    } else {
      try {
        const resueltas = await lookup(host, { all: true, verbatim: true });
        direcciones.push(...resueltas.map((r) => r.address));
      } catch {
        return NO_RESUELVE;
      }
    }
    if (direcciones.length === 0) return 'El nombre no resolvió a ninguna dirección.';

    // Basta que UNA resolucion sea interna para rechazar: con DNS de respuesta
    // rotatoria, aceptar "alguna es publica" dejaria pasar el ataque una de
    // cada dos veces.
    for (const ip of direcciones) {
      if (CLOUD_METADATA.has(ip)) return 'No se consulta el servicio de metadata de la nube.';
      const motivo = this.rangoProhibido(ip);
      if (motivo) return motivo;
    }
    return null;
  }

  /** Motivo por el que una IP no debe consultarse, o `null` si es pública. */
  private rangoProhibido(ip: string): string | null {
    const version = isIP(ip);

    if (version === 4) {
      const o = ip.split('.').map(Number);
      if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
        return 'Dirección IPv4 mal formada.';
      }
      if (o[0] === 0) return 'Rango reservado.';
      if (o[0] === 10) return 'Rango privado.';
      if (o[0] === 127) return 'Dirección de bucle local.';
      if (o[0] === 169 && o[1] === 254) return 'Rango enlace-local.';
      if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return 'Rango privado.';
      if (o[0] === 192 && o[1] === 168) return 'Rango privado.';
      if (o[0] === 192 && o[1] === 0 && o[2] === 0) return 'Rango reservado.';
      if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return 'Rango compartido de operador.';
      if (o[0] >= 224) return 'Rango multidifusión o reservado.';
      return null;
    }

    if (version === 6) {
      const grupos = this.expandirIpv6(ip);
      if (!grupos) return 'Dirección IPv6 mal formada.';

      // ::  y  ::1
      if (grupos.slice(0, 7).every((g) => g === 0)) {
        return grupos[7] <= 1 ? 'Dirección de bucle local.' : 'Rango reservado.';
      }

      // IPv4 embebida: ::ffff:a.b.c.d. `new URL` la reescribe a su forma
      // hexadecimal (::ffff:7f00:1), asi que comparar el texto no basta: hay
      // que expandir la direccion y mirar los grupos. Sin esto, ::ffff:127.0.0.1
      // pasaba el filtro y el servidor acababa hablando con su propio bucle
      // local.
      const mapeada = grupos.slice(0, 5).every((g) => g === 0) && grupos[5] === 0xffff;
      if (mapeada) {
        const a = (grupos[6] >> 8) & 0xff;
        const b = grupos[6] & 0xff;
        const c = (grupos[7] >> 8) & 0xff;
        const d = grupos[7] & 0xff;
        return this.rangoProhibido(`${a}.${b}.${c}.${d}`);
      }

      const primero = grupos[0];
      if ((primero & 0xffc0) === 0xfe80) return 'Rango enlace-local.';
      if ((primero & 0xfe00) === 0xfc00) return 'Rango privado.';
      if ((primero & 0xff00) === 0xff00) return 'Rango multidifusión.';
      return null;
    }

    return 'Dirección no reconocida.';
  }

  /**
   * Expande una IPv6 a sus ocho grupos de 16 bits.
   *
   * Hace falta porque la misma dirección se escribe de muchas formas —`::1`,
   * `0:0:0:0:0:0:0:1`, `::ffff:127.0.0.1`, `::ffff:7f00:1`— y comparar cadenas
   * deja pasar las variantes que no se previeron. Comparando números no hay
   * variantes.
   */
  private expandirIpv6(ip: string): number[] | null {
    let texto = ip.toLowerCase();

    // Cola en notación IPv4: se convierte a dos grupos hexadecimales.
    const cola = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(texto);
    if (cola) {
      const o = cola[1].split('.').map(Number);
      if (o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
      const alto = ((o[0] << 8) | o[1]).toString(16);
      const bajo = ((o[2] << 8) | o[3]).toString(16);
      texto = `${texto.slice(0, cola.index)}${alto}:${bajo}`;
    }

    const partes = texto.split('::');
    if (partes.length > 2) return null;

    const aNumeros = (trozo: string) =>
      (trozo === '' ? [] : trozo.split(':').map((g) => parseInt(g, 16)));

    const izquierda = aNumeros(partes[0]);
    const derecha = partes.length === 2 ? aNumeros(partes[1]) : [];
    if ([...izquierda, ...derecha].some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) {
      return null;
    }

    if (partes.length === 1) {
      return izquierda.length === 8 ? izquierda : null;
    }
    const relleno = 8 - izquierda.length - derecha.length;
    if (relleno < 0) return null;
    return [...izquierda, ...Array(relleno).fill(0), ...derecha];
  }

  /**
   * Una sola petición, acotada en tiempo y sin seguir redirecciones sola.
   *
   * `redirect: 'manual'` es deliberado: seguirlas automáticamente saltaría la
   * comprobación de cada salto, que es justo donde vive el ataque.
   */
  private async fetchOnce(original: URL): Promise<Response> {
    let url = original;
    if (this.testOrigins.size) {
      const puerto = original.port || (original.protocol === 'https:' ? '443' : '80');
      const destino = this.testOrigins.get(`${original.hostname.toLowerCase()}:${puerto}`);
      if (destino && destino !== `${original.hostname.toLowerCase()}:${puerto}`) {
        url = new URL(original.toString());
        url.host = destino;
      }
    }
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), this.timeoutMs);
    try {
      return await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: control.signal,
        headers: {
          // Identificarse es lo correcto y además evita bloqueos de los
          // emisores que rechazan clientes sin agente.
          'User-Agent': 'Afinia-LinkChecker/1.0 (+verificacion de certificados)',
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        },
      });
    } finally {
      clearTimeout(reloj);
    }
  }

  /** Cuerpo de texto (HTML, JSON o texto), leyendo como mucho MAX_BODY_BYTES. */
  private async readBody(respuesta: Response): Promise<string | null> {
    const tipo = respuesta.headers.get('content-type') ?? '';
    if (!/html|json|text/.test(tipo)) return null;

    const cuerpo = respuesta.body;
    if (!cuerpo) return null;

    const lector = cuerpo.getReader();
    const trozos: Uint8Array[] = [];
    let leidos = 0;
    try {
      // Se corta al llegar al limite: una respuesta enorme no debe poder
      // agotar la memoria del servidor.
      while (leidos < MAX_BODY_BYTES) {
        const { done, value } = await lector.read();
        if (done) break;
        trozos.push(value);
        leidos += value.byteLength;
      }
    } catch {
      return null;
    } finally {
      await lector.cancel().catch(() => {});
    }

    return Buffer.concat(trozos.map((t) => Buffer.from(t))).toString('utf8').slice(0, MAX_BODY_BYTES);
  }

  private titleOf(html: string): string | null {
    const m = /<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(html);
    if (!m) return null;
    return m[1].replace(/\s+/g, ' ').trim().slice(0, 200) || null;
  }

  private logFallo(url: URL, error: unknown): null {
    this.logger.debug(`No se pudo consultar ${url.origin}: ${String(error)}`);
    return null;
  }
}
