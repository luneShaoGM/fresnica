# Fresnica Mobile Capability Rebaseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate Fresnica Mobile onto one clean baseline, remove the Mobile-local `core` architecture layer, align current code with upstream Application Capability semantics, and prepare a verified replacement PR to `main`.

**Architecture:** Keep the verified RN 0.87 Android/iOS consumer shell intact while moving application code to `app / features / capabilities / platform` responsibilities. Native SDK security authority remains behind a narrow `FresnicaSdk` adapter; Stellar/Horizon and persistence are platform mechanisms; Transaction, Ledger Authorization and Signing Coordination become reusable Mobile Capability implementations.

**Tech Stack:** React Native 0.87.0, React 19.2.3, TypeScript 6.0.3, Jest 29.7.0, `@stellar/stellar-sdk` 17.0.1, Fresnica Native SDK 0.2.1, RN adapter source 0.2.0.

**Spec:** `docs/superpowers/specs/2026-08-27-mobile-capability-rebaseline-design.md`

## Global Constraints

- Implementation baseline is `work/rn087-native-shell @ 6948345d20abeebf77543f6995bdcca35afcf708`, already captured by `refactor/mobile-capabilities`.
- `Core` terminology is reserved for Fresnica SDK/Rust Core security authority; Mobile application architecture must not retain `src/core` as a long-term layer.
- `NativeModules.FresnicaCore` remains the upstream React Native module name at the platform boundary.
- Mobile must not implement secret/mnemonic derivation, KDF/envelope cryptography, raw private signing, `WalletUnlockKey` handling, or protected-envelope parsing in TypeScript.
- Account identity and Signer capability remain separate; watch-only remains derived from absence of an applicable local signer.
- Transaction review must remain bound to the exact XDR that is signed.
- Ledger Authorization must be refreshed immediately before signing; local signer presence alone is not authorization.
- System Auth/passcode behavior must be centralized in Signing Coordination, not implemented independently by Payment/Send/Swap/Trustline flows.
- Current upstream Mobile consumer baseline remains Native SDK `0.2.1`, Native Binding API `2`, Universal SDK API `3`, Core Client API `3`, RN adapter source `0.2.0`, RN `0.87.0` unless upstream consumer contracts explicitly change during execution.
- Use no new runtime dependency for this rebaseline.
- Every structural task must leave `npm run typecheck` and the relevant focused Jest tests passing before the old path is deleted.

---

## File Structure Locked By This Plan

```text
src/
  app/
    config/
    App.tsx

  capabilities/
    account/
      AccountSignerRepository.ts
      types.ts
      __tests__/
    signer/
      types.ts
    payment/
      buildPaymentReview.ts
      submitReviewedPayment.ts
      __tests__/
    transaction/
      ReviewedTransaction.ts
      assertReviewedTransactionFresh.ts
      submission.ts
      __tests__/
    ledger-authorization/
      types.ts
      resolveLocalSigner.ts
      __tests__/
    signing/
      signReviewedTransaction.ts
      __tests__/

  platform/
    fresnica/
      FresnicaSdk.ts
      types.ts
      compatibility.ts
      index.ts
      native/
        FresnicaNativeError.ts
        NativeFresnicaModule.ts
        ReactNativeFresnicaSdk.ts
        loadNativeFresnicaModule.ts
        index.ts
        __tests__/
      __tests__/

    stellar/
      StellarGateway.ts
      StellarSdkGateway.ts
      types.ts
      index.ts
      __tests__/

    persistence/
      memory/
        InMemoryAccountSignerRepository.ts
        __tests__/
      index.ts
```

Do not create empty `features/*` directories during this rebaseline. Feature folders begin when product screens/application flows are implemented.

---

### Task 1: Move the Fresnica Native SDK adapter out of Mobile `core`

