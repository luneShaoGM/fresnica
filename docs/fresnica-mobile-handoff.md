# Fresnica Mobile Project Handoff

> Purpose: continuation baseline for the independent `fresnica-mobile` React Native application.
>
> Upstream Mobile SDK contract source of truth: `manran/fresnica/docs/platforms/mobile/sdk-usage.md`.
> Cross-platform architecture source of truth: `manran/fresnica/docs/platform-implementation.md`.

## 1. Current baseline

The active architecture rebaseline is `refactor/mobile-capabilities`.

Current pinned integration contract:

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

These values are separate compatibility axes. Do not infer Native SDK `2.1` from a Core release/state described as `2.1`.

## 2. Architecture vocabulary

Use upstream terminology:

```text
Mobile Feature
  -> Application Flow
  -> Application Capability
  -> platform implementation mechanisms
```

Mobile Feature is local product/UI organization. Application Capability is the cross-project semantic contract. `Core` is reserved for Fresnica SDK/Rust Core security authority and is not a Mobile TypeScript application layer.

Target source ownership:

```text
src/app
  application composition/config/navigation

src/features
  product screens and Application Flows when implemented

src/capabilities
  Account
  Signer
  Payment
  Transaction
  Ledger Authorization
  Signing Coordination

src/platform
  fresnica       RN -> Native SDK integration
  stellar        Stellar SDK / Horizon mechanisms
  persistence    repository implementations
```

Do not mirror Rust/Core internals in Mobile.

## 3. Security ownership

Fresnica SDK/Core owns:

- secret and mnemonic validation/derivation;
- signer identity verification;
- protected-envelope semantics and cryptography;
- transaction hashing/signing;
- native System Auth signer authorization helpers;
- stable security error categories.

Mobile owns:

- UI/navigation and product flows;
- persistence schemas and repositories;
- Horizon/network state;
- transaction construction and exact-XDR review;
- Ledger Authorization interpretation;
- System Auth/passcode product policy through shared Signing Coordination;
- submission and post-submit refresh.

`WalletUnlockKey`, raw private keys, mnemonic/secret persistence, low-level signing and envelope cryptography must never be implemented or stored in normal JavaScript application state.

## 4. Account and Signer model

Account identity and signer capability are distinct concepts.

```text
AccountRecord
SignerRecord
AccountSignerReference
optional RecoverySourceRecord/grouping metadata
```

Mandatory invariants:

1. Account != Signer != Recovery Source.
2. Watch-only is derived from absence of an applicable local signer.
3. A Classic account may use a signer public key different from its master address.
4. `C...` identities are not Ed25519 software signers.
5. Protected envelope JSON is opaque to Mobile.
6. Shared signer records must remain valid while referenced by another account.

## 5. Current transaction architecture

The reusable transaction path is:

```text
Feature intent
 -> build unsigned transaction through a Capability/platform mechanism
 -> derive review from the exact XDR
 -> user confirmation
 -> assert reviewed transaction freshness
 -> reload current ledger signer/threshold state
 -> Ledger Authorization resolves an applicable local signer
 -> Signing Coordination
      -> signWithSystemAuth(...)
      -> or signWithPasscode(...)
 -> submit the exact signed XDR
 -> normalize accepted / rejected / uncertain submission result
 -> refresh/invalidate affected state
```

Important invariants:

- review and signing use the same exact XDR;
- an expired reviewed transaction is blocked before ledger/auth/signing work;
- local signer presence alone is not ledger authorization;
- only typed Ed25519 ledger signer conditions are invokable by local software signers;
- feature modules never invoke biometrics/password dialogs independently;
- Payment, future Swap, trustline changes and dApp transaction flows must share Signing Coordination;
- unsupported multisig fails safely.

## 6. Native SDK boundary

Mobile-facing TypeScript uses `FresnicaSdk` under `src/platform/fresnica`.

The native runtime module name remains exactly:

```text
NativeModules.FresnicaCore
```

Do not rename the native registration merely because the Mobile interface is called `FresnicaSdk`.

Normal app builds consume pinned Native SDK/RN adapter binaries and do not compile Rust or silently rebuild the adapter. Rebuild only when a real compatibility boundary changes.

## 7. System Auth policy

Privilege hierarchy:

```text
Fresnica app passcode > System Auth
```

System Auth may authorize routine signing. Reveal/Export and passcode changes still require fresh Fresnica app passcode authorization.

Routine signing policy belongs only in Signing Coordination. Features should provide the reviewed transaction and signer context, not implement biometric/passcode branching themselves.

## 8. Capability status

See `docs/mobile-capability-status.md` for current Mobile support and conformance state.

The current implemented foundation includes:

- Account/Signer relationship semantics;
- in-memory persistence implementation for tests/foundation;
- typed Classic Ledger Authorization;
- Payment exact-XDR review;
- Transaction freshness checking;
- shared Signing Coordination;
- Stellar/Horizon gateway mechanisms;
- accepted/rejected/uncertain submission normalization;
- Fresnica Native SDK compatibility checks.

Realm schemas, screens/navigation and broader product features remain later product work.

## 9. Development rules

Before adding wallet/security behavior, check the pinned Fresnica SDK contract first. If the SDK already owns the semantic operation, call it rather than reproducing it in Mobile.

When upstream SDK/adapter documentation changes:

1. compare each compatibility axis independently;
2. update `FRESNICA_SDK_COMPATIBILITY` only from verified upstream contracts;
3. update adapter requirements only when the manifest contract changes;
4. rebuild adapter binaries only when required;
5. run TypeScript/Jest and native consumer validation gates;
6. preserve Application Capability and security ownership boundaries.

Xaman may be used as a UX/behavior reference, but it is not an implementation authority for Fresnica security semantics.
