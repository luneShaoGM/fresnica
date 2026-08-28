# Fresnica Mobile Capability Status

This file records current Mobile implementation evidence against the shared Fresnica Application Capability vocabulary. Upstream maturity labels describe the shared specification, not Mobile implementation quality.

## Compatibility baseline

```text
Fresnica Native SDK       0.2.1
Native Binding API        2
Universal SDK API         3
Core Client API           3
RN adapter source         0.2.1
Adapter source revision   47383bd94b1f88882dd0759f7275bd8b5452dcdb
React Native              0.87.0
Realm                     20.2.0
Network                   Stellar Testnet
```

## Capability matrix

| Application Capability | Upstream maturity | Mobile status | Current evidence / scope |
| --- | --- | --- | --- |
| Account | Normative | Foundation implemented | `src/capabilities/account`: account records, account-signer invariants and derived watch-only state. |
| Signer | Normative | Foundation implemented | `src/capabilities/signer`: signer identity/kind/lifecycle types. Protected-envelope cryptography remains SDK/Core-owned. |
| Payment | Normative | Foundation implemented | `src/capabilities/payment`: exact-XDR single-payment review and orchestration on Testnet. UI Flow not yet implemented. |
| Transaction | Normative | Foundation implemented | Reviewed-transaction identity, freshness guard and normalized submission semantics. |
| Ledger Authorization | Defined | Classic foundation implemented | Typed Classic signer conditions and threshold resolution for applicable local Ed25519 signers. Full multisig/provider coordination remains future work. |
| Signing Coordination | Normative | Foundation implemented | Shared routine signing policy prefers Native SDK System Auth. The Binding API 2 fallback is still named `signWithPasscode`, but Mobile supplies a strong app passphrase and treats passcode as compatibility terminology only. |
| Application Security | Defined | Partial platform/policy foundation | Passphrase/System Auth hierarchy documented; native System Auth primitives available. App lock/session, high-risk policy implementation, passphrase rotation UI and recovery flows remain future work. |
| Network / Gateway | Defined | Platform mechanism implemented | `src/platform/stellar`: Horizon authorization loading, payment construction and submission. |
| Persistence | Mobile platform mechanism | Realm v1 implemented on feature branch | Memory and Realm implementations share the same `AccountSignerRepository` semantics. Realm schema v1 stores Account, Signer and references only; watch-only remains derived. Production app composition is not wired yet. |

## Persistence evidence

Realm implementation under `src/platform/persistence/realm` includes:

- schema version 1 with Account/Signer/reference entities;
- strict plain-object mappers and fail-closed persisted enum handling;
- atomic write transactions;
- duplicate `(networkId,address)` enforcement;
- orphan signer cleanup with shared-signer preservation;
- shared repository contract reused by Memory and Realm integration tests;
- close/reopen persistence integration test;
- no persisted passphrase, mnemonic, raw secret, WalletUnlockKey or biometric auth state.

Android and Apple actual RN runtimes have both been manually verified with:

```text
FRESNICA_PARSE_ACCOUNT_SMOKE_OK realm=ok
```

This verifies Realm native runtime and `NativeModules.FresnicaCore` coexist on both platforms. The macOS Realm integration workflow is present, but the latest GitHub Actions attempts failed before any step because no runner was allocated (`runner_id=0`); therefore automated restart-test success is not yet claimed.

## Conformance / regression scope

The TypeScript/Jest tests are designed to verify, among other cases:

- Account and Signer remain separate;
- watch-only changes only with account-signer references;
- shared signers survive until their final reference is removed;
- duplicate account identity is network-scoped;
- Realm mappers do not leak live Realm objects or mutable Date references;
- invalid persisted enum values fail closed;
- non-Ed25519 ledger conditions are not treated as invokable local software signers;
- Payment review and signing preserve exact XDR;
- expired reviewed transactions are blocked before signing;
- Signing Coordination centralizes System Auth/passphrase product policy;
- submission distinguishes accepted, rejected and uncertain outcomes;
- the Native runtime module key remains `FresnicaCore`.

## Platform mechanisms

```text
src/platform/fresnica
  React Native -> Fresnica Native SDK integration

src/platform/stellar
  @stellar/stellar-sdk / Horizon mechanisms

src/platform/persistence
  memory/ deterministic test/foundation adapter
  realm/  durable Realm v1 adapter
```

Realm remains a platform implementation choice and must not redefine Account/Signer Capability semantics.

## Not yet implemented

- production application composition using Realm repository;
- product screens/navigation/Application Flows;
- onboarding and signer provisioning UI;
- Portfolio/Balance;
- Trustline Flow;
- Swap/SDEX Flow;
- History/Activity UI;
- Reveal/Export UI;
- app lock/session and complete passphrase rotation/recovery flows;
- Realm database encryption-key lifecycle;
- retryable System Auth/external-provider secure cleanup orchestration;
- full multisig coordination;
- hardware/external signer provider integration;
- Mainnet enablement.

## Contribution rule

When Mobile behavior exposes a Fresnica SDK/adapter/documentation inconsistency, classify it explicitly and contribute a concrete reproduction/fix upstream rather than hiding a permanent compatibility patch in Mobile.
