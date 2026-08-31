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
| Balance / Availability | Normative | Read-only Portfolio slice implemented | Classic Horizon native/credit balances are normalized behind a Balance Capability. Exact decimal strings are preserved; inactive and contract-account states remain explicit; LP shares are not projected as ordinary tokens. |
| Payment | Normative | Product Flow implemented on Testnet | Runtime Send selects a visible balance asset, validates destination/amount/text memo, builds an unsigned payment, derives review from exact XDR, authorizes through shared Signing Coordination and renders normalized submission outcomes. |
| Transaction | Normative | Foundation implemented and used by Send | Reviewed-transaction identity, freshness guard and normalized submission semantics are exercised by the runtime Send Flow. |
| History / Activity | Mobile read capability | Read-only product slice implemented | Classic Horizon account operations are paged behind `StellarGateway`, normalized into stable History entries, and rendered with loading/refresh/empty/error/load-more states. Payment/create-account are specialized; unknown operations remain explicit rather than being dropped. |
| Ledger Authorization | Defined | Classic foundation implemented and used by Send | Typed Classic signer conditions and threshold resolution are reloaded before Send signing for applicable local Ed25519 signers. Full multisig/provider coordination remains future work. |
| Signing Coordination | Normative | Foundation implemented and used by Send | Shared `routine` policy prefers Native SDK System Auth. `passphrase-required` skips System Auth entirely and requires a fresh app passphrase before signing. Send uses `routine`. |
| Application Security | Defined | System Auth foundation implemented | Strong app-passphrase policy, System Auth status/enable/repair/disable, protected-signer registration and high-assurance signing policy are implemented. App lock/session and product-wide passphrase rotation remain blocked on explicit upstream framework-safe authorization APIs. |
| Network / Gateway | Defined | Platform mechanism implemented | `src/platform/stellar`: Horizon balance/authorization/history loading, payment construction and transaction submission. |
| Persistence | Mobile platform mechanism | Realm v1 wired into production bootstrap | Memory and Realm implementations share `AccountSignerRepository`, including account-to-signer lookup used by Send. Production `createAppServices()` opens Realm, loads `FresnicaCore`, composes shared services and closes Realm on teardown/bootstrap failure. |

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
- route completed onboarding into the runtime product shell.

Existing-wallet protected-signer creation/import is intentionally disabled for now. The product contract is one app passphrase across ordinary protected software signers, while Native Binding API 2 / the current React Native adapter does not expose a framework-safe verification-only operation for proving that an entered passphrase matches the existing wallet without returning `WalletUnlockKey` material. Existing-wallet Add Account therefore currently supports watch-only only and fails closed rather than allowing mixed app-passphrase state.

## Runtime Product Shell / Portfolio evidence

`src/app/navigation` and `src/features/portfolio` now provide the first real product runtime:

- completed onboarding enters one `ProductRuntime` instead of the legacy terminal wallet-ready placeholder;
- Wallet / Activity / Settings are explicit typed roots;
- navigation state contains public account IDs and product destinations only, never app passphrase, mnemonic, signer material or transaction XDR;
- switching the selected account drives Wallet Home and a fresh Balance read;
- Wallet Home distinguishes loading, inactive account, active balances and network/read errors;
- native and issued assets preserve exact decimal strings from Horizon rather than converting balances to JavaScript numbers;
- issued asset identity keeps both code and issuer;
- liquidity-pool shares are deliberately not shown as ordinary token balances in this first slice;
- contract accounts do not inherit Classic Horizon balance semantics.

## Send v1 evidence

`src/features/send` implements the first complete runtime transaction Feature over the existing Fresnica transaction foundations:

- donor Send behavior was inspected for the product step rhythm and asset/destination/memo coverage, while donor Vault/signing semantics were not copied;
- the flow is local Feature state: form -> exact-XDR review -> authorization/submission -> result;
- visible native and issued Balance assets can be selected for Payment;
- `G...` Classic and `M...` muxed destinations are validated before build;
- payment amounts remain exact decimal strings, allow at most seven decimal places and are bounded by Stellar signed-int64 stroop semantics without JavaScript floating-point conversion;
- text memo is limited to 28 UTF-8 bytes;
- Unicode memo bytes read back from Stellar SDK 17 XDR are explicitly decoded as UTF-8 for review;
- unsigned construction uses `StellarGateway.buildPayment` and configured Testnet context;
- every review field is derived from the exact unsigned transaction XDR;
- the submission boundary re-derives `PaymentReview` from that exact XDR rather than trusting mutable/plain JavaScript semantic fields supplied by the caller;
- current ledger authorization and transaction freshness are checked immediately before signing through the existing Payment orchestration;
- account-to-signer lookup is explicit in `AccountSignerRepository` and shared by Memory/Realm implementations;
- zero attached signers return a watch-only outcome; multiple attached signers fail closed pending the multisig milestone rather than selecting one silently;
- routine signing uses System Auth first when the signer is enrolled, otherwise the shared signing layer returns `passcode-required` and the UI asks for the existing app passphrase;
- app passphrase exists only in local Review state and is cleared before passphrase-backed submit awaits;
- result UI keeps submitted, deterministic rejected, uncertain, authorization-blocked, unsupported-signer, watch-only and unsupported-multisig outcomes distinct;
- returning from Send goes back to Wallet Home, which reloads current ledger balances.

