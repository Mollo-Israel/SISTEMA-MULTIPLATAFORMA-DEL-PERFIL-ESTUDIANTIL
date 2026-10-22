/**
 * Jest + SuperTest con cobertura (Investigación §3.1).
 *
 * Ejecuta `npm --prefix api run test:cov` y deja la evidencia en
 * pruebas/02-jest-supertest: salida-consola.txt, el resumen de cobertura y el
 * reporte HTML navegable (cobertura/). El reporte de Jest lo escribe la
 * configuración (reporte/reporte-jest.html); api/coverage queda para SonarQube.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './entorno.mjs';

const OUT = join(RAIZ, 'pruebas', '02-jest-supertest');
const COV = join(RAIZ, 'api', 'coverage');
const r = spawnSync('npm', ['--prefix', 'api', 'run', 'test:cov'], { cwd: RAIZ, encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 });
const salida = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
writeFileSync(join(OUT, 'salida-consola.txt'), salida);
cpSync(join(COV, 'coverage-summary.json'), join(OUT, 'coverage-summary.json'));
rmSync(join(OUT, 'cobertura'), { recursive: true, force: true });
cpSync(join(COV, 'lcov-report'), join(OUT, 'cobertura'), { recursive: true });
console.log(salida.split('\n').slice(-25).join('\n'));
process.exit(r.status ?? 1);
