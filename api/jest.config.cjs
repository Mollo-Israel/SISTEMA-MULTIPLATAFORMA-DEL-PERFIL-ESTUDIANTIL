const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname, '..'),
  testEnvironment: 'node',

  testMatch: [
    '<rootDir>/api/test/**/*.spec.ts',
  ],

  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: path.resolve(__dirname, 'tsconfig.spec.json'),
      },
    ],
  },

  moduleNameMapper: {
    '^@perfil/shared$': '<rootDir>/shared/src/index.ts',
  },

  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  restoreMocks: true,

  collectCoverageFrom: [
    '<rootDir>/api/src/**/*.ts',
    '<rootDir>/shared/src/**/*.ts',
    '!<rootDir>/api/src/main.ts',
    '!<rootDir>/**/index.ts',
  ],

  coverageDirectory: '<rootDir>/api/coverage',
};