**Files:**
- Create: `src/platform/fresnica/FresnicaSdk.ts`
- Create: `src/platform/fresnica/types.ts`
- Create: `src/platform/fresnica/compatibility.ts`
- Create: `src/platform/fresnica/index.ts`
- Create: `src/platform/fresnica/native/FresnicaNativeError.ts`
- Create: `src/platform/fresnica/native/NativeFresnicaModule.ts`
- Create: `src/platform/fresnica/native/ReactNativeFresnicaSdk.ts`
- Create: `src/platform/fresnica/native/loadNativeFresnicaModule.ts`
- Create: `src/platform/fresnica/native/index.ts`
- Move/rewrite tests from: `src/core/fresnica/__tests__/*`, `src/core/fresnica/native/__tests__/*`
- Modify imports in: `src/core/stellar/signing/*.ts`, `src/core/stellar/signing/__tests__/*.ts`
- Delete after green verification: `src/core/fresnica/**`

**Interfaces:**
- Produces: `FresnicaSdk` with the same high-level methods currently exposed by `FresnicaCore`.
- Produces: `ReactNativeFresnicaSdk implements FresnicaSdk`.
- Produces: `loadNativeFresnicaModule(nativeModules): NativeFresnicaModule`.
- Preserves runtime contract: lookup key is exactly `FresnicaCore`.

- [ ] **Step 1: Add a failing adapter boundary test for the new SDK naming**

Create `src/platform/fresnica/native/__tests__/loadNativeFresnicaModule.test.ts` with a test equivalent to:

