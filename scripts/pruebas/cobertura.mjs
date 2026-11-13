/**
 * Cobertura real de las pruebas que ejercitan Afinia desde fuera (Investigación §3.7).
 *
 *   node scripts/pruebas/cobertura.mjs api        # API compilada en :3010, instrumentada con V8 y en modo de pruebas
 *   node scripts/pruebas/cobertura.mjs detener    # pide a esa API que guarde la cobertura y termine
 *   node scripts/pruebas/cobertura.mjs unitarias  # batería unitaria de Node.js (157 casos) con cobertura
 *   node scripts/pruebas/cobertura.mjs convertir  # informes lcov de la API y de la web para SonarQube
 *                                                 # (`convertir api` o `convertir web` para uno solo)
 *
 * Jest mide la cobertura de sus propias pruebas con Istanbul. La regresión (contra
 * :3010), la batería unitaria, Playwright (contra :5180, con PRUEBAS_COBERTURA=1)
 * y las suites de navegador recorren la API y la web desde fuera: lo que ejecutan
 * se toma del motor V8 y se ubica en las fuentes con los source maps. `convertir`
 * suma todo sobre la estructura de Istanbul y deja un informe por paquete en
 * pruebas/07-sonarqube/cobertura/, que sonar.mjs entrega a SonarQube.
 * Nada de esto cambia el código de Afinia.
 *
 * Antes de `api`: detener la API de desarrollo y compilar (`npm --prefix api run build`).
 * Antes de `convertir`: correr Jest (`npm run pruebas:jest`), cuya estructura se completa.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENV_PRUEBAS, RAIZ } from './entorno.mjs';

const require = createRequire(import.meta.url);
const SALIDA = process.env.COBERTURA_SALIDA ?? join(RAIZ, 'pruebas', '07-sonarqube', 'cobertura');
const V8_API = process.env.COBERTURA_V8_API ?? join(SALIDA, 'v8-api');
const V8_WEB = process.env.COBERTURA_V8_WEB ?? join(RAIZ, 'pruebas', '03-playwright', 'cobertura-v8');
const V8_UNIT = process.env.COBERTURA_V8_UNIT ?? join(SALIDA, 'v8-unitarias');
const JEST_JSON = join(RAIZ, 'api', 'coverage', 'coverage-final.json');
const DISPARADOR = join(SALIDA, '.detener-api');
const API_SALUD = 'http://localhost:3010/api/health';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const responde = async () => {
  try { return (await fetch(API_SALUD, { signal: AbortSignal.timeout(3000) })).ok; } catch { return false; }
};

async function api() {
  if (!existsSync(join(RAIZ, 'api', 'dist', 'main.js'))) throw new Error('Falta api/dist: ejecute `npm --prefix api run build`.');
  if (await responde()) throw new Error('Ya hay una API en :3010. Deténgala antes de medir la cobertura.');
  rmSync(V8_API, { recursive: true, force: true });
  mkdirSync(V8_API, { recursive: true });
  rmSync(DISPARADOR, { force: true });
  // Igual que la API de desarrollo con la que corren las suites (base perfil_estudiantil,
  // puerto 3010), pero con correo simulado y los verificadores locales.
  const env = {
    ...process.env,
    NODE_V8_COVERAGE: V8_API,
    COBERTURA_DISPARADOR: DISPARADOR,
    MAIL_TRANSPORT: 'console',
    GITHUB_API_BASE_URL: ENV_PRUEBAS.GITHUB_API_BASE_URL,
    LINK_CHECK_TEST_ORIGINS: ENV_PRUEBAS.LINK_CHECK_TEST_ORIGINS,
  };
  const p = spawn(process.execPath, ['--require', join(RAIZ, 'scripts', 'pruebas', 'cobertura-gancho.cjs'), join('dist', 'main.js')], {
    cwd: join(RAIZ, 'api'), env, stdio: 'inherit',
  });
  p.on('exit', (c) => process.exit(c ?? 0));
}

async function detener() {
  mkdirSync(SALIDA, { recursive: true });
  writeFileSync(DISPARADOR, '');
  for (let i = 0; i < 60 && (await responde()); i++) await espera(1000);
  await espera(2000);
  const n = existsSync(V8_API) ? readdirSync(V8_API).filter((f) => f.endsWith('.json')).length : 0;
  console.log(n ? `API detenida; ${n} archivo(s) de cobertura V8 en ${relative(RAIZ, V8_API)}.` : 'No se encontró cobertura V8 de la API.');
}

/** Batería unitaria de Node.js (`npm --prefix api run test:unit`) con cobertura de V8. */
function unitarias() {
  rmSync(V8_UNIT, { recursive: true, force: true });
  mkdirSync(V8_UNIT, { recursive: true });
  const r = spawnSync('npm --prefix api run test:unit', {
    cwd: RAIZ, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NODE_V8_COVERAGE: V8_UNIT },
  });
  const salida = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  console.log(salida.split('\n').filter((l) => /^ℹ (tests|suites|pass|fail|cancelled)/.test(l)).join('\n'));
  if (r.status !== 0) console.error('La batería unitaria terminó con fallos.');
  return r.status ?? 1;
}

