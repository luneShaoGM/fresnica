# Fresnica Mobile Capability Status

This file records current Mobile implementation evidence against the shared Fresnica Application Capability vocabulary. Upstream maturity labels describe the shared specification, not Mobile implementation quality.

Target product shell, naming, and rewrite order: `docs/stellar-product-information-architecture.md`. Evidence below describes Git as it is (including `events`/`xapps` tab ids and the temporary `ProductRuntime`).

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
| Balance / Availability | Normative | Read-only Portfolio slice implemented | Classic Horizon native/credit balances are normalized behind Balance. Exact decimal strings are preserved; inactive and contract-account states remain explicit; LP shares are not projected as ordinary tokens. |
| Payment | Normative | Current contract rebaseline implemented in PR #21 | Classic `G...` destination scope, Payment-vs-CreateAccount selection, current fee/reserve/availability preflight, issued trustline authorization/capacity, SEP-29 memo-required handling and exact-XDR review/submission binding. |
| Transaction | Normative | Shared reviewed-transaction submission implemented | Payment and Trustline share freshness, current ledger authorization, threshold resolution, Signing Coordination and exact signed-XDR submission semantics. |
| Trustline | Normative | Add/Remove Product Flow implemented on Testnet | Ordinary Classic `CODE:GISSUER` Add/Remove follows Fresnica canonical limit, reserve/fee, issuer-state, liabilities and liquidity-pool removal rules with exact-XDR review. Asset-code case is preserved exactly. Set Limit UI is not implemented yet. |
| History / Activity | Defined | Read-only product slice implemented | Classic Horizon account operations are paged behind `StellarGateway`, normalized into stable History entries, and rendered with loading/refresh/empty/error/load-more states. Payment/create-account are specialized; unknown operations remain explicit. |
| SDEX | Normative | Not implemented | Current shared contract is for `ManageSellOffer` / `ManageBuyOffer`, order books, offers and fills. It is intentionally not used as an implicit Path Payment Swap contract. |
| Path Payment / Swap | Shared contract missing | Blocked on Fresnica/fresnica#134 | Donor Swap uses `PathPaymentStrictSend` / `PathPaymentStrictReceive`; Mobile will not invent a platform-only semantic authority for quote/path/slippage policy. |
| Ledger Authorization | Defined | Classic foundation used by Payment and Trustline | Typed Classic signer conditions and threshold resolution are reloaded immediately before signing. Payment and ChangeTrust use medium threshold. Full multisig/provider coordination remains future work. |
| Signing Coordination | Normative | Shared routine signing used by write Flows | `routine` prefers Native SDK System Auth and falls back to a fresh app passphrase only when required. `passphrase-required` bypasses System Auth for high-assurance operations. |
| Application Security | Defined | System Auth foundation implemented | Strong app-passphrase policy, System Auth status/enable/repair/disable and protected-signer registration exist. App lock/session and wallet-wide passphrase rotation remain blocked on explicit upstream APIs. |
| Network / Gateway | Defined | Platform mechanism implemented | `src/platform/stellar`: Horizon balance/authorization/history/account-state/ledger/liquidity-pool reads, Payment/ChangeTrust construction and normalized transaction submission. |
| Persistence | Mobile platform mechanism | Realm v1 wired into production bootstrap | Memory and Realm share `AccountSignerRepository`, including account-to-signer lookup used by write Flows. Secrets and app passphrases are not persisted. |

## Onboarding v1 evidence

`src/features/onboarding` provides the Testnet onboarding slice:

- create a new mnemonic-backed protected software signer through Fresnica SDK/Core;
- import mnemonic or Stellar `S...` material only through SDK protection APIs;
- add watch-only `G...` / `C...` identities;
- establish the app passphrase while creating/importing the first protected software signer;
- atomically persist Account + Signer + Account-Signer reference;
- never persist plaintext mnemonic, secret or app passphrase;
- persist only mnemonic-backup metadata and resume interrupted generated-mnemonic backup with a fresh passphrase through SDK `reveal`;
- route completed onboarding into the runtime Product Shell.

Existing-wallet protected-signer creation/import remains disabled because Native Binding API 2 does not expose a framework-safe verification-only current-passphrase primitive. Mobile fails closed rather than creating mixed passphrase state.

## Runtime Product Shell / Portfolio evidence

- completed onboarding enters one `ProductRuntime`;
- Wallet / Activity / Settings are typed roots;
- navigation carries public account IDs/destinations only;
- selected-account switching drives Wallet Home and a fresh Balance read;
- Wallet Home distinguishes loading, inactive, active and error states;
- native/issued balances remain exact decimal strings;
- issued asset identity preserves code + issuer and exact case;
- liquidity-pool shares are not projected as ordinary token balances;
- contract accounts do not inherit Classic Horizon balance semantics.

## Send / Payment evidence

`src/features/send` plus `src/capabilities/payment` implement form -> current-ledger preparation -> exact-XDR review -> authorization/submission -> result.

Current PR #21 semantics:

