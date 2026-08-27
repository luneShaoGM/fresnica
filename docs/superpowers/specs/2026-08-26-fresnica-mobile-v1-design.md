# Fresnica Mobile v1 Architecture Design

## Status

Approved direction for the new `fresnica-mobile` application.

This repository is intentionally rebuilt from a clean React Native application rather than continuing the Xaman-derived `luneShaoGM/Stellar` source tree.

## Goals

1. Build a commercial-safe Fresnica mobile wallet without inheriting Xaman/XRPL code ownership or architecture.
2. Make the product Stellar-native from the data model upward.
3. Use Fresnica Native SDK / Rust Core as the security and signing authority from the first implementation slice.
4. Preserve proven product behavior from the existing `luneShaoGM/Stellar` wallet where it is useful, but reimplement it behind new interfaces.
5. Borrow strong Stellar-specific UX and interaction ideas from `stellar/freighter-mobile` without copying its application architecture blindly.
6. Start with a narrow, testable Testnet wallet and add Swap, liquidity and dApp capabilities after the core wallet pipeline is stable.

## Non-goals for v1 milestone

The first milestone does not include:

- Mainnet enablement;
- Swap;
- liquidity pools;
- WalletConnect;
- embedded dApp browser / Freighter provider bridge;
- general Soroban contract authorization;
- passkeys;
- full multisig orchestration;
- Tangem or Ledger production support.

The architecture must leave room for those capabilities without implementing them speculatively.

## Fixed technical baseline

- Product display name: **Fresnica**.
- package/project identifier: **fresnica-mobile**.
- Network: **Stellar Testnet only** for the first usable milestone.
- React Native: **0.87.0**.
- React: **19.2.3**.
- Node.js: **>= 22.13.0**.
- React Native New Architecture / Fabric: enabled; do not add legacy-architecture compatibility work.
- Android minimum SDK: **26**, matching Fresnica Native SDK requirements.
- Navigation: React Navigation 7 native stack.
- Product state: Zustand 5; keep persisted wallet truth out of transient Zustand stores.
- Stellar networking / transaction construction: `@stellar/stellar-sdk` 17.x.
- Durable local wallet persistence: Realm, behind an application-owned storage port. Realm compatibility with RN 0.87 must be verified before its native dependency becomes a hard application requirement.
- Fresnica Native SDK: pin **native-sdk-v0.2.0** exactly for the first integration slice.
- Fresnica Native SDK v0.2.0 compatibility identifiers: Native Binding API 2, Universal SDK API 3, Core Client API 3.

React Native 0.87 is a fresh baseline, not an upgrade of the old RN 0.74 application. The project should be generated from the official 0.87 community template and then modified.

## Architecture

```text
React Native UI
      |
Feature application logic
      |
+--------------------+---------------------+
|                                          |
Fresnica adapter / Native SDK          Stellar Gateway
|                                      Horizon / RPC
Rust Core                              stellar-sdk
|                                          |
Signer / crypto authority             Stellar Testnet
```

The central rule is:

> React Native owns product orchestration. Fresnica Core owns cryptographic meaning. Stellar Gateway owns chain communication.

### Source ownership

`fresnica-mobile` owns:

- React Native UI;
- navigation;
- application state;
- Realm schema and migrations;
- account/signer references;
- product lifecycle and transaction orchestration;
- Horizon/RPC state and caches;
- operating-system lifecycle;
- user-facing biometric/system-auth flows.

`manran/fresnica` owns:

- Stellar identity parsing that affects security semantics;
- secret and mnemonic validation;
- SEP-0005 derivation;
- protected software-signer envelope format;
- encryption/KDF semantics;
- signer identity verification;
- transaction hashing/signing semantics;
- re-protection;
- stable native binding APIs;
- native signer authorization helpers.

The mobile repository must consume released native binaries and the canonical React Native adapter boundary. It must not fork Rust Core or make Rust/UniFFI compilation part of ordinary application builds.

## Directory structure

```text
src/
  app/
    App.tsx
    bootstrap/
    navigation/
    providers/
    config/

  features/
    onboarding/
    accounts/
    portfolio/
    send/
    history/
    trustlines/
    security/
    settings/

  core/
    fresnica/
    stellar/
    storage/
    security/
    network/

  shared/
    ui/
    hooks/
    utils/
    types/
    constants/

vendor/
  fresnica/
    native/
    adapter/react-native/

docs/
```

Feature code should own feature-specific screens, state and application functions. Avoid recreating the old global `services/`, `store/repositories/` and `common/libs/ledger/` trees.

## Core boundary

The TypeScript boundary should expose narrow product-safe operations, conceptually:

