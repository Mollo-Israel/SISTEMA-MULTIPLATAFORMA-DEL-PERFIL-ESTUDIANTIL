/**
 * Datos de conexión a PostgreSQL, compartidos por la API y las migraciones.
 *
 * En local se usan las variables POSTGRES_*. Los servicios administrados suelen
 * entregar una sola `DATABASE_URL`, que tiene prioridad si existe. El cifrado se
 * activa con `DATABASE_SSL=true`.
 */
export function databaseConnection(get: (clave: string) => string | undefined) {
  const valor = (clave: string) => get(clave)?.trim() || undefined;
  const ssl = valor('DATABASE_SSL')?.toLowerCase() === 'true'
    ? { rejectUnauthorized: valor('DATABASE_SSL_REJECT_UNAUTHORIZED')?.toLowerCase() !== 'false' }
    : undefined;
  const url = valor('DATABASE_URL');
  if (url) return { url, ssl };
  return {
    host: valor('POSTGRES_HOST') ?? 'localhost',
    port: Number(valor('POSTGRES_PORT') ?? 5432),
    username: valor('POSTGRES_USER') ?? 'perfil_user',
    password: get('POSTGRES_PASSWORD') ?? 'perfil_pass',
    database: valor('POSTGRES_DB') ?? 'perfil_estudiantil',
    ssl,
  };
}
