# Fresnica Mobile Capability Status

This file records current Mobile implementation evidence against the shared Fresnica Application Capability vocabulary. Upstream maturity labels describe the shared specification, not Mobile implementation quality.

Target product shell and completion rules: [information architecture](stellar-product-information-architecture.md). Current execution status and final evidence registration: [current progress](fresnica-mobile-current-progress-and-next-plan.md). The execution plan retains the stage/acceptance framework; a reachable implementation is not complete Stellar parity or native acceptance.

## Current baseline — 2026-11-24

The implementation matrix below describes `main@6ed7b7c9d4c1ccf93e19dfc4265ec37d8a8b3f7d`, including merged #231 UI, #230 SEP-53 reply repair and #228 Android foreground dApp local notifications. Swap, Request/QR/deep link, Actions A1–A5, Claimable, SDEX/LP exit, dApp browser/permissions, persistent themes, Session Logs and application lock are supported implementations, not the old scaffolding/blocker state. Contacts are wallet-wide user records; transaction, cache and grant isolation still uses the relevant account/network identity.

The local `fix/audit-state-contracts-2026-11-24` repairs for Trustline review lifetime, Claimable invalidation/discovery, account cleanup, sensitive input/backup lifetime and credit-asset availability remain **candidates pending one final exact-HEAD Review**. Their scope is [the audit behavior spec](behavior-specs/audit-state-contracts-2026-11-24.md); final PR, remote HEAD, checks and review belong in the current-progress record. No candidate or automated regression is recorded here as merged or natively accepted.

Current [S04 authentication policy](behavior-specs/s04-authentication-policy.md) separates biometric App access from fresh App Passphrase signing. Network settings use normal Mainnet access and warning/confirmation-gated Developer Mode for Testnet/custom nodes. Full Soroban/token/auth-entry support, hardware/multisig, full notification and release work remain later scope. #228 adds merged Android foreground dApp local notifications with one-time consent; iOS is unsupported and native notification acceptance remains pending. #78 automation stays paused; WalletConnect is off and M addresses remain owner-paused.

Historical native records below retain their original dates and SHAs. In particular, Stage 9 real-iPhone System Auth cancellation/retry remains deferred; historical System Auth signing evidence is not evidence for today's fresh-passphrase policy.

## Historical SDK compatibility evidence — 2026-09

```text
Fresnica Native SDK       0.3.1
Native Binding API        3
Universal SDK API         5
Core Client API           5
RN adapter source         0.3.0
Adapter source revision   2750d3cb44f58f3c09198fbfe1585dfb7d9aad48
React Native              0.87.0
Realm                     20.2.0
Network                   Stellar Testnet
```

The 2026-09-16 Native SDK 0.3.1 maintenance is locally validated at implementation commit `e6f4098...` plus deterministic Android smoke carrier `66b41c6...`: full JS/architecture/provenance/locale gates pass at 68/68 suites and 353/353 tests, Realm integration is 28/28, and both iOS and a disposable Android 16 / API 36 AVD return `FRESNICA_PARSE_ACCOUNT_SMOKE_OK` against the 0.3.1 binary + canonical RN adapter. This is dependency/runtime evidence only; it does not promote any Stage 4 product surface by itself.

The follow-up S01 prerequisite at `32c16852...` advances only the canonical RN adapter revision to `c5eae08e...` while keeping Native SDK 0.3.1. `verifyProtectedSignerPassphrase` is present in the required bridge contract and validated on both native platforms for correct/wrong passphrase, signer mismatch and malformed envelope. The frozen Existing-wallet Add Account policy has production Create at `0eb20f7...`, Import mnemonic / Stellar `S...` at `e8405af...`, and HD additional-account at exact code/runtime target `b33baae...`. PR #50 final head `44775245...` passed all four remote gates including the Apple simulator runtime. The merged `main@a2b17eba...` then passed one-wallet Android+iOS aggregate acceptance across Create + Import + HD, default/restart recovery and System Auth registration/repair. S01 is therefore `L3 / L4 partial`. A 2026-09-18 review identified one additional product-semantic gap: generated mnemonic backup used explicit acknowledgement rather than proof-of-backup verification. PR #54 merged the shared in-memory word-position verification hardening at `main@52bd547...`, closing that gap without changing persistence ownership. Remaining S01 L4 work is the repeatable required aggregate gate plus trustworthy dynamic-font and screen-reader focus-order acceptance.

