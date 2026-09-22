# Fresnica Mobile Capability Status

This file records current Mobile implementation evidence against the shared Fresnica Application Capability vocabulary. Upstream maturity labels describe the shared specification, not Mobile implementation quality.

Target product shell, naming, and completion rules: `docs/stellar-product-information-architecture.md`. Current construction order and status ledger: `docs/fresnica-mobile-rewrite-execution-plan.md`. Evidence below describes Git scaffolding as it is. It is **not** the rewrite completion bar (Developer Mode, verified hardware-wallet combinations, clean-room dApp rewrite and custom themes remain incomplete; Stage 2.5 transaction recovery is now verified for S07/S30).

## Compatibility baseline

```text
Fresnica Native SDK       0.3.1
Native Binding API        3
Universal SDK API         5
Core Client API           5
RN adapter source         0.3.0
Adapter source revision   c5eae08e84b197d534a05f02ae1a230a1e245f28
React Native              0.87.0
Realm                     20.2.0
Network                   Stellar Testnet
```

The 2026-09-16 Native SDK 0.3.1 maintenance is locally validated at implementation commit `e6f4098...` plus deterministic Android smoke carrier `66b41c6...`: full JS/architecture/provenance/locale gates pass at 68/68 suites and 353/353 tests, Realm integration is 28/28, and both iOS and a disposable Android 16 / API 36 AVD return `FRESNICA_PARSE_ACCOUNT_SMOKE_OK` against the 0.3.1 binary + canonical RN adapter. This is dependency/runtime evidence only; it does not promote any Stage 4 product surface by itself.

The follow-up S01 prerequisite at `32c16852...` advances only the canonical RN adapter revision to `c5eae08e...` while keeping Native SDK 0.3.1. `verifyProtectedSignerPassphrase` is present in the required bridge contract and validated on both native platforms for correct/wrong passphrase, signer mismatch and malformed envelope. The frozen Existing-wallet Add Account policy has production Create at `0eb20f7...`, Import mnemonic / Stellar `S...` at `e8405af...`, and HD additional-account at exact code/runtime target `b33baae...`. PR #50 final head `44775245...` passed all four remote gates including the Apple simulator runtime. The merged `main@a2b17eba...` then passed one-wallet Android+iOS aggregate acceptance across Create + Import + HD, default/restart recovery and System Auth registration/repair. S01 is therefore `L3 / L4 partial`. A 2026-09-18 review identified one additional product-semantic gap: generated mnemonic backup used explicit acknowledgement rather than proof-of-backup verification. PR #54 merged the shared in-memory word-position verification hardening at `main@52bd547...`, closing that gap without changing persistence ownership. Remaining S01 L4 work is the repeatable required aggregate gate plus trustworthy dynamic-font and screen-reader focus-order acceptance.

## Capability matrix