```ts
interface FresnicaCore {
  getCompatibility(): Promise<CoreCompatibility>;
  parseAccount(address: string): Promise<AccountIdentity>;
  generateMnemonic(input: GenerateMnemonicInput): Promise<GeneratedSigner>;
  protectMnemonic(input: ProtectMnemonicInput): Promise<ProtectedSigner>;
  protectSecret(input: ProtectSecretInput): Promise<ProtectedSigner>;
  deriveVerifiedUnlockKey(input: DeriveUnlockKeyInput): Promise<void>;
  signProtectedTransaction(input: SignProtectedTransactionInput): Promise<string>;
  reprotect(input: ReprotectInput): Promise<ProtectedSigner>;
  exportSigningMaterial(input: ExportSigningMaterialInput): Promise<ExportedSigningMaterial>;
}
```

The actual adapter may represent native-only unlock operations without returning key material to JavaScript. TypeScript must not expose APIs such as `decryptSecret`, `privateKey`, `WalletUnlockKey`, or generic raw secret access.

At startup the adapter must verify the pinned API compatibility identifiers. An incompatible Native SDK/adapter combination is a startup integration error, not something the app guesses around.

## Stellar Gateway boundary

JavaScript may use `@stellar/stellar-sdk` for:

- Horizon/RPC requests;
- loading account state;
- balances and trustlines;
- operation history;
- fee queries;
- transaction construction;
- XDR inspection and review-model generation;
- transaction submission.

JavaScript must not use Stellar SDK as a second secret-management or signing implementation.

First milestone Testnet configuration:

- Horizon: `https://horizon-testnet.stellar.org`;
- Network passphrase: `Test SDF Network ; September 2015`.

Network configuration lives in one immutable Testnet config object so Mainnet can later be added deliberately instead of through scattered conditionals.

## Wallet data model

### No WalletRecord in v1

The application itself is the wallet container. Do not introduce a persisted `WalletRecord` until there is a real multiple-wallet/workspace requirement.

### AccountRecord

```ts
type AccountIdentityKind = 'classic' | 'contract';

type AccountRecord = {
  id: string;
  address: string;
  identityKind: AccountIdentityKind;
  networkId: string;
  label: string;
  sortOrder: number;
  hidden: boolean;
  createdAt: Date;
  updatedAt: Date;
};
```

Account identity is network-scoped. The uniqueness rule is `(networkId, address)`.

Do not persist `watchOnly`, `canSign`, `accessLevel`, `encryptionLevel`, `walletType`, `balance` or `trustlines` as AccountRecord truth.

### SignerRecord

```ts
type SignerKind = 'protected-software' | 'hardware' | 'external';

type SignerRecord = {
  id: string;
  publicKey: string;
  kind: SignerKind;
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

For protected software signers, `envelopeJson` is opaque Core-owned data. Mobile stores it but never parses or mutates its cryptographic fields.

`envelopeRevision` is a Mobile-owned credential-binding revision. System-auth credentials must be bound to signer ID plus current revision so an old biometric/secure-storage authorization cannot be used after re-protection.

### AccountSignerReference

```ts
type AccountSignerReference = {
  id: string;
  accountId: string;
  signerId: string;
  createdAt: Date;
};
```

This is intentionally many-to-many. A Stellar account may use additional signers and one signer key can be relevant to more than one network-scoped account.

Do not persist ledger signer weight or authorization here. Those values come from current Stellar account state.

### Derived state

Watch-only means:

```text
AccountRecord exists
AND
no local AccountSignerReference exists
```

`hasLocalSigner` is not equivalent to `canAuthorizeTransaction`.

Transaction authorization must consider current on-chain signer weights and thresholds. v1 may block transactions that require unsupported multisig coordination, but it must not falsely treat local secret ownership as sufficient authorization.

### Network/cache state

Stable wallet identity must be separate from replaceable network caches.

Suggested cache records:

- AccountSnapshot;
- AssetBalanceCache;
- OperationHistoryCache.

Deleting network cache must never delete AccountRecord, SignerRecord, signer envelopes, or user metadata.

### Secure storage

Realm/application storage contains:

- AccountRecord;
- SignerRecord metadata;
- opaque protected signer envelope;
- AccountSignerReference;
- network caches;
- secure-cleanup retry tasks.

OS secure storage contains:

- Realm/database encryption material if used;
- per-signer native unlock credentials;
- native authentication keys and policies.

Private keys, mnemonic phrases, app passcodes and native unlock keys must never be stored in Realm, Zustand, navigation params, logs, analytics or crash reports.

## Account lifecycle

### Generate new software account

```text
Set Fresnica app passcode
  -> Core generate_mnemonic
  -> receive signer public key + protected envelope + one-time mnemonic
  -> atomic persistence of Account + Signer(backup=pending) + Reference
  -> show backup phrase
  -> verify backup
  -> Signer backupState = confirmed
  -> enter wallet
