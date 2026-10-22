/**
 * Entorno aislado de pruebas de Afinia (Investigación de herramientas, §4).
 *
 *   node scripts/pruebas/entorno.mjs reconstruir   # base afinia_test desde cero: migraciones + datos deterministas
 *   node scripts/pruebas/entorno.mjs api           # API de pruebas en :3020 (correo a consola, almacenamiento temporal)
 *   node scripts/pruebas/entorno.mjs web           # compila la web contra :3020 y la sirve en :5180
 *
 * No toca la base de desarrollo (perfil_estudiantil) ni los puertos 3010 / 5173.
 * Los datos son los de `seed` + `seed:populate`: cuentas de ejemplo por rol, sin
 * información personal real.
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const API_PORT = 3020; // 3011 lo usa e2e-ai-provider para su propia API
export const WEB_PORT = 5180;
export const API_URL = `http://localhost:${API_PORT}/api`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const DB = 'afinia_test';
const STORAGE = join(RAIZ, 'pruebas', '01-entorno', 'almacenamiento-temporal');

/** Variables exclusivas del entorno de pruebas (se suman a las del .env, que no se modifica). */
export const ENV_PRUEBAS = {
  POSTGRES_DB: DB,
  API_PORT: String(API_PORT),
  STORAGE_LOCAL_PATH: STORAGE,
  MAIL_TRANSPORT: 'console',
  WEB_APP_URL: WEB_URL,
  WEB_ORIGINS: `${WEB_URL},http://127.0.0.1:${WEB_PORT}`,
  CORS_ORIGINS: `${WEB_URL},http://127.0.0.1:${WEB_PORT}`,
  // Las pruebas no deben depender de GitHub ni de internet: verificador simulado.
  GITHUB_API_BASE_URL: 'http://127.0.0.1:3996',
  LINK_CHECK_TEST_ORIGINS: 'verificador.afinia-pruebas.org:3997=127.0.0.1:3997',
  NODE_ENV: 'development',
};

const psql = (sql, db = 'postgres') => execSync(
  `docker exec perfil_postgres psql -U perfil_user -d ${db} -v ON_ERROR_STOP=1 -tAc "${sql}"`,
  { encoding: 'utf8' },
).trim();

function ejecutar(cmd, cwd = RAIZ) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...ENV_PRUEBAS }, shell: true });
}

export function reconstruir() {
  // Solo se elimina la base de PRUEBAS; la de desarrollo nunca se nombra aquí.
  psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB}' AND pid <> pg_backend_pid()`);
  psql(`DROP DATABASE IF EXISTS ${DB}`);
  psql(`CREATE DATABASE ${DB} OWNER perfil_user`);
  if (existsSync(STORAGE)) rmSync(STORAGE, { recursive: true, force: true });
  mkdirSync(STORAGE, { recursive: true });
  ejecutar('npm run shared:build');
  ejecutar('npm --prefix api run migration:run');
  ejecutar('npm --prefix api run seed');
  ejecutar('npm --prefix api run seed:populate');
  // Pruebas de rendimiento (22/10/2026): una base recién creada no tiene
  // estadísticas del planificador y el JOIN del listado de actividades pasaba
  // de ~25 ms a ~1,6 s. Se analizan las tablas al terminar de sembrar, como
  // debe hacerse también tras migrar, restaurar o importar en producción.
  psql('ANALYZE', DB);
  const n = psql('SELECT count(*) FROM users', DB);
  console.log(`\nBase ${DB} lista: ${n} usuarios de prueba.`);
}

export function api() {
  const p = spawn('npm', ['--prefix', 'api', 'run', 'start'], {
    cwd: RAIZ, stdio: 'inherit', shell: true, env: { ...process.env, ...ENV_PRUEBAS },
  });
  p.on('exit', (c) => process.exit(c ?? 0));
}

export function web() {
  ejecutar('npx vite build --outDir dist-pruebas --emptyOutDir', join(RAIZ, 'web'));
  const p = spawn('npx', ['vite', 'preview', '--outDir', 'dist-pruebas', '--port', String(WEB_PORT), '--strictPort'], {
    cwd: join(RAIZ, 'web'), stdio: 'inherit', shell: true, env: { ...process.env, VITE_API_URL: API_URL },
  });
  p.on('exit', (c) => process.exit(c ?? 0));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const orden = process.argv[2];
  if (orden === 'reconstruir') reconstruir();
  else if (orden === 'api') api();
  else if (orden === 'web') {
    process.env.VITE_API_URL = API_URL;
    web();
  } else {
    console.log('Uso: node scripts/pruebas/entorno.mjs reconstruir | api | web');
    process.exit(1);
  }
}
