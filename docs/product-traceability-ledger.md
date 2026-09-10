# Fresnica Mobile Product Traceability Ledger

> Stage 0 stable product ledger. Source behavior comes from `origin/Stellar@stellar-migration`; security/business semantics come from `origin/fresnica`. Donor implementation is clean-room by default under `docs/provenance/README.md`.

| ID | Product behavior | Target owner | Decision | Provenance path | External/upstream dependency | Current maturity |
| --- | --- | --- | --- | --- | --- | --- |
| S01 | Create/import/watch-only/HD account entry | accounts/onboarding + Account/Signer | Adapt | clean-room | Fresnica recovery/derivation contracts | L3 partial |
| S02 | Account list/select/label/sort/hide | accounts + Account | Adapt | clean-room | persistence lifecycle | L2/L3 partial |
| S03 | Reveal mnemonic/secret/change passphrase | accounts/security + Signer/Backup | Adapt | clean-room | Fresnica reveal/reprotect/System Auth | L1/L2 partial |
| S04 | App lock/auth/security/privacy controls | security + Application Security | Adapt | clean-room / Fresnica security requirement for disable confirmation | generic System Auth challenge still missing | L3 partial/blocker |
| S05 | Home balances/availability/refresh/inactive/Friendbot | home + Balance/Network | Adapt | clean-room | Horizon; Friendbot Testnet only | L3 partial |
| S06 | Asset discovery/details/icons/risk | assets + Asset Discovery | Adapt | clean-room | TOML/catalog authority | L1 partial |
| S07 | Send/CreateAccount + memo families | send + Payment/Transaction | Adapt | clean-room | memo return/muxed require shared contract | L3 partial |
| S08 | M-address/muxed identity | send/request + Destination | Adapt | clean-room | shared destination contract required | L0 blocked |
| S09 | Request/QR/scan/share/deep link | request + Intent/system ports | Adapt | clean-room | SEP-7 + camera/share/deep-link | L0 |
| S10 | Path Payment strict send/receive swap | exchange + Swap/Transaction | Adapt | clean-room | shared Path Payment capability required | L1 mechanism only |
| S11 | Claimable balance list/risk/claim | claimables + capability | Adapt | clean-room | write semantics to define | L0 |
| S12 | Liquidity pool list/details/withdraw | liquidity + pool capability | Adapt | clean-room | shared LP write contract required | L1 read mechanism only |
| S13 | Activity list/filter/search/detail/participants | activity + History | Adapt | clean-room | operation-family projections | L3 partial |
| S14 | dApp catalog/search/category/icons | dapps + Catalog ports | Adapt | clean-room | `dapp.fchain.io` catalog/backend boundaries | L1 scaffold |
| S15 | Recent/disclaimer/custom URL | dapps + preferences | Adapt | clean-room | persistence + origin policy | L1 scaffold |
| S16 | dApp browser/origin/navigation lifecycle | dapps + platform/dapp-browser | Adapt | clean-room | WebView/origin security | L0 |
| S17 | dApp permissions/session/revoke | dapps/security + permission capability | Adapt | clean-room | permission contract/persistence | L0 |
| S18 | Freighter account/network/transaction requests | dapps + Transaction/Signing | Adapt | clean-room | permission + arbitrary reviewed transaction contract | L0 |
| S19 | SEP-53 message signing | dapps + Fresnica native | Adapt | clean-room | Native SDK 0.3.0 bridge available | L2 mechanism |
| S20 | Soroban auth-entry request | dapps + Fresnica native | Adapt | clean-room | RN secure delivery missing | L0 blocked |
| S21 | Browser commands/device/share/data bridge | dapps + controlled platform ports | Adapt | clean-room | per-command contract | L0 |
| S22 | Address book/destination picker | contacts + Contacts capability | Adapt | clean-room | local contacts policy | L0 |
| S23 | General settings/language/display/theme/feedback | settings + Preferences/locale/AppTheme | Adapt | clean-room | final visual/theme persistence | L2/L3 partial |
| S24 | Network list/switch/custom endpoint | settings + Network | Adapt | clean-room | Developer Mode auth/persistence | L1 |
| S25 | Developer settings/session logs/diagnostics | settings + Diagnostics | Adapt | clean-room | user-reachable export/policy | L1/L2 partial |
| S26 | Help/Credits/Terms/ChangeLog/browser | settings/support + system browser | Adapt | clean-room | legal/content inputs | L1 |
| S27 | AppState/privacy/clipboard/camera/files/share permissions | app/platform/system | Adapt | clean-room | OS lifecycle/permission APIs | L1 partial |
| S28 | External/hardware signer provider | accounts/security + external signer | Adapt | clean-room | verified Ledger BLE matrix; Fresnica prepare/apply | L2 seam only |
| S29 | Old Stellar/Xaman data behavior | app/persistence migration guard | Exclude old-data migration; Adapt fresh-start detection | clean-room | final app identity + legacy detection | L0 |
| S30 | Trustline Add/Set Limit/Remove | trustlines + Trustline/Transaction | Adapt | clean-room | Fresnica Trustline contract; current Horizon ledger state; Stage 2.5 recovery pipeline | L3 partial |

