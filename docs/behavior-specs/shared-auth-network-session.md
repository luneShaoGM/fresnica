# Shared authentication and network session foundation

## Authority, scope and provenance

S04/S24/S25; Phase 0 passed and architecture carriers 2a/2b/2c exist. Adapt product roles from Stellar Advanced settings / Network list / Add RPC / current node controls; implement clean-room from this specification, never from donor source structure. SDK/Core owns cryptography; Application Security owns policy; Network capability owns mode/node transitions; app owns immutable service-session composition; Platform owns HTTP and local persistence; settings owns presentation.

This foundation does not implement generic biometric application unlock, new transaction authority, dApp signing or new cryptography. Existing routine/passphrase-required transaction authorization remains authoritative. Strict scope extends to app network-session composition and Network settings.

## Authentication design

| Purpose | Authority | Current boundary |
| --- | --- | --- |
| Routine transaction | Standard review/sign pipeline; enrolled System Auth or existing passphrase fallback | Existing implementation; still bound to exact XDR/account/network |
| High-risk maintenance | Fresh strong App Passphrase under shared Application Security policy | Reuse SDK verification/reveal/reprotect only for their real intended operations |
| Enable Developer Mode | Explicit warning + fresh App Passphrase verified against every local protected software signer | New sensitive-setting orchestration; zero signers fails closed, including watch-only-only and external-only wallets |
| App-session biometric unlock | Generic challenge against existing native protection domain | BLOCKED upstream; availability, registration and dummy signing are not unlock proof |

- Sensitive-setting authorization is operation-scoped: no reusable credential/token or persisted authenticated flag. A persisted Developer Mode preference is product state, not app unlock/signing authorization.
- Capture signer inventory before verification; reject if identity/envelope/revision changes while waiting. Never log or persist the submitted passphrase; UI clears it on submit, cancel, blur/background and unmount.
- Cancellation/background/closed service generation invalidates pending authorization and network probe outcomes. Native verification may finish after cancellation but cannot commit a preference. Wrong credential/native errors leave old preference unchanged; retry requires a new explicit submission. Duplicate operations are rejected while busy.
- Empty/no-protected-signer wallets cannot enable Developer Mode until a supported authentication authority is specified; do not silently accept a zero-target verifier result. Disabling never requires revealing secrets.
- Generic app unlock remains a separate dependency. Do not hold supported sensitive-setting verification hostage to the missing biometric challenge; do not claim this work implements the lock.

## Account/network parity audit status (2026-10-29)

The earlier empty-target-partition presentation below describes the implemented foundation, not an accepted final Stellar wallet experience. The audited target and missing coverage are recorded in the final section, **Account/network cross-cutting re-audit**. Classic wallet visibility must not be equated with whether a per-network local AccountRecord already exists. No runtime/storage/signing changes are made by this audit; existing exact-network authorization checks stay enforced until a coherent replacement is implemented and reviewed.

## Network preferences and bootstrap

- New normal-mode sessions use built-in Stellar Mainnet. New Testnet access and custom HTTPS Horizon endpoints require Developer Mode. Exception: an existing Testnet account partition may be explicitly retained through the built-in Testnet node without enabling Developer Mode; this preserves access rather than granting custom-node or signing authority. Only the frozen Mainnet/Testnet passphrases define network identity; custom endpoint metadata cannot define a new passphrase or account partition.
- Local network preferences contain mode, selected built-in network, selected endpoint per network and saved custom endpoints. No credentials, XDR, health claims or signer material. Malformed persisted state fails closed rather than silently enabling mode or changing identity.
- Preferences use a dedicated additive Realm file alongside the wallet Realm, schema v1. This avoids concurrently changing the dApp wallet-schema migration. Existing accounts/signers/defaults/caches/pending hashes are never migrated/relabelled/copied between networks. Legacy wallets without confirmed network preferences enter an explicit network-choice gate before wallet/deep-link actions. Mode enable alone does not confirm this choice; the unconfirmed preference survives relaunch. Existing Testnet pending recovery blocks choosing another network, while selecting the retained built-in Testnet node can resume it without requiring a protected software signer. Existing pending mnemonic backup is completed against its original account network before entering this gate. After an explicit Mainnet choice, its empty account partition keeps Settings reachable; no old account is relabelled. New wallets default to Mainnet.
- Explicit compatibility option for repository/native helper callers may retain their chosen fixed network. Production App bootstrap uses persisted network settings. Helper overrides must not expose a false production switching claim.

## Node management

