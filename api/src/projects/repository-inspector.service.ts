import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LinkCheckStatus, TechnologyStatus } from '@perfil/shared';
import type {
  RepositoryMetadata,
  TechnologySignal,
} from '../entities/project-check.entity';
import { GithubApiCache } from '../entities/github-api-cache.entity';
import {
  DependencySignal,
  MANIFEST_FILES,
  MAX_MANIFEST_BYTES,
  signalsFromManifest,
} from './dependency-map';

/**
 * Inspección de un repositorio público (V3 §24, §25).
 *
 * Lo que se consulta, y nada más:
 *   1. el repositorio (existe, dueño/nombre, rama, fechas, público);
 *   2. los lenguajes (bytes por lenguaje: presencia, no dominio);
 *   3. el listado de la raíz (árbol limitado: un solo nivel);
 *   4. el texto de los manifiestos controlados (§24.3), con tope de tamaño;
 *   5. reglas deterministas dependencia → tecnología (`dependency-map.ts`).
 *
 * No se clona, no se instala ni se ejecuta nada del repositorio.
 *
 * Resiliencia (§24.6): cada respuesta se guarda con su ETag; dentro del
 * plazo de frescura no se vuelve a preguntar, y después se pregunta con
 * `If-None-Match` (un 304 no gasta cuota). Si GitHub avisa de cuota agotada
 * no se insiste hasta la hora de reinicio, y un fallo de red se reintenta
 * dos veces con espera creciente. Si aun así no responde, el resultado es
 * «sin comprobar»: no poder preguntar no prueba que el repositorio no exista.
 */

/** Ficheros cuya sola presencia ya es señal, aunque no se lean. */
const PRESENCIA: Record<string, string> = {
  'composer.json': 'PHP',
  Gemfile: 'Ruby',
  'go.mod': 'Go',
  'Cargo.toml': 'Rust',
};

const TIMEOUT_MS = 8_000;
const REINTENTOS_MS = [300, 900];

export interface RepositoryCheckResult {
  status: LinkCheckStatus;
  metadata: RepositoryMetadata | null;
  technologySignals: TechnologySignal[];
}

interface Respuesta {
  ok: boolean;
  status: number;
  data: any;
  /** Vino de la caché (fresca o confirmada con 304). */
  cached: boolean;
}

@Injectable()
export class RepositoryInspectorService {
  private readonly logger = new Logger(RepositoryInspectorService.name);
  private readonly token: string | null;
  private readonly enabled: boolean;
  /**
   * Base de la API de GitHub. Por defecto la pública; se configura para
   * GitHub Enterprise o, en las pruebas, para un GitHub simulado.
   */
  private readonly apiBase: string;
  /** Plazo en que una respuesta guardada se usa sin preguntar. */
  private readonly freshMs: number;
  /** Hasta cuándo no se pregunta porque GitHub dijo que no queda cuota. */
  private cuotaHasta = 0;

  constructor(
    config: ConfigService,
    @InjectRepository(GithubApiCache) private readonly cache: Repository<GithubApiCache>,
  ) {
    this.apiBase = (config.get<string>('GITHUB_API_BASE_URL') || 'https://api.github.com').replace(/\/+$/, '');
    // §24.6: el token es opcional. Sin él se usa la cuota pública, que es menor
    // pero suficiente para el volumen de una carrera.
    const raw = config.get<string>('GITHUB_TOKEN', '').trim();
    this.token = raw.length > 0 ? raw : null;
    this.enabled = config.get<string>('REPOSITORY_CHECK_ENABLED', 'true') !== 'false';
    const ttl = Number(config.get<string>('GITHUB_CACHE_TTL_SECONDS'));
    this.freshMs = (Number.isFinite(ttl) && ttl >= 0 ? ttl : 600) * 1000;
  }