/** Ruta del proyecto con barras normales, para lcov y para el resumen. */
const relativa = (ruta) => relative(RAIZ, ruta).split(sep).join('/');
const absoluta = (rel) => join(RAIZ, ...rel.split('/'));

// ===========================================================================
//  Conversión: estructura de Istanbul + conteos de V8
// ===========================================================================
/*
 * Cada informe tiene la estructura de Istanbul, la misma de Jest: sentencias,
 * ramas (if, ternarios, &&, || y ??, switch, valores por omisión) y funciones.
 * En la API se parte de la estructura y los conteos de Jest; en la web, de la
 * estructura que da el instrumentador de Istanbul sobre cada fuente. A cada
 * elemento se le suma lo que ejecutaron las demás pruebas según V8: el conteo del
 * rango más interno que contiene el primer token de su posición en el código
 * ejecutado, ubicado con el source map. Así todos los informes cuentan las mismas
 * líneas y condiciones, sin importar qué prueba las ejercitó.
 */
const PLUGINS = [
  'typescript', 'jsx', 'decorators-legacy', 'classProperties', 'classPrivateProperties', 'classPrivateMethods',
  'dynamicImport', 'importMeta', 'topLevelAwait', 'optionalChaining', 'nullishCoalescingOperator', 'objectRestSpread',
  'numericSeparator',
];

/** Estructura de Istanbul de una fuente, con todos los conteos en cero. */
function estructura(rel) {
  const { createInstrumenter } = require('istanbul-lib-instrument');
  const instrumentador = createInstrumenter({ esModules: true, compact: false, produceSourceMap: false, parserPlugins: PLUGINS });
  const abs = absoluta(rel);
  instrumentador.instrumentSync(readFileSync(abs, 'utf8'), abs);
  return instrumentador.lastFileCoverage();
}

/**
 * Istanbul ubica las dos ramas de un «if» en el propio «if»: dónde empiezan el
 * «entonces» y el «si no» se busca con el analizador de TypeScript.
 */