## Capability matrix

| Application Capability | Upstream maturity | Mobile status | Current evidence / scope |
| --- | --- | --- | --- |
| Account | Normative | Create/Import/HD/watch-only and S02 lifecycle implemented; historical L3 / L4 partial | Account ≠ Signer, atomic registration, backup recovery, direct selection/default, rename/sort/hide/restore/delete and zero-visible recovery are production paths. Classic identity follows explicit runtime network context rather than becoming a separate identity per network. Historical aggregate `main@48b77acc...` remains original evidence; current cleanup/input repairs are candidates. |
| Signer | Normative | Protected-software and recovery-management flows implemented | SDK/Core owns protection, reveal and reprotect; Realm stores public identity, opaque envelope and backup metadata. Hardware/external providers and full multisig orchestration remain separate work. |
| Balance / Availability | Normative | Live reads, partitioned display cache and Home/asset surfaces implemented; historical L3 / L4 partial | Exact native/credit balances, native reserve/availability, honest inactive/offline state and Testnet-only Friendbot use authoritative reads. LP shares are separate; fiat estimate covers XLM only. Historical dual-platform aggregate remains `main@ab794fa...`; credit authorization/liability projection is a current repair candidate, not new native evidence. |
| Payment | Normative | G-address Send/CreateAccount, typed memo and shared recovery implemented | Details → Recipient → Summary consumes global Contacts, Request/QR and explicit network/account review. None/Text/ID/Hash/Return stay distinct; M addresses are paused. Each signature requires a fresh App Passphrase under current policy. Historical `main@a921635...` tested the then-current policy; its real-iPhone System Auth cancel/retry gap remains Stage 9 evidence debt. |
| Transaction | Normative | One exact-XDR submission and pending/reconciliation path | Payment, Trustline, Swap, Claimable, offers and LP exit reuse public durable pending metadata, economic-intent duplicate blocking, original network-bound hash reconciliation and read invalidation. Uncertain outcomes never cause automatic resign/rebroadcast; unresolved records do not auto-expire. Original Stage 2.5 native proof applies to its S07/S30 target, not every later consumer. |
| Trustline | Normative | Add/Set Limit/Remove implemented; historical L3 / L4 partial | Canonical limit, issuer/authorization/clawback facts, reserve/fee/liabilities, pool relationships and exact-XDR/pre-sign ledger checks are implemented. Historical aggregate remains `main@0e84fd5...`. Route-account/focus/selection retirement and pre-sign current-session checks are this repair candidate; shared pending recovery is retained. |
| History / Activity | Defined | Pagination, cache/offline, filters/search, details and operation-family projections implemented; native aggregate partial | Horizon remains authoritative. Supported projections now include payments/path payments, offers/pools, claimable/clawback, contract/maintenance and trust/sponsorship families with explicit unsupported shapes. Only verifiable effects supply amounts; cache contains no cursor authority. Historical Android aggregate and iOS helper evidence retain their boundaries; iOS Retry/reconnect product closure is not inferred from helper tests. |
| SDEX | Normative | Order-management product implemented; native acceptance pending | Independent Home order list/create/update/cancel uses effective int32 price, exact liabilities and common review/sign/recovery. Order book/trades/candles remain outside this batch; SDEX is distinct from Path Payment Swap. |
| Liquidity Pool | Normative (upstream 85d6cdf) | Positions/details/exit implemented; native acceptance pending | Live exact/all exit has explicit slippage, canonical A/B minima and optional atomic share-trustline cleanup through shared submission/recovery. Deposit and pool creation remain outside scope. [Behavior](behavior-specs/s12-markets.md). |
| Path Payment / Swap | Shared capability consumed by Mobile | Strict-send/strict-receive quote, review and execution implemented | Home/Actions entry, live Spendable/Max, quote expiry/slippage, exact-XDR review, fresh-passphrase signing and uncertain/recovery exist. The former #134 contract blocker no longer describes current code. Native product aggregate and release evidence remain open. |
| Ledger Authorization | Defined | Current Classic signer/threshold facts checked by write flows | Capability reloads ledger authorization before signing; shared threshold/signature rules remain authoritative. Full multisig/provider coordination is not implied by a single-local-signer path. |
| Signing Coordination | Normative | Shared fresh-passphrase signing; bounded dApp transaction and SEP-53 flows | Every key operation obtains its required fresh App Passphrase; biometric App unlock conveys no signing authority. S18 accepts the supported plain-payment exact-XDR subset, not arbitrary Stellar/Soroban transactions. SEP-53 native reply repair #230 is merged; token/auth-entry requests are still explicitly unsupported. |
| Application Security | Defined | Application lock, biometric App access/fallback, privacy/settings and recovery management implemented | Real locked/unlocked lifecycle and persisted timeout/biometric preferences coexist with fresh signing authorization. Recovery reveal and all-signer staged reprotect/atomic persistence are reachable. Hardware, Realm encryption-key lifecycle and remaining native/device acceptance are separate; no generic-lock upstream blocker remains. |
| Network / Gateway | Defined | Mainnet plus Developer-Mode Testnet/custom node settings; ledger mechanisms implemented | One injected gateway supplies balance/history/account/ledger, path, claimable, offers/pools and submission mechanisms. Friendbot is Testnet Classic-only. Developer Mode uses warning/confirmation, not signer authentication; a network preference never grants signing authority. |
| Persistence | Mobile platform mechanism | Realm schema v14, separate identity/preferences/pending/grants/public caches | Durable entities include Account/Signer/references, preferences, global Contacts, pending submissions, scoped dApp grants/Recent, Balance/History/Claimable and slow-data caches. Chain caches remain replaceable, not current ledger truth. Candidate account cleanup clears address-owned partitions only when no surviving Classic reference owns them, revokes account-ID grants, and retains Contacts; no schema bump is required. Secrets, passphrases and transaction XDR remain excluded from these cache/pending records. |

