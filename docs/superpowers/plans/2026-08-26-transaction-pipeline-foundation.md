# Stellar Transaction Pipeline Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable Testnet transaction foundation for Fresnica Mobile: resolve local Stellar signer authorization, derive an immutable transaction review model from the exact XDR, and route protected-software signing through one shared system-auth/passcode coordinator.

**Architecture:** This slice stays below screens. `src/core/stellar` owns public Stellar account/transaction representations and SDK adapters; `src/core/security` owns signing policy; features consume those ports. JavaScript constructs and reviews transactions, but Fresnica Native Core remains the only routine local signer implementation.

**Tech Stack:** React Native 0.87.0, TypeScript 6, Jest 29, `@stellar/stellar-sdk` 17.0.1, Fresnica Native SDK/RN adapter 0.2.0.

**Spec:** `docs/superpowers/specs/2026-08-26-fresnica-mobile-v1-design.md`

## Global Constraints

- Milestone 1 is Stellar Testnet only.
- Pin `@stellar/stellar-sdk` to exact `17.0.1` for this slice.
- Account identity and signer capability remain separate.
- Local signer ownership does not imply current ledger authorization.
- Review data is derived from the exact transaction XDR that will be signed.
- Protected-software signing goes through `FresnicaCore.signWithSystemAuth` or `FresnicaCore.signWithPasscode`; no JS private-key signing.
- A user-cancelled biometric prompt is distinct from invalidation, unavailable authentication and signing failure.
- v1 supports the ordinary single-local-signer case and returns explicit unsupported/insufficient states for multisig rather than guessing.
- No Swap, LP, Soroban contract auth, WalletConnect or general transaction plugin framework in this slice.

---

### Task 1: Stellar signer authorization resolver

**Files:**
- Create: `src/core/stellar/accounts/types.ts`
- Create: `src/core/stellar/signing/resolveLocalSigner.ts`
- Test: `src/core/stellar/signing/__tests__/resolveLocalSigner.test.ts`
- Create: `src/core/stellar/index.ts`

**Interfaces:**
- Consumes local signer public keys from Account/Signer persistence and current public Horizon account signer/threshold state.
- Produces `SignerResolution` with `ready`, `watch-only`, `insufficient-weight`, or `unsupported-multisig` status.

- [ ] **Step 1: Write the failing resolver tests**

```ts
import { resolveLocalSigner } from '../resolveLocalSigner';

const account = {
  address: 'GACCOUNT',
  thresholds: { low: 1, medium: 1, high: 1 },
  signers: [{ publicKey: 'GSIGNER', weight: 1 }],
};

test('selects one authorized local signer with enough weight', () => {
  expect(resolveLocalSigner(account, ['GSIGNER'], 'medium')).toEqual({
    status: 'ready',
    signerPublicKey: 'GSIGNER',
    requiredWeight: 1,
    availableWeight: 1,
  });
});

test('reports watch-only when no local signer exists', () => {
  expect(resolveLocalSigner(account, [], 'medium')).toEqual({
    status: 'watch-only',
    requiredWeight: 1,
    availableWeight: 0,
  });
});

test('does not claim readiness when several local signers are required', () => {
  expect(resolveLocalSigner({ ...account, thresholds: { low: 1, medium: 2, high: 2 } }, ['GSIGNER'], 'medium')).toEqual({
    status: 'insufficient-weight',
    requiredWeight: 2,
    availableWeight: 1,
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/core/stellar/signing/__tests__/resolveLocalSigner.test.ts`

Expected: FAIL because `resolveLocalSigner` does not exist.

- [ ] **Step 3: Implement the minimal public ledger types and resolver**

```ts
export type StellarThresholdLevel = 'low' | 'medium' | 'high';

export type StellarAccountAuthorization = {
  address: string;
  thresholds: { low: number; medium: number; high: number };
  signers: Array<{ publicKey: string; weight: number }>;
};
```

Resolver rules:
1. map the threshold level to required weight;
2. intersect ledger-authorized signers with local signer public keys;
3. ignore zero-weight ledger signers;
4. no local intersection => `watch-only`;
5. one local signer whose weight reaches threshold => `ready`;
6. total local weight below threshold => `insufficient-weight`;
7. more than one local signer is required to reach threshold => `unsupported-multisig` for v1.

- [ ] **Step 4: Run focused test and full typecheck**

Run: `npm run typecheck && npm test -- src/core/stellar/signing/__tests__/resolveLocalSigner.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: resolve Stellar local signer authorization`

---

### Task 2: Testnet Stellar Gateway transaction port

**Files:**
- Modify: `package.json`
- Create: `src/core/stellar/gateway/StellarGateway.ts`
- Create: `src/core/stellar/gateway/types.ts`
- Create: `src/core/stellar/gateway/StellarSdkGateway.ts`
- Test: `src/core/stellar/gateway/__tests__/StellarSdkGateway.test.ts`

**Interfaces:**
- Produces `loadAccountAuthorization(address)`, `buildPayment(input)`, and `submitTransaction(signedXdrBase64)`.
- The first implementation is hard-bound to `APP_CONFIG.network` Testnet values.

- [ ] **Step 1: Pin Stellar SDK and write gateway contract tests**

Add exact dependency:

```json
"@stellar/stellar-sdk": "17.0.1"
```

