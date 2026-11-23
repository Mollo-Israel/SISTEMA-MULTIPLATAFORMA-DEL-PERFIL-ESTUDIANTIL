/**
 * Pruebas de seguridad de Afinia (capítulo III, sección 3.4).
 *
 *   node scripts/pruebas/seguridad.mjs                  # todo
 *   node scripts/pruebas/seguridad.mjs --sin-gitleaks   # sin la búsqueda de secretos
 *
 * 1. Levanta la API compilada (api/dist) con NODE_ENV=production contra la base
 *    aislada afinia_test, en el puerto 3030: límites de peticiones de
 *    producción, correo apagado (sin cola ni servidor SMTP alcanzable) y
 *    secretos de firma aleatorios de un solo uso.
 * 2. Ejecuta las suites de test/seguridad con Jest y SuperTest.
 * 3. Detiene esa API.
 * 4. npm audit de la raíz (API y shared), la web y la app móvil, completo y
 *    solo dependencias de ejecución.
 * 5. Gitleaks sobre todo el historial de git, con los hallazgos enmascarados.
 * 6. Verificaciones estáticas de la web, la app móvil y el repositorio.
 *
 * Evidencia en pruebas/11-seguridad. Ningún archivo guarda contraseñas,
 * tokens ni secretos: la salida se filtra antes de escribirse.
 *
 * Requisitos: base afinia_test reconstruida (npm run pruebas:entorno) y la API
 * compilada (npm run api:build o el modo de desarrollo, que también compila).
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { ENV_PRUEBAS, RAIZ, WEB_URL } from './entorno.mjs';

const OUT = join(RAIZ, 'pruebas', '11-seguridad');
mkdirSync(OUT, { recursive: true });
const PUERTO = 3030;
const URL_API = `http://127.0.0.1:${PUERTO}/api`;
const conGitleaks = !process.argv.includes('--sin-gitleaks');
const resumen = { fecha: new Date().toISOString() };

// Valores que nunca deben quedar escritos en la evidencia: la contraseña de las
// cuentas sembradas y los valores sensibles del .env (solo se usan para borrarlos).
function sensiblesDelEnv() {
  try {
    return readFileSync(join(RAIZ, '.env'), 'utf8').split(/\r?\n/)
      .map((l) => /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l))
      .filter((m) => m && /PASS|SECRET|KEY|TOKEN/.test(m[1]))
      .map((m) => m[2].trim().replace(/^["']|["']$/g, ''));
  } catch { return []; }
}
const SECRETOS = [...sensiblesDelEnv(), 'Univalle2026*'].filter((s) => s && s.length >= 6);
const limpiar = (texto) => SECRETOS.reduce((t, s) => t.split(s).join('[omitido]'), String(texto))
  .replace(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]*/g, '[token omitido]');

const registroConsola = [];
const linea = (t = '') => { console.log(t); registroConsola.push(t); };

