/**
 * Ajustes propios de las pruebas de seguridad, sumados a test/jest/entorno.ts.
 *
 * La ventana de gracia del refresh token (60 s por defecto) se reduce a 2 s
 * para poder comprobar, sin esperar un minuto, que un token ya rotado deja de
 * servir. Ningún otro valor cambia respecto de la batería funcional.
 */
Object.assign(process.env, {
  REFRESH_TOKEN_REUSE_GRACE_SECONDS: '2',
});
