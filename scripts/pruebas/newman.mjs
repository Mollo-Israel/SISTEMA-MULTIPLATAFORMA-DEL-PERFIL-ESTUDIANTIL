/**
 * Postman + Newman contra el entorno aislado (Investigación §3.2).
 *
 * Regenera la colección y la ejecuta. La contraseña del administrador se lee
 * de .env y se pasa solo al ejecutar; las evidencias no guardan ni esa
 * contraseña ni los tokens de sesión.
 *
 * Evidencia en pruebas/04-postman-newman: reporte-newman.html,
 * resultados-newman.json y salida-consola.txt.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './entorno.mjs';

const DIR = join(RAIZ, 'pruebas', '04-postman-newman');
const env = Object.fromEntries(readFileSync(join(RAIZ, '.env'), 'utf8').split(/\r?\n/)
  .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, '')]));
const clave = env.ADMIN_PASSWORD ?? '';

spawnSync('node', [join(RAIZ, 'scripts', 'pruebas', 'postman-coleccion.mjs')], { stdio: 'inherit' });
const r = spawnSync(process.execPath, [
  join(RAIZ, 'node_modules', 'newman', 'bin', 'newman.js'),
  'run', join(DIR, 'afinia.postman_collection.json'),
  '-e', join(DIR, 'afinia-pruebas.postman_environment.json'),
  '--env-var', `adminPassword=${clave}`,
  '-r', 'cli,htmlextra,json',
  '--reporter-htmlextra-export', join(DIR, 'reporte-newman.html'),
  '--reporter-json-export', join(DIR, 'resultados-newman.json'),
  '--color', 'off',
], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const limpiar = (s) => (clave ? s.split(clave).join('[omitida]') : s)
  .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[token omitido]');
for (const f of ['reporte-newman.html', 'resultados-newman.json']) {
  const ruta = join(DIR, f);
  if (existsSync(ruta)) writeFileSync(ruta, limpiar(readFileSync(ruta, 'utf8')));
}
const salida = limpiar(`${r.stdout ?? ''}\n${r.stderr ?? ''}`);
writeFileSync(join(DIR, 'salida-consola.txt'), salida);
console.log(salida.split('\n').slice(-30).join('\n'));
process.exit(r.status ?? 1);