// ---------------------------------------------------------------- 1. API con perfil de producción
function apiProduccion() {
  const main = join(RAIZ, 'api', 'dist', 'main.js');
  if (!existsSync(main)) throw new Error('Falta api/dist/main.js: compile la API (npm run api:build).');
  const env = {
    ...process.env,
    ...ENV_PRUEBAS,
    NODE_ENV: 'production',
    PORT: String(PUERTO),
    API_PORT: String(PUERTO),
    WEB_ORIGINS: WEB_URL,
    CORS_ORIGINS: WEB_URL,
    WEB_APP_URL: 'https://afinia-pruebas.example.org',
    // Límites de producción (los valores por defecto del código).
    RATE_LIMIT_GLOBAL_PER_MINUTE: '300',
    RATE_LIMIT_AUTH_PER_MINUTE: '10',
    RATE_LIMIT_REFRESH_PER_MINUTE: '60',
    RATE_LIMIT_ACTIVATION_PER_MINUTE: '5',
    ACCESS_TOKEN_TTL_MINUTES: '15',
    // Correo apagado: sin cola y con un servidor SMTP local inexistente.
    MAIL_TRANSPORT: 'smtp',
    MAIL_WORKER_ENABLED: 'false',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '2525',
    SMTP_SECURE: 'false',
    SMTP_AUTH: 'login',
    SMTP_USER: 'pruebas.seguridad@univalle.edu',
    SMTP_PASSWORD: 'no-se-usa',
    SMTP_FROM: 'pruebas.seguridad@univalle.edu',
    MAIL_FROM: 'pruebas.seguridad@univalle.edu',
    BREVO_API_KEY: '',
    // Procesos en segundo plano apagados: la prueba no debe cambiar datos por su cuenta.
    VALIDATION_WORKER_ENABLED: 'false',
    NOTIFICATION_REMINDERS_ENABLED: 'false',
    ORPHAN_CLEANUP_ENABLED: 'false',
    AFFINITY_BACKFILL_ON_BOOT: 'false',
    ACTIVITY_LIFECYCLE_INTERVAL_MS: '86400000',
    LINK_CHECK_ENABLED: 'false',
    REPOSITORY_CHECK_ENABLED: 'false',
    STORAGE_DRIVER: 'local',
    AI_PROVIDER: 'none',
    SWAGGER_ENABLED: '',
    TRUST_PROXY_HOPS: '1',
    // Secretos propios de esta ejecución: los del .env no se usan ni se leen.
    JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
  };
  const registro = createWriteStream(join(OUT, 'api-produccion.log'));
  const p = spawn(process.execPath, [main], { cwd: join(RAIZ, 'api'), env, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', (d) => registro.write(limpiar(d)));
  p.stderr.on('data', (d) => registro.write(limpiar(d)));
  return p;
}

async function esperarSalud(proceso) {
  const limite = Date.now() + 90_000;
  while (Date.now() < limite) {
    if (proceso.exitCode !== null) throw new Error(`La API de producción terminó (código ${proceso.exitCode}); ver api-produccion.log.`);
    try {
      const r = await fetch(`${URL_API}/health`);
      if (r.ok) return;
    } catch { /* todavía arrancando */ }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  throw new Error('La API de producción no respondió en 90 s.');
}

// ---------------------------------------------------------------- 2. Jest
function jest() {
  const r = spawnSync('npx', ['jest', '-c', 'jest.seguridad.config.js', '--runInBand', '--forceExit', '--verbose'], {
    cwd: join(RAIZ, 'api'), shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, SEGURIDAD_API_URL: URL_API, SEGURIDAD_WEB_ORIGIN: WEB_URL, FORCE_COLOR: '1' },
  });
  const conColor = limpiar(`${r.stdout ?? ''}\n${r.stderr ?? ''}`);
  const salida = conColor.replace(/\x1b\[[0-9;]*m/g, '');
  // El texto plano es la evidencia legible; la versión con color sirve para la figura.
  writeFileSync(join(OUT, 'salida-consola.txt'), salida);
  writeFileSync(join(OUT, 'salida-consola-color.txt'), conColor);
  const pruebas = /Tests:\s+(.*)/.exec(salida)?.[1] ?? '';
  const suites = /Test Suites:\s+(.*)/.exec(salida)?.[1] ?? '';
  resumen.jest = { suites, pruebas, codigo: r.status };
  linea(`Jest: ${suites} | ${pruebas}`);
  return r.status === 0;
}

// ---------------------------------------------------------------- 4. npm audit
function auditar(nombre, carpeta) {
  const resultado = {};
  for (const [clave, extra] of [['todas', []], ['ejecucion', ['--omit=dev']]]) {
    const r = spawnSync('npm', ['audit', '--json', ...extra], { cwd: carpeta, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    let datos;
    try { datos = JSON.parse(r.stdout); } catch { datos = { error: (r.stderr || r.stdout || '').slice(0, 500) }; }
    writeFileSync(join(OUT, `npm-audit-${nombre}-${clave}.json`), JSON.stringify(datos, null, 2));
    const vuln = datos?.metadata?.vulnerabilities ?? null;
    const graves = Object.entries(datos?.vulnerabilities ?? {})
      .filter(([, v]) => ['high', 'critical'].includes(v.severity))
      .map(([paquete, v]) => ({
        paquete,
        severidad: v.severity,
        directo: v.isDirect,
        motivo: (v.via ?? []).filter((x) => typeof x === 'object').map((x) => x.title).slice(0, 2),
        correccion: v.fixAvailable === true ? 'disponible' : (v.fixAvailable ? `cambio mayor (${v.fixAvailable.name}@${v.fixAvailable.version})` : 'sin corrección'),
      }));
    resultado[clave] = { vulnerabilidades: vuln, dependencias: datos?.metadata?.dependencies ?? null, graves };
  }
  return resultado;
}

// ---------------------------------------------------------------- 5. Gitleaks
function gitleaks() {
  const imagen = 'zricethezav/gitleaks:v8.18.4';
  const orden = 'git config --global --add safe.directory /repo && '
    + 'gitleaks detect --source=/repo --redact --no-banner --exit-code 0 '
    + '--report-format json --report-path /salida/gitleaks.json';
  const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh',
    '-v', `${RAIZ}:/repo:ro`, '-v', `${OUT}:/salida:rw`, imagen, '-c', orden],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const salida = limpiar(`${r.stdout ?? ''}\n${r.stderr ?? ''}`);
  writeFileSync(join(OUT, 'gitleaks-salida.txt'), salida);
  let hallazgos = [];
  try { hallazgos = JSON.parse(readFileSync(join(OUT, 'gitleaks.json'), 'utf8')); } catch { /* sin reporte */ }
  // Solo se conserva lo necesario para el documento; el valor ya viene enmascarado.
  const resumido = hallazgos.map((h) => ({ regla: h.RuleID, archivo: h.File, linea: h.StartLine, commit: String(h.Commit).slice(0, 8), fecha: h.Date }));
  writeFileSync(join(OUT, 'gitleaks-resumen.json'), JSON.stringify(resumido, null, 2));
  const commits = /(\d+) commits scanned/.exec(salida)?.[1] ?? null;
  return { codigo: r.status, commitsAnalizados: commits ? Number(commits) : null, hallazgos: resumido.length, porRegla: contar(resumido, 'regla') };
}

const contar = (lista, campo) => lista.reduce((acc, x) => ({ ...acc, [x[campo]]: (acc[x[campo]] ?? 0) + 1 }), {});

// ---------------------------------------------------------------- 6. Verificaciones estáticas
function estaticas() {
  const leer = (ruta) => readFileSync(join(RAIZ, ruta), 'utf8');
  const git = (args) => spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).stdout.trim();
  const buscar = (carpeta, patron) => {
    const r = spawnSync('git', ['grep', '-n', '-E', patron, '--', carpeta], { cwd: RAIZ, encoding: 'utf8' });
    return r.stdout.trim() ? r.stdout.trim().split('\n') : [];
  };
  const clienteWeb = leer('web/src/api/client.ts');
  const clienteMovil = leer('mobile/src/api/client.ts');
  const main = leer('api/src/main.ts');
  const appJson = leer('mobile/app.json');
  const html = buscar('web/src', 'dangerouslySetInnerHTML');
  const checks = [
    ['PS-EST-01', 'El archivo .env no está versionado y git lo ignora',
      git(['ls-files', '.env', 'api/.env', 'web/.env', 'mobile/.env']) === '' && git(['check-ignore', '.env']) === '.env'],
    ['PS-EST-02', 'La web no guarda tokens en localStorage (solo una marca sin valor)',
      !/localStorage\.setItem\(\s*['"]afinia_(access|refresh)/.test(clienteWeb) && /SESSION_HINT/.test(clienteWeb)],
    ['PS-EST-03', 'La web solo inserta HTML sin escapar en un lugar: el QR que genera el servidor',
      html.length === 1 && /Collaboration\.tsx/.test(html[0]) && /qrSvg/.test(html[0])],
    ['PS-EST-04', 'La app móvil guarda los tokens en el almacenamiento seguro del sistema (SecureStore)',
      /SecureStore\.setItemAsync\(TOKEN_KEY/.test(clienteMovil) && /SecureStore\.setItemAsync\(REFRESH_KEY/.test(clienteMovil)
        && !/from ['"]@react-native-async-storage/.test(clienteMovil)
        && buscar('mobile/src', 'AsyncStorage\\.setItem\\([^)]*([Tt]oken|TOKEN)').length === 0],
    ['PS-EST-05', 'La configuración de la app móvil no habilita tráfico sin cifrar',
      !/usesCleartextTraffic/.test(appJson)],
    ['PS-EST-06', 'La API aplica Helmet, validación estricta de entradas y límite del cuerpo',
      /app\.use\(helmet\(/.test(main) && /whitelist: true/.test(main) && /forbidNonWhitelisted: true/.test(main) && /limit: '256kb'/.test(main)],
    ['PS-EST-07', 'El código de la API no evalúa código dinámico (eval o new Function)',
      buscar('api/src', '\\beval\\(|new Function\\(').length === 0],
  ];
  const observaciones = [
    ['OBS-01', 'La API desactiva la Política de Seguridad de Contenido (CSP) de Helmet porque no sirve HTML; la web debe aplicarla en su propio hosting',
      /contentSecurityPolicy: false/.test(main)],
    ['OBS-02', 'El script de compilación local del APK habilita HTTP sin cifrar para conectarse a la red local',
      /usesCleartextTraffic="true"/.test(leer('scripts/movil/construir-apk.mjs'))],
  ];
  const resultado = {
    verificaciones: checks.map(([codigo, descripcion, ok]) => ({ codigo, descripcion, resultado: ok ? 'PASS' : 'FAIL' })),
    observaciones: observaciones.map(([codigo, descripcion, presente]) => ({ codigo, descripcion, presente })),
  };
  writeFileSync(join(OUT, 'verificaciones-estaticas.json'), JSON.stringify(resultado, null, 2));
  for (const v of resultado.verificaciones) linea(`  ${v.resultado}  ${v.codigo}  ${v.descripcion}`);
  for (const o of resultado.observaciones) linea(`  ${o.presente ? 'OBS ' : '  - '}  ${o.codigo}  ${o.descripcion}`);
  return resultado;
}

// ---------------------------------------------------------------- ejecución
linea('== 1. API con perfil de producción (afinia_test, puerto 3030)');
const api = apiProduccion();
let jestOk = false;
try {
  await esperarSalud(api);
  linea('   lista.');
  linea('== 2. Suites de seguridad (Jest + SuperTest)');
  jestOk = jest();
} finally {
  linea('== 3. Deteniendo la API de producción');
  api.kill();
}

linea('== 4. npm audit');
resumen.npmAudit = {
  'raiz (api y shared)': auditar('raiz', RAIZ),
  web: auditar('web', join(RAIZ, 'web')),
  movil: auditar('movil', join(RAIZ, 'mobile')),
};
for (const [nombre, r] of Object.entries(resumen.npmAudit)) {
  const t = r.todas.vulnerabilidades ?? {};
  const e = r.ejecucion.vulnerabilidades ?? {};
  linea(`   ${nombre}: total ${t.total ?? '?'} (crít. ${t.critical ?? 0}, altas ${t.high ?? 0}, mod. ${t.moderate ?? 0}, bajas ${t.low ?? 0}) | solo ejecución ${e.total ?? '?'} (crít. ${e.critical ?? 0}, altas ${e.high ?? 0})`);
}

if (conGitleaks) {
  linea('== 5. Gitleaks (historial completo, hallazgos enmascarados)');
  resumen.gitleaks = gitleaks();
  linea(`   commits analizados: ${resumen.gitleaks.commitsAnalizados} | hallazgos: ${resumen.gitleaks.hallazgos} ${JSON.stringify(resumen.gitleaks.porRegla)}`);
}

linea('== 6. Verificaciones estáticas');
resumen.estaticas = estaticas();

writeFileSync(join(OUT, 'resumen.json'), JSON.stringify(resumen, null, 2));
linea(`\nEvidencia en ${OUT}`);
writeFileSync(join(OUT, 'resumen-consola.txt'), `${registroConsola.join('\n')}\n`);
process.exit(jestOk ? 0 : 1);
