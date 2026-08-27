module.exports = {
  preset: '@react-native/jest-preset',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@stellar/(stellar-sdk|js-xdr)|@exodus/bytes|@noble/(ed25519|hashes)|uint8array-extras|smol-toml|feaxios|eventsource)/)',
  ],
};