| Application Capability | Upstream maturity | Mobile status | Current evidence / scope |
| --- | --- | --- | --- |
| Account | Normative | Onboarding + S02 lifecycle/selection production-wired; aggregate L3 accepted, L4 partial | Account records, account-signer invariants, derived watch-only state, atomic account+signer registration and first-run create/import/watch-only flows remain unchanged. Rename, Hide/Delete and Sort/reorder are independently accepted in `main`. The current S02 selection slice replaces cycle-only switching with direct choice among visible accounts on the active network in stable `sortOrder → createdAt → id` order. `app/` still owns session selection, while Realm v4 stores `defaultAccountId` by network. Missing, hidden, deleted or cross-network defaults normalize to a valid current-network account; an explicit default write failure leaves the current session unchanged, automatic hide/delete fallback remains session-safe and retries from the stale preference on later reconciliation, restoring a hidden account does not steal the default, and final-account onboarding clears the network default. If the active network has zero visible accounts, navigation no longer throws: the app exposes only that network's Accounts recovery path so hidden records can be restored or a new account can be added without selecting a visible account from another network. Android native acceptance proves direct select, restart/default restore, hide fallback persistence and restore-without-default-steal. PR #42/#43 review is merged, and 2026-09-15 dual-platform aggregate acceptance on `main@48b77acc...` proves the production account lifecycle at L3, including direct selection/default restore, reorder identity retention, hide fallback persistence, restore-no-steal, delete/final-Onboarding cleanup, zero-visible Restore and zero-account Add without cross-network fallback. S02 remains L4 partial because Accounts/Account Detail still contain hard-coded English, reliable TalkBack/VoiceOver focus-order acceptance is not yet closed, and the aggregate UI flow is not yet a required CI gate. |
| Signer | Normative | Protected-software onboarding implemented | Secret/mnemonic protection remains SDK/Core-owned. Mobile persists only public signer identity plus opaque envelope and backup metadata. |
| Balance / Availability | Normative | Portfolio read + S05 aggregate L3 accepted, L4 partial | Classic Horizon native/credit balances are normalized behind Balance. Exact decimal strings are preserved; inactive and contract-account states remain explicit; LP shares are not projected as ordinary tokens. Inactive Classic Testnet accounts can invoke Network-owned Friendbot activation, after which Home reloads the same authoritative Balance/Horizon path rather than fabricating a local balance. Merged `main@ab794fa...` now has dual-platform Home/Balance aggregate evidence: Android covers active/read-only/inactive, Asset Details, focus invalidation, error/retry and pull refresh; iOS covers active/read-only/inactive, Asset Details and Horizon transport error/retry. S05 remains L4 partial until the aggregate is a required gate and accessibility/dynamic-font evidence closes. |
| Payment | Normative | S07 production flow + shared recovery implemented on Testnet | Classic `G...` destination scope, Payment-vs-CreateAccount selection, current fee/reserve/availability preflight, issued trustline authorization/capacity, SEP-29 memo-required handling, exact-XDR review/submission binding and Stage 2.5 pending/reconciliation are wired. The 2026-09-18 aggregate on merged `main@a921635...` proves Text/ID/Hash, App Passphrase fallback, System Auth success, submitted/rejected/uncertain and restart recovery on Android+iOS; Android additionally proves native System Auth cancel -> retry. iOS Simulator did not expose a trustworthy cancellable System Auth window, and no real iPhone is currently available, so S07 remains `L3 partial`. The missing real-iPhone `cancel → user-cancel → pending=0 → retry → submitted` evidence is deferred to Stage 9 / release acceptance; it blocks S07 maturity promotion and final release sign-off, but not S30 Trustline or S13 Activity. |
| Transaction | Normative | Shared submission + Stage 2.5 restart recovery verified | S07 Payment and S30 Trustline persist public pending metadata before broadcast, block unresolved duplicate economic intentions, and reconcile the original network-bound hash through one App coordinator on cold start, foreground, definite offline→online recovery and manual refresh. The coordinator remains single-flight but queues one trailing run when a trigger arrives during an active reconciliation, and the Capability independently rejects any outcome whose returned hash differs from the persisted hash. Long-lived still-unknown records never auto-expire. The recovery slice has Realm/native/Testnet process-death evidence; this does not by itself make the S07/S30 product surfaces L4. |
| Trustline | Normative | S30 production flow aggregate L3 accepted, L4 partial | Ordinary Classic `CODE:GISSUER` Add/Set Limit/Remove follows Fresnica canonical add limit, set-limit commitment/issuer rules, reserve/fee, authorization/clawback state and liquidity-pool removal rules with exact-XDR review and pre-sign ledger revalidation. Asset-code case is preserved exactly. After PR #59 fixed the narrow Horizon omitted-clawback adapter mismatch, merged `main@0e84fd5...` passed fresh Android+iOS Testnet aggregate acceptance across Add/Set Limit/Remove, App Passphrase fallback, System Auth success, authoritative Horizon reads, deterministic rejection, uncertain/restart reconciliation and Home invalidation. Android additionally proves production load-error Retry, Simplified Chinese Manage Assets, 1.5x dynamic type and basic TalkBack traversal. S30 is `L3 / L4 partial`; L4 still requires a repeatable required aggregate gate plus trustworthy platform-level screen-reader focus-order depth, especially iOS VoiceOver. |
| History / Activity | Defined | Read-model + projections + cache/offline + filter/search + explorer/product hardening dual-platform aggregate accepted; L4 partial | Classic Horizon account operations use opaque-cursor pagination behind `StellarGateway`; refresh/load-more failures preserve accepted data, cursor cycles fail closed, and detail uses the single-operation endpoint with exact identity/account-association checks. Stable projections cover payment, create-account and ordinary issued-asset change-trust participants. Activity hydrates the matching Realm snapshot as explicitly cached/stale data, revalidates Horizon page 1 before enabling a fresh online cursor chain, and keeps cache persistence cursor-free. Current-loaded-set query adds a dedicated Trustlines filter plus local search over stable fields without auto-paging. Operation Details exposes explicit unsupported-type/shape warnings and a Network-Capability-owned Stellar Expert projection for supported Testnet/Mainnet transaction hashes; Platform owns only the external-open side effect. Fresh Android+iOS aggregate evidence on merged `main@bb7a24d...` now covers page-1/pagination, filters/search, details/participants, explorer failure/retry, restart/cache hydration, offline list/detail and reconnect revalidation through production `createAppServices → Horizon → Realm → Activity` wiring. Horizon remains authoritative. |
| SDEX | Normative | Not implemented | Current shared contract is for `ManageSellOffer` / `ManageBuyOffer`, order books, offers and fills. It is intentionally not used as an implicit Path Payment Swap contract. |
| Path Payment / Swap | Shared contract missing | Blocked on Fresnica/fresnica#134 | Donor Swap uses `PathPaymentStrictSend` / `PathPaymentStrictReceive`; Mobile will not invent a platform-only semantic authority for quote/path/slippage policy. |
| Ledger Authorization | Defined | Classic foundation used by Payment and Trustline | Typed Classic signer conditions and threshold resolution are reloaded immediately before signing. Payment and ChangeTrust use medium threshold. Full multisig/provider coordination remains future work. |
| Signing Coordination | Normative | Shared routine signing used by write Flows | `routine` prefers Native SDK System Auth and falls back to a fresh app passphrase only when required. `passphrase-required` bypasses System Auth for high-assurance operations. Native SDK 0.3.1 retains high-level SEP-53 message signing for future dApp flows; product permission/session policy is not implemented yet. |
| Application Security | Defined | S04 System Auth production settings partial | Strong app-passphrase policy, System Auth status/enable/repair/disable and protected-signer registration exist. `6a19346` adds explicit confirmation before disable, fail-closed Native error handling and duplicate-confirm protection in the reachable Security Settings flow. Generic app-session System Auth challenge remains blocked upstream; all-signer staged `reprotect`/atomic persistence and post-commit registration recovery remain Mobile orchestration work. |
| Network / Gateway | Defined | Horizon mechanisms + Testnet Friendbot adapter production-wired | `src/platform/stellar`: Horizon balance/authorization/history/account-state/ledger/liquidity-pool reads, Payment/ChangeTrust construction and normalized transaction submission. `StellarFriendbotGateway` is a narrow HTTP mechanism injected by `app/`; Network Capability permits it only for `stellar-testnet` Classic accounts and sends only the public address. S07/S30 Horizon submission uses Stellar SDK 17.0.1 official `/axios` transport after real RN Testnet validation (`eaa1e8c`); Path Payment remains a separate blocked mechanism. |
| Persistence | Mobile platform mechanism | Realm v5 verified with pending recovery, network default and replaceable History cache | Realm v5 preserves the existing wallet/pending/default entities and adds only `HistoryCacheSnapshotEntity`: one replaceable public-ledger snapshot per `networkId + classic account address`, containing schema version, last successful Horizon update time, canonical normalized entries and validated ready details. Persisted History data contains no cursor/accepted-cursor chain or raw Horizon payload; corrupt/incompatible History data clears only its own partition. Memory and Realm repositories share one contract, including operation-family semantic validation; Realm close/reopen and v4→v5 migration across Account, Signer, Account-Signer Reference, Locale, DefaultAccountPreference and PendingSubmission are covered, and local account deletion clears its matching History partition through an injected port. Current hydration/offline slice Realm integration is 52/52 using the arm64 Node runtime required by the installed prebuild; cache reads also reject invalid `occurredAt` timestamps and any ready detail that contradicts the canonical retained list entry for the same operation id, while close/reopen now explicitly exercises the product hydration helpers for cached list + ready detail. Secrets, app passphrases, unlock keys, signer material and transaction XDR remain outside persisted History/default/pending records. |

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

