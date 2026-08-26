# Fresnica Mobile Project Handoff

> Purpose: development baseline for the independent `fresnica-mobile` React Native application.
>
> Upstream SDK contract source of truth: `manran/fresnica/docs/mobile-sdk-usage.md`.
>
> This document describes what the Mobile app owns, what Fresnica Native SDK owns, and the rules that future implementation in this repository must follow.

## 1. Product and technical baseline

`fresnica-mobile` is a clean Stellar-native React Native wallet. It does not inherit Xaman/XRPL architecture and must not reproduce Fresnica Core cryptography in TypeScript, Swift, Kotlin, Realm models, or feature code.

Current pinned integration baseline:

```text
React Native              0.87.0
Fresnica Native SDK       0.2.1
Native Binding API        2
Universal SDK API         3
Core Client API           3
RN adapter source         0.2.0
React Native module       FresnicaCore
Initial product network   Stellar Testnet
```

Pre-1.0 integration versions are exact pins. Do not use floating SDK or React Native version ranges.

## 2. Ownership boundary

The application architecture is:

```text
React Native product code
        |
        v
Fresnica RN Adapter
        |
        v
Fresnica Native SDK
        |
        v
fresnica-sdk / Rust Core
```

### Fresnica SDK/Core owns

- Stellar account identity parsing;
- secret and mnemonic validation;
- mnemonic derivation;
- signer identity derivation and identity mismatch checks;
- protected signer envelope semantics;
- encryption/KDF details;
- mnemonic generation;
- signer reprotection during passcode rotation;
- Reveal/Export decryption;
- transaction hashing/signing;
- native signer authorization helpers;
- stable security/crypto error categories.

### `fresnica-mobile` owns

- screens and navigation;
- Realm schema and migrations;
- Account / Signer / relationship persistence;
- Recovery Source grouping metadata;
- app session/lock policy;
- product settings;
- Horizon/network requests;
- balance, asset, trustline and history caches;
- ledger signer weight/threshold interpretation;
- transaction construction and review orchestration;
- system-auth UX policy and passcode fallback UX;
- post-submit refresh/invalidation.

The Mobile project must not introduce a second cryptographic implementation or a second protected-envelope format.

## 3. Native SDK consumption

Normal application builds consume stored binary artifacts. They do not compile Rust, run UniFFI generation, or rebuild the RN adapter.

Recommended repository layout:

```text
vendor/fresnica/
  native/
    fresnica-native-sdk-0.2.1.aar
    FresnicaSDK.xcframework
    FresnicaSDKFFI.xcframework
  adapter/react-native/
    fresnica-rn-adapter.aar
    FresnicaRNAdapter.xcframework
    adapter-manifest.json
```

The canonical adapter is built once in the actual Mobile RN/CocoaPods/Gradle environment and then reused until a real compatibility boundary changes.

Normal CI checks adapter compatibility. It must not silently rebuild adapter binaries.

## 4. React Native API boundary

Product code may use the high-level canonical adapter capabilities:

```text
parseAccount
protectSecret
protectMnemonic
generateMnemonic
deriveMnemonicSigner
reprotect
reveal
prepareEd25519Signing
applyEd25519Signature
canUseSystemAuth
hasSystemAuthDomain
initializeSystemAuth
registerSignerSystemAuth
hasSignerSystemAuth
removeSignerSystemAuth
removeSystemAuthDomain
signWithSystemAuth
signWithPasscode
```

Product code must not create equivalents of:

```text
deriveUnlockKey
validateUnlockKey
raw signTransactionXdr
private-key derivation
secret decryption for routine signing
KDF/AES protected-envelope parsing
```

`WalletUnlockKey` and native biometric authorization state never enter normal JavaScript state.

## 5. Account, signer and recovery model

Persist these concepts separately:

```text
AccountRecord
  address / identity kind / network / product metadata

SignerRecord
  signer public identity / kind / provider metadata / opaque envelope

AccountSignerReference
  account <-> signer relation

RecoverySourceRecord
  optional Mobile-owned HD/backup grouping metadata
```

