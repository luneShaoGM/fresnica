const { createJestModuleNameMapper } = require('./config/moduleAliases.cjs');

module.exports = {
  preset: '@react-native/jest-preset',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/origin/', '/vendor/'],
  modulePathIgnorePatterns: ['<rootDir>/origin/', '<rootDir>/vendor/'],
  watchPathIgnorePatterns: ['<rootDir>/origin/', '<rootDir>/vendor/'],
  moduleNameMapper: createJestModuleNameMapper(),
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@stellar/(stellar-sdk|js-xdr)|@exodus/bytes|@noble/(ed25519|hashes)|uint8array-extras|smol-toml|feaxios|eventsource)/)',
  ],
};