Existing-wallet protected-signer **Create** is production-wired at `0eb20f7...`, mnemonic / Stellar `S...` **Import** at `e8405af...`, and **HD additional-account** at exact code/runtime target `b33baae...`. HD selects only eligible visible current-network mnemonic-backed protected sources with `backupState=confirmed|not-required`, verifies the current App Passphrase across all unique protected targets, then calls canonical `deriveMnemonicSigner` for an explicit SEP-5 index without Reveal or envelope parsing. Derived recovery state inherits the source and never becomes pending; duplicate/watch-only upgrade, post-persistence System Auth repair, and default-before-current selection reuse the already closed Import/Create orchestration. UI/navigation retain only public signer/account identity plus index; recovery material, App Passphrase and opaque envelope do not enter navigation/log/error/default metadata. Exact `b33baae...` passes 76/414 full checks, Realm 31/31 and disposable Android API 36 native+Realm acceptance. PR #50 final-head Apple runtime is also green. On merged `main@a2b17eba...`, a temporary same-wallet aggregate carrier then passed Android and iOS with pending-backup restart recovery, wrong-pass zero-write, Import watch-only upgrade/duplicate rejection, HD no-pending-backup, default restart restore and Native System Auth registration-gap-repair ending at 3/3 enrolled signers. The carrier was deleted after acceptance, so S01 is `L3 / L4 partial` rather than L4 until this aggregate becomes a required repeatable gate and accessibility/dynamic-font acceptance closes.

