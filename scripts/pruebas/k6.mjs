/**
 * Grafana k6 contra el entorno aislado (Investigación §3.5).
 *
 * Usa el escenario de scripts/k6/carga-basica.js (umbrales de RNF05: p95 ≤ 3 s
 * en operaciones CRUD y login, ≤ 5 s en reportes, < 1 % de errores) con las
 * cuentas de prueba sembradas, contra la API de pruebas (:3020).
 *
 * Evidencia en pruebas/05-k6: resumen.json, salida-consola.txt y el panel
 * HTML de k6 (reporte-k6.html).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { API_PORT, RAIZ } from './entorno.mjs';

const OUT = join(RAIZ, 'pruebas', '05-k6');
mkdirSync(OUT, { recursive: true });
const r = spawnSync('docker', [
  'run', '--rm', '-i',
  '-v', `${join(RAIZ, 'scripts', 'k6')}:/scripts`,
  '-v', `${OUT}:/out`,
  '-e', 'EMAIL=ana.quispe@est.univalle.edu',
  '-e', 'DIR_EMAIL=jorge.vargas@univalle.edu',
  '-e', 'PASSWORD=Univalle2026*',
  '-e', `BASE=http://host.docker.internal:${API_PORT}/api`,
  '-e', 'K6_WEB_DASHBOARD=true',
  '-e', 'K6_WEB_DASHBOARD_EXPORT=/out/reporte-k6.html',
  '-e', 'NO_COLOR=true',
  'grafana/k6:latest', 'run', '--summary-export=/out/resumen.json', '/scripts/carga-basica.js',
], { encoding: 'utf8' });
// setup() devuelve los tokens de sesión y k6 los copia al resumen: se omiten.
const sinTokens = (s) => s.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[token omitido]');
for (const f of ['resumen.json', 'reporte-k6.html']) {
  const ruta = join(OUT, f);
  if (existsSync(ruta)) writeFileSync(ruta, sinTokens(readFileSync(ruta, 'utf8')));
}
const salida = sinTokens(`${r.stdout ?? ''}\n${r.stderr ?? ''}`);
writeFileSync(join(OUT, 'salida-consola.txt'), salida);
console.log(salida.split('\n').slice(-60).join('\n'));
process.exit(r.status ?? 1);