Test pure conversion of Horizon signer/threshold data into `StellarAccountAuthorization`; do not make live network calls in unit tests.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/core/stellar/gateway/__tests__/StellarSdkGateway.test.ts`

Expected: FAIL because gateway implementation does not exist.

- [ ] **Step 3: Implement the smallest SDK adapter**

`buildPayment` accepts:

```ts
type BuildPaymentInput = {
  source: string;
  destination: string;
  asset: { kind: 'native' } | { kind: 'credit'; code: string; issuer: string };
  amount: string;
  memo?: string;
  baseFee: string;
};
```

It loads the source account from Horizon, uses the fixed Testnet network passphrase, builds one payment operation, applies a bounded timeout, and returns base64 transaction XDR plus its source address. It never signs.

- [ ] **Step 4: Verify unit tests + typecheck**

Run: `npm run typecheck && npm test -- src/core/stellar/gateway/__tests__/StellarSdkGateway.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add Testnet Stellar transaction gateway`

---

### Task 3: Exact-XDR payment review model

**Files:**
- Create: `src/core/stellar/review/types.ts`
- Create: `src/core/stellar/review/buildPaymentReview.ts`
- Test: `src/core/stellar/review/__tests__/buildPaymentReview.test.ts`

**Interfaces:**
- Consumes base64 XDR and expected Testnet passphrase.
- Produces immutable `PaymentReview` containing source, destination, amount, asset, memo, fee and network ID.

- [ ] **Step 1: Write a test from a deterministic Stellar SDK transaction fixture**

The test constructs a transaction fixture using public test account strings only, converts it to XDR, calls `buildPaymentReview`, and asserts every review field.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/core/stellar/review/__tests__/buildPaymentReview.test.ts`

Expected: FAIL because `buildPaymentReview` does not exist.

- [ ] **Step 3: Implement exact-XDR parsing**

Reject:
- transactions with zero operations;
- transactions with more than one operation in this v1 Payment review function;
- non-payment operations;
- an unexpected network identifier supplied by the caller.

Return `Object.freeze(review)` so the Review screen cannot mutate the transaction summary after build.

- [ ] **Step 4: Verify focused and full tests**

Run: `npm run typecheck && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: derive payment review from exact XDR`

---

### Task 4: Shared protected-software signing coordinator

**Files:**
- Create: `src/core/security/TransactionSigningCoordinator.ts`
- Create: `src/core/security/types.ts`
- Test: `src/core/security/__tests__/TransactionSigningCoordinator.test.ts`
- Create: `src/core/security/index.ts`

**Interfaces:**
- Consumes a ready signer resolution, signer envelope, exact XDR, network passphrase and `FresnicaCore`.
- Produces signed base64 XDR or a stable coordinator result requiring passcode fallback/cancellation/re-enrollment.

- [ ] **Step 1: Write policy tests before implementation**

Test these paths:
1. enrolled system auth => `signWithSystemAuth` first;
2. `user-cancel` => return `{ status: 'cancelled' }`, do not silently prompt passcode;
3. `system-auth-not-enrolled` or `system-auth-invalidated` => return `{ status: 'passcode-required', reenrollSystemAuth: true }`;
4. unavailable system auth => `{ status: 'passcode-required', reenrollSystemAuth: false }`;
5. explicit passcode continuation calls only `signWithPasscode`;
6. invalid passcode remains an error category and does not fall back to any JS signing.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/core/security/__tests__/TransactionSigningCoordinator.test.ts`

Expected: FAIL because the coordinator does not exist.

- [ ] **Step 3: Implement the minimal coordinator**

The coordinator must not import React Native biometric libraries. It delegates OS authentication to the Fresnica native adapter and only interprets typed `FresnicaNativeErrorCode` values.

- [ ] **Step 4: Verify full checks**

Run: `npm run typecheck && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: centralize protected transaction signing policy`

---

### Task 5: Payment pipeline orchestration

**Files:**
- Create: `src/features/send/application/preparePayment.ts`
- Create: `src/features/send/application/authorizePayment.ts`
- Create: `src/features/send/application/submitPayment.ts`
- Test: `src/features/send/application/__tests__/paymentPipeline.test.ts`

**Interfaces:**
- `preparePayment` builds XDR and derives review data from that exact XDR.
- `authorizePayment` reloads current ledger authorization, resolves a local signer, and delegates to the shared signing coordinator.
- `submitPayment` accepts only signed XDR and delegates to Stellar Gateway.

- [ ] **Step 1: Write orchestration tests**

Prove that the prepared review is created from the returned XDR rather than form values, and that authorization reloads current account signer state before invoking Fresnica signing.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/features/send/application/__tests__/paymentPipeline.test.ts`

Expected: FAIL because pipeline application functions do not exist.

- [ ] **Step 3: Implement minimal orchestration**

Do not add screens, navigation, analytics or persistence to this task. Return explicit states the future UI can render.

- [ ] **Step 4: Verify all foundation checks**

Run: `npm run typecheck && npm test`

Expected: PASS with zero failed suites.

- [ ] **Step 5: Commit**

Commit message: `feat: orchestrate Testnet payment pipeline`

---

## Completion Gate

Before this plan is considered complete:

1. `npm run typecheck` exits 0;
2. `npm test` exits 0;
3. no `Keypair.fromSecret`, `.sign(`, mnemonic derivation, WalletUnlockKey, or raw private-key handling exists under `src/`;
4. transaction Review is generated from exact XDR;
5. biometric policy exists only in the shared signing coordinator, not Send-specific code;
6. insufficient signer weight is surfaced explicitly instead of attempting a transaction that cannot meet Stellar thresholds;
7. live Testnet submission remains behind `StellarGateway` and unit tests do not depend on public Horizon availability.
