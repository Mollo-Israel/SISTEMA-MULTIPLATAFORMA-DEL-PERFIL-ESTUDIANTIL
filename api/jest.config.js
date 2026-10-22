/**
 * Jest + SuperTest (Investigación de herramientas de pruebas, §3.1).
 *
 * - `test/jest/unit`: reglas de negocio puras (sin base de datos).
 * - `test/jest/api`: la aplicación NestJS real, levantada en memoria contra la
 *   base aislada `afinia_test` (ver scripts/pruebas/entorno.mjs), y probada
 *   con SuperTest: status, cuerpo y efectos en la base.
 *
 * Evidencia: reporte HTML en pruebas/02-jest-supertest/reporte y cobertura en
 * api/coverage (lcov para SonarQube) y pruebas/02-jest-supertest/cobertura.
 */
const path = require('path');
const EVIDENCIA = path.join(__dirname, '..', 'pruebas', '02-jest-supertest');

module.exports = {
  rootDir: __dirname,
  testMatch: ['<rootDir>/test/jest/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: false, isolatedModules: true }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/test/jest/entorno.ts'],
  testEnvironment: 'node',
  testTimeout: 60000,
  maxWorkers: 1,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/load-env.ts',
    '!src/database/migrations/**',
    '!src/database/seeds/**',
    '!src/**/*.module.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['lcov', 'text-summary', 'json-summary'],
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: path.join(EVIDENCIA, 'reporte'),
      filename: 'reporte-jest.html',
      pageTitle: 'Afinia · Jest + SuperTest',
      expand: true,
      inlineSource: true,
    }],
  ],
};
