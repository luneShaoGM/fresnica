const reactNativeConfig = require('@react-native/eslint-config/flat');

// RN 0.87 still attaches eslint-plugin-ft-flow to **/*.js. That plugin calls
// context.getAllComments(), which ESLint 9.39 removed. This repo is TypeScript, not Flow.
const reactNativeWithoutFlow = reactNativeConfig.filter(entry => !entry.plugins?.['ft-flow']);

module.exports = [
  {
    ignores: ['android/**', 'ios/**', 'node_modules/**', 'origin/**', 'vendor/**', 'coverage/**'],
  },
  ...reactNativeWithoutFlow,
  {
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.{js,mjs,cjs}', 'config/**/*.{js,mjs,cjs}', '*.{js,mjs,cjs}'],
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
];