```

If the process is interrupted after generation, the durable protected signer remains. Plaintext mnemonic is never persisted. Recovery of a pending backup must use an explicit authenticated Core export/reveal path rather than a hidden JS copy of the mnemonic.

### Import secret or mnemonic

Core validates, derives and protects the input. Mobile atomically creates AccountRecord, SignerRecord and AccountSignerReference. Imported recovery material is not echoed back or persisted; `backupState = not-required`.

### Add watch-only account

Core parses and classifies `G...` or `C...`. Mobile persists AccountRecord only. No signer or app-passcode encryption step is required.

### Upgrade watch-only classic account

For a master-key attachment, Mobile calls Core with the existing account address as the expected signer public key. Core verifies identity. On mismatch, nothing is written. On success, Mobile atomically creates the signer and reference while keeping the existing account ID, label and caches.

### Downgrade to watch-only

After explicit authorization, remove the account-to-signer reference. Delete the SignerRecord only if it is orphaned. Preserve AccountRecord and account caches.

### Delete account

Delete the AccountRecord, its references and account-scoped caches. A referenced signer survives if another account still references it. An orphan signer is deleted and its native credential cleanup is queued.

### Secure cleanup

Keychain/Keystore cleanup occurs after Realm commit and can fail independently. Persist retryable cleanup work:

```ts
type SecureCleanupTask = {
  id: string;
  signerId: string;
  envelopeRevision: string;
  reason: 'signer-deleted' | 'envelope-reprotected';
  createdAt: Date;
  attempts: number;
};
```

A secure-storage cleanup failure never restores a deleted or replaced Core envelope.

## Transaction pipeline

The first transaction feature is classic Stellar payment/send.

```text
Recipient + asset + amount + memo
        |
validate input
        |
load current account from Horizon
        |
resolve destination / trustline constraints
        |
load fee + build unsigned transaction
        |
create immutable review model from exact XDR
        |
user confirms
        |
resolve currently authorized local signer(s)
        |
OS authentication / app-passcode fallback
        |
Fresnica Native SDK / Core signs exact transaction
        |
submit signed XDR through Stellar Gateway
        |
normalize result
        |
refresh account snapshot + history
```

### Review integrity

The Review screen must render from the exact built transaction/XDR, not from mutable form state. Amount, asset, destination, memo, fee and network displayed to the user must be derived from or verified against the transaction that will be signed.

### Signer resolution

Before signing:

1. load current Horizon account state;
2. determine the threshold required by the transaction operations;
3. intersect authorized ledger signers with locally available signers;
4. if the locally available weight is insufficient, block submission with an explicit unsupported/missing-signature state;
5. choose the local signer only after this check.

v1 supports the common single-signer case. The resolver must expose a result type that can later represent multiple required signers rather than baking `account.address === signer.publicKey` into Send.

### Authentication

Every local protected-software transaction uses one shared signing coordinator. Send, future Swap, trustline operations and future dApp signing must all invoke that coordinator so biometric/app-passcode behavior is consistent.

Do not let individual features decide independently whether to show password first or biometrics first. The coordinator owns the policy:

1. if valid system-auth enrollment exists for this signer revision, request system authentication first;
2. on explicit user choice/cancel where fallback is permitted, offer Fresnica app passcode;
3. use Native SDK to authorize/sign without exposing native unlock material to JS;
4. normalize cancellation, lockout, stale enrollment, bad passcode and Core errors.

This is the architectural fix for the old application's inconsistent Send vs Swap authentication behavior.

## Feature boundaries for milestone 1

Create only:

- onboarding;
- accounts;
- security;
- portfolio;
- send;
- history;
- trustlines;
- settings.

Do not create empty Swap, liquidity, dApp or WalletConnect modules.

## State management

Zustand is for transient product/session state, for example:

- selected account ID;
- current send draft;
- temporary UI preferences;
- bootstrap status;
- in-memory network request state.

Realm/repositories are the source of durable wallet truth. Do not mirror full persisted account/signer objects into a global Zustand store.

Feature stores should be small and local to the feature unless state is genuinely application-wide.

## Navigation

Use React Navigation native stack. Do not inherit `react-native-navigation` from Xaman.

Top-level flows:

```text
Bootstrap
  -> OnboardingStack      when no initialized wallet state exists
  -> LockedApp            when application auth is required
  -> MainTabs/MainStack   when unlocked
