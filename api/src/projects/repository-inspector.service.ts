import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LinkCheckStatus, TechnologyStatus } from '@perfil/shared';
import type {
  RepositoryMetadata,
  TechnologySignal,
} from '../entities/project-check.entity';

/**
 * Inspección de un repositorio público (especificacion §37, §38).
 *
 * GitHub es **opcional**: un proyecto no necesita repositorio para existir, y
 * que no lo tenga no lo penaliza. Cuando lo hay, se consulta solo lo que §37
 * autoriza —metadata pública y la presencia de manifiestos— y nunca se
 * descarga ni se analiza el repositorio entero.
 *
 * Lo que sale de aquí no dice que nadie domine nada. §38 lo deja escrito:
 * «detected» significa que se encontraron indicios compatibles.
 */

/** Manifiestos que §38 nombra como señal válida. */
const MANIFESTS = [
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'pom.xml',
  'build.gradle',
  'Dockerfile',
  'docker-compose.yml',
  'composer.json',
  'Gemfile',
  'go.mod',
  'Cargo.toml',
];

/**
 * Tecnologías que un manifiesto permite inferir por su sola presencia.
 *
 * Se queda corto a propósito. Leer las dependencias de un `package.json` daría
 * mucho más, pero §37 prohíbe analizar el repositorio sin límite, y la
 * presencia del fichero ya es la señal que §38 pide.
 */
const TECH_BY_MANIFEST: Record<string, string[]> = {
  'package.json': ['JavaScript', 'Node.js'],
  'requirements.txt': ['Python'],
  'pyproject.toml': ['Python'],
  'pom.xml': ['Java', 'Maven'],
  'build.gradle': ['Java', 'Gradle'],
  Dockerfile: ['Docker'],
  'docker-compose.yml': ['Docker'],
  'composer.json': ['PHP'],
  Gemfile: ['Ruby'],
  'go.mod': ['Go'],
  'Cargo.toml': ['Rust'],
};

const TIMEOUT_MS = 8_000;

export interface RepositoryCheckResult {
  status: LinkCheckStatus;
  metadata: RepositoryMetadata | null;
  technologySignals: TechnologySignal[];
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

  constructor(config: ConfigService) {
    this.apiBase = (config.get<string>('GITHUB_API_BASE_URL') || 'https://api.github.com').replace(/\/+$/, '');
    // §37: el token es opcional. Sin él se usa la cuota pública, que es menor
    // pero suficiente para el volumen de una carrera.
    const raw = config.get<string>('GITHUB_TOKEN', '').trim();
    this.token = raw.length > 0 ? raw : null;
    this.enabled = config.get<string>('REPOSITORY_CHECK_ENABLED', 'true') !== 'false';
  }

  /**
   * Consulta la metadata pública del repositorio y cruza tecnologías.
   *
   * `declaradas` son las que el estudiante escribió en el proyecto; el
   * resultado dice de cada una si además se encontró rastro.
   */
  async inspect(repositoryUrl: string, declaradas: string[]): Promise<RepositoryCheckResult> {
    const vacio: RepositoryCheckResult = {
      status: LinkCheckStatus.UNVERIFIED,
      metadata: null,
      technologySignals: this.cruzar(declaradas, [], {}),
    };
    if (!this.enabled) return vacio;

    const ref = this.parseGitHub(repositoryUrl);
    if (!ref) {
      // No es un repositorio de GitHub. No es un error: §37 habla de GitHub,
      // y otros proveedores simplemente no se inspeccionan.
      return vacio;
    }

    try {
      const repo = await this.fetchJson(`${this.apiBase}/repos/${ref.owner}/${ref.name}`);
      if (repo.status === 404) {
        return {
          status: LinkCheckStatus.UNAVAILABLE,
          metadata: this.metadataVacia(ref, 'El repositorio no existe o no es público.'),
          technologySignals: this.cruzar(declaradas, [], {}),
        };
      }
      if (repo.status === 403) {
        // Cuota agotada. No se sabe nada del repositorio, y decir que no
        // existe sería mentir.
        return {
          status: LinkCheckStatus.UNVERIFIED,
          metadata: this.metadataVacia(ref, 'No se pudo consultar: cuota de la API agotada.'),
          technologySignals: this.cruzar(declaradas, [], {}),
        };
      }
      if (!repo.ok || !repo.data) {
        return {
          status: LinkCheckStatus.UNAVAILABLE,
          metadata: this.metadataVacia(ref, `Respuesta inesperada (${repo.status}).`),
          technologySignals: this.cruzar(declaradas, [], {}),
        };
      }

      // V3 §22: con un token, GitHub también devuelve repositorios privados.
      // Un repositorio privado no es una fuente pública y no respalda nada.
      if (repo.data.private === true) {
        return {
          status: LinkCheckStatus.UNAVAILABLE,
          metadata: this.metadataVacia(ref, 'El repositorio es privado.'),
          technologySignals: this.cruzar(declaradas, [], {}),
        };
      }

      const [lenguajes, manifiestos] = await Promise.all([
        this.fetchLanguages(ref),
        this.fetchManifests(ref, repo.data.default_branch ?? 'main'),
      ]);

      const metadata: RepositoryMetadata = {
        exists: true,
        owner: repo.data.owner?.login ?? ref.owner,
        repositoryName: repo.data.name ?? ref.name,
        defaultBranch: repo.data.default_branch ?? null,
        languages: lenguajes,
        updatedAt: repo.data.updated_at ?? null,
        readmePresence: manifiestos.readme,
        manifests: manifiestos.encontrados,
        stars: typeof repo.data.stargazers_count === 'number' ? repo.data.stargazers_count : null,
        error: null,
      };

      const desdeManifiestos: Record<string, string> = {};
      for (const fichero of manifiestos.encontrados) {
        for (const tech of TECH_BY_MANIFEST[fichero] ?? []) {
          desdeManifiestos[this.norm(tech)] = fichero;
        }
      }

      return {
        status: LinkCheckStatus.AVAILABLE,
        metadata,
        technologySignals: this.cruzar(declaradas, lenguajes, desdeManifiestos),
      };
    } catch (error) {
      this.logger.debug(`No se pudo inspeccionar ${repositoryUrl}: ${String(error)}`);
      // V3 §20: no poder contactar con GitHub no prueba que el repositorio
      // no exista. Queda sin comprobar, no «no disponible».
      return {
        status: LinkCheckStatus.UNVERIFIED,
        metadata: this.metadataVacia(ref, 'No se pudo contactar con el proveedor.'),
        technologySignals: this.cruzar(declaradas, [], {}),
      };
    }
  }

