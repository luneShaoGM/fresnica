# Fresnica Mobile Project Handoff

> Purpose: continuation baseline for the independent `fresnica-mobile` React Native application.
>
> Upstream Mobile SDK contract source of truth: `manran/fresnica/docs/platforms/mobile/sdk-usage.md`.
> Framework adapter source of truth: `manran/fresnica/docs/platforms/mobile/framework-adapter.md` and `manran/fresnica/adapters/react-native/README.md`.

## 1. Current baseline

`main` is the single long-lived baseline. Current Realm work is isolated on `feat/realm-persistence`.

```text
React Native              0.87.0
Fresnica Native SDK       0.2.1
Native Binding API        2
Universal SDK API         3
Core Client API           3
RN adapter source         0.2.1
Adapter source revision   47383bd94b1f88882dd0759f7275bd8b5452dcdb
React Native module       FresnicaCore
Realm                     20.2.0
Initial product network   Stellar Testnet
```

These are separate compatibility axes. Do not infer one version from another.

## 2. Architecture vocabulary

```text
Mobile Feature
  -> Application Flow
  -> Application Capability
  -> platform implementation mechanisms
```

`Core` is reserved for Fresnica SDK/Rust Core security authority. Mobile intentionally has no TypeScript `src/core` layer.

```text
src/app
  application composition/config/navigation

src/features
  product screens and Application Flows

src/capabilities
  Account / Signer / Payment / Transaction / Ledger Authorization / Signing Coordination

src/platform
  fresnica       RN -> Native SDK integration
  stellar        Stellar SDK / Horizon mechanisms
  persistence    Memory + Realm repository implementations
```

## 3. Security ownership

Fresnica SDK/Core owns secret/mnemonic validation and derivation, protected-envelope semantics, signer identity verification, transaction signing, and native System Auth primitives.

Mobile owns UI/navigation, persistence, Horizon/network state, exact-XDR review, Ledger Authorization interpretation, and the product policy deciding when System Auth versus a fresh strong passphrase is required.

Product terminology is **app passphrase**. New passphrases require at least 15 Unicode characters. Routine signing is biometrics/System-Auth-first; Reveal/Export, passphrase rotation/recovery and product-classified high-risk actions require fresh passphrase authorization.

Binding API 2 still contains compatibility method/field names such as `signWithPasscode` and `appPasscode`. Keep those names only at the Fresnica platform boundary until upstream changes the binding contract; do not expose passcode/PIN terminology in product/domain UI.

Never persist passphrase, mnemonic, raw secret, WalletUnlockKey, decrypted signer material or biometric authentication state in Realm or ordinary JavaScript state.

See `docs/application-security-policy.md`.

## 4. Account / Signer / persistence model

Account and Signer remain separate concepts.

```text
AccountRecord
SignerRecord
AccountSignerReference
```

Mandatory invariants:

1. Account != Signer.
2. Watch-only is derived from absence of an applicable local signer.
3. A Classic account may use a signer public key different from its master address.
4. `C...` identities are not Ed25519 software signers.
5. Protected envelope JSON is opaque to Mobile.
6. Shared signer records survive while any Account still references them.

Realm v1 stores only:

```text
AccountEntity
SignerEntity
AccountSignerReferenceEntity
```

It uses stable IDs rather than Realm object links. Reads are mapped to detached plain domain records. Unknown persisted enum values fail closed. Database encryption-key lifecycle and SecureCleanupTask persistence are deferred to later Application Security work.

## 5. Transaction architecture

```text
Feature intent
 -> build unsigned transaction
 -> derive review from exact XDR
 -> user confirmation
 -> assert freshness
 -> reload ledger signer/threshold state
 -> Ledger Authorization
 -> Signing Coordination
      -> routine: signWithSystemAuth(...)
      -> binding-level fallback/high-assurance path: signWithPasscode(...), with a strong app passphrase value
 -> submit exact signed XDR
 -> normalize accepted / rejected / uncertain
 -> refresh/invalidate state
```

Features must not implement their own biometric/passphrase branching. High-risk classification belongs centrally in Application Security / Signing Coordination.

## 6. Native SDK / adapter boundary

Mobile-facing TypeScript uses `FresnicaSdk` under `src/platform/fresnica`. Native runtime module name remains exactly:

```text
NativeModules.FresnicaCore
```

Adapter source 0.2.1 is consumer-toolchain neutral and is built inside the Mobile-owned native toolchain. The pinned revision includes upstream PR #121, which fixes Apple module export through `RCT_EXTERN_REMAP_MODULE`; no local Apple remap shim is allowed.

Normal product builds consume pinned Native SDK/adapter binaries. They do not compile Rust/Core or silently rebuild the adapter.

## 7. Current evidence

Foundation implemented:

- Account/Signer relationship semantics;
- Memory and Realm repository implementations;
- Realm schema v1 and strict detached mappers;
- typed Classic Ledger Authorization;
- exact-XDR Payment review and transaction freshness checking;
- shared Signing Coordination;
- Stellar/Horizon gateway mechanisms;
- normalized submission outcomes;
- Fresnica compatibility checks.

Both Android and Apple have been manually verified in actual RN runtime with:

```text
FRESNICA_PARSE_ACCOUNT_SMOKE_OK realm=ok
```

This proves Realm 20.2.0 and Fresnica Native runtime coexist on both target platforms. A macOS Realm close/reopen integration test and shared repository contract are present, but recent GitHub Actions attempts did not receive runners (`runner_id=0`, `steps=[]`), so that automated gate is still pending execution.

Screens/navigation, onboarding, Portfolio, History, Trustline, Swap/SDEX, Reveal/Export UI, full Application Security flows, full multisig, hardware/external signer providers and Mainnet remain future work.

## 8. Development rules

Before adding wallet/security behavior, check the pinned Fresnica SDK/adapter contract. If upstream already owns the semantic operation, call it rather than reproduce it in Mobile.

When upstream and Mobile disagree, classify the finding explicitly as one of:

- Mobile bug;
- dependency/toolchain limitation;
- Fresnica upstream contract/documentation/implementation inconsistency.

For an upstream inconsistency, record the concrete file/API, reproduction condition and recommended correction. Avoid permanent hidden Mobile compatibility patches.

Xaman may be used as a UX reference only; it is not the implementation authority for Fresnica security semantics.