## Historical implementation and native evidence

The following v1 sections preserve the implementation and acceptance history at their stated revisions. Their old network, signing-policy and UI descriptions are not the current feature index; use the matrix above and the linked current behavior specifications. No historical test count or native result is reassigned to the 2026-11-24 repair branch.

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
- Fresh post-#69 aggregate evidence used one public Testnet fixture source through production `createAppServices`, `StellarSdkGateway`/Horizon, Realm History cache and Activity capabilities. Both platforms loaded a latest page 1 of **20** entries with a fresh opaque cursor, then **5** older entries, covering payment, create-account, change-trust and explicit unsupported. Current-loaded-set filters/search, four-family details/participants, trusted explorer projection plus failure/retry dispatch, cold restart hydration, network/account partition isolation and offline cached list/detail are supported by the recorded evidence without restoring a persisted cursor.
- Android product evidence additionally closes reconnect through the real Activity surface: offline cached Activity exposed localized degraded state/Retry and retained rows, reconnect reloaded page 1 with the fresh cursor, preserved the continuous 25-entry cache tail, advanced last-updated and survived another cold restart with no persisted cursor.
- The iOS evidence boundary is narrower. The first reconnect loaded page 1 at 20 entries but the same-process cache observation was absent; the later deterministic reconnect proved `page1=20`, `cacheWrite=true`, a 25-entry continuous cache, advanced last-updated and cold-restart persistence only through direct production History/Realm helpers. That helper path is diagnostic capability evidence, **not** accepted as an Activity effect/Retry product-flow closure.
- A narrow follow-up attempted to close exactly `offline cached Activity → page Retry → revalidation → cold restart`. The current iOS Hermes runtime reported `typeof Intl.NumberFormat.prototype.formatToParts === "undefined"`, and rendering a real Activity row entered a LogBox `Render Error` at `src/locale/localization.ts:117` before a trustworthy Retry/tap sequence could be completed. No iOS reconnect product evidence is claimed from that run. The localization/runtime compatibility issue must be fixed independently before rerunning only this missing iOS product path.
- The unchanged product tree still passes `npm run check` at **92/92 suites and 528/528 tests**, ESLint **0 errors / 21 existing warnings**, with architecture/alias/provenance/locale gates green; these static/unit/native gates do not substitute for the missing iOS product-path evidence.
- **S13 remains `L3 partial`.** Android aggregate closure and the valid iOS capability/cache evidence are retained, but the maturity promotion is deferred until the iOS Activity render compatibility blocker is independently fixed and the missing offline Retry → reconnect → cold-restart product path is accepted. No History schema/cursor, Payment, Trustline, Signing, Transaction or recovery semantics changed during aggregate work.

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

