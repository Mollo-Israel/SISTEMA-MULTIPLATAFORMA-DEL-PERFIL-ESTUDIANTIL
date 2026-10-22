/**
 * SonarQube Community Build: análisis estático + cobertura de Jest (Investigación §3.7).
 *
 *   node scripts/pruebas/sonar.mjs
 *
 * 1. Levanta (o reutiliza) el contenedor `sonarqube-afinia` en :9100.
 * 2. Primera vez: cambia la contraseña por omisión por una aleatoria, guardada
 *    solo en pruebas/07-sonarqube/.credenciales-local.json (ignorado por git).
 * 3. Convierte api/coverage/lcov.info a rutas relativas (el escáner corre en Docker).
 * 4. Corre sonar-scanner-cli y espera a que el servidor procese el análisis.
 * 5. Guarda el Quality Gate y las métricas en pruebas/07-sonarqube/resumen.json.
 */
import { execSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './entorno.mjs';

const OUT = join(RAIZ, 'pruebas', '07-sonarqube');
mkdirSync(OUT, { recursive: true });
const URL_SONAR = 'http://localhost:9100';
const CRED = join(OUT, '.credenciales-local.json');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
// En el primer arranque, /api/system/status responde UP antes de que la API
// web acepte peticiones autenticadas: se reintenta ante errores de red.
async function pedir(url, opciones) {
  for (let i = 0; ; i++) {
    try { return await fetch(url, opciones); } catch (e) { if (i >= 20) throw e; await espera(3000); }
  }
}

// 1. Contenedor propio de este proyecto (no se toca ningún otro).
const existe = execSync('docker ps -a --format "{{.Names}}"', { encoding: 'utf8' }).split(/\r?\n/).includes('sonarqube-afinia');
if (!existe) {
  execSync('docker run -d --name sonarqube-afinia -p 9100:9000 -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true sonarqube:community', { stdio: 'inherit' });
} else {
  execSync('docker start sonarqube-afinia', { stdio: 'inherit' });
}
for (let i = 0; i < 120; i++) {
  try {
    const s = await (await fetch(`${URL_SONAR}/api/system/status`)).json();
    if (s.status === 'UP') break;
  } catch { /* arrancando */ }
  await espera(5000);
}
await espera(10000);
console.log('SonarQube listo.');

// 2. Credenciales locales.
const basic = (u, p) => ({ authorization: `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}` });
let cred = existsSync(CRED) ? JSON.parse(readFileSync(CRED, 'utf8')) : null;
if (!cred) {
  const nueva = `Af!${randomBytes(12).toString('base64url')}9`;
  // Se guarda ANTES de cambiarla: si la respuesta se pierde, no queda una
  // contraseña desconocida (SonarQube corta la conexión ante un 401).
  writeFileSync(CRED, JSON.stringify({ user: 'admin', password: nueva, pendiente: true }, null, 2));
  const r = await pedir(`${URL_SONAR}/api/users/change_password`, {
    method: 'POST', headers: { ...basic('admin', 'admin'), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ login: 'admin', previousPassword: 'admin', password: nueva }),
  });
  if (r.status !== 204) throw new Error(`No se pudo fijar la contraseña de SonarQube (${r.status}).`);
  cred = { user: 'admin', password: nueva };
  writeFileSync(CRED, JSON.stringify(cred, null, 2));
}
const auth = basic(cred.user, cred.password);
// Recién arrancado, SonarQube puede responder 204 y aún no aplicar el cambio:
// se comprueba que la credencial guardada valide antes de seguir.
for (let i = 0; ; i++) {
  const v = await (await pedir(`${URL_SONAR}/api/authentication/validate`, { headers: auth })).json();
  if (v.valid) break;
  if (i >= 20) throw new Error('La credencial guardada de SonarQube no valida.');
  await espera(3000);
}
const tok = await (await pedir(`${URL_SONAR}/api/user_tokens/generate`, {
  method: 'POST', headers: { ...auth, 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ name: `afinia-${Date.now()}` }),
})).json();

// 3. Cobertura con rutas relativas a la raíz del proyecto.
const lcov = join(RAIZ, 'api', 'coverage', 'lcov.info');
if (existsSync(lcov)) {
  const rel = readFileSync(lcov, 'utf8').replace(/^SF:(.*)$/gm, (_, ruta) => {
    // Jest escribe rutas relativas a api/ (src\…) o absolutas (…/api/src/…).
    const r = ruta.replace(/\\/g, '/');
    const i = r.lastIndexOf('/src/');
    return `SF:api/${i >= 0 ? r.slice(i + 1) : r}`;
  });
  writeFileSync(join(RAIZ, 'api', 'coverage', 'lcov-sonar.info'), rel);
}

// 4. Análisis.
const raiz = RAIZ.replace(/\\/g, '/');
const r = spawnSync('docker', [
  'run', '--rm',
  '-e', 'SONAR_HOST_URL=http://host.docker.internal:9100',
  '-e', `SONAR_TOKEN=${tok.token}`,
  '-v', `${raiz}:/usr/src`,
  'sonarsource/sonar-scanner-cli',
  '-Dsonar.javascript.lcov.reportPaths=api/coverage/lcov-sonar.info',
  '-Dsonar.qualitygate.wait=true',
  '-Dsonar.qualitygate.timeout=600',
], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const salida = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.split(tok.token).join('[token omitido]');
writeFileSync(join(OUT, 'salida-analisis.txt'), salida);

// 5. Resultado.
const metricas = 'bugs,vulnerabilities,security_hotspots,code_smells,coverage,duplicated_lines_density,ncloc,reliability_rating,security_rating,sqale_rating';
const [gate, medidas] = await Promise.all([
  pedir(`${URL_SONAR}/api/qualitygates/project_status?projectKey=afinia`, { headers: auth }).then((x) => x.json()),
  pedir(`${URL_SONAR}/api/measures/component?component=afinia&metricKeys=${metricas}`, { headers: auth }).then((x) => x.json()),
]);
const resumen = {
  qualityGate: gate.projectStatus?.status,
  condiciones: gate.projectStatus?.conditions,
  metricas: Object.fromEntries((medidas.component?.measures ?? []).map((m) => [m.metric, m.value])),
  fecha: new Date().toISOString(),
};
writeFileSync(join(OUT, 'resumen.json'), JSON.stringify(resumen, null, 2));
console.log(JSON.stringify(resumen, null, 2));
console.log(`\nPanel: ${URL_SONAR}/dashboard?id=afinia  (usuario admin; contraseña en ${CRED})`);