## Runtime Product Shell / Portfolio evidence

- completed onboarding enters `AppNavigator` main tabs;
- Home / Activity / dApps / Settings are typed destination roots and Actions remains a non-selected overlay trigger;
- the current Shell/Home/Settings presentation is intentionally neutral and functional: text-only destination tabs, a `+` Actions trigger, text action buttons, text asset badges, ordinary `ListRow`, React Native `Pressable` and `ActivityIndicator`; donor presentation assets/components/theme are not runtime dependencies;
- semantic `AppTheme` remains the replacement seam; final visual design and brand assets are explicitly not complete;
- Stage 0A remediation `36d306f` removes the donor presentation asset/component/theme trees; `bd916c5` adds the fixed target-tree exact-blob/marker gate. The remediated rewrite tip passes 56/284 unit tests, Realm 17/17 and 0 unapproved donor collisions, but this evidence must be reproduced on the clean integration commit before merge;
- Stage 3 now has an executable Android product native-flow carrier: an isolated cold Realm goes through generated-mnemonic onboarding and backup confirmation, reaches the production `AppNavigator` main branch, performs an authoritative Balance read, and submits a real Testnet Send through the production transaction pipeline. Two 2026-09-10 runs produced independent submitted hashes with the expected 2 XLM + 100-stroop source-balance delta; this is a native-flow carrier, not full tap/visual L4 acceptance;
- S05 Testnet Friendbot target `373912dc...` adds a clean-room inactive-account activation path without creating a second balance or transaction authority: eligibility is fail-closed in Network Capability, the Platform adapter sends only the public `G...` address, Home de-duplicates per-account requests and reloads Balance/Horizon after success. In addition to the host protocol smoke, a clean disposable Android 16 / API 36 AVD completed fresh watch-only inactive → Friendbot disabled in-flight → authoritative `XLM 10000.0000000` → restart/reload, plus an in-flight two-account switch where the stale completion did not replace the newly selected account. The older `Medium_Phone` resolver failure is isolated as AVD environment debt. The Friendbot sub-slice is Android-native accepted at L3; at that sub-slice point, aggregate S05 remained L3 partial pending Home/Balance aggregation, iOS product evidence and a required gate.
- S05 Home/Balance aggregate acceptance on `main@ab794fa...` closes that pending L3 gap without adding product code. Android production UI proves protected active and funded read-only Horizon balances at `XLM 10000.0000000`, honest inactive state, Asset Details authority re-read, Asset Details → Home focus invalidation into `Balances unavailable`, recovery through `Try again`, and pull-to-refresh. iOS production UI independently proves active/Asset Details, read-only and inactive states plus a Horizon axios/XHR transport fault entering the same error state and one retry restoring the same authoritative balance. Friendbot product UI was not re-triggered during aggregate acceptance. Disposable devices, temporary fixture/fault entrypoints and Metro were removed afterward. S05 is therefore `L3 / L4 partial`; L4 still requires a repeatable required aggregate gate plus trustworthy dynamic-font and TalkBack/VoiceOver focus-order acceptance, and iOS has not independently repeated the focus-return fault path.
- S07 aggregate acceptance on merged `main@a921635...` exercises one fresh protected Testnet source per platform through production Payment/Signing/Transaction/Realm/Horizon paths. Android proves Text whitespace preservation, ID/hash canonicalization, App Passphrase fallback, System Auth success, real Native `user-cancel` plus retry, real submitted and deterministic `tx_bad_seq` rejection, test-induced uncertain-after-real-acceptance, and same-hash process-restart recovery to confirmed. A fresh current-tree iOS Debug build independently proves all of those except Native cancellation; Simulator LocalAuthentication completed signing without a stable cancellable prompt, so that gap is recorded rather than inferred. With no real iPhone currently available, direct iOS cancellation/retry acceptance is deferred to Stage 9 / release acceptance. S07 therefore remains `L3 partial`; the deferred evidence blocks S07 maturity promotion and final release sign-off only, not S30/S13 progression. L4 still separately requires required repeatable aggregate gating and accessibility/dynamic-font/tap-driven UI depth.
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
- merged S13 projection specializes `payment`, `create_account` and ordinary issued-asset `change_trust`, with stable semantic participants and explicit unsupported fallback for unknown/malformed shapes;
- unknown operation types and malformed specialized operation shapes remain explicit unsupported entries;
- issued asset identity and exact amount strings are preserved;
- incoming/outgoing/self/neutral payment direction is explicit, including muxed destination handling for history records;
- Activity has loading, inactive, unsupported account, offline-empty, cached/stale, empty, refresh and load-more states; cached/stale state exposes localized last-update/degraded copy without fixed-height text containers.
- stale async results are ignored after account/request changes; the Activity stack itself remounts when the `networkId + classic address` partition changes, so the previous account/network state is not reused.
- raw Horizon records/cursors never enter product navigation; operation detail navigation carries only `accountId + operationId`, and cached hydration never restores `nextCursor` or accepted cursor chains.
- operation detail first restores a previously validated cached ready detail when available, then reloads the single Horizon operation, validates exact operation id/account association, updates the cached ready detail on success, and removes cached detail when Horizon authoritatively reports not-found/not-associated.
- Horizon page 1 success creates a fresh online page/cursor chain. Persistent cache uses `fresh page 1 + continuous cached tail` only when an operation-ID overlap exists; without overlap it keeps only fresh page 1. Cache read/write failure cannot turn a successful live read into failure, an authoritative inactive response clears the partition best-effort, and transaction invalidation marks visible data stale before revalidation rather than optimistically adding Activity.
- History cache hydration/offline product state is merged through PR #66 at `main@02e309b8c49e9badd6940ea9acd5ad64219da9ec`, whose tree matches reviewed head `e7ba6033777a157cf5f253d1236c7c11a9369d42`.
- Current-loaded-set filter/search is merged through PR #67 at `main@9aaef8cd09ceeaea1e1c70c88c4720da2833ac51`; reviewed head `ebcb5ba418e8bcf842ed00786d720298a7e28647` and the merge tree are identical.
- Explorer/product-hardening policy is frozen in `890c4f4ff52f23c4daa53fb5c2c8ee7c3a0054dc` and implemented in `71241968de1c16dd2fc3daf33758d8bde3a36047`. Network Capability alone maps valid 64-hex transaction hashes to the frozen Testnet/Mainnet Stellar Expert HTTPS prefixes; unknown networks/invalid hashes produce no action. App composition injects a Platform external-URL opener that passes the trusted URL through unchanged and propagates OS-open failure.
- Operation Details now exposes localized read-only explorer action/opening/failure copy plus explicit unsupported-type/unsupported-shape warnings. Duplicate external opens are blocked while busy; an open failure keeps the loaded/cached detail and action, announces localized failure and remains retryable without entering History refresh/error state. Activity Retry controls also expose explicit button role/label. Explorer/warning containers use flexible vertical layout without fixed-height text clipping.
- Final local gates on the frozen explorer/product implementation passed `npm run check` at **92/92 suites and 526/526 tests**, ESLint **0 errors / 21 existing warnings**, architecture/provenance/alias gates green, and locale check **3 dictionaries / 374 shared keys**.
- PR #69 then fixed the narrow React Native URL-compat defect found by the first aggregate attempt: pending `searchParams` are now preserved when Stellar SDK rewrites pathname/host/protocol. Independently reviewed head `cc1578f9f724f4c2fcd5b75454b2f76149837c6e` merged as `main@bb7a24d33951db4b59e4ae7968fd95766769e59f`, with merge tree identical to the reviewed head and all four remote gates successful.
- Fresh post-#69 Android+iOS aggregate acceptance used one public Testnet fixture source through production `createAppServices → StellarSdkGateway/Horizon → Realm → Activity`. Both platforms loaded a latest page 1 of **20** entries with a fresh opaque cursor, then **5** older entries, covering payment, create-account, change-trust and explicit unsupported. Current-loaded-set filters/search, four-family details/participants, trusted explorer projection plus failure/retry dispatch, cold restart hydration, network/account partition isolation, offline cached list/detail, retained last-updated and reconnect page-1 revalidation all closed without restoring a persisted cursor.
- Android platform UI evidence additionally showed the real Activity surface in offline state with localized `Cached activity`, degraded refresh copy, `Last updated …`, Retry and retained payment/create-account/change-trust/unsupported rows. iOS ran the same real Activity surface and production dependencies, but exact internal Simulator accessibility-tree/VoiceOver ordering is not claimed because the available tooling cannot export trustworthy node-order evidence.
- Post-acceptance unchanged product-tree `npm run check` passes **92/92 suites and 528/528 tests**, ESLint **0 errors / 21 existing warnings**, with architecture/alias/provenance/locale gates green.
- **S13 is promoted to `L3 / L4 partial`; do not claim L4.** Remaining L4 debt is converting this aggregate into a repeatable required CI/E2E gate plus trustworthy dynamic-font and platform-level TalkBack/VoiceOver focus-order/tap-driven acceptance, especially iOS VoiceOver. No History schema/cursor, Payment, Trustline, Signing, Transaction or recovery semantics changed during aggregate acceptance.

