/**
 * Variables del entorno aislado de pruebas (§4). Se cargan ANTES de importar
 * la aplicación: la base es `afinia_test`, el correo va a la consola y los
 * procesos en segundo plano quedan apagados para que cada prueba sea
 * determinista. El .env de desarrollo no se modifica.
 */
import { join } from 'path';

Object.assign(process.env, {
  POSTGRES_DB: 'afinia_test',
  MAIL_TRANSPORT: 'console',
  MAIL_WORKER_ENABLED: 'false',
  VALIDATION_WORKER_ENABLED: 'false',
  NOTIFICATION_REMINDERS_ENABLED: 'false',
  ORPHAN_CLEANUP_ENABLED: 'false',
  AFFINITY_BACKFILL_ON_BOOT: 'false',
  ACTIVITY_LIFECYCLE_INTERVAL_MS: '86400000',
  LINK_CHECK_ENABLED: 'false',
  REPOSITORY_CHECK_ENABLED: 'false',
  STORAGE_LOCAL_PATH: join(__dirname, '..', '..', '..', 'pruebas', '01-entorno', 'almacenamiento-temporal'),
  NODE_ENV: 'development',
});
