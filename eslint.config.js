const reactNativeConfig = require('@react-native/eslint-config/flat');

module.exports = [
  {
    ignores: [
      'android/**',
      'ios/**',
      'node_modules/**',
      'origin/**',
      'vendor/**',
      'coverage/**',
    ],
  },
  ...reactNativeConfig,
  {
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.{js,mjs,cjs}', 'config/**/*.{js,mjs,cjs}', '*.{js,mjs,cjs}'],
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
];
