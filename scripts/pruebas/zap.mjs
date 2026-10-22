/**
 * OWASP ZAP contra el entorno aislado (Investigación §3.6).
 *
 * `zap-api-scan.py` en Docker con la definición OpenAPI de la API de pruebas
 * (:3020/api/docs-json): descubre las rutas, aplica el escaneo pasivo y, por
 * ser un entorno propio y desechable (afinia_test), también el ACTIVO, con la
 * sesión de un estudiante sembrado (lo que tendría un atacante con una cuenta).
 *
 *   node scripts/pruebas/zap.mjs            # pasivo + activo
 *   node scripts/pruebas/zap.mjs --pasivo   # solo pasivo
 *
 * Evidencia en pruebas/06-zap: reporte-zap.html, reporte-zap.json y la salida.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { API_PORT, API_URL, RAIZ } from './entorno.mjs';

const OUT = join(RAIZ, 'pruebas', '06-zap');
mkdirSync(OUT, { recursive: true });
const soloPasivo = process.argv.includes('--pasivo');

// Estudiante sembrado distinto del que usan las pruebas de Playwright.
const login = await fetch(`${API_URL}/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'tomas.suarez@est.univalle.edu', password: 'Univalle2026*' }),
});
const { accessToken } = await login.json();
if (!accessToken) throw new Error('No se pudo iniciar sesión con la cuenta de escaneo.');

const host = `http://host.docker.internal:${API_PORT}`;
const reemplazo = [
  'replacer.full_list(0).description=sesion',
  'replacer.full_list(0).enabled=true',
  'replacer.full_list(0).matchtype=REQ_HEADER',
  'replacer.full_list(0).matchstr=Authorization',
  'replacer.full_list(0).regex=false',
  `replacer.full_list(0).replacement=Bearer ${accessToken}`,
].map((c) => `-config ${c}`).join(' ');

const r = spawnSync('docker', [
  'run', '--rm',
  '-v', `${OUT}:/zap/wrk:rw`,
  'ghcr.io/zaproxy/zaproxy:stable',
  'zap-api-scan.py',
  '-t', `${host}/api/docs-json`, '-f', 'openapi', '-O', host,
  '-r', 'reporte-zap.html', '-J', 'reporte-zap.json',
  '-I',
  ...(soloPasivo ? ['-S'] : []),
  '-z', reemplazo,
], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
// La salida nunca debe guardar el token de la sesión.
const salida = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.split(accessToken).join('[token omitido]');
writeFileSync(join(OUT, 'salida-consola.txt'), salida);
console.log(salida.split('\n').filter((l) => /^(WARN|FAIL|PASS:|INFO)/.test(l) || /FAIL-NEW|WARN-NEW|PASS/.test(l)).slice(-80).join('\n'));
process.exit(r.status ?? 1);
