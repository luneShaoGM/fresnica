'use strict';

const HEAVY_GATES = Object.freeze(['realm', 'android', 'apple']);

function normalizePath(file) {
  return String(file || '').replace(/^\.\//, '');
}

function isAutomationOrDocs(file) {
  return (
    file.startsWith('.github/') ||
    file.startsWith('docs/') ||
    file === 'scripts/fresnica-controller.cjs' ||
    file === 'scripts/fresnica-controller.test.cjs' ||
    file === 'scripts/fresnica-gate-planner.cjs' ||
    file === 'scripts/fresnica-gate-planner.test.cjs'
  );
}

function classifyGatePlan(files) {
  const normalized = [...new Set(files.map(normalizePath).filter(Boolean))];
  if (normalized.length === 0) {
    return {
      files: [],
      categories: ['automation/docs/controller-only'],
      automationOnly: true,
      productJsShared: false,
      realmPersistence: false,
      androidImpacting: false,
      appleImpacting: false,
      nativeSharedImpacting: false,
      unknownRuntimeImpacting: false,
      heavy: { realm: false, android: false, apple: false },
    };
  }

  const automationOnly = normalized.every(isAutomationOrDocs);
  let productJsShared = false;
  let realmPersistence = false;
  let androidImpacting = false;
  let appleImpacting = false;
  let nativeSharedImpacting = false;
  let unknownRuntimeImpacting = false;

  for (const file of normalized) {
    if (isAutomationOrDocs(file)) continue;

    if (file.startsWith('src/')) {
      productJsShared = true;
      if (file.startsWith('src/platform/persistence/realm/')) realmPersistence = true;
      continue;
    }
    if (file.startsWith('android/')) {
      androidImpacting = true;
      continue;
    }
    if (file.startsWith('ios/')) {
      appleImpacting = true;
      continue;
    }
    if (
      file === 'package.json' ||
      file === 'package-lock.json' ||
      file === 'react-native.config.js' ||
      file === 'metro.config.js' ||
      file === 'babel.config.js' ||
      file.startsWith('scripts/native-') ||
      file.startsWith('scripts/run-native-') ||
      file.startsWith('scripts/run-product-flow-') ||
      file.startsWith('scripts/product-flow-')
    ) {
      nativeSharedImpacting = true;
      if (file === 'package.json' || file === 'package-lock.json') realmPersistence = true;
      continue;
    }

    unknownRuntimeImpacting = true;
  }

  const heavy = {
    realm: realmPersistence || unknownRuntimeImpacting,
    android: productJsShared || androidImpacting || nativeSharedImpacting || unknownRuntimeImpacting,
    apple: productJsShared || appleImpacting || nativeSharedImpacting || unknownRuntimeImpacting,
  };

  const categories = [];
  if (automationOnly) categories.push('automation/docs/controller-only');
  if (productJsShared) categories.push('product-js/shared');
  if (realmPersistence) categories.push('realm/persistence-impacting');
  if (androidImpacting) categories.push('android-impacting');
  if (appleImpacting) categories.push('apple-impacting');
  if (nativeSharedImpacting) categories.push('native/shared-impacting');
  if (unknownRuntimeImpacting) categories.push('unknown-runtime/fail-closed');

  return {
    files: normalized,
    categories,
    automationOnly,
    productJsShared,
    realmPersistence,
    androidImpacting,
    appleImpacting,
    nativeSharedImpacting,
    unknownRuntimeImpacting,
    heavy,
  };
}

function heavyGateDisposition(plan, gate, aiState) {
  if (!HEAVY_GATES.includes(gate)) throw new Error(`Unknown heavy gate: ${gate}`);
  if (!plan.heavy[gate]) return 'not-applicable';
  if (aiState === 'ai:approved') return 'applicable';
  return 'deferred';
}

module.exports = { HEAVY_GATES, classifyGatePlan, heavyGateDisposition };