Mandatory invariants:

1. Account identity is not signer capability.
2. Account, Signer and Recovery Source are not assumed to be one-to-one.
3. Watch-only is derived from absence of an applicable local signer reference.
4. `watchOnly`, `canSign`, private key, mnemonic and secret are not persisted as parallel mutable truths.
5. Classic `G...` account identity may differ from an authorized signer public key.
6. `C...` contract identity is not an Ed25519 software signer.
7. Protected envelope JSON is opaque Mobile data; never parse its cryptographic fields.
8. Secret, mnemonic and WalletUnlockKey never enter Realm, global state, navigation params, logs, analytics or crash reports.

## 6. Watch-only lifecycle

### Add watch-only

```text
user G... / C...
 -> FresnicaCore.parseAccount
 -> persist AccountRecord only
```

No signer, protected envelope, mnemonic, secret or signer-auth registration exists.

### Upgrade a direct master-key classic watch-only account

```text
secret/mnemonic input
 -> protectSecret/protectMnemonic
    expectedSignerPublicKey = existing G address
 -> SDK verifies signer identity
 -> only on success persist SignerRecord + AccountSignerReference
```

`identity-mismatch` must leave persistence unchanged. JavaScript must not reimplement this check with `Keypair.fromSecret()`.

### Downgrade

Removing local signing capability removes the account/signer reference and unreferenced signer material while preserving the Account identity and product metadata.

## 7. Mnemonic and Recovery Source behavior

Normal first mnemonic account uses derivation index `0`.

When adding another account from the same mnemonic-backed recovery source, do not reveal or re-enter the mnemonic. Use:

```text
deriveMnemonicSigner(
  sourceEnvelope,
  appPasscode,
  expectedSourceSignerPublicKey,
  index
)
```

The SDK authenticates the existing source envelope and derives the new signer internally. Mobile receives a new signer public key and independent protected envelope.

Mobile may use `RecoverySourceRecord` to express that several SignerRecords share the same user backup/recovery source, without treating the mnemonic itself as persisted application data.

## 8. Passcode and system-auth model

There is one Fresnica application passcode for ordinary local software signer protection.

Privilege hierarchy:

```text
Fresnica app passcode > System Auth
```

System Auth may authorize routine transaction signing. It must not authorize:

- Reveal/Export;
- app passcode change;
- recovery-root operations.

Recommended flow:

```text
first onboarding
 -> set Fresnica app passcode
 -> optional initializeSystemAuth(reason)  # one device/system auth prompt

new local signer
 -> protect/generate/derive using app passcode
 -> persist opaque envelope
 -> registerSignerSystemAuth(...)          # no extra biometric prompt

routine signing
 -> signWithSystemAuth(...)
 -> on unavailable/not enrolled policy: shared signWithPasscode(...) fallback
```

Features such as Send, Change Trust and future Swap must not invoke biometrics or password dialogs independently. They all use one shared transaction approval policy.

## 9. Reveal / Export

Reveal/Export always requires a freshly entered Fresnica app passcode and calls the SDK `reveal` operation.

Never use these as export authority:

- an unlocked app session;
- successful Face ID/fingerprint;
- cached System Auth authorization;
- a WalletUnlockKey.

Plaintext mnemonic/secret returned by explicit Reveal/Export is ephemeral UI data only and must be cleared when the screen leaves.

## 10. Global app-passcode rotation

Mobile coordinates rotation; SDK performs cryptographic reprotection.

Required semantics:

```text
for every protected local signer
 -> SDK reprotect(oldPasscode, newPasscode)
 -> stage all returned envelopes

verify all succeeded
 -> atomically commit every new envelope in Realm
 -> mark previous signer system-auth registrations stale
 -> re-register new signer generations in the existing System Auth Domain
```

Do not partially commit a subset of signers. A failure before the Realm commit leaves the old state intact.