## Delivery and acceptance map

This map assigns construction order without reducing final scope. An ID is complete only when its row-specific behavior and the execution-plan Feature Definition of Done both have current evidence.

| Target stage | Trace IDs | Acceptance anchor |
| --- | --- | --- |
| Stage 0 / 0A | S01–S30 | Every implementation PR names IDs; provenance path is recorded; donor-derived behavior has a clean-room behavior specification before code is written. Current target tree passes the fixed donor exact-blob/marker gate, and donor-informed presentation receives a separate human structure review; automated zero-collision is necessary but not sufficient. |
| Stage 2.5 | Current ledger-write IDs S07 and S30; mandatory later for the ledger-write portions of S10–S12 and S18 | **Passed 2026-09-10 for the shared recovery gate.** Pending submission is persisted before broadcast; reconciliation uses the original network-bound transaction hash; unresolved duplicates are blocked by network + account + economic intent with no time expiry. Payment and Trustline prove the shared implementation before another write type is added. |
| Stage 3 | S04, S23, S24, S25, S27 | Shared shell/theme/modal/error/diagnostic/lifecycle carriers exist; a minimal native-flow E2E harness proves they work across feature boundaries. |
| Stage 4 | S01–S08, S13, S30 and the local-wallet portion of S04/S23/S24/S27 | Account lifecycle, Home, Send, Trustline, Activity and core Settings meet their §9 flows, failure states, localization/accessibility and native/E2E evidence. Blocked memo/muxed/security semantics remain explicit, not silently excluded. S30 additionally proves Add/Set Limit/Remove, exact asset identity, pre-sign ledger revalidation and Stage 2.5 recovery. |
| Stage 5 | S09 plus the destination/deep-link portions of S08/S27 | QR, share, SEP-7, paste/scan and deep link converge on one typed parser/router and fail closed on network or asset mismatch. |
| Stage 6 | S10 | Strict-send and strict-receive quote/review/expiry/slippage/submit flows use the shared transaction and recovery pipeline after the upstream capability is authoritative. |
| Stage 7 | S14–S21 | Catalog, browser, origin policy, permissions, Freighter request matrix, SEP-53/Soroban and controlled system bridges are clean-room, revocable, auditable and routed through standard review/sign/submit. |
| Stage 8 | S03, S06, S11–S13, S22–S28 | Remaining asset, claimable, LP, contact, diagnostics, support, platform and external-signer behavior reaches the relevant §7/§9 contract. Hardware support is limited to combinations proven on actual devices. |
| Stage 8B | Backend-dependent portions of S14, S17, S24 and S27 | Versioned backend contracts and threat models exist; unavailable/not-configured/degraded states are honest and do not block unrelated local-wallet capability. |
| Stage 9 | S04, S24, S27, S29 and all release-critical IDs | Android identity is `com.fresnica.wallet`; the new iOS Bundle ID is frozen; legacy data is never silently adopted or erased; release signing, SBOM/provenance and critical native E2E matrix pass. |

## Stage 2.5 recovery evidence