  /**
   * Consulta el repositorio y cruza tecnologías.
   *
   * `declaradas` son las del proyecto; el resultado dice de cada una si
   * además se encontró rastro. `force` salta el plazo de frescura (sigue
   * usando ETag): es el «volver a comprobar» del responsable.
   */
  async inspect(repositoryUrl: string, declaradas: string[], opts: { force?: boolean } = {}): Promise<RepositoryCheckResult> {
    const vacio: RepositoryCheckResult = {
      status: LinkCheckStatus.UNVERIFIED,
      metadata: null,
      technologySignals: this.cruzar(declaradas, [], []),
    };
    if (!this.enabled) return vacio;

    const ref = this.parseGitHub(repositoryUrl);
    if (!ref) {
      // No es un repositorio de GitHub. No es un error: otros proveedores
      // simplemente no se inspeccionan.
      return vacio;
    }
    const sinComprobar = (motivo: string): RepositoryCheckResult => ({
      status: LinkCheckStatus.UNVERIFIED,
      metadata: this.metadataVacia(ref, motivo),
      technologySignals: this.cruzar(declaradas, [], []),
    });

    try {
      const base = `${this.apiBase}/repos/${ref.owner}/${ref.name}`;
      const repo = await this.get(base, opts.force);
      if (repo.status === 404) {
        return {
          status: LinkCheckStatus.UNAVAILABLE,
          metadata: this.metadataVacia(ref, 'El repositorio no existe o no es público.'),
          technologySignals: this.cruzar(declaradas, [], []),
        };
      }
      if (repo.status === 403 || repo.status === 429) {
        // Cuota agotada. No se sabe nada del repositorio, y decir que no
        // existe sería mentir.
        return sinComprobar('No se pudo consultar: cuota de la API agotada.');
      }
      if (!repo.ok || !repo.data) {
        return sinComprobar(`Respuesta inesperada (${repo.status}).`);
      }

      // V3 §22: con un token, GitHub también devuelve repositorios privados.
      // Un repositorio privado no es una fuente pública y no respalda nada.
      if (repo.data.private === true) {
        return {
          status: LinkCheckStatus.UNAVAILABLE,
          metadata: this.metadataVacia(ref, 'El repositorio es privado.'),
          technologySignals: this.cruzar(declaradas, [], []),
        };
      }

      const rama = repo.data.default_branch ?? 'main';
      const [lenguajes, raiz] = await Promise.all([
        this.fetchLanguages(base, opts.force),
        this.fetchRoot(base, rama, opts.force),
      ]);
      const dependencias = await this.readManifests(base, rama, raiz.manifiestos, opts.force);
      for (const f of raiz.presencia) {
        dependencias.push({ technology: PRESENCIA[f], file: f, evidence: f });
      }

      const metadata: RepositoryMetadata = {
        exists: true,
        owner: repo.data.owner?.login ?? ref.owner,
        repositoryName: repo.data.name ?? ref.name,
        defaultBranch: repo.data.default_branch ?? null,
        languages: lenguajes,
        updatedAt: repo.data.updated_at ?? null,
        pushedAt: repo.data.pushed_at ?? null,
        readmePresence: raiz.readme,
        manifests: [...raiz.manifiestos, ...raiz.presencia],
        dependencySignals: dependencias,
        stars: typeof repo.data.stargazers_count === 'number' ? repo.data.stargazers_count : null,
        fromCache: repo.cached,
        error: null,
      };

      return {
        status: LinkCheckStatus.AVAILABLE,
        metadata,
        technologySignals: this.cruzar(declaradas, lenguajes, dependencias),
      };
    } catch (error) {
      this.logger.debug(`No se pudo inspeccionar ${repositoryUrl}: ${String(error)}`);
      // V3 §20: no poder contactar con GitHub no prueba que el repositorio
      // no exista. Queda sin comprobar, no «no disponible».
      return sinComprobar('No se pudo contactar con el proveedor.');
    }
  }

  // ====================================================================