## Trustline / Manage Assets v1 evidence

`src/capabilities/trustline` and `src/features/trustlines` implement the first Classic issued-asset write flow according to the upstream Normative Trustline contract:

- ordinary trustline identity is `CODE:GISSUER`; XLM and liquidity-pool-share ChangeTrust assets are outside this v1 product scope;
- asset code is 1-12 ASCII alphanumeric characters, preserves exact case, and issuer must be a Classic `G...` account;
- an issuer cannot create a trustline to its own asset;
- Add requires no existing trustline and requires the issuer account to exist;
- Add uses Fresnica canonical default limit `708269837873.6765` rather than Stellar SDK's generic max-int64 default;
- Add loads current ledger base fee/reserve and preflights native XLM capacity against selling liabilities, protocol minimum balance, one additional base reserve and fee;
- issuer `AUTH_REQUIRED` and clawback flags are exposed as expected initial state in review, not treated as final confirmed ledger state;
- Set Limit requires an existing trustline, a positive new limit not below current balance plus buying liabilities, a still-existing issuer for the non-zero result, and fee/reserve capacity;
- prepared Set Limit intent is carried explicitly because non-zero ChangeTrust XDR alone cannot distinguish Add from Set Limit, and current trustline state is revalidated before signing;
- Remove requires an existing trustline and rejects non-zero balance, buying liabilities or selling liabilities;
- Remove checks each held liquidity-pool share and rejects deletion if a referenced pool reserve uses the issued asset;
- Remove does not require a deleted/orphaned issuer account to be recreated;
- `StellarGateway` supplies account ledger facts, ledger parameters, pool reserves and ChangeTrust XDR construction as platform mechanisms while Capability code owns the rules;
- ChangeTrust Review accepts exactly one ordinary issued-asset ChangeTrust operation, rejects operation source overrides and derives source/asset/limit/fee/expiry from exact XDR;
- submission discards mutable caller review semantics and re-derives from exact XDR before account/signer checks;
- ChangeTrust uses the same medium-threshold shared reviewed-transaction submission path as Payment;
- System Auth/passphrase behavior is therefore shared rather than Trustline-specific;
- Manage Assets lists current issued trustlines and current limits, supports manual Add, Set Limit and Remove, and routes all three intents through exact ChangeTrust review;
- successful return to Wallet causes Portfolio to reload current ledger balances;
- watch-only and multiple-local-signer accounts fail closed before signing.

