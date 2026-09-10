const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: ['<rootDir>/src/platform/persistence/realm/integration/**/*.integration.ts'],
  testEnvironment: 'node',
  watchman: false,
};