  /**
   * Cruza lo declarado con lo encontrado (§24.4).
   *
   *   BOTH     — declarada y con rastro (lenguaje o manifiesto). Corrobora.
   *   DECLARED — declarada sin rastro. No se marca falsa ni resta (§29):
   *              Redis puede no dejar huella en los manifiestos.
   *   DETECTED — hay rastro y no se declaró. Se informa sin añadirla al
   *              proyecto: lo que el estudiante declara es suyo.
   *
   * `source` dice de dónde salió: `languages` o `package.json (react)`.
   */
  private cruzar(
    declaradas: string[],
    lenguajes: string[],
    dependencias: DependencySignal[],
  ): TechnologySignal[] {
    const encontradas = new Map<string, { nombre: string; source: string }>();
    for (const l of lenguajes) encontradas.set(this.norm(l), { nombre: l, source: 'languages' });
    for (const d of dependencias) {
      const clave = this.norm(d.technology);
      // Un manifiesto es una señal más concreta que el lenguaje: se prefiere.
      const previa = encontradas.get(clave);
      if (!previa || previa.source === 'languages') {
        encontradas.set(clave, {
          nombre: d.technology,
          source: d.evidence && d.evidence !== d.file ? `${d.file} (${d.evidence})` : d.file,
        });
      }
    }

    const salida: TechnologySignal[] = [];
    const yaVistas = new Set<string>();
    for (const d of declaradas) {
      const clave = this.norm(d);
      if (yaVistas.has(clave)) continue;
      yaVistas.add(clave);
      const hallada = encontradas.get(clave);
      salida.push({
        name: d,
        status: hallada ? TechnologyStatus.BOTH : TechnologyStatus.DECLARED,
        source: hallada?.source ?? null,
      });
    }
    for (const [clave, hallada] of encontradas) {
      if (yaVistas.has(clave)) continue;
      salida.push({ name: hallada.nombre, status: TechnologyStatus.DETECTED, source: hallada.source });
    }
    return salida;
  }

