'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { classifyGatePlan, heavyGateDisposition } = require('./fresnica-gate-planner.cjs');

test('automation/docs/controller-only changes require no heavy gates', () => {
  const plan = classifyGatePlan([
    '.github/workflows/fresnica-controller.yml',
    '.github/automation/review-task-v2.md',
    'docs/automation/fresnica-automation-v2.1-efficiency.md',
    'scripts/fresnica-controller.cjs',
    'scripts/fresnica-gate-planner.cjs',
  ]);
  assert.equal(plan.automationOnly, true);
  assert.deepEqual(plan.heavy, { realm: false, android: false, apple: false });
});

test('product JS/shared changes require both native heavy gates', () => {
  const plan = classifyGatePlan(['src/features/send/SendScreen.tsx']);
  assert.equal(plan.productJsShared, true);
  assert.deepEqual(plan.heavy, { realm: false, android: true, apple: true });
});

test('Realm persistence changes require Realm plus both native heavy gates', () => {
  const plan = classifyGatePlan(['src/platform/persistence/realm/schemas.ts']);
  assert.equal(plan.realmPersistence, true);
  assert.deepEqual(plan.heavy, { realm: true, android: true, apple: true });
});

test('platform-specific changes run only the corresponding native heavy gate', () => {
  assert.deepEqual(classifyGatePlan(['android/app/build.gradle']).heavy, {
    realm: false,
    android: true,
    apple: false,
  });
  assert.deepEqual(classifyGatePlan(['ios/Fresnica/Info.plist']).heavy, {
    realm: false,
    android: false,
    apple: true,
  });
});

test('native/shared dependency changes fail closed across native and Realm when dependency risk is shared', () => {
  const plan = classifyGatePlan(['package-lock.json']);
  assert.equal(plan.nativeSharedImpacting, true);
  assert.equal(plan.realmPersistence, true);
  assert.deepEqual(plan.heavy, { realm: true, android: true, apple: true });
});

test('unknown runtime/config paths fail closed to all heavy gates', () => {
  const plan = classifyGatePlan(['config/runtime-boundary.cjs']);
  assert.equal(plan.unknownRuntimeImpacting, true);
  assert.deepEqual(plan.heavy, { realm: true, android: true, apple: true });
});

test('heavy disposition is not-applicable, deferred, or applicable by trusted plan and state', () => {
  const automationPlan = classifyGatePlan(['.github/workflows/ai-review-gate.yml']);
  assert.equal(heavyGateDisposition(automationPlan, 'android', 'ai:approved'), 'not-applicable');

  const productPlan = classifyGatePlan(['src/features/send/SendScreen.tsx']);
  assert.equal(heavyGateDisposition(productPlan, 'android', 'ai:ready-review'), 'deferred');
  assert.equal(heavyGateDisposition(productPlan, 'android', 'ai:approved'), 'applicable');
});