- native and issued Balance assets are selectable;
- destination scope is Classic `G...`; muxed `M...` is rejected under the current shared contract;
- amount validation preserves exact positive seven-decimal Stellar semantics without JavaScript floating point;
- text memo is limited to 28 UTF-8 bytes and leading/trailing whitespace is preserved exactly;
- source state, destination state and current ledger base fee/reserve are loaded during preparation;
- missing destination + XLM builds exact `CreateAccount`; missing destination + issued asset fails closed;
- CreateAccount requires at least the current two-base-reserve minimum starting balance;
- native source availability subtracts protocol minimum balance, selling liabilities and fee;
- issued source payments require the exact trustline, full authorization and sufficient available balance unless source is the issuer;
- issued destination payments require the exact trustline, full authorization and `limit - balance - buying liabilities` receiving capacity unless destination is the issuer;
- SEP-29 `config.memo_required=1` is enforced before XDR construction;
- current ledger base fee replaces the earlier hard-coded build fee;
- `PaymentReview` derives and exposes actual `Payment` vs `CreateAccount` operation from exact unsigned XDR;
- preparation binds source, destination, operation, amount, asset, memo and fee back to exact XDR context;
- submission re-derives semantic review from exact XDR before account/signer checks;
- current ledger authorization and freshness are checked immediately before signing;
- zero attached signers fail as watch-only; multiple attached signers fail closed pending multisig;
- routine signing uses System Auth first and passphrase fallback otherwise;
- submitted, deterministic rejected, uncertain, authorization-blocked and signer-gate outcomes remain distinct;
- returning to Wallet refreshes balances.

PR #21 normal CI and Realm Integration are green on its pre-native-integration head. The latest documentation/head update exists specifically to force a fresh pull-request merge tree against the now-integrated Trustline/native base; that current-base full validation remains authoritative.

Send intentionally excludes Path Payment Swap, persistent SDEX offers, full multisig, external signer providers and Agent authorization.

## History / Activity v1 evidence

- donor Events behavior informed account reset/loading/refresh/load-more product behavior without copying its persistent cache/gap-recovery machinery;
- `StellarGateway.loadAccountOperations` owns descending Horizon cursor pagination;
- History normalizes stable operation ID, paging token, timestamp, transaction hash and source account;
- v1 specializes `payment` and `create_account`;
- unknown operation types and malformed specialized operation shapes remain explicit unsupported entries;
- issued asset identity and exact amount strings are preserved;
- incoming/outgoing/self/neutral payment direction is explicit, including muxed destination handling for history records;
- Activity has loading, inactive, unsupported account, error, empty, refresh and load-more states;
- stale async results are ignored after account/request changes;
- raw Horizon records/cursors never enter product navigation.

## Trustline / Manage Assets v1 evidence

`src/capabilities/trustline` and `src/features/trustlines` implement the first Classic issued-asset write flow according to the upstream Normative Trustline contract:

- ordinary trustline identity is `CODE:GISSUER`; XLM and liquidity-pool-share ChangeTrust assets are outside this v1 product scope;
- asset code is 1-12 ASCII alphanumeric characters, preserves exact case, and issuer must be a Classic `G...` account;
- an issuer cannot create a trustline to its own asset;
- Add requires no existing trustline and requires the issuer account to exist;
- Add uses Fresnica canonical default limit `708269837873.6765` rather than Stellar SDK's generic max-int64 default;
- Add loads current ledger base fee/reserve and preflights native XLM capacity against selling liabilities, protocol minimum balance, one additional base reserve and fee;
- issuer `AUTH_REQUIRED` and clawback flags are exposed as expected initial state in review, not treated as final confirmed ledger state;
- Remove requires an existing trustline and rejects non-zero balance, buying liabilities or selling liabilities;
- Remove checks each held liquidity-pool share and rejects deletion if a referenced pool reserve uses the issued asset;
- Remove does not require a deleted/orphaned issuer account to be recreated;
- `StellarGateway` supplies account ledger facts, ledger parameters, pool reserves and ChangeTrust XDR construction as platform mechanisms while Capability code owns the rules;
- ChangeTrust Review accepts exactly one ordinary issued-asset ChangeTrust operation, rejects operation source overrides and derives source/asset/limit/fee/expiry from exact XDR;
- submission discards mutable caller review semantics and re-derives from exact XDR before account/signer checks;
- ChangeTrust uses the same medium-threshold shared reviewed-transaction submission path as Payment;
- System Auth/passphrase behavior is therefore shared rather than Trustline-specific;
- Manage Assets lists current issued trustlines, supports manual Add by code+issuer and Remove review from an existing issued asset;
- successful return to Wallet causes Portfolio to reload current ledger balances;
- watch-only and multiple-local-signer accounts fail closed before signing.

Trustline v1 intentionally does not implement Set Limit UI, Asset Discovery/catalog/ranking, liquidity-pool-share ChangeTrust, multisig coordination or Agent authorization.

## Native gate evidence

The native recovery is now integrated into the Trustline base.

