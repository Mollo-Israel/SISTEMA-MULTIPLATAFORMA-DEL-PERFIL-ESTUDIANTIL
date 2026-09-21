import { config as loadDotenv } from 'dotenv';
import * as path from 'path';

/**
 * Carga el .env antes que nada.
 *
 * ConfigModule tambien lo lee, pero llega tarde para los decoradores: los
 * limites de @Throttle se evaluan al importar los controladores, antes de que
 * exista el contenedor de inyeccion.
 *
 * Se prueban las dos ubicaciones porque el proceso puede arrancar desde la
 * raiz del monorepo o desde `api/`, segun el script que se use.
 */
for (const candidate of ['.env', path.join('..', '.env')]) {
  loadDotenv({ path: path.resolve(process.cwd(), candidate) });
}