Send v1 intentionally does not implement path payment, swap, multi-operation review, multisig coordination, external signer providers or Agent/AI authorization.

## History / Activity v1 evidence

`src/capabilities/history` and `src/features/history` implement the first read-only Activity slice:

- donor Events behavior was inspected for account reset, loading/refresh/load-more states and its separation between raw ledger records and presentation models;
- Mobile intentionally does not copy the donor's large persistent cache/gap-recovery machinery into the first History slice;
- `StellarGateway.loadAccountOperations` owns Horizon descending pagination, validates page size and exposes only typed record pages/cursors to the Capability layer;
- account 404 is preserved as an inactive state and contract accounts do not inherit Classic operation-history semantics;
- History normalizes stable operation id, paging token, timestamp, transaction hash and source account without exposing raw Horizon records to UI;
- v1 specializes `payment` and `create_account` operations;
- unknown operation types become explicit `unsupported` entries instead of being filtered from history;
- malformed specialized operation shapes become explicit unsupported-shape entries while invalid common identity/time fields fail closed;
- payment direction preserves incoming/outgoing/self/neutral semantics, including muxed-recipient direction based on the base account identity;
- native and issued amounts remain exact strings and issued asset identity retains code + issuer;
- Activity distinguishes initial loading, inactive, unsupported account, read error, empty list and populated list states;
- explicit refresh replaces the current page, while load-more appends older entries and deduplicates by stable operation id;
- stale asynchronous results are ignored after the selected account or request generation changes;
- product navigation does not carry raw operations, paging cursors or whole History entries; operation-details remains reserved for stable `accountId + operationId` addressing.

History v1 intentionally does not implement persistent operation caching/gap backfill, search/filtering or transaction actions from history.

## Application Security v1 evidence

`src/capabilities/application-security` and `src/features/security` implement the supported System Auth slice:

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
- bootstrap list queries, account-to-signer lookup and explicit signer backup-state updates;
- no persisted passphrase, mnemonic, raw secret, WalletUnlockKey or biometric auth state.

Android and Apple actual RN runtimes have both previously been manually verified with:

```text
FRESNICA_PARSE_ACCOUNT_SMOKE_OK realm=ok
```

The Onboarding + Application Security milestone was manually exercised through create/import/watch-only, interrupted mnemonic-backup recovery, Add Account, System Auth enable/repair/disable and restart persistence paths. New Product Shell/Balance/Send/History changes still require their own executable validation; GitHub Actions runner allocation has repeatedly failed before workflow steps begin and must not be treated as green.

## Conformance / regression scope

The TypeScript/Jest tests are designed to verify, among other cases:

- Account and Signer remain separate;
- watch-only changes only with account-signer references;
- account-to-signer lookup returns only signers attached to the requested account;
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
- Unicode text memo is decoded from XDR as UTF-8;
- Send validates G/M destinations, seven-decimal amount semantics and UTF-8 memo byte length;
- Send submission re-derives semantic review data from exact XDR;
- watch-only and unsupported multisig Send paths fail closed before signing;
- expired reviewed transactions are blocked before signing;
- History payment/create-account mapping preserves direction, exact amounts and asset identity;
- unknown/malformed History operation types remain explicit rather than disappearing;
- History cursor paging preserves next-page identity and deduplicates operation IDs;
- History rejects network mismatch and keeps inactive/contract-account states explicit;
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
  @stellar/stellar-sdk / Horizon mechanisms for balances, authorization, history and transactions

src/platform/persistence
  memory/ deterministic test/foundation adapter
  realm/  durable Realm v1 adapter
```

Realm remains a platform implementation choice and must not redefine Account/Signer Capability semantics.

## Next product milestone

The next staged milestone is Trustline / Manage Assets:

- inspect donor asset-management behavior for product information architecture;
- use stable issued-asset identity `CODE:GISSUER`;
- add a dedicated Change Trust transaction capability boundary;
- derive review from exact XDR and reuse the same freshness / authorization / Signing Coordination / submission architecture proven by Send;
- refresh Portfolio after an accepted trustline change;
- keep unsupported account/asset shapes fail closed.

The execution sequence and acceptance gates are maintained in `docs/fresnica-mobile-stage-plan.md`.

Persisted wallet truth remains in Realm. Application/global UI state must not become a second wallet database.

## Not yet implemented

- Trustline Flow;
- Swap/SDEX Flow;
- specialized operation-details product flow;
- persistent History cache/search/filter layer;
- Reveal/Export product UI outside interrupted-backup recovery;
- app lock/session pending the upstream authorization API described above;
- existing-wallet protected-signer provisioning pending framework-safe current-passphrase verification;
- complete passphrase rotation/recovery flows;
- Realm database encryption-key lifecycle;
- retryable System Auth/external-provider secure cleanup orchestration;
- full multisig coordination;
- hardware/external signer provider integration;
- Agent/AI standing authorization pending transaction-specific Core authority constraints;
- Mainnet enablement.

## Contribution rule

When Mobile behavior exposes a Fresnica SDK/adapter/documentation inconsistency, classify it explicitly and contribute a concrete reproduction/fix upstream rather than hiding a permanent compatibility patch in Mobile.