## Historical Application Security v1 evidence — superseded policy

- query System Auth availability and Protection Domain state;
- initialize/disable the device domain;
- require an explicit S04 product confirmation before invoking disable; Cancel/backdrop/system-back have no Native side effect, and disable failure remains visibly enabled/retryable;
- register/repair protected software signers only with the current app passphrase;
- remove a newly created empty domain if all registrations fail;
- never persist app passphrase, WalletUnlockKey or biometric authorization state.

Signing Coordination policies at that historical revision (superseded by the current S04 policy):

```text
routine
  -> prefer System Auth when signer is enrolled
  -> otherwise require app passphrase fallback

passphrase-required
  -> bypass System Auth
  -> require a fresh app passphrase
```

At that historical revision, `verifyProtectedSignerPassphrase` resolved verification-only passphrase validation while generic app-session unlock remained open. The current application-session implementation now separates OS biometric App access from fresh SDK passphrase key authorization; the old unlock blocker and routine System Auth preference no longer describe current behavior.

## Historical Persistence evidence — Realm v5

The Realm v5 baseline at that time keeps the existing account/signer/locale, `PendingSubmissionEntity` and network-scoped `DefaultAccountPreferenceEntity` invariants, and adds only the replaceable `HistoryCacheSnapshotEntity`. History partitions are keyed by network plus Classic account address and store canonical normalized History DTO JSON, cache schema version and last successful Horizon update time; validated ready details are keyed by operation id inside the same atomic snapshot. The repository deduplicates operation ids, preserves gateway order, trims to the newest 500 entries, drops details outside that retained window, never persists cursors/raw Horizon fields, and clears only a corrupt/incompatible History partition. Existing v2/v3 migration coverage now targets v5, and a direct v4→v5 integration proves Account, Signer, Account-Signer Reference, Locale, DefaultAccountPreference and PendingSubmission survive while History starts empty. Persisted data still does not contain plaintext mnemonic, secret, app passphrase, WalletUnlockKey, biometric auth state or transaction XDR.

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
- current fresh-passphrase signing policy and separate biometric App-access lifecycle;
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
  realm/  durable Realm adapter (current schema v14; historical versions below retain their evidence)
```

Realm and Horizon remain platform choices; they do not redefine Capability semantics.

## Next product milestone

Complete the narrow 2026-11-24 state-contract repairs and their targeted automation/Realm checks, then obtain one independent exact-HEAD Review before the owner decides Merge. [Current progress](fresnica-mobile-current-progress-and-next-plan.md) is the final PR/HEAD/check/review register. This index update does not repeat previously accepted unaffected flows or promote native maturity.

## Remaining implementation and acceptance

- Full Soroban contract-asset balance/transfer/simulation and auth-entry/token request products; arbitrary dApp transaction review beyond the supported plain-payment subset.
- Hardware/external signer providers and full multisig coordination; Agent standing authorization requires its own transaction-specific Core authority contract.
- LP deposit/pool creation, order-book/trade/chart products and full issued-asset fiat valuation.
- Full notification/backend and release work; #228's Android foreground local-notification subset is merged, without implying iOS support or native product acceptance.
- Realm database encryption-key lifecycle; owner-provided legal text/version/acceptance policy, ChangeLog and the remaining support/release loop.
- Repeatable aggregate native/product gates, dynamic-font and screen-reader evidence, historical iOS Activity Retry/reconnect closure, and Stage 9 real-iPhone System Auth cancellation/retry. Existing dated native evidence remains attached to its original SHA.
- M addresses are paused by owner decision; WalletConnect remains disabled and #78 automation remains paused. These are preserved scope decisions, not newly opened work.

## Contribution rule

When Mobile behavior exposes a Fresnica SDK/adapter/documentation inconsistency, classify it explicitly and contribute a concrete reproduction/fix upstream rather than hiding a permanent compatibility patch in Mobile.