- Always retain one immutable built-in endpoint per network. Show current/default status, saved custom nodes, connection health and separate last test results (not active connectivity).
- Add: Developer Mode required; normalize a bounded HTTPS URL with no credentials/query/fragment; reject duplicates; probe with deadline and expected passphrase before saving. Save does not silently select the node.
- Test: one explicit public root check with timeout/cancellation; classify reachable, wrong network and unavailable safely. No account/private data or signed requests.
- Select: explicit confirmation; verify target network/endpoint eligibility and passphrase before committing. Persist atomically before retiring the previous session. Persistence/probe failure leaves the old session/preference authoritative. Offline cannot select an unverified endpoint.
- Delete: explicit confirmation, custom nodes only. Inactive deletion does not rebuild services. Active-node deletion first verifies built-in fallback and commits selection + removal together; failure/cancel keeps the node.
- Disable Developer Mode: explicit confirmation; verify built-in Mainnet, atomically persist Mainnet/default node + mode=false, then retire/rebuild. A failure leaves the prior mode/network authoritative. Custom nodes can remain saved but hidden while disabled.

## Session transition safety

- Freeze network ID/passphrase/endpoint once per AppServices generation; all display, account effects, reconciliation, transaction preparation/submission, Swap routes/preflight and Request gateways derive from the same profile. No per-feature endpoint setters.
- Retire old SDK/gateway leases synchronously on a committed network/active-endpoint change. Reject later method calls and late async results. Do not switch during an in-flight native SDK sensitive operation or active broadcast. Cross-network switches additionally reject unresolved submissions; same-network verified node replacement remains possible for original-hash recovery.
- Pause/cancel setting operations when app leaves foreground. Persisted Developer Mode is not blanket authorization to execute background changes.
- Rebuild service tree and remount navigation on transition. Cancel old read effects/reconciliation/intake resolution; discard old deep links, reviews, quotes, selection stores and permission sessions. Account defaults/cache/recovery remain keyed by their original network/account. No automatic signing or broadcasting.
- Old submitting/uncertain records survive restart; nothing is marked confirmed or discarded merely because an endpoint changes. Recovery uses original network/hash only.

## Acceptance

Automated cases: successful/wrong/zero-signer/cancelled/changed-inventory authorization; persisted state validation/reopen; add/duplicate/wrong-network/timeout/cancel; select failure/atomic persistence; protected default/delete fallback; disable ordering/failure; late old gateway/native results; active signing/broadcast and unresolved cross-network guards; composition profile parity; foreground and navigation remount; original partitions retained.

Native product acceptance is separate: Android/iOS mode enable/cancel/retry, node add/test/select/remove and fallback, relaunch preferences, Testnet→Mainnet→Testnet account isolation, old review/quote cancellation, offline failure, interrupted SDK operation, dynamic font and TalkBack/VoiceOver. Do not submit live Mainnet transactions for this acceptance. No native acceptance or release maturity is implied by helper tests. Stage 9 iOS System Auth cancel/retry remains deferred.

## Implementation verification (2026-10-28)

- `npm run check`: PASS, 162 suites / 1292 tests; lint 0 errors / 31 existing warnings; architecture/alias/provenance/locale/type gates passed. Full log retained locally at `/private/tmp/fresnica-foundation-check.log`.
- Dedicated real Realm integration: 2 tests passed, including close/reopen, original account/network and pending-hash retention, atomic write rollback and corrupt state rejection. Wallet schema is unchanged.
- Android and iOS production JS bundles passed with a temporary Metro config adding the reused external node_modules to watchFolders/nodeModulesPaths and disabling Watchman. This is supplementary shared-dependency tooling, not an unmodified clean-install/native build. Repository Metro config and dependencies are unchanged.
- Network transition also dismisses queued intake and invalidates delayed cold URLs; a new-network warm input remains accepted. No stale request is replayed merely because the new session becomes ready.
- NOT RUN: native builds, emulator/device product taps, fresh native credential/OS cancellation, process-restart product acceptance, accessibility and live Mainnet writes. Independent Work exact-HEAD review and remote CI remain pending at candidate creation.
- Scope limitations: watch-only-only/external-only wallets cannot authenticate Developer Mode with the current supported authority, but their existing Testnet partition is accessible through its retained built-in node; generic biometric app unlock and Session Logs remain unimplemented. PR #123 must be integrated using the selected `networkProfile.id` for its catalog/cache, not the Testnet helper configuration.

## PR #124 P2 correction: retained Testnet access

Review of `41ade33bdb5dbc96e59f50e491d11dfef727e822` found an entry deadlock for existing watch-only/external-only Testnet wallets. Composition now seeds `retainedTestnet` from existing Testnet accounts, including a wallet that previously chose Mainnet. The public preference survives explicit selection/relaunch, so returning to that partition does not depend on creating an unrelated signer. This is an explicit built-in-node retention exception to normal network visibility, not Developer Mode authentication.