Trustline v1 intentionally does not implement Asset Discovery/catalog/ranking, liquidity-pool-share ChangeTrust, multisig coordination or Agent authorization.

## Native gate evidence

### Current rewrite milestone evidence — 2026-09-10

- Stage 2.5 real Android Testnet process-death recovery is recorded under `5db3610`: the original network/account/source/hash survives process replacement and is reconciled without another sign/broadcast.
- After NetInfo integration, current Android and iOS Native runtime smoke both passed; iOS also completed a fresh simulator build on iPhone 15 Pro / iOS 17.2.
- `6a19346` adds the S04 System Auth disable-confirmation product boundary without changing Native API semantics; capability tests prove a failed `removeSystemAuthDomain` does not report a false disabled state.
- `50d8653` removes Android release debug-signing fallback. Local fail-closed, root-task-graph and ephemeral release-signing/APK-certificate checks pass; production keystore/CI secret remains intentionally unprovisioned.
- Final local milestone validation target `f49dc50`: `npm run check` 56 suites / 284 tests, `npm run test:realm` 17/17, ESLint 0 errors / 28 warnings; fixed-commit provenance regeneration produced zero ledger drift. Android real Testnet recovery, standard Android native smoke, Android independent release-signing checks, iOS fresh simulator build and iOS native smoke all passed. The branch was still 11 commits ahead of origin, so current remote GitHub Actions evidence had not yet been recorded.