function ramasIf(rel) {
  const ts = require('typescript');
  const abs = absoluta(rel);
  const sf = ts.createSourceFile(abs, readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true,
    abs.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const pos = (n) => {
    const { line, character } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
    return { line: line + 1, column: character };
  };
  const ramas = new Map();
  const visitar = (n) => {
    if (ts.isIfStatement(n)) {
      const inicio = pos(n);
      ramas.set(`${inicio.line}:${inicio.column}`, { entonces: pos(n.thenStatement), sino: n.elseStatement ? pos(n.elseStatement) : null });
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return ramas;
}

/** Posiciones por consultar en V8 y cómo se reparten sus conteos en la estructura. */
function plan(fc, rel) {
  const posiciones = [];
  const p = { s: [], f: [], b: [] };
  const agregar = (lugar) => {
    posiciones.push(lugar?.line ? lugar : null);
    return posiciones.length - 1;
  };
  for (const k of Object.keys(fc.statementMap)) p.s.push([k, agregar(fc.statementMap[k].start)]);
  // Una función se ejecutó si se ejecutó su último token (la llave que cierra el cuerpo).
  for (const k of Object.keys(fc.fnMap)) {
    const fin = fc.fnMap[k].loc?.end;
    p.f.push([k, agregar(fin?.line ? { line: fin.line, column: Math.max(0, fin.column - 1) } : null)]);
  }
  let ifs = null;
  for (const [k, rama] of Object.entries(fc.branchMap)) {
    const brazos = fc.b[k].length;
    if (rama.type === 'if') {
      ifs ??= ramasIf(rel);
      const inicio = rama.locations[0]?.start?.line ? rama.locations[0].start : rama.loc?.start;
      const nodo = inicio && ifs.get(`${inicio.line}:${inicio.column}`);
      if (!nodo) continue; // sin ubicar: queda con los conteos de Jest
      const entonces = agregar(nodo.entonces);
      p.b.push([k, 0, { directo: entonces }]);
      if (brazos > 1) {
        // «Si no» implícito: las veces que se evaluó el «if» menos las que entró al «entonces».
        p.b.push([k, 1, nodo.sino ? { directo: agregar(nodo.sino) } : { resta: [agregar(inicio), entonces] }]);
      }
    } else {
      rama.locations.forEach((lugar, i) => {
        if (i < brazos && lugar?.start?.line) p.b.push([k, i, { directo: agregar(lugar.start) }]);
      });
    }
  }
  return { posiciones, ...p };
}

/** Suma a la estructura los conteos de V8 de cada posición (null: nunca ejecutada). */
function aplicar(fc, p, sumas) {
  const v = (i) => sumas[i] ?? 0;
  for (const [k, i] of p.s) fc.s[k] += v(i);
  for (const [k, i] of p.f) fc.f[k] += v(i);
  for (const [k, j, como] of p.b) {
    fc.b[k][j] += como.directo === undefined ? Math.max(0, v(como.resta[0]) - v(como.resta[1])) : v(como.directo);
  }
}

// --- Guiones (scripts) que ejecutó V8, con lo necesario para ubicar en ellos las fuentes
const bases = new Map();
function base(rutaJs, generado, mapa) {
  if (bases.has(rutaJs)) return bases.get(rutaJs);
  const { TraceMap } = require('@jridgewell/trace-mapping');
  const traza = new TraceMap(mapa);
  const inicios = [0];
  for (let i = 0; i < generado.length; i += 1) if (generado.charCodeAt(i) === 10) inicios.push(i + 1);
  // Ruta del proyecto de cada fuente → nombre con que la nombra el mapa.
  const fuentes = new Map();
  traza.sources.forEach((s) => {
    if (s == null) return;
    const abs = s.startsWith('file:') ? fileURLToPath(s) : resolve(dirname(rutaJs), traza.sourceRoot ?? '', s);
    fuentes.set(relativa(abs), s);
  });
  const b = { traza, inicios, fuentes };
  bases.set(rutaJs, b);
  return b;
}

function guion(rutaJs, generado, mapa, funciones) {
  const rangos = [];
  for (const f of funciones) for (const r of f.ranges) rangos.push({ ini: r.startOffset, fin: r.endOffset, n: r.count });
  rangos.sort((a, b) => a.ini - b.ini || b.fin - a.fin);
  return { base: base(rutaJs, generado, mapa), rangos };
}

function guionesApi() {
  const lista = [];
  for (const carpeta of [V8_API, V8_UNIT].filter((c) => existsSync(c))) {
    for (const archivo of readdirSync(carpeta).filter((f) => f.endsWith('.json'))) {
      const datos = JSON.parse(readFileSync(join(carpeta, archivo), 'utf8'));
      const enMemoria = datos['source-map-cache'] ?? {};
      for (const entrada of datos.result) {
        if (!entrada.url.startsWith('file:')) continue;
        const ruta = fileURLToPath(entrada.url);
        const rel = relativa(ruta);
        if (rel.includes('node_modules')) continue;
        if (/^api\/dist(-e2e)?\/.*\.js$/.test(rel) && existsSync(`${ruta}.map`)) {
          // API compilada (dist o dist-e2e): el source map está junto al .js.
          const mapa = bases.has(ruta) ? null : JSON.parse(readFileSync(`${ruta}.map`, 'utf8'));
          lista.push(guion(ruta, bases.has(ruta) ? '' : readFileSync(ruta, 'utf8'), mapa, entrada.functions));
        } else if (/^api\/src\/.*\.ts$/.test(rel) && enMemoria[entrada.url]?.data) {
          // Batería unitaria: ts-node transpila en memoria. Node guarda el mapa y el
          // largo de cada línea del código generado, que basta para ubicar los rangos.
          const { lineLengths, data } = enMemoria[entrada.url];
          lista.push(guion(ruta, lineLengths.map((n) => '.'.repeat(n)).join('\n') + '\n', data, entrada.functions));
        }
      }
    }
  }
  return lista;
}

function guionesWeb() {
  // Playwright usa la compilación del entorno de pruebas (:5180, web/dist-pruebas);
  // las suites de navegador, la de web/dist servida en :5173.
  const distDe = (url) => join(RAIZ, 'web', url.port === '5180' ? 'dist-pruebas' : 'dist');
  const lista = [];
  if (!existsSync(V8_WEB)) return lista;
  for (const archivo of readdirSync(V8_WEB).filter((f) => f.endsWith('.json'))) {
    for (const entrada of JSON.parse(readFileSync(join(V8_WEB, archivo), 'utf8'))) {
      const url = new URL(entrada.url);
      const ruta = join(distDe(url), ...url.pathname.split('/').filter(Boolean));
      if (!existsSync(`${ruta}.map`) || !entrada.source) continue;
      // Los mapas son «hidden»: el navegador no los ve; se leen aquí del disco.
      const mapa = bases.has(ruta) ? null : JSON.parse(readFileSync(`${ruta}.map`, 'utf8'));
      lista.push(guion(ruta, entrada.source, mapa, entrada.functions));
    }
  }
  return lista;
}

/**
 * Conteos de V8 para las posiciones de cada fuente (rel → arreglo de sumas). Las
 * posiciones se ubican una vez por guion distinto y luego, en cada ejecución, un
 * barrido toma el rango más interno: los rangos de V8 están anidados.
 */
function contar(guiones, planes) {
  const { generatedPositionFor, LEAST_UPPER_BOUND, GREATEST_LOWER_BOUND } = require('@jridgewell/trace-mapping');
  const sumas = new Map([...planes].map(([rel, p]) => [rel, new Array(p.posiciones.length).fill(null)]));
  const porBase = new Map();
  for (const g of guiones) {
    if (!porBase.has(g.base)) porBase.set(g.base, []);
    porBase.get(g.base).push(g);
  }
  for (const [b, ejecuciones] of porBase) {
    const consultas = [];
    for (const [rel, fuente] of b.fuentes) {
      const p = planes.get(rel);
      if (!p) continue;
      p.posiciones.forEach((lugar, i) => {
        if (!lugar) return;
        const pedido = { source: fuente, line: lugar.line, column: lugar.column };
        let g = generatedPositionFor(b.traza, { ...pedido, bias: LEAST_UPPER_BOUND });
        if (g.line == null) g = generatedPositionFor(b.traza, { ...pedido, bias: GREATEST_LOWER_BOUND });
        if (g.line != null) consultas.push({ o: b.inicios[g.line - 1] + g.column, rel, i });
      });
    }
    consultas.sort((x, y) => x.o - y.o);
    for (const { rangos } of ejecuciones) {
      const pila = [];
      let k = 0;
      for (const c of consultas) {
        while (k < rangos.length && rangos[k].ini <= c.o) {
          while (pila.length && pila.at(-1).fin <= rangos[k].ini) pila.pop();
          pila.push(rangos[k]);
          k += 1;
        }
        while (pila.length && pila.at(-1).fin <= c.o) pila.pop();
        const s = sumas.get(c.rel);
        s[c.i] = (s[c.i] ?? 0) + (pila.length ? pila.at(-1).n : 0);
      }
    }
  }
  return sumas;
}

/** Estructuras y conteos de un paquete: parte de `inicial` (rel → datos) y suma V8. */
function completar(inicial, guiones, prefijo) {
  const { createCoverageMap } = require('istanbul-lib-coverage');
  const datos = new Map(inicial);
  for (const g of guiones) {
    for (const rel of g.base.fuentes.keys()) {
      if (rel.startsWith(prefijo) && !datos.has(rel) && existsSync(absoluta(rel))) datos.set(rel, estructura(rel));
    }
  }
  const planes = new Map([...datos].map(([rel, fc]) => [rel, plan(fc, rel)]));
  const sumas = contar(guiones, planes);
  const mapa = createCoverageMap({});
  for (const [rel, fc] of datos) {
    aplicar(fc, planes.get(rel), sumas.get(rel));
    fc.path = absoluta(rel);
    mapa.addFileCoverage(fc);
  }
  return mapa;
}

function coberturaApi() {
  // La estructura y los conteos de Jest (todas las fuentes de la API, incluso las que no cargó).
  const jest = existsSync(JEST_JSON) ? JSON.parse(readFileSync(JEST_JSON, 'utf8')) : {};
  if (!existsSync(JEST_JSON)) console.log('api: falta coverage-final.json de Jest (npm run pruebas:jest); solo se usa V8.');
  const inicial = Object.entries(jest).map(([ruta, fc]) => [relativa(resolve(ruta)), fc]);
  const guiones = guionesApi();
  return { mapa: completar(inicial, guiones, 'api/src/'), guiones: guiones.length };
}

function coberturaWeb() {
  const guiones = guionesWeb();
  return { mapa: completar([], guiones, 'web/src/'), guiones: guiones.length };
}

function escribir(mapa, carpeta) {
  const libReport = require('istanbul-lib-report');
  const reports = require('istanbul-reports');
  rmSync(carpeta, { recursive: true, force: true });
  mkdirSync(carpeta, { recursive: true });
  const contexto = libReport.createContext({ dir: carpeta, coverageMap: mapa, defaultSummarizer: 'nested' });
  reports.create('lcovonly', { file: 'lcov.info' }).execute(contexto);
  reports.create('json-summary', { file: 'resumen.json' }).execute(contexto);
  // Rutas relativas a la raíz: el escáner de Sonar corre en Docker con otra raíz.
  const lcov = join(carpeta, 'lcov.info');
  const lineas = readFileSync(lcov, 'utf8').replace(/^SF:(.*)$/gm, (_, r) => `SF:${relativa(resolve(r))}`);
  writeFileSync(lcov, lineas);
  return mapa.getCoverageSummary().toJSON();
}

function convertir(solo) {
  const previo = join(SALIDA, 'resumen.json');
  // Al convertir un solo paquete se conserva el resumen del otro.
  const resumen = solo && existsSync(previo) ? JSON.parse(readFileSync(previo, 'utf8')) : {};
  for (const [nombre, cobertura] of [['api', coberturaApi], ['web', coberturaWeb]]) {
    if (solo && solo !== nombre) continue;
    const { mapa, guiones } = cobertura();
    if (!mapa.files().length) {
      console.log(`${nombre}: sin datos de cobertura.`);
      continue;
    }
    const total = escribir(mapa, join(SALIDA, nombre));
    resumen[nombre] = { guiones, archivos: mapa.files().length, lineas: total.lines, ramas: total.branches, sentencias: total.statements };
    console.log(`${nombre}: ${mapa.files().length} archivos fuente; líneas ${total.lines.pct}% (${total.lines.covered}/${total.lines.total}), `
      + `ramas ${total.branches.pct}% (${total.branches.covered}/${total.branches.total})`);
  }
  writeFileSync(join(SALIDA, 'resumen.json'), JSON.stringify({ ...resumen, fecha: new Date().toISOString() }, null, 2));
}

const orden = process.argv[2];
mkdirSync(dirname(DISPARADOR), { recursive: true });
if (orden === 'api') await api();
else if (orden === 'detener') await detener();
else if (orden === 'unitarias') process.exitCode = unitarias();
else if (orden === 'convertir') convertir(process.argv[3]);
else {
  console.log('Uso: node scripts/pruebas/cobertura.mjs api | detener | unitarias | convertir [api|web]');
  process.exit(1);
}
