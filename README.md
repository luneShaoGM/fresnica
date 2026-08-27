# Fresnica Mobile

Stellar-native React Native wallet consuming Fresnica Native SDK as its security authority.

## Current development baseline

The active rebaseline branch is `refactor/mobile-capabilities`. It replaces the earlier `feat/*` and accumulated `work/*` development line with one architecture aligned to upstream Application Capabilities. After this rebaseline is merged, `main` is the single long-lived baseline; follow-up work should use short-lived task branches rather than persistent checkpoint branches.

Current verified foundation includes:

- React Native 0.87.0;
- Stellar Testnet configuration;
- Account and Signer semantics separated from persistence mechanisms;
- watch-only derived from applicable signer relationships rather than persisted as a parallel truth;
- Fresnica Native SDK 0.2.1 behind the Mobile-facing `FresnicaSdk` platform adapter;
- Native Binding API 2, Universal SDK API 3 and Core Client API 3 recorded independently;
- canonical React Native adapter source 0.2.0;
- typed Ledger Authorization that distinguishes Ed25519, preauth-tx, Hash-X and signed-payload conditions;
- Stellar/Horizon mechanics isolated under `src/platform/stellar`;
- exact-XDR Payment review with transaction freshness checks;
- reusable Signing Coordination shared independently of Payment;
- submission normalization that distinguishes accepted, rejected and uncertain outcomes.

## Architecture

```text
Mobile Feature
  -> Application Flow
  -> Application Capability
  -> platform / Fresnica SDK mechanisms
```

```text
src/app
  composition, configuration, navigation/application bootstrap

src/features
  product features and Application Flows when screens are implemented

src/capabilities
  Mobile implementations of Application Capability semantics
  account / signer / payment / transaction / ledger-authorization / signing

src/platform
  external implementation mechanisms
  fresnica / stellar / persistence
```

The repository intentionally has no Mobile-local `src/core` architecture layer. `Core` refers to Fresnica SDK/Rust Core security authority, not a TypeScript application layer. `NativeModules.FresnicaCore` is the upstream React Native runtime module name and must not be interpreted as a Mobile architecture layer.

A typical transaction path is:

```text
Feature intent
 -> Payment/other transaction-building Capability
 -> exact reviewed transaction
 -> user confirmation
 -> Ledger Authorization refresh
 -> Signing Coordination
 -> FresnicaSdk -> Native SDK/Core signing
 -> Stellar platform submission
 -> refresh/invalidation
```

## Security boundary

Fresnica Mobile does not implement wallet cryptography.

Fresnica SDK/Core owns secret and mnemonic validation and derivation, protected-envelope semantics, signer identity checks, transaction signing and native signer authorization helpers. Mobile owns UI/navigation, persistence, Horizon/network state and product orchestration.

`WalletUnlockKey`, raw private keys, native biometric cipher state and low-level signing APIs must not enter normal JavaScript application code. Routine local software signing uses Native SDK high-level `signWithSystemAuth` or `signWithPasscode` operations through `FresnicaSdk`.

## Current SDK compatibility

```text
Fresnica Native SDK       0.2.1
Native Binding API        2
Universal SDK API         3
Core Client API           3
RN adapter source         0.2.0
React Native              0.87.0
React Native module       FresnicaCore
```

These are separately-versioned contracts. A Core version/state referred to as `2.1` elsewhere does not imply Native SDK version `2.1`.

Upstream sources of truth:

- `manran/fresnica/docs/platform-implementation.md`
- `manran/fresnica/docs/platforms/mobile/sdk-usage.md`

Local capability/conformance state is tracked in `docs/mobile-capability-status.md`; continuation rules are in `docs/fresnica-mobile-handoff.md`.

## Native integration gate

The RN 0.87 Android/iOS consumer shell and pinned adapter/native artifacts remain the platform integration baseline. Normal application changes must not rebuild the adapter implicitly; rebuild only when its compatibility contract requires it.