## 11. Transaction pipeline

Mobile owns transaction construction, ledger authorization resolution, review, submission and refresh. Fresnica SDK owns signer authorization helpers and signing.

Shared flow:

```text
Feature intent
 -> Stellar Gateway builds unsigned XDR
 -> Review is derived from the exact built XDR
 -> user confirms
 -> reload current ledger signer/threshold state
 -> resolve applicable local signer
 -> shared TransactionApproval
      -> signWithSystemAuth(...)
      -> or signWithPasscode(...)
 -> Horizon submit signed XDR
 -> invalidate/refresh affected caches
```

Important invariants:

- feature modules never call biometrics directly;
- feature modules never perform secret/private-key signing;
- exact reviewed XDR is the exact XDR passed into Fresnica signing;
- if the unsigned transaction must be rebuilt after review, force a new review;
- local signer presence does not imply sufficient on-chain signer weight;
- unsupported multisig must fail safely instead of pretending the transaction is signable.

For the first Testnet milestone, support a single locally available signer that individually satisfies the transaction threshold. Multi-party signature coordination remains future work.

## 12. Stellar SDK boundary

`@stellar/stellar-sdk` is allowed in Mobile for public/non-secret responsibilities such as:

- Horizon access;
- balances and trustlines;
- history;
- asset representation;
- transaction construction;
- fee/sequence/timebounds;
- exact-XDR review parsing;
- Horizon submission;
- ledger signer/threshold state.

It must not become a parallel wallet-security implementation. Do not use it for private-key persistence, mnemonic derivation, routine local signing, identity verification during protected signer attach, or passcode encryption.

## 13. Error handling

Branch on stable SDK/native error codes, never human-readable messages.

Core/SDK categories include:

```text
invalid-input
invalid-passcode
invalid-unlock-key
invalid-protected-data
identity-mismatch
invalid-transaction
core-error
```

Native System Auth may additionally surface user cancellation, unavailable/not-enrolled/invalidated authorization, authentication failure, integration failure, or an already-active auth operation.

Shared product policy examples:

- user cancellation -> return to Review, not generic failure;
- system auth unavailable/not enrolled -> shared passcode fallback;
- invalid passcode -> remain on shared passcode screen and allow correction;
- identity mismatch / corrupt protected data -> security error, no persistence mutation;
- insufficient ledger signer weight -> do not prompt for biometric/passcode at all.

## 14. Current implementation order

For the first Fresnica Mobile milestone:

1. RN 0.87 shell and `FresnicaCore.parseAccount` Android/iOS smoke path.
2. Exact Native SDK/adapter compatibility checks.
3. Realm Account / Signer / Reference / optional Recovery Source schema.
4. Watch-only lifecycle.
5. Create/import/generate/derive signer provisioning through SDK only.
6. One app passcode and optional single System Auth Domain.
7. Portfolio/assets/trustlines.
8. Shared Testnet transaction pipeline and Send.
9. History/events refresh.
10. Global passcode rotation and explicit Reveal/Export UX.
11. Hardening and product settings.

Deferred from the first milestone:

```text
Swap
liquidity pools
Freighter/dApp bridge
hardware signer transport
full multisig coordination
Mainnet
```

## 15. Development rules for future changes

Before adding wallet/security behavior, first check whether the current pinned Fresnica SDK already exposes the semantic operation. If it does, call it; do not reproduce it in Mobile.

When the upstream `mobile-sdk-usage.md` changes:

1. compare pinned Native SDK/API/adapter versions;
2. update Mobile compatibility requirements explicitly;
3. rebuild adapter binaries only when the compatibility manifest says it is required;
4. update Mobile integration tests;
5. preserve the ownership boundary above.

Implementation should remain surgical: add abstractions only for real Mobile-owned boundaries (storage, Horizon, transaction orchestration, navigation, system-auth product policy), not for cryptographic operations already provided by Fresnica SDK.
