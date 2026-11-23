/**
 * Pruebas de seguridad (capítulo III, sección 3.4).
 *
 * Configuración aparte de `jest.config.js` para que la batería funcional
 * (test/jest) no cambie: estas suites se ejecutan con
 * `npm run pruebas:seguridad`, que además levanta la API con el perfil de
 * producción para las pruebas HTTP y reúne npm audit y Gitleaks.
 *
 * - test/seguridad/reglas.spec.ts: reglas puras (contraseñas, arranque seguro, SSRF).
 * - test/seguridad/api.spec.ts: la API real en memoria contra `afinia_test`.
 * - test/seguridad/http.spec.ts: la API arrancada como en producción
 *   (SEGURIDAD_API_URL): cabeceras, CORS, cookies, errores y límites.
 *
 * Evidencia: pruebas/11-seguridad (reporte HTML y salida de consola).
 */
const path = require('path');
const EVIDENCIA = path.join(__dirname, '..', 'pruebas', '11-seguridad');

module.exports = {
  rootDir: __dirname,
  testMatch: ['<rootDir>/test/seguridad/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: false, isolatedModules: true }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/test/jest/entorno.ts', '<rootDir>/test/seguridad/entorno.ts'],
  testEnvironment: 'node',
  testTimeout: 90000,
  maxWorkers: 1,
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: path.join(EVIDENCIA, 'reporte'),
      filename: 'reporte-seguridad.html',
      pageTitle: 'Afinia · Pruebas de seguridad',
      expand: true,
      inlineSource: true,
    }],
  ],
};
