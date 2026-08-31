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
| Account | Normative | Onboarding provisioning implemented | Account records, account-signer invariants, derived watch-only state, atomic account+signer registration and first-run create/import/watch-only flows. |
| Signer | Normative | Protected-software onboarding implemented | Secret/mnemonic protection remains SDK/Core-owned. Mobile persists only public signer identity plus opaque envelope and backup metadata. |
| Payment | Normative | Foundation implemented | `src/capabilities/payment`: exact-XDR single-payment review and orchestration on Testnet. UI Flow not yet implemented. |
| Transaction | Normative | Foundation implemented | Reviewed-transaction identity, freshness guard and normalized submission semantics. |
| Ledger Authorization | Defined | Classic foundation implemented | Typed Classic signer conditions and threshold resolution for applicable local Ed25519 signers. Full multisig/provider coordination remains future work. |
| Signing Coordination | Normative | Foundation implemented | Shared routine signing policy prefers Native SDK System Auth. The Binding API 2 fallback is still named `signWithPasscode`, but Mobile supplies a strong app passphrase and treats passcode as compatibility terminology only. |
| Application Security | Defined | Partial policy/onboarding foundation | Strong passphrase policy is enforced for protected-software onboarding. Fresh-passphrase `reveal` resumes interrupted generated-mnemonic backup. App lock/session, System Auth onboarding, high-risk policy implementation and passphrase rotation remain future work. |
| Network / Gateway | Defined | Platform mechanism implemented | `src/platform/stellar`: Horizon authorization loading, payment construction and submission. |
| Persistence | Mobile platform mechanism | Realm v1 wired into production bootstrap | Memory and Realm implementations share `AccountSignerRepository`. Production `createAppServices()` opens Realm, loads `FresnicaCore`, creates the repository and closes Realm on teardown/bootstrap failure. |

## Onboarding v1 evidence

`src/features/onboarding` now implements the first usable Testnet onboarding slice:

- create a new mnemonic-backed protected software signer through Fresnica SDK/Core;
- import an existing mnemonic through `protectMnemonic`;
- import an existing Stellar `S...` secret through `protectSecret`;
- add a watch-only `G...` or `C...` identity through `parseAccount`;
- atomically persist Account + Signer + Account-Signer reference for protected software wallets;
- never persist plaintext mnemonic, secret or app passphrase;
- mark newly generated mnemonic backup as `pending` until explicit confirmation;
- on application restart, detect `pending` mnemonic backup and require a fresh app passphrase to recover it through SDK `reveal` rather than storing plaintext recovery material;
- mark backup `confirmed` only after the user explicitly completes the backup step;
- route completed onboarding into a minimal account landing screen.

The current UI intentionally remains a small in-feature flow without adding a new navigation/state dependency in this milestone. React Navigation 7 / Zustand 5 remain the approved broader v1 application baseline and should be introduced when multi-feature application navigation/state composition begins; persisted wallet truth remains in Realm.

## Persistence evidence

Realm implementation under `src/platform/persistence/realm` includes:

- schema version 1 with Account/Signer/reference entities;
- strict plain-object mappers and fail-closed persisted enum handling;
- atomic write transactions;
- duplicate `(networkId,address)` enforcement;
- orphan signer cleanup with shared-signer preservation;
- shared repository contract reused by Memory and Realm integration tests;
- close/reopen persistence integration test;
- bootstrap list queries and explicit signer backup-state updates;
- no persisted passphrase, mnemonic, raw secret, WalletUnlockKey or biometric auth state.

Android and Apple actual RN runtimes have both been manually verified with:

```text
FRESNICA_PARSE_ACCOUNT_SMOKE_OK realm=ok
```

This verifies Realm native runtime and `NativeModules.FresnicaCore` coexist on both platforms. Local TypeScript/Jest/Realm integration validation is required again for the onboarding branch before the milestone is considered verified.

## Conformance / regression scope

The TypeScript/Jest tests are designed to verify, among other cases:

- Account and Signer remain separate;
- watch-only changes only with account-signer references;
- shared signers survive until their final reference is removed;
- duplicate account identity is network-scoped;
- account+signer provisioning is atomic;
- Realm mappers do not leak live Realm objects or mutable Date references;
- invalid persisted enum values fail closed;
- generated mnemonic plaintext is not written to repository records;
- interrupted generated-mnemonic backup resolves to a resumable startup state;
- resuming backup uses fresh-passphrase SDK `reveal` and confirmation updates only backup metadata;
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

- React Navigation / multi-feature application shell;
- System Auth enablement during onboarding and app lock/session behavior;
- Portfolio/Balance;
- Trustline Flow;
- Swap/SDEX Flow;
- History/Activity UI;
- Reveal/Export product UI outside the interrupted-backup recovery path;
- complete passphrase rotation/recovery flows;
- Realm database encryption-key lifecycle;
- retryable System Auth/external-provider secure cleanup orchestration;
- full multisig coordination;
- hardware/external signer provider integration;
- Mainnet enablement.

## Contribution rule

When Mobile behavior exposes a Fresnica SDK/adapter/documentation inconsistency, classify it explicitly and contribute a concrete reproduction/fix upstream rather than hiding a permanent compatibility patch in Mobile.