The same availability policy controls presentation and Capability selection/testing. No existing Testnet partition means no retention path for a fresh wallet. Mode-off retained access permits only the built-in Testnet URL; saved custom nodes remain hidden/unselectable, add/remove still require mode, and zero-target Developer Mode verification still fails. Existing probe, cancellation, persistence, busy/pending-backup and cross-network recovery guards remain in force. No account/signer/hash migration occurs.

Focused regression coverage includes watch-only/external-only legacy wallets with and without unresolved Testnet transactions; explicit selection and service reopen with mode=false; fresh-wallet visibility; wrong-network rejection; blocked custom-node selection/mutation; and real Realm close/reopen of the retained preference. Native acceptance remains unexecuted. The old NEEDS_FIX review is historical and a new exact-HEAD review is required.

P2 fix verification: `npm run check` passed 162 suites / 1299 tests; focused network/bootstrap/presentation run passed 5 suites / 32 tests; dedicated real Realm integration passed 3 tests. No new native/device acceptance was performed, and the original supplementary JS bundles were not rerun for this fix. New remote HEAD requires independent Work review.

## PR #124 follow-up P2: retention expires with the partition

The account inventory is authoritative for `retainedTestnet` on every service startup. Deleting the last Testnet account retires the current service generation before the deletion flow can expose onboarding. Reopening removes the persisted retention flag. With Developer Mode off and Testnet previously selected, the new session uses the built-in Mainnet profile and requires explicit network confirmation before onboarding/wallet entry. A failed preference write blocks startup rather than exposing the old Testnet profile. Process death between deletion and preference correction is handled by the same startup reconciliation.

A remaining Testnet account preserves retained access, and authenticated Developer Mode continues to allow new Testnet wallets. Existing account deletion still refuses unresolved submissions belonging to that account; unrelated partitions and their pending records are unchanged. An inconsistent legacy state with no Testnet accounts but unresolved Testnet submissions blocks startup rather than silently abandoning recovery or opening Testnet onboarding. No pending records are deleted or rewritten.

Verification: `npm run check` passed 162 suites / 1305 tests, including actual deletion Capability calls through the production composition with mocked storage/SDK, old-session retirement, reopen/relaunch, stale preferences, write failure, remaining-account recovery and Developer Mode cases. These automated tests do not establish native product-flow acceptance; no new native/device or real-Realm run was performed for this correction.

## Account/network cross-cutting re-audit (2026-10-29)

### Evidence and limits

S01/S02/S04/S05/S07/S10/S13/S14–S18/S24/S30. Phase 0 passed; decision Adapt/clean-room. This is a read-only behavior/contract audit, not a schema choice or product acceptance. Fixed Stellar reference `bd0f4540b2496a57314e4e29bc6fcf8ff691b60f`; Fresnica main checked at `f8f4c6ae83867f37b5601ba198540cc587694928`, plus #129 candidate `8b16df1dfd9bb18f93e5fc499c5ac26b3a76a424`. Main now includes #128 browser, #130 protocol and #131 permissions; #129 was developed from older main and must be integrated with the current composition/navigation before further runtime changes. The primary dApp worktree was only inspected and not modified.

Reference paths are evidence locators, not implementation templates. No donor source, tests or resources copied. Account ≠ Signer, SDK/Core crypto authority, network-bound exact XDR and Fresnica pending/recovery rules remain mandatory; legacy XRPL/Xahau pill, regular-key/Vault design and reference-specific service structure are not adoption targets.