### Historical native-integration PR evidence

The native recovery was integrated into the earlier Trustline base as follows.

- Android checkout-only adapter compatibility tracks upstream Fresnica/fresnica#128 and #129 while retaining canonical adapter build, manifest/AAR checks and Android app link.
- Apple runtime-smoke stabilization starts the unchanged 120s callback window immediately before Simulator launch and persists actionable diagnostics without weakening the Realm or `NativeModules.FresnicaCore.parseAccount` assertions.
- PR #22 exact head executed normal CI, Realm Integration, Native Android Gate and Native Apple Gate successfully on the Stage 1-4 product tree before merge.
- PR #22 was then merged into `feat/trustline-flow` as `8741beb4...`; its history includes the Android compatibility commits from #20, and GitHub marked #20 merged as those commits entered the base.
- PR #19's first post-integration runs, plus an immediate core-CI retry, failed before any step executed (`steps:null`). That is current runner-allocation evidence, not a code-test failure, so PR #19 remains open pending a real current-head run.
- PR #21 is being revalidated against this integrated base from its newest head rather than reusing Android/Apple results generated before the native fixes existed in the base.

## Application Security v1 evidence

- query System Auth availability and Protection Domain state;
- initialize/disable the device domain;
- require an explicit S04 product confirmation before invoking disable; Cancel/backdrop/system-back have no Native side effect, and disable failure remains visibly enabled/retryable;
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