  /** Extrae dueño y nombre de una URL de GitHub. */
  private parseGitHub(url: string): { owner: string; name: string } | null {
    try {
      const u = new URL(url);
      if (!/(^|\.)github\.com$/i.test(u.hostname)) return null;
      const partes = u.pathname.split('/').filter(Boolean);
      if (partes.length < 2) return null;
      const owner = partes[0];
      const name = partes[1].replace(/\.git$/i, '');
      // Nombres de GitHub: letras, cifras, punto, guion y guion bajo.
      if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(name)) return null;
      return { owner, name };
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------- HTTP

  /**
   * GET con caché, ETag, cuota y reintentos (§24.6).
   */
  private async get(url: string, force = false): Promise<Respuesta> {
    const guardada = await this.cache.findOne({ where: { url } });
    const deCache = (r: GithubApiCache): Respuesta => ({
      ok: r.status === 200, status: r.status, data: r.body ? JSON.parse(r.body) : null, cached: true,
    });
    if (guardada && !force && Date.now() - guardada.fetchedAt.getTime() < this.freshMs) {
      return deCache(guardada);
    }
    if (Date.now() < this.cuotaHasta) {
      // Sin cuota: lo último que se supo vale más que nada.
      return guardada ? deCache(guardada) : { ok: false, status: 403, data: null, cached: false };
    }

    let ultimoError: unknown = null;
    for (let intento = 0; intento <= REINTENTOS_MS.length; intento += 1) {
      if (intento > 0) await new Promise((r) => setTimeout(r, REINTENTOS_MS[intento - 1]));
      try {
        const res = await this.fetchOnce(url, guardada?.etag ?? null);
        if (res.status === 304 && guardada) {
          guardada.fetchedAt = new Date();
          await this.cache.save(guardada);
          return deCache(guardada);
        }
        const restante = res.headers.get('x-ratelimit-remaining');
        if ((res.status === 403 || res.status === 429) && (restante === '0' || res.status === 429)) {
          const reinicio = Number(res.headers.get('x-ratelimit-reset'));
          this.cuotaHasta = Number.isFinite(reinicio) && reinicio > 0 ? reinicio * 1000 : Date.now() + 60_000;
          this.logger.warn(`Cuota de GitHub agotada; se reanuda a las ${new Date(this.cuotaHasta).toISOString()}.`);
          return guardada ? deCache(guardada) : { ok: false, status: res.status, data: null, cached: false };
        }
        if (res.status >= 500) {
          ultimoError = new Error(`GitHub respondió ${res.status}`);
          continue;
        }
        const texto = res.status === 200 ? await res.text() : null;
        if (res.status === 200 || res.status === 404) {
          await this.cache.save(this.cache.create({
            url,
            etag: res.headers.get('etag'),
            status: res.status,
            body: texto,
            fetchedAt: new Date(),
          }));
        }
        return { ok: res.ok, status: res.status, data: texto ? JSON.parse(texto) : null, cached: false };
      } catch (error) {
        ultimoError = error;
      }
    }
    throw ultimoError ?? new Error('GitHub no respondió.');
  }

  private async fetchOnce(url: string, etag: string | null): Promise<Response> {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, {
        signal: control.signal,
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Afinia-RepositoryInspector/1.0',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...(etag ? { 'If-None-Match': etag } : {}),
        },
      });
    } finally {
      clearTimeout(reloj);
    }
  }

  // ------------------------------------------------------------ lectura

  private async fetchLanguages(base: string, force?: boolean): Promise<string[]> {
    const res = await this.get(`${base}/languages`, force);
    if (!res.ok || !res.data) return [];
    // El objeto es { lenguaje: bytes }. Se ordena por peso, que es el orden en
    // que el propio GitHub los presenta.
    return Object.entries(res.data as Record<string, number>)
      .sort((a, b) => b[1] - a[1])
      .map(([nombre]) => nombre)
      .slice(0, 12);
  }

  /**
   * Un solo listado de la raíz («tree limitado», §24.1): qué manifiestos
   * controlados hay y si existe README.
   */
  private async fetchRoot(base: string, branch: string, force?: boolean) {
    const res = await this.get(`${base}/contents/?ref=${encodeURIComponent(branch)}`, force);
    if (!res.ok || !Array.isArray(res.data)) return { manifiestos: [] as string[], presencia: [] as string[], readme: false };
    const ficheros = res.data
      .filter((e: any) => e?.type === 'file' && typeof e.name === 'string')
      .map((e: any) => ({ name: e.name as string, size: Number(e.size ?? 0) }));
    const tiene = (n: string) => ficheros.find((f: { name: string }) => f.name.toLowerCase() === n.toLowerCase());
    return {
      manifiestos: MANIFEST_FILES
        .filter((m) => {
          const f = tiene(m);
          return f && f.size <= MAX_MANIFEST_BYTES;
        })
        .map((m) => tiene(m)!.name),
      presencia: Object.keys(PRESENCIA).filter((p) => tiene(p)),
      readme: ficheros.some((f: { name: string }) => /^readme(\.|$)/i.test(f.name)),
    };
  }

  /** Lee el texto de cada manifiesto controlado y aplica las reglas (§24.3). */
  private async readManifests(base: string, branch: string, ficheros: string[], force?: boolean): Promise<DependencySignal[]> {
    const salida: DependencySignal[] = [];
    for (const f of ficheros) {
      try {
        const res = await this.get(`${base}/contents/${encodeURIComponent(f)}?ref=${encodeURIComponent(branch)}`, force);
        if (!res.ok || !res.data || res.data.encoding !== 'base64' || typeof res.data.content !== 'string') continue;
        if (Number(res.data.size ?? 0) > MAX_MANIFEST_BYTES) continue;
        const texto = Buffer.from(res.data.content, 'base64').toString('utf8');
        salida.push(...signalsFromManifest(f, texto));
      } catch {
        // Un manifiesto que no se pudo leer no aporta, pero no tumba el resto.
      }
    }
    return salida;
  }

  private metadataVacia(
    ref: { owner: string; name: string },
    error: string,
  ): RepositoryMetadata {
    return {
      exists: false,
      owner: ref.owner,
      repositoryName: ref.name,
      defaultBranch: null,
      languages: [],
      updatedAt: null,
      pushedAt: null,
      readmePresence: false,
      manifests: [],
      dependencySignals: [],
      stars: null,
      fromCache: false,
      error,
    };
  }

  private norm(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9+#]/g, '');
  }
}