- Android checkout-only adapter compatibility tracks upstream Fresnica/fresnica#128 and #129 while retaining canonical adapter build, manifest/AAR checks and Android app link.
- Apple runtime-smoke stabilization starts the unchanged 120s callback window immediately before Simulator launch and persists actionable diagnostics without weakening the Realm or `NativeModules.FresnicaCore.parseAccount` assertions.
- PR #22 exact head executed normal CI, Realm Integration, Native Android Gate and Native Apple Gate successfully on the Stage 1-4 product tree before merge.
- PR #22 was then merged into `feat/trustline-flow` as `8741beb4...`; its history includes the Android compatibility commits from #20, and GitHub marked #20 merged as those commits entered the base.
- PR #19's first post-integration runs, plus an immediate core-CI retry, failed before any step executed (`steps:null`). That is current runner-allocation evidence, not a code-test failure, so PR #19 remains open pending a real current-head run.
- PR #21 is being revalidated against this integrated base from its newest head rather than reusing Android/Apple results generated before the native fixes existed in the base.

## Application Security v1 evidence

- query System Auth availability and Protection Domain state;
- initialize/disable the device domain;
- register/repair protected software signers only with the current app passphrase;
- remove a newly created empty domain if all registrations fail;
- never persist app passphrase, WalletUnlockKey or biometric authorization state.

Signing Coordination policies:

```text
routine
  -> prefer System Auth when signer is enrolled
  -> otherwise require app passphrase fallback

passphrase-required
  -> bypass System Auth
  -> require a fresh app passphrase
```

Two upstream gaps remain explicit: framework-safe verification-only current-passphrase validation, and a generic existing-domain System Auth challenge for app-session unlock. Mobile must not emulate them with `reveal`, dummy signing/XDR, `reprotect`, or a second JS verifier/KDF.

## Persistence evidence

Realm v1 includes strict plain-object mapping, atomic writes, network-scoped duplicate account identity, shared-signer preservation, orphan cleanup, account-to-signer lookup, backup-state updates and reopen persistence coverage. Persisted data does not contain plaintext mnemonic, secret, app passphrase, WalletUnlockKey or biometric auth state.

## Conformance / regression scope

Tests are designed to cover, among other cases:

- Account != Signer and account-signer reference invariants;
- Realm persistence/mapping and no secret leakage;
- mnemonic backup recovery semantics;
- typed non-Ed25519 ledger signer preservation;
- exact-XDR Payment and Trustline review/signing binding;
- Payment Classic destination scope, Payment/CreateAccount selection, reserve/fee/availability, trustline auth/capacity, SEP-29 memo-required and exact memo/asset identity;
- shared reviewed-transaction freshness and ledger authorization before signing;
- History normalization, unsupported operation preservation and cursor deduplication;
- Trustline canonical limit, issuer existence/state, reserve+fee preflight, removal liabilities, liquidity-pool relationship, orphan-issuer removal and exact asset-code case;
- ChangeTrust Horizon state mapping and XDR construction;
- routine System Auth preference and passphrase-required bypass behavior;
- accepted / rejected / uncertain submission separation;
- Native runtime module key remains `FresnicaCore`.

## Platform mechanisms

```text
src/platform/fresnica
  React Native -> Fresnica Native SDK integration

src/platform/stellar
  Stellar JS SDK / Horizon mechanisms for balances, authorization,
  history, account/ledger/trustline facts and transaction construction/submission

src/platform/persistence
  memory/ deterministic tests
  realm/  durable Realm v1 adapter
```

Realm and Horizon remain platform choices; they do not redefine Capability semantics.

## Next product milestone

The donor's immediate Swap surface is a Path Payment product, not the same contract as Fresnica's current Normative SDEX offer capability.

- Fresnica/fresnica#134 tracks the missing shared Path Payment / Swap contract.
- Mobile may continue donor UX/quote research and platform-mechanism investigation while that contract is open.
- Mobile must not ship a private authoritative strict-send/strict-receive, quote freshness, slippage or path policy that could diverge from Fresnica.
- Normative SDEX `ManageSellOffer` / `ManageBuyOffer` support remains a separate future product stage rather than a substitute for Swap.
- While Stage 5A is blocked, unblocked Stage 6 security/account-lifecycle slices may proceed independently.

The execution sequence and acceptance gates are maintained in `docs/fresnica-mobile-stage-plan.md`.

## Not yet implemented

- Path Payment Swap pending shared capability #134;
- SDEX offer-management product surface;
- Trustline Set Limit product UI;
- Asset Discovery/catalog integration;
- specialized operation-details product flow;
- persistent History cache/search/filter layer;
- Reveal/Export UI outside interrupted-backup recovery;
- app lock/session pending upstream authorization API;
- existing-wallet protected-signer provisioning pending safe current-passphrase verification;
- complete passphrase rotation/recovery flows;
- Realm database encryption-key lifecycle;
- full multisig coordination;
- hardware/external signer provider integration;
- Agent/AI standing authorization pending transaction-specific Core authority constraints;
- Mainnet enablement.

## Contribution rule

When Mobile behavior exposes a Fresnica SDK/adapter/documentation inconsistency, classify it explicitly and contribute a concrete reproduction/fix upstream rather than hiding a permanent compatibility patch in Mobile.
