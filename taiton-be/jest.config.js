/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: [],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/utils/**/*.js',
    'src/services/navigation.service.js',
    'src/services/permissions.service.js',
    'src/middleware/auth.js',
    'src/app.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'json-summary', 'lcov'],
  setupFiles: ['<rootDir>/jest.setup.js'],
};