```ts
import { loadNativeFresnicaModule } from '../loadNativeFresnicaModule';

describe('loadNativeFresnicaModule', () => {
  it('loads only the upstream FresnicaCore NativeModules key', () => {
    const module = { parseAccount: jest.fn() };

    expect(loadNativeFresnicaModule({ FresnicaCore: module })).toBe(module);
    expect(() => loadNativeFresnicaModule({ FresnicaSdk: module })).toThrow(
      'FresnicaCore native module is unavailable',
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails because the new module path does not exist**

Run:

```bash
npx jest src/platform/fresnica/native/__tests__/loadNativeFresnicaModule.test.ts --runInBand
```

Expected: FAIL with module-not-found for `loadNativeFresnicaModule`.

- [ ] **Step 3: Create `FresnicaSdk` and move the existing SDK value types without changing their semantic shapes**

Create `src/platform/fresnica/FresnicaSdk.ts` using the existing method set:

```ts
export interface FresnicaSdk {
  parseAccount(address: string): Promise<AccountIdentity>;
  protectSecret(input: ProtectSecretInput): Promise<ProtectedSigner>;
  protectMnemonic(input: ProtectMnemonicInput): Promise<ProtectedSigner>;
  generateMnemonic(input: GenerateMnemonicInput): Promise<GeneratedSigner>;
  deriveMnemonicSigner(input: DeriveMnemonicSignerInput): Promise<ProtectedSigner>;
  reprotect(input: ReprotectInput): Promise<ProtectedSigner>;
  reveal(input: RevealInput): Promise<RevealedSigningMaterial>;
  prepareEd25519Signing(input: PrepareEd25519SigningInput): Promise<Ed25519SigningRequest>;
  applyEd25519Signature(input: ApplyEd25519SignatureInput): Promise<string>;
  canUseSystemAuth(): Promise<boolean>;
  hasSystemAuthDomain(): Promise<boolean>;
  initializeSystemAuth(reason: string): Promise<boolean>;
  registerSignerSystemAuth(input: RegisterSignerSystemAuthInput): Promise<boolean>;
  hasSignerSystemAuth(expectedSignerPublicKey: string): Promise<boolean>;
  removeSignerSystemAuth(expectedSignerPublicKey: string): Promise<boolean>;
  removeSystemAuthDomain(): Promise<boolean>;
  signWithSystemAuth(input: SignWithSystemAuthInput): Promise<string>;
  signWithPasscode(input: SignWithPasscodeInput): Promise<string>;
}
```

Copy the existing data types from `src/core/fresnica/types.ts` into `src/platform/fresnica/types.ts` unchanged unless an import-only rename is required.

- [ ] **Step 4: Implement the native loader and React Native adapter under platform naming**

`loadNativeFresnicaModule` must retain the exact runtime key:

```ts
export function loadNativeFresnicaModule(
  nativeModules: Record<string, unknown>,
): NativeFresnicaModule {
  const candidate = nativeModules.FresnicaCore;
  if (!candidate) {
    throw new Error('FresnicaCore native module is unavailable');
  }
  return candidate as NativeFresnicaModule;
}
```

Rename only the Mobile TypeScript abstraction (`ReactNativeFresnicaSdk`); do not rename the underlying native module registration.

- [ ] **Step 5: Port the existing compatibility and native-error tests to the new paths**

Preserve all assertions from:

```text
src/core/fresnica/__tests__/FresnicaCore.contract.test.ts
src/core/fresnica/__tests__/compatibility.test.ts
src/core/fresnica/native/__tests__/FresnicaNativeError.test.ts
src/core/fresnica/native/__tests__/NativeFresnicaCoreModule.contract.test.ts
src/core/fresnica/native/__tests__/ReactNativeFresnicaCore.test.ts
src/core/fresnica/native/__tests__/loadNativeFresnicaCoreModule.test.ts
```

Update symbol names only where the symbol represents Mobile code, not the native module name.

- [ ] **Step 6: Update consumers from `FresnicaCore` type to `FresnicaSdk` and remove the old adapter tree**

For example, existing signing dependencies change from:

```ts
core: FresnicaCore;
```

to:

```ts
sdk: FresnicaSdk;
```

Do not change signing behavior in this task.

- [ ] **Step 7: Run focused adapter tests and full TypeScript/Jest checks**

Run:

```bash
npx jest src/platform/fresnica --runInBand
npm run typecheck
npm test
```

Expected: all PASS.

- [ ] **Step 8: Commit the SDK boundary migration**

Commit message:

```text
refactor: move Fresnica SDK adapter to platform boundary
```

---

### Task 2: Separate Account/Signer semantics from persistence mechanisms

**Files:**
- Create: `src/capabilities/account/types.ts`
- Create: `src/capabilities/signer/types.ts`
- Create: `src/capabilities/account/AccountSignerRepository.ts`
- Create: `src/capabilities/account/__tests__/walletInvariants.test.ts`
- Create: `src/platform/persistence/memory/InMemoryAccountSignerRepository.ts`
- Create: `src/platform/persistence/memory/__tests__/InMemoryAccountSignerRepository.test.ts`
- Create: `src/platform/persistence/index.ts`
- Modify: signing/payment imports that consume `SignerRecord`
- Delete after verification: `src/core/storage/**`

**Interfaces:**
- Produces: `AccountRecord`, `AccountSignerReference` from `capabilities/account/types.ts`.
- Produces: `SignerRecord`, `SignerKind`, recovery/cleanup types from `capabilities/signer/types.ts`.
- Produces: `AccountSignerRepository` with the current repository operations.
- Produces: `InMemoryAccountSignerRepository implements AccountSignerRepository`.

- [ ] **Step 1: Write failing tests against the target account/signer capability paths**

The invariants test must explicitly verify:

```ts
expect(repository.isWatchOnly(account.id)).toBe(true);
repository.createSigner(signer);
repository.attachSigner(account.id, signer.id, now);
expect(repository.isWatchOnly(account.id)).toBe(false);
repository.detachSigner(account.id, signer.id);
expect(repository.isWatchOnly(account.id)).toBe(true);
```

Also preserve the shared-signer test: deleting one account must not delete or invalidate a signer still referenced by another account.

- [ ] **Step 2: Run the new focused tests and verify the target modules are missing**

Run:

```bash
npx jest src/capabilities/account src/platform/persistence/memory --runInBand
```

Expected: FAIL because the new modules do not exist.

- [ ] **Step 3: Split the current record types by semantic owner**

Move these fields unchanged:

```ts
export type AccountRecord = {
  id: string;
  address: string;
  identityKind: 'classic' | 'contract';
  networkId: string;
  label: string;
  sortOrder: number;
  hidden: boolean;
  createdAt: Date;
  updatedAt: Date;
};
```

and:

```ts
export type SignerRecord = {
  id: string;
  publicKey: string;
  kind: 'protected-software' | 'hardware' | 'external';
  envelopeJson?: string;
  envelopeRevision?: string;
  recoveryKind?: 'mnemonic' | 'secret';
  backupState?: 'pending' | 'confirmed' | 'not-required';
  providerId?: string;
  providerMetadataJson?: string;
  createdAt: Date;
  updatedAt: Date;
};
```

Keep `SecureCleanupTask` with Signer lifecycle semantics; do not make it a generic persistence type.

- [ ] **Step 4: Replace `WalletRepository` with `AccountSignerRepository` without changing behavior**

Use this interface:

```ts
export interface AccountSignerRepository {
  createAccount(account: AccountRecord): void;
  createSigner(signer: SignerRecord): void;
  attachSigner(accountId: string, signerId: string, createdAt: Date): void;
  detachSigner(accountId: string, signerId: string): void;
  deleteAccount(accountId: string): void;
  getAccount(accountId: string): AccountRecord | undefined;
  getSigner(signerId: string): SignerRecord | undefined;
  isWatchOnly(accountId: string): boolean;
}
```

- [ ] **Step 5: Move the in-memory implementation to `platform/persistence/memory` and update all imports**

Behavior must remain identical; this task is ownership cleanup, not Realm implementation.

- [ ] **Step 6: Run focused tests, typecheck and the full Jest suite**

Run:

```bash
npx jest src/capabilities/account src/platform/persistence/memory --runInBand
npm run typecheck
npm test
```

Expected: all PASS.

- [ ] **Step 7: Delete `src/core/storage/**` and commit**

Commit message:

```text
refactor: separate account signer semantics from persistence
```

---

### Task 3: Move Stellar mechanics to platform and make Ledger Authorization typed

**Files:**
- Create: `src/capabilities/ledger-authorization/types.ts`
- Create: `src/capabilities/ledger-authorization/resolveLocalSigner.ts`
- Create: `src/capabilities/ledger-authorization/__tests__/resolveLocalSigner.test.ts`
- Create: `src/platform/stellar/StellarGateway.ts`
- Create: `src/platform/stellar/StellarSdkGateway.ts`
- Create: `src/platform/stellar/types.ts`
- Create: `src/platform/stellar/index.ts`
- Create/port: `src/platform/stellar/__tests__/StellarSdkGateway.test.ts`
- Delete after verification: `src/core/stellar/accounts/**`, `src/core/stellar/gateway/**`

**Interfaces:**
- Produces: typed `ClassicLedgerAuthorization`.
- Produces: `resolveLocalSigner(authorization, availableSignerPublicKeys, threshold)` that only treats Ed25519 ledger conditions as invokable software-signer candidates.
- Produces: `StellarGateway` for public chain state, transaction building and submission.

- [ ] **Step 1: Add failing typed-ledger tests**

Use a condition union that cannot confuse typed ledger identities:

```ts
export type LedgerSignerCondition =
  | { kind: 'ed25519'; publicKey: string; weight: number }
  | { kind: 'preauth-tx'; key: string; weight: number }
  | { kind: 'hash-x'; key: string; weight: number }
  | { kind: 'signed-payload'; key: string; weight: number };
```

Test that a matching `preauth-tx` or `hash-x` key is never treated as a local Ed25519 signer.

- [ ] **Step 2: Run the typed-ledger tests and verify they fail on missing target modules**

Run:

```bash
npx jest src/capabilities/ledger-authorization --runInBand
```

Expected: FAIL.

- [ ] **Step 3: Implement `ClassicLedgerAuthorization` and the resolver**

Use:

```ts
export type ClassicLedgerAuthorization = {
  address: string;
  thresholds: { low: number; medium: number; high: number };
  signers: LedgerSignerCondition[];
};
```

Resolver result must preserve the current fail-closed states:

```ts
'ready' | 'watch-only' | 'insufficient-weight' | 'unsupported-multisig'
```

The resolver may select a single local Ed25519 signer only when that signer individually satisfies the required threshold.

- [ ] **Step 4: Port the Stellar gateway under `platform/stellar` and normalize Horizon signer types**

Map Horizon signer `type` values explicitly:

```text
ed25519_public_key -> ed25519
preauth_tx -> preauth-tx
sha256_hash -> hash-x
ed25519_signed_payload -> signed-payload
```

Unknown signer types must throw a stable integration error rather than being silently treated as Ed25519.

- [ ] **Step 5: Preserve payment construction behavior exactly**

`buildPayment` must still:

- use the configured Testnet passphrase;
- create exactly one payment operation;
- preserve native vs issued asset code/issuer;
- preserve optional text memo;
- set a 180-second timeout;
- return exact XDR.

- [ ] **Step 6: Run focused gateway/authorization tests plus full checks**

Run:

```bash
npx jest src/capabilities/ledger-authorization src/platform/stellar --runInBand
npm run typecheck
npm test
```

Expected: all PASS.

- [ ] **Step 7: Delete the old accounts/gateway paths and commit**

Commit message:

```text
refactor: establish typed ledger authorization boundary
```

---

### Task 4: Establish Transaction integrity and Payment semantic review

**Files:**
- Create: `src/capabilities/transaction/ReviewedTransaction.ts`
- Create: `src/capabilities/transaction/assertReviewedTransactionFresh.ts`
- Create: `src/capabilities/transaction/__tests__/assertReviewedTransactionFresh.test.ts`
- Create: `src/capabilities/payment/buildPaymentReview.ts`
- Create: `src/capabilities/payment/__tests__/buildPaymentReview.test.ts`
- Delete after verification: `src/core/stellar/review/**`

**Interfaces:**
- Produces: `ReviewedTransaction` containing exact XDR, network id, source, fee and explicit expiry when present.
- Produces: `PaymentReview extends ReviewedTransaction` with destination/amount/asset/memo.
- Produces: `assertReviewedTransactionFresh(review, nowUnixSeconds)`.

- [ ] **Step 1: Write a failing freshness regression test**

Use a deterministic review object:

```ts
const review = {
  transactionXdrBase64: 'AAAA-reviewed-xdr',
  networkId: 'stellar-testnet',
  source: 'GSOURCE',
  fee: '100',
  expiresAtUnixSeconds: 1000,
} as const;

expect(() => assertReviewedTransactionFresh(review, 1000)).toThrow(
  'Reviewed transaction is expired',
);
expect(() => assertReviewedTransactionFresh(review, 999)).not.toThrow();
```

- [ ] **Step 2: Run the freshness test and verify it fails before implementation**

Run:

```bash
npx jest src/capabilities/transaction/__tests__/assertReviewedTransactionFresh.test.ts --runInBand
```

Expected: FAIL.

- [ ] **Step 3: Implement `ReviewedTransaction` and freshness checking**

Use:

```ts
export type ReviewedTransaction = Readonly<{
  transactionXdrBase64: string;
  networkId: string;
  source: string;
  fee: string;
  expiresAtUnixSeconds?: number;
}>;
```

`assertReviewedTransactionFresh` must fail closed when an explicit max time is less than or equal to `nowUnixSeconds`.

- [ ] **Step 4: Port `buildPaymentReview` into the Payment Capability and include transaction max-time information**

Preserve current review restrictions:

```text
exactly one operation
operation type must be payment
no operation source override
memo is none or text only
network must match configured network
```

The returned `transactionXdrBase64` must be exactly the input XDR.

- [ ] **Step 5: Port all existing Payment review regression tests and add the expiry extraction assertion**

The test must prove that a transaction created with a known timeout produces the expected `expiresAtUnixSeconds` value in the review.

- [ ] **Step 6: Run focused tests and the full suite**

Run:

```bash
npx jest src/capabilities/transaction src/capabilities/payment/__tests__/buildPaymentReview.test.ts --runInBand
npm run typecheck
npm test
```

Expected: all PASS.

- [ ] **Step 7: Delete the old review path and commit**

Commit message:

```text
refactor: establish transaction review integrity boundary
```

---

### Task 5: Generalize Signing Coordination and normalize submission outcomes

**Files:**
- Create: `src/capabilities/signing/signReviewedTransaction.ts`
- Create: `src/capabilities/signing/__tests__/signReviewedTransaction.test.ts`
- Create: `src/capabilities/transaction/submission.ts`
- Modify: `src/platform/stellar/StellarGateway.ts`
- Modify: `src/platform/stellar/StellarSdkGateway.ts`
- Modify: `src/platform/stellar/types.ts`
- Create: `src/capabilities/payment/submitReviewedPayment.ts`
- Create/port: `src/capabilities/payment/__tests__/submitReviewedPayment.test.ts`
- Delete after verification: `src/core/stellar/signing/**`

**Interfaces:**
- Produces: `signReviewedTransaction({ sdk, review, signer, appPasscode?, systemAuthReason? })`.
- Produces: `TransactionSubmissionResult` with `accepted`, `rejected`, and `uncertain` states.
- Produces: `submitReviewedPayment` as current Payment orchestration using generic Transaction/Ledger Authorization/Signing Coordination boundaries.

- [ ] **Step 1: Write the failing generic Signing Coordination tests**

Test the exact three existing software-signer outcomes against `ReviewedTransaction` rather than `PaymentReview`:

```text
registered System Auth -> signWithSystemAuth(exact reviewed XDR)
no System Auth + no passcode -> passcode-required
passcode supplied -> signWithPasscode(exact reviewed XDR)
```

Also test malformed/external signer -> `unsupported-signer` before any SDK call.

- [ ] **Step 2: Run the signing test and verify failure on missing generic module**

Run:

```bash
npx jest src/capabilities/signing --runInBand
```

Expected: FAIL.

- [ ] **Step 3: Implement `signReviewedTransaction` with the SDK dependency name and no Payment knowledge**

The core call shapes remain:

```ts
await sdk.signWithSystemAuth({
  envelopeJson: signer.envelopeJson,
  expectedSignerPublicKey: signer.publicKey,
  transactionXdrBase64: review.transactionXdrBase64,
  networkPassphrase: APP_CONFIG.network.networkPassphrase,
  reason,
});
```

or:

```ts
await sdk.signWithPasscode({
  envelopeJson: signer.envelopeJson,
  appPasscode,
  expectedSignerPublicKey: signer.publicKey,
  transactionXdrBase64: review.transactionXdrBase64,
  networkPassphrase: APP_CONFIG.network.networkPassphrase,
});
```

- [ ] **Step 4: Add a failing submission-normalization test at the Stellar platform boundary**

Define:

```ts
export type TransactionSubmissionResult =
  | { status: 'accepted'; hash: string; ledger?: number }
  | { status: 'rejected'; transactionHash: string; resultCode?: string }
  | { status: 'uncertain'; transactionHash: string };
```

Tests:

1. successful Horizon response -> `accepted`;
2. deterministic Horizon `400` response -> `rejected`;
3. thrown transport error without deterministic ledger rejection -> `uncertain`.

The `transactionHash` for rejected/uncertain outcomes must be computed from the exact signed transaction before submission so later reconciliation has a stable identity.

- [ ] **Step 5: Implement submission normalization without adding a retry loop**

Unknown/transport failures return `uncertain`; do not automatically resubmit. A deterministic Horizon transaction rejection may return `rejected` with a parsed result code when available.

- [ ] **Step 6: Port `submitReviewedPayment` to Payment capability orchestration and enforce ordering**

Required order:

```text
assert review freshness
-> refresh Classic ledger authorization for review.source
-> resolve a local Ed25519 signer at medium threshold
-> if blocked: return authorization-blocked without auth prompt
-> shared signReviewedTransaction
-> if passcode-required/unsupported: return without submission
-> submit exact signed XDR
-> map accepted/rejected/uncertain result
```

The current Payment review guarantees one payment operation and no operation-source override, therefore the Classic medium threshold applies to this current supported slice.

- [ ] **Step 7: Add/port Payment execution regressions**

Tests must prove:

- insufficient signer weight never invokes System Auth/passcode;
- stale review never loads authorization or invokes SDK;
- signing receives the exact reviewed XDR;
- the exact signed XDR returned by SDK is the value submitted;
- uncertain submission is surfaced as uncertain and not retried;
- deterministic rejection is distinct from uncertain transport failure.

- [ ] **Step 8: Run all capability/platform tests and full checks**

Run:

```bash
npx jest src/capabilities src/platform --runInBand
npm run typecheck
npm test
npm run check
```

Expected: all PASS.

- [ ] **Step 9: Delete `src/core/stellar/signing/**`; verify `src/core` no longer exists; commit**

Commit message:

```text
refactor: centralize transaction signing coordination
```

---

### Task 6: Record current SDK compatibility and replace stale architecture documentation

**Files:**
- Modify: `src/platform/fresnica/compatibility.ts`
- Modify: `src/platform/fresnica/__tests__/compatibility.test.ts`
- Modify: `README.md`
- Modify: `docs/fresnica-mobile-handoff.md`
- Create: `docs/mobile-capability-status.md`
- Modify if necessary: design/architecture docs that still describe Mobile `Core = Capability`

**Interfaces:**
- Produces: one explicit current Mobile SDK compatibility record.
- Produces: one Mobile Capability support/conformance matrix.

- [ ] **Step 1: Add a failing compatibility metadata test for all separately-versioned contracts**

The application compatibility record must expose current verified consumer values separately:

```ts
expect(FRESNICA_SDK_COMPATIBILITY).toEqual({
  nativeSdkVersion: '0.2.1',
  nativeBindingApiVersion: 2,
  universalSdkApiVersion: 3,
  coreClientApiVersion: 3,
  adapterSourceVersion: '0.2.0',
  reactNativeVersion: '0.87.0',
});
```

Do not rename Native SDK `0.2.1` to `2.1` merely because a Core release/state is described as 2.1 elsewhere.

- [ ] **Step 2: Verify current upstream Mobile consumer docs before changing compatibility values**

Read current upstream:

```text
docs/platforms/mobile/sdk-usage.md
docs/platforms/mobile/bindings.md
docs/platforms/mobile/framework-adapter.md
docs/platforms/mobile/system-auth.md
docs/platforms/mobile/security-vault-contract.md
docs/sdk/native-release.md
```

Also re-read:

```text
docs/capabilities/transaction.md
docs/capabilities/signing-coordination.md
docs/capabilities/ledger-authorization.md
```

If the exact consumer versions differ from the constants above, update the test and implementation to the upstream values and document the source commit; otherwise retain the exact current pins.

- [ ] **Step 3: Implement the compatibility record and keep adapter-manifest validation separate**

`FRESNICA_ADAPTER_REQUIREMENTS` remains only the fields the adapter manifest actually guarantees. `FRESNICA_SDK_COMPATIBILITY` records the broader SDK/Core consumer contract and must not force manifest validation against fields absent from the manifest.

- [ ] **Step 4: Rewrite README architecture/baseline text**

README must state:

```text
main is the long-lived baseline after rebaseline merge
Mobile Feature -> Application Flow -> Application Capability -> platform/Fresnica SDK mechanisms
NativeModules.FresnicaCore is an upstream runtime module name, not a Mobile architecture layer
```

Replace stale `docs/mobile-sdk-usage.md` references with `docs/platforms/mobile/sdk-usage.md`.

- [ ] **Step 5: Update the local handoff and add `docs/mobile-capability-status.md`**

Initial matrix must truthfully reflect current implementation, for example:

```text
Account                foundation implemented; persistence still in-memory
Signer                 foundation implemented; Native SDK protected software path integrated
Payment                Testnet payment construction/review/execution foundation implemented
Transaction            exact-review binding + freshness + normalized submission foundation implemented
Ledger Authorization   Defined; current single-source Classic payment slice implemented
Signing Coordination   Normative software signer System Auth/passcode slice implemented
Balance                 not implemented
Trustline               not implemented
SDEX                    not implemented
```

Do not claim Realm, Mainnet, Swap, multisig coordination or full dApp signing support.

- [ ] **Step 6: Scan the repository for obsolete architecture terms**

Search for:

```text
src/core
Mobile Core
Core = Capability
mobile-sdk-usage.md
signReviewedPayment
FresnicaCore type
```

Remaining `FresnicaCore` occurrences are allowed only where they refer to actual upstream Fresnica Core/security authority or the `NativeModules.FresnicaCore` runtime contract.

- [ ] **Step 7: Run complete verification**

Run:

```bash
npm run typecheck
npm test
npm run check
```

Expected: all PASS.

Also verify the existing native workflow files and RN shell have not been removed or bypassed.

- [ ] **Step 8: Commit documentation and compatibility synchronization**

Commit message:

```text
docs: align mobile baseline with capability contracts
```

---

### Task 7: Replacement PR and safe branch convergence

**Files/remote state:**
- Create replacement PR: `refactor/mobile-capabilities -> main`
- Close when replacement PR is ready and validated: PR #1, PR #2, PR #10
- Candidate old branches: `architecture/phase-1`, `feat/fresnica-mobile-v1`, and all listed `work/*` branches

**Interfaces:**
- Produces: one replacement PR that becomes the sole active development review.
- Produces: a verified safe-to-delete branch list.

- [ ] **Step 1: Compare every historical branch against `refactor/mobile-capabilities`**

For each candidate, verify it contributes no required source, test, native integration, or architecture content absent from the rebaseline branch.

The comparison must include:

```text
architecture/phase-1
feat/fresnica-mobile-v1
work/mobile-sdk-usage-baseline
work/native-module-loader-tdd
work/payment-review
work/reviewed-payment-execution
work/stellar-gateway
work/transaction-signer-resolution
work/transaction-signing-coordinator
work/rn087-native-shell
```

- [ ] **Step 2: Open the replacement PR to `main`**

Title:

```text
refactor: rebaseline Fresnica Mobile on capability architecture
```

PR body must summarize:

- RN 0.87 native shell preservation;
- `src/core` removal;
- Fresnica SDK platform boundary;
- Account/Signer/persistence split;
- typed Ledger Authorization;
- Transaction freshness and normalized submission;
- shared Signing Coordination;
- SDK compatibility verification;
- branch/PR supersession plan.

- [ ] **Step 3: Verify CI/status for the replacement PR head**

Do not close old PRs until the replacement PR exists and its available CI checks are successful. If native jobs are unavailable in the current environment, state exactly which checks have not run.

- [ ] **Step 4: Close PR #1, #2 and #10 as superseded with a pointer to the replacement PR**

Use a closure note equivalent to:

```text
Superseded by the Fresnica Mobile capability rebaseline PR, which preserves the required work from this branch and establishes the new mainline architecture.
```

- [ ] **Step 5: Recompare old branch heads after PR closure and produce the final safe-to-delete list**

A branch is safe only when the rebaseline contains or intentionally supersedes every required change.

- [ ] **Step 6: Delete obsolete branch refs where tooling permits; otherwise report the exact branches requiring one manual GitHub delete action**

The current ChatGPT GitHub connector does not expose a branch-ref deletion action. Do not emulate deletion with force-updating refs. If this remains true at execution time, provide the final exact list for manual deletion after merge.

- [ ] **Step 7: After merge, verify `main` contains the replacement head and future work can branch directly from `main`**

Final expected long-lived branch model:

```text
main
  <- short-lived feat/*
  <- short-lived fix/*
  <- short-lived refactor/*
```

No future task should require chaining from a historical `work/*` checkpoint branch.