  // ====================================================================

  /**
   * Cruza lo declarado con lo encontrado (§38).
   *
   * Tres estados, y cada uno significa algo distinto:
   *   BOTH     — declarada y con rastro. Es la única que corrobora.
   *   DECLARED — el estudiante la declaró y no se encontró rastro. Puede ser
   *              perfectamente cierta: PostgreSQL no deja huella en los
   *              lenguajes de un repositorio (§39).
   *   DETECTED — hay rastro y no se declaró. Se informa sin añadirla al
   *              proyecto: lo que el estudiante declara es suyo.
   */
  private cruzar(
    declaradas: string[],
    lenguajes: string[],
    desdeManifiestos: Record<string, string>,
  ): TechnologySignal[] {
    const encontradas = new Map<string, string>();
    for (const l of lenguajes) encontradas.set(this.norm(l), 'languages');
    for (const [k, v] of Object.entries(desdeManifiestos)) encontradas.set(k, v);

    const salida: TechnologySignal[] = [];
    const yaVistas = new Set<string>();

    for (const d of declaradas) {
      const clave = this.norm(d);
      yaVistas.add(clave);
      const origen = encontradas.get(clave) ?? null;
      salida.push({
        name: d,
        status: origen ? TechnologyStatus.BOTH : TechnologyStatus.DECLARED,
        source: origen,
      });
    }

    for (const [clave, origen] of encontradas) {
      if (yaVistas.has(clave)) continue;
      const original = lenguajes.find((l) => this.norm(l) === clave) ?? clave;
      salida.push({ name: original, status: TechnologyStatus.DETECTED, source: origen });
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

  private async fetchJson(url: string): Promise<{ ok: boolean; status: number; data: any }> {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: control.signal,
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Afinia-RepositoryInspector/1.0',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
      });
      const data = res.ok ? await res.json().catch(() => null) : null;
      return { ok: res.ok, status: res.status, data };
    } finally {
      clearTimeout(reloj);
    }
  }

  private async fetchLanguages(ref: { owner: string; name: string }): Promise<string[]> {
    const res = await this.fetchJson(
      `${this.apiBase}/repos/${ref.owner}/${ref.name}/languages`,
    );
    if (!res.ok || !res.data) return [];
    // El objeto es { lenguaje: bytes }. Se ordena por peso, que es el orden en
    // que el propio GitHub los presenta.
    return Object.entries(res.data as Record<string, number>)
      .sort((a, b) => b[1] - a[1])
      .map(([nombre]) => nombre)
      .slice(0, 12);
  }

  /**
   * Qué manifiestos existen en la raíz.
   *
   * Se pide **un solo** listado de la raíz, no un recorrido del árbol: §37
   * prohíbe analizar el repositorio sin límite, y para saber si hay un
   * `package.json` no hace falta más.
   */
  private async fetchManifests(
    ref: { owner: string; name: string },
    branch: string,
  ): Promise<{ encontrados: string[]; readme: boolean }> {
    const res = await this.fetchJson(
      `${this.apiBase}/repos/${ref.owner}/${ref.name}/contents/?ref=${encodeURIComponent(branch)}`,
    );
    if (!res.ok || !Array.isArray(res.data)) return { encontrados: [], readme: false };

    const nombres = res.data
      .filter((e: any) => e?.type === 'file' && typeof e.name === 'string')
      .map((e: any) => e.name as string);

    return {
      encontrados: MANIFESTS.filter((m) =>
        nombres.some((n) => n.toLowerCase() === m.toLowerCase())),
      readme: nombres.some((n) => /^readme(\.|$)/i.test(n)),
    };
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
      readmePresence: false,
      manifests: [],
      stars: null,
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