```

Milestone 1 navigation should remain intentionally small. Navigation params contain stable record IDs and public/display data only, never signer envelopes or secrets.

## Old Stellar donor policy

`luneShaoGM/Stellar` is a behavior and UX donor, not a source tree to merge.

Preserve/reimplement proven behaviors including:

- account creation/import flow quality;
- Send review consistency;
- Horizon operation-based history;
- asset/trustline UX;
- post-transaction refresh behavior;
- future Swap/LP behavior;
- future Freighter-compatible dApp interaction ideas.

Do not copy forward:

- XRPL account types and ledger abstractions;
- Xaman service/repository architecture;
- `Account.accessLevel + encryptionLevel + publicKey` coupling;
- Xaman API/backend assumptions;
- Xaman-specific product names/copy;
- Xaman private-key/Vault cryptography;
- `react-native-navigation` boot architecture.

Before reusing any individual implementation from the old repository, verify that it is Fresnica-authored or otherwise commercially reusable. Default to behavior-level reimplementation.

## Freighter donor policy

Freighter Mobile is a Stellar UX/reference donor. Good ideas may inform:

- React Navigation patterns;
- Stellar transaction review;
- asset display;
- network state presentation;
- Stellar-specific error/copy choices;
- future WalletConnect/dApp interactions.

Do not clone Freighter's folder structure merely because it is a Stellar wallet. Fresnica's Account/Signer/Core security boundary remains authoritative.

## Error model

Normalize errors at boundaries rather than leaking SDK/native error strings into screens.

Minimum application categories:

```ts
type WalletErrorCode =
  | 'invalid-input'
  | 'invalid-account'
  | 'account-not-found'
  | 'invalid-passcode'
  | 'auth-cancelled'
  | 'auth-locked'
  | 'stale-auth-enrollment'
  | 'unsupported-protected-data'
  | 'signer-identity-mismatch'
  | 'insufficient-signer-weight'
  | 'unsupported-multisig'
  | 'insufficient-balance'
  | 'missing-trustline'
  | 'destination-requires-trustline'
  | 'network-unavailable'
  | 'transaction-build-failed'
  | 'transaction-sign-failed'
  | 'transaction-submit-failed';
```

Feature screens translate these stable categories into user-facing copy.

## Logging and telemetry

Create a redaction-first logger. Never log:

- `S...` secrets;
- mnemonics;
- passcodes;
- protected envelopes;
- signed or unsigned XDR if it can contain user-sensitive memo/data unless explicitly redacted for a local debug build;
- native unlock credentials.

Crash reporting and analytics are not part of the first scaffold. They can be introduced after the redaction boundary exists.

## Testing strategy

### Unit tests

Test pure application/domain behavior first:

- account/signer lifecycle rules;
- watch-only derivation;
- orphan-signer deletion behavior;
- signer authorization/threshold resolution;
- transaction review-model integrity;
- error normalization;
- Testnet configuration.

### Contract tests

Adapter tests prove:

- Native SDK compatibility query;
- `parseAccount` through RN adapter;
- protected signer output is treated opaquely;
- signing coordinator never returns native unlock material to JS.

### Persistence tests

Use an in-memory repository contract test suite first. Run the same lifecycle contract against Realm once Realm is integrated.

### Native smoke tests

At minimum before milestone completion:

- Android app launches on RN 0.87 and can call Fresnica SDK through the generated adapter;
- iOS app launches and can call the same compatibility/parseAccount path;
- Testnet account can be generated/imported, signed and submitted without private signing material being persisted in JS state.

## Implementation sequence

1. Bootstrap official RN 0.87 application and quality gates.
2. Establish module boundaries and Testnet config.
3. Integrate/pin Fresnica Native SDK v0.2.0 and build/store the RN adapter once for RN 0.87.
4. Prove compatibility + `parseAccount` smoke call on Android/iOS.
5. Implement account/signer repository contracts with in-memory tests.
6. Verify Realm 20.x compatibility with RN 0.87; then implement Realm adapter and schema v1.
7. Implement app passcode + system-auth coordinator boundary.
8. Implement create/import/watch-only account lifecycles.
9. Implement portfolio/account snapshot loading.
10. Implement Send transaction pipeline and one shared signing coordinator.
11. Implement operation history.
12. Implement trustline add/remove flow through the same transaction pipeline.
13. Harden restart/recovery/secure-cleanup behavior.
14. Only after these pass on Testnet, evaluate Mainnet enablement and phase 2 features.

## Success criteria for the first usable milestone

A fresh install can:

1. initialize Fresnica security;
2. generate a Stellar Testnet account and complete recovery backup;
3. import an existing Stellar mnemonic or `S...` secret;
4. add a watch-only `G...` account;
5. preserve Account != Signer semantics in persistence;
6. show XLM and trustline balances;
7. send a Testnet payment through Review -> auth -> Core signing -> Horizon submit;
8. show operation history;
9. add/remove a trustline through the shared transaction/signing pipeline;
10. downgrade a signing account to watch-only without deleting the account;
11. delete accounts without deleting shared signers incorrectly;
12. restart without losing wallet state;
13. keep private signing material, passcodes and native unlock credentials out of Realm/Zustand/logs;
14. build on both Android and iOS using RN 0.87 with the pinned Fresnica Native SDK/adapter compatibility manifest.