- Evidence head: `5db3610` (includes `043c947`, `3651aa7`, `b035037`, `6e50817`, `8f5bffd` and Horizon transport fix `eaa1e8c`).
- `npm run check`: 55 suites / 278 tests passed; `npm run test:realm`: 17/17; ESLint 0 errors / 29 warnings.
- Android real-Testnet process-death smoke: transaction `f4c319cbe5db754888a419af7311901331ebf1b5a9209d2dd7fff8cd057e1417` persisted uncertain under PID 7631, process was force-stopped, PID 7773 reopened the same Realm and reconciled the same network/account/source/hash to confirmed without signing or broadcasting again.
- Android and iOS current-head native runtime smoke both passed after the NetInfo dependency was integrated; iOS also completed a fresh simulator build.
- This evidence passes the S07/S30 **shared recovery gate only**. The product rows remain `L3 partial` until their Stage 4 user-flow, failure, localization/accessibility and native/E2E acceptance is complete.
- Future ledger-write slices S10–S12 and S18 must consume this recovery path; passing Stage 2.5 is not permission to implement them before their own Stage/Capability gates.

## Current milestone security / release evidence

- S04 `6a19346`: reachable Security Settings now requires an explicit second confirmation before disabling System Auth; cancellation paths do not call Native remove, in-flight confirm is de-duplicated, and Native failure preserves the truthful enabled state. This slice used no donor implementation; provenance is `none / Fresnica security requirement`. S04 is therefore `L3 partial/blocker`, not L4, because app-session unlock and other security/privacy sub-behaviors remain incomplete or upstream-blocked.
- Release-critical S04 `50d8653`: Android release no longer references `signingConfigs.debug`; missing/partial credentials fail closed from the actual release task graph. A temporary local PKCS12 successfully signed `assembleRelease`, and `apksigner` verified `CN=Fresnica Local Release Gate` rather than Android Debug. No production keystore or password was created, persisted or committed.
- Final local milestone validation target `f49dc50`: `npm run check` 56/56 suites and 284/284 tests, `npm run test:realm` 17/17, ESLint 0 errors / 28 warnings, locale dictionaries 98 keys; fixed-commit provenance regeneration had zero ledger drift. Real Android Testnet recovery used exact hash `fc75bde872216a89d8fa867269a7ee2fd40d652d4a93e58f256d7c33c381fecc` across process replacement PID 8360 → 8525, and both Android/iOS standard native gates passed. Remote CI was not yet recorded because the branch remained 11 commits ahead of origin.
- Android Application ID remains `com.fresnica.mobile`, production release credentials are not provisioned, and iOS distribution identity is not frozen. Therefore Stage 9 remains incomplete even though the debug-signing fallback merge blocker is closed.
- After `b5a3be6` was pushed, Stage 0A target-tree audit found 21 exact donor presentation PNG blobs plus donor-port presentation helpers in the rewrite lineage. Direct merge of `rewrite/stellar-source-parity` to `main` is therefore prohibited even after those files are deleted from its tip: the historical blobs would remain reachable through the merge. The approved path is a clean integration branch from `origin/main` carrying only the final remediated tree, followed by full revalidation and a normal `integration → main` merge.
- Remediation evidence: `36d306f` removes the donor presentation trees and converts Shell/Home/Settings to neutral functional presentation; `bd916c5` adds the fixed full-tree collision/marker gate and Fresnica-owned debug key. On the remediated rewrite tip, `npm run check` is 56/56 suites and 284/284 tests, Realm is 17/17, ESLint is 0 errors / 23 warnings, and target-tree collision is 0 unapproved exact blobs with only the pinned RN 0.87 `.xcode.env` exception. These are pre-integration results only.

## Gate rules

- A Feature PR must name at least one stable `Sxx` ID or add a reviewed new ID before implementation.
- `Adopt` never means source-copy permission. Direct migration is separately controlled by `docs/provenance/donor-source-ledger.tsv` and an approval record.
- `Exclude` applies only to the explicitly excluded donor behavior; it does not remove adjacent Fresnica requirements.
- A row reaches L4 only with the execution-plan integration/native/E2E evidence, not by route/file existence.
- New behavior discovered under execution-plan §7, §10 or later audits receives a new stable ID rather than being hidden inside a Stage bullet.
- Stable IDs are append-only. Do not renumber existing rows when a missing behavior is discovered; S30 was added for this reason.
- Evidence must identify the exact commit, platform/device, command or scenario, date and result. A historical green run is not current-head evidence.
