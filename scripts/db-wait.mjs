/**
 * Espera a que PostgreSQL acepte conexiones (V2 §10.2).
 *
 * `docker compose up -d` vuelve en cuanto el contenedor arranca, no cuando la
 * base está lista: lanzar las migraciones en ese momento falla de forma
 * intermitente. Aquí se pregunta al propio contenedor con `pg_isready` hasta
 * que responde, con un límite de tiempo.
 *
 * Uso: node scripts/db-wait.mjs [segundos=90]
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const limite = Number(process.argv[2] ?? 90) * 1000;
const inicio = Date.now();

if (!existsSync('.env')) {
  console.error('Falta el archivo .env en la raíz. Cópielo desde .env.example.');
  process.exit(1);
}

const compose = ['compose', '--env-file', '.env', '-f', 'docker/docker-compose.yml'];

try {
  execFileSync('docker', ['info'], { stdio: 'ignore' });
} catch {
  console.error('Docker no está en marcha. Abra Docker Desktop y vuelva a intentarlo.');
  process.exit(1);
}

function listo() {
  try {
    execFileSync('docker', [...compose, 'exec', '-T', 'postgres', 'sh', '-c', 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

process.stdout.write('Esperando a PostgreSQL');
while (!listo()) {
  if (Date.now() - inicio > limite) {
    console.error(`\nPostgreSQL no respondió en ${limite / 1000} s. Revise: npm run db:logs`);
    process.exit(1);
  }
  process.stdout.write('.');
  await new Promise((r) => setTimeout(r, 1500));
}
console.log(` lista (${((Date.now() - inicio) / 1000).toFixed(1)} s).`);
