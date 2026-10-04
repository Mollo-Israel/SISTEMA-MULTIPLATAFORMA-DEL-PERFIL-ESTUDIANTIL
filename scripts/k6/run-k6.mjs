/**
 * Lanza la carga básica de k6 en Docker contra la API local (V2 BATCH 16).
 *
 * Crea un estudiante y una Dirección de prueba por el camino real (alta,
 * correo, activación, bienvenida) y ejecuta `grafana/k6` con el escenario de carga-basica.js. El
 * resumen queda en scripts/k6/out/resumen.json (ignorado por git).
 *
 * Uso: node scripts/k6/run-k6.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PWD, loginAdmin, provisionAndActivate, req } from '../lib/fixtures.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const TS = Date.now();

const admin = await loginAdmin();
const est = await provisionAndActivate(admin, {
  firstName: 'Carga', lastName: 'Simulada', email: `k6.${TS}@est.univalle.edu`, role: 'STUDENT', semester: 5,
});
const t = est.token;
await req('POST', '/profiles/me/onboarding/institutional-confirmation', { token: t, body: {} });
const skills = ((await req('GET', '/skills', { token: t })).data ?? []).filter((s) => s.isActive !== false);
await req('PUT', '/profiles/me/skill-interests', { token: t, body: { items: [{ skillId: skills[0].id, kind: 'interest' }] } });
await req('PATCH', '/profiles/me', { token: t, body: { availability: 'open' } });
await req('POST', '/profiles/me/onboarding/privacy', { token: t, body: { peerDiscoverable: true, publicProfileEnabled: false } });
await req('POST', '/profiles/me/onboarding/complete', { token: t });
const director = await provisionAndActivate(admin, {
  firstName: 'Carga', lastName: 'Direccion', email: `k6.dir.${TS}@univalle.edu`, role: 'CAREER_DIRECTOR',
});

mkdirSync(join(AQUI, 'out'), { recursive: true });
const r = spawnSync('docker', [
  'run', '--rm', '-i',
  '-v', `${resolve(AQUI)}:/scripts`,
  '-e', `EMAIL=${est.email}`, '-e', `DIR_EMAIL=${director.email}`, '-e', `PASSWORD=${PWD}`,
  '-e', `BASE=${process.env.K6_BASE ?? 'http://host.docker.internal:3010/api'}`,
  'grafana/k6:latest', 'run', '--summary-export=/scripts/out/resumen.json', '/scripts/carga-basica.js',
], { stdio: 'inherit' });
process.exit(r.status ?? 1);
