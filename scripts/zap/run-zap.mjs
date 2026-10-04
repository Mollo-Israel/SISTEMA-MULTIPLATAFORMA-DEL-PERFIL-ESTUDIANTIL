/**
 * Escaneo de seguridad de la API con OWASP ZAP (V2 §79.6, BATCH 16).
 *
 * Usa `zap-api-scan.py` en Docker con la definición OpenAPI de la API
 * (`SWAGGER_ENABLED=true` en desarrollo) y la sesión de un **estudiante**
 * recién creado: el escaneo activo ataca cada ruta con lo que ese rol puede
 * hacer, que es lo que un atacante con una cuenta tendría.
 *
 * El escaneo activo envía cargas maliciosas y deja datos de prueba: hágalo
 * solo contra una base de desarrollo, después de respaldarla.
 *
 * Informe en scripts/zap/out/ (ignorado por git).
 *
 * Uso: node scripts/zap/run-zap.mjs [--baseline]
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginAdmin, provisionAndActivate } from '../lib/fixtures.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const TS = Date.now();
const soloPasivo = process.argv.includes('--baseline');

const admin = await loginAdmin();
const est = await provisionAndActivate(admin, {
  firstName: 'Escaneo', lastName: 'Seguridad', email: `zap.${TS}@est.univalle.edu`, role: 'STUDENT', semester: 4,
});

mkdirSync(join(AQUI, 'out'), { recursive: true });
const host = process.env.ZAP_TARGET ?? 'http://host.docker.internal:3010';
const reemplazo = [
  'replacer.full_list(0).description=sesion',
  'replacer.full_list(0).enabled=true',
  'replacer.full_list(0).matchtype=REQ_HEADER',
  'replacer.full_list(0).matchstr=Authorization',
  'replacer.full_list(0).regex=false',
  `replacer.full_list(0).replacement=Bearer ${est.token}`,
].map((c) => `-config ${c}`).join(' ');

const r = spawnSync('docker', [
  'run', '--rm',
  '-v', `${resolve(join(AQUI, 'out'))}:/zap/wrk:rw`,
  'ghcr.io/zaproxy/zaproxy:stable',
  'zap-api-scan.py',
  '-t', `${host}/api/docs-json`, '-f', 'openapi', '-O', host,
  '-r', 'zap-api.html', '-J', 'zap-api.json',
  '-I', '-T', '20',
  ...(soloPasivo ? ['-S'] : []),
  '-z', reemplazo,
], { stdio: 'inherit' });
process.exit(r.status ?? 1);