The current Realm v5 baseline keeps the existing account/signer/locale, `PendingSubmissionEntity` and network-scoped `DefaultAccountPreferenceEntity` invariants, and adds only the replaceable `HistoryCacheSnapshotEntity`. History partitions are keyed by network plus Classic account address and store canonical normalized History DTO JSON, cache schema version and last successful Horizon update time; validated ready details are keyed by operation id inside the same atomic snapshot. The repository deduplicates operation ids, preserves gateway order, trims to the newest 500 entries, drops details outside that retained window, never persists cursors/raw Horizon fields, and clears only a corrupt/incompatible History partition. Existing v2/v3 migration coverage now targets v5, and a direct v4→v5 integration proves Account, Signer, Account-Signer Reference, Locale, DefaultAccountPreference and PendingSubmission survive while History starts empty. Persisted data still does not contain plaintext mnemonic, secret, app passphrase, WalletUnlockKey, biometric auth state or transaction XDR.

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
- pre-broadcast pending persistence, concurrent duplicate-intent rejection, restart reconciliation, long-unknown blocking and cross-network isolation;
- S07 Payment and S30 Trustline sharing the same pending repository/reconciliation path;
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
  realm/  durable Realm adapter (v3 verified; pending-submission recovery included)
```

Realm and Horizon remain platform choices; they do not redefine Capability semantics.

## Next product milestone

The donor's immediate Swap surface is a Path Payment product, not the same contract as Fresnica's current Normative SDEX offer capability.

- Fresnica/fresnica#134 tracks the missing shared Path Payment / Swap contract.
- Mobile may continue donor UX/quote research and platform-mechanism investigation while that contract is open.
- Mobile must not ship a private authoritative strict-send/strict-receive, quote freshness, slippage or path policy that could diverge from Fresnica.
- Normative SDEX `ManageSellOffer` / `ManageBuyOffer` support remains a separate future product stage rather than a substitute for Swap.
- While Stage 5A is blocked, unblocked Stage 6 security/account-lifecycle slices may proceed independently.

The current execution sequence and acceptance gates are maintained in `docs/fresnica-mobile-rewrite-execution-plan.md`. `docs/fresnica-mobile-stage-plan.md` is historical Capability/security PR evidence.

## Not yet implemented

- Path Payment Swap pending shared capability #134;
- SDEX offer-management product surface;
- Asset Discovery/catalog integration;
- current-loaded-set History search/filter closure, followed by explorer/product hardening and dual-platform aggregate acceptance;
- Reveal/Export UI outside interrupted-backup recovery;
- app lock/session pending upstream authorization API;
- S01 Existing-wallet Create + Import + HD is aggregate-accepted at `L3 / L4 partial`. The 2026-09-18 review found that generated mnemonic backup acknowledgement did not prove the user retained the phrase; PR #54 merged the mnemonic-verification hardening at `main@52bd547...`, closing that product-semantic gap without changing persistence. Remaining S01 work is the repeatable required aggregate CI/E2E gate plus trustworthy dynamic-font and TalkBack/VoiceOver focus-order acceptance;
- complete passphrase rotation/recovery flows;
- Realm database encryption-key lifecycle;
- full multisig coordination;
- hardware/external signer provider integration;
- Agent/AI standing authorization pending transaction-specific Core authority constraints;
- Mainnet enablement.

## Contribution rule

When Mobile behavior exposes a Fresnica SDK/adapter/documentation inconsistency, classify it explicitly and contribute a concrete reproduction/fix upstream rather than hiding a permanent compatibility patch in Mobile.