| Chain point | Stellar behavior and pinned locator | Fresnica finding / required correction |
| --- | --- | --- |
| Local wallet identity / list | `store/repositories/account.ts:74,221` finds an account by address and lists the retained wallet inventory; `store/models/objects/account.ts:27,46` has address plus a collection of details | `AccountRecord.networkId`, provision duplicate check `(networkId,address)`, Realm identity constraint and navigation filtering currently bind local rows to a network. Reconcile wallet identity with an explicit network-specific view/binding; do not just remove filtering or relabel stored rows |
| Per-network ledger state | `store/models/objects/account.ts:142` selects details by current network; `repositories/account.ts:172` updates details under the same address; details identify address+network | Keep balances, activation, sequence, trustlines, assets/history/cache/recovery and permissions strictly network-scoped, while retaining the Classic wallet address across a switch |
| Refresh after switching | `services/NetworkService.ts:842` changes default/current connection and emits network change; `services/AccountService.ts:143,188,206` retains inventory, stops old monitoring and refreshes/resubscribes on connect | Retain Fresnica immutable session/late-result invalidation and safe native teardown. Rebuild current-network account views and selected identity; an absent target local row must not hide an otherwise retained Classic wallet |
| Loading / inactive / error | `screens/Home/HomeView.tsx:379` waits when no current details/state version; `:388` renders inactive only after state exists; `services/AccountService.ts:714` distinguishes failed reads from account-not-found and updates details for the current network | Existing Horizon 404→inactive read behavior is useful. Preserve unknown/loading, confirmed inactive, active and failed/stale independently; node reachability alone cannot establish activation. Never synthesize inactive from a missing local network row or a timeout |
| Home switch entry | `HomeView.tsx:367`, `Modules/NetworkSwitchButton/NetworkSwitchButton.tsx:187,198` provide a network chooser entry and connection state | Fresnica Home renders NetworkStatus without onPress, so it remains an old disabled placeholder. Wire the chooser to the same Network capability/policy as Settings; keep mode/pending/busy/cancel guards, not a separate feature-specific setter |
| Chooser / default endpoint | `Overlay/SwitchNetwork/SwitchNetworkOverlay.tsx:200,388,416` filters visible networks by mode, selects network and updates default endpoint; reconnects for the active network | Preserve Fresnica verified explicit activation, custom-node trust policy and atomic failure behavior. Settings node list and Home chooser are two entries to one authority |
| Selected wallet and metadata | `store/repositories/core.ts:97` retains selected account separately from selected network; local account has label/hidden/order | Preserve current Classic identity when it remains eligible. Define reconciliation for legacy duplicate addresses, differing labels/hidden flags, last selected identity and defaults; do not silently merge or discard records |
| Signing / write consumers | Stellar's visible wallet is not proof of a signing right | Fresnica payment/trustline/path-payment/Swap checks use account.networkId, while main `createDappTransactionSigner.ts:13` also checks account/network/address. Supply a coherent target-network binding under Application authority; retain all exact-XDR/network/Signer checks, epoch cancellation, permissions and unresolved-original-hash recovery |
| Lifecycle / legacy access | Reference keeps wallet inventory across networks; this does not define Fresnica signer cleanup or pending-record semantics | `deleteLocalAccount` currently scopes pending/cache cleanup to the stored account network and Realm deletes orphan signers by references. Define wallet removal vs per-network view removal, all-network pending protection, reference counts and legacy record-ID compatibility. Retained Testnet access must use genuine legacy access evidence, not infer permission from a newly global wallet list |

### Why the first pass missed this

- The foundation audited Advanced/Network/Add controls and reused the existing network-scoped AccountRecord as a fixed assumption. It did not trace Account model/repository → AccountService → Home state/selection → switch entry.
- The contract promoted that assumption into a product expectation: an empty target partition should show Settings. Automated cases and native runs then checked the same expectation. The later empty-tab fix repairs navigation under that model but does not establish wallet/address continuity parity.
- Exact-HEAD safety reviews and passing tests cover their stated scope. They do not certify untested product parity; no blame or additional approval authority is transferred to reviewers.

### Audited target and exit cases

For an existing visible **Classic G-address** wallet, explicit Mainnet↔Testnet selection retains the local wallet/address and queries that identity on the chosen network. A confirmed absent account shows inactive; missing current results show loading/unknown; network failures retain honest target-scoped freshness/error. Switching back restores that network's real cached/revalidated state. No repeated secret import, new protected signer or copied secret is required merely to view another network. This target must not be generalized to deployed C-address contracts, hardware/external authority or changed on-ledger signer/threshold relationships.

Required matrix before product closure:

- Same G identity: active A/inactive B; active both with different balances/sequences/trustlines; target 404 vs timeout/offline; cached vs never-read target; switch back and process restart.
- Lifecycle: multiple wallets/selection; hidden/all-hidden; watch-only; protected and unsupported external/hardware; legacy duplicate same-address rows with different metadata/signers; failed/rolled-back migration; delete with pending records or shared signer references.
- Entries/state: Home chooser and Settings use the same capability, mode visibility and pending/busy guards; cancel/error leaves old selection authoritative; mode disable returns verified Mainnet without losing identity; no stale late result or invisible navigation.
- Consumers: Send, Trustline, Swap quote/review/submit/uncertain recovery, Request/deep link, Effects/history/cache and new main dApp permissions/signing keep current network/account/intent binding. Changing view network must never reinterpret an old pending XDR, grant or original hash.
- Automated/real-Realm checks for any identity/binding/migration change, then Android/iOS product paths. Hardware/external and Stage 9 real-device gaps remain explicit; no current simulator evidence is upgraded to full acceptance.

### Execution within the existing queue

Continue original task 3, not a new numbered roadmap: (1) integrate #129 with latest main; (2) settle Application-owned wallet identity ↔ network-view binding and legacy migration/metadata policy, retaining Core/SDK and signer lifetime contracts; (3) implement wallet continuity + target activation reads + both switch entries as one complete product flow; (4) validate affected consumers and actual native matrix; (5) new exact-HEAD independent review before any user-decided merge. The storage/binding mechanism is deliberately not chosen by this audit. Do not start by removing network guards, auto-cloning account/signer rows, deduplicating protected envelopes by address alone, or reworking unrelated Swap/dApp features.
