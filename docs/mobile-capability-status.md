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
| Payment | Normative | Foundation implemented | `src/capabilities/payment`: exact-XDR single-payment review and orchestration on Testnet. Product UI Flow not yet implemented. |
| Transaction | Normative | Foundation implemented | Reviewed-transaction identity, freshness guard and normalized submission semantics. |
| Ledger Authorization | Defined | Classic foundation implemented | Typed Classic signer conditions and threshold resolution for applicable local Ed25519 signers. Full multisig/provider coordination remains future work. |
| Signing Coordination | Normative | Foundation implemented | Shared `routine` policy prefers Native SDK System Auth. `passphrase-required` skips System Auth entirely and requires a fresh app passphrase before signing. |
| Application Security | Defined | System Auth foundation implemented | Strong app-passphrase policy, System Auth status/enable/repair/disable, protected-signer registration and high-assurance signing policy are implemented. App lock/session and product-wide passphrase rotation remain blocked on explicit upstream framework-safe authorization APIs. |
| Network / Gateway | Defined | Platform mechanism implemented | `src/platform/stellar`: Horizon authorization loading, payment construction and submission. |
| Persistence | Mobile platform mechanism | Realm v1 wired into production bootstrap | Memory and Realm implementations share `AccountSignerRepository`. Production `createAppServices()` opens Realm, loads `FresnicaCore`, creates repositories/services and closes Realm on teardown/bootstrap failure. |

## Onboarding v1 evidence

`src/features/onboarding` implements the first usable Testnet onboarding slice:

- create a new mnemonic-backed protected software signer through Fresnica SDK/Core;
- import an existing mnemonic through `protectMnemonic`;
- import an existing Stellar `S...` secret through `protectSecret`;
- add a watch-only `G...` or `C...` identity through `parseAccount`;
- establish the app passphrase while creating/importing the first protected software signer;
- atomically persist Account + Signer + Account-Signer reference for protected software wallets;
- never persist plaintext mnemonic, secret or app passphrase;
- mark newly generated mnemonic backup as `pending` until explicit confirmation;
- on application restart, detect `pending` mnemonic backup and require a fresh app passphrase to recover it through SDK `reveal` rather than storing plaintext recovery material;
- mark backup `confirmed` only after the user explicitly completes the backup step;
- route completed onboarding into the current wallet landing screen.

Existing-wallet protected-signer creation/import is intentionally disabled for now. The product contract is one app passphrase across ordinary protected software signers, while Native Binding API 2 / the current React Native adapter does not expose a framework-safe verification-only operation for proving that an entered passphrase matches the existing wallet without returning `WalletUnlockKey` material. Existing-wallet Add Account therefore currently supports watch-only only and fails closed rather than allowing mixed app-passphrase state.

## Application Security v1 evidence

`src/capabilities/application-security` and `src/features/security` now implement the supported System Auth slice:

- query system-auth availability;
- query whether the device System Auth Protection Domain exists;
- report protected software signer registration status;
- initialize the device protection domain with platform biometric/system authentication;
- register/repair protected signers only after the user supplies the current app passphrase established during Create/Import;
- remove a newly created empty domain when all signer registrations fail;
- surface the underlying Native/Core registration failure rather than treating biometric success as passphrase success;
- disable the device domain and all signer registrations;
- keep app passphrase, WalletUnlockKey and biometric authorization objects out of Realm and persisted JS state.

Signing Coordination additionally distinguishes:

```text
routine
  -> prefer System Auth when the signer is enrolled
  -> otherwise require app passphrase fallback

passphrase-required
  -> do not query or invoke System Auth
  -> require a fresh app passphrase
```

`passphrase-required` is the reusable policy boundary for Reveal/Export, passphrase rotation/recovery and future product-classified high-risk actions.

Two upstream gaps remain explicit rather than hidden behind Mobile workarounds:

1. a framework-safe verification-only signer/app-passphrase operation, conceptually `verifySignerPassphrase(...)`, that validates the existing protected envelope without returning `WalletUnlockKey` or signing material to JavaScript;
2. a generic existing-domain System Auth challenge, conceptually `authenticateSystemAuth(reason)`, for application-session unlock without manufacturing a transaction or abusing Reveal/Export.

Until those exist, Mobile must not emulate them with `reveal`, dummy XDR/signing, `reprotect`, or a second JavaScript KDF/verifier.

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

The current Onboarding + Application Security milestone has also been manually exercised through create/import/watch-only, interrupted mnemonic-backup recovery, Add Account, System Auth enable/repair/disable and restart persistence paths. Local TypeScript/Jest/Realm validation is part of milestone acceptance; GitHub Actions runner allocation remains infrastructure-dependent.

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
- routine Signing Coordination prefers System Auth;
- passphrase-required Signing Coordination bypasses System Auth entirely;
- System Auth enrollment status is signer-scoped and device-domain state remains separate;
- newly initialized empty System Auth domains fail closed on total signer-registration failure;
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

## Next product milestone

The current screens were intentionally minimal while the persistence/onboarding/security boundaries were being proven. The next milestone is productization rather than more temporary flow UI:

- introduce the formal multi-feature navigation shell;
- add the small reusable UI foundation needed by actual screens;
- migrate Onboarding, Wallet Home and Security Settings onto the formal shell without changing their capability semantics;
- use Xaman as a UX/information-architecture donor only, while Fresnica capabilities and SDK/Core remain behavior/security authority;
- follow with Send as the first complete product Feature over the existing Payment/Transaction/Ledger Authorization/Signing/Gateway foundations.

Persisted wallet truth remains in Realm. Application/global UI state must not become a second wallet database.

## Not yet implemented

- formal multi-feature navigation/product shell;
- Portfolio/Balance product flow;
- Send product UI over the existing Payment foundation;
- Trustline Flow;
- Swap/SDEX Flow;
- History/Activity UI;
- Reveal/Export product UI outside interrupted-backup recovery;
- app lock/session pending the upstream authorization API described above;
- existing-wallet protected-signer provisioning pending framework-safe current-passphrase verification;
- complete passphrase rotation/recovery flows;
- Realm database encryption-key lifecycle;
- retryable System Auth/external-provider secure cleanup orchestration;
- full multisig coordination;
- hardware/external signer provider integration;
- Mainnet enablement.

## Contribution rule

When Mobile behavior exposes a Fresnica SDK/adapter/documentation inconsistency, classify it explicitly and contribute a concrete reproduction/fix upstream rather than hiding a permanent compatibility patch in Mobile.
