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

## Network preferences and bootstrap

- New normal-mode sessions use built-in Stellar Mainnet. Testnet/custom HTTPS Horizon endpoints are visible/usable only with Developer Mode enabled. Only the frozen Mainnet/Testnet passphrases define network identity; custom endpoint metadata cannot define a new passphrase or account partition.
- Local network preferences contain mode, selected built-in network, selected endpoint per network and saved custom endpoints. No credentials, XDR, health claims or signer material. Malformed persisted state fails closed rather than silently enabling mode or changing identity.
- Preferences use a dedicated additive Realm file alongside the wallet Realm, schema v1. This avoids concurrently changing the dApp wallet-schema migration. Existing accounts/signers/defaults/caches/pending hashes are never migrated/relabelled/copied between networks. Legacy wallets without confirmed network preferences enter an explicit network-choice gate before wallet/deep-link actions. Mode enable alone does not confirm this choice; the unconfirmed preference survives relaunch. Existing Testnet pending recovery blocks choosing another network, while authenticated Testnet selection can resume it. Existing pending mnemonic backup is completed against its original account network before entering this gate. After an explicit Mainnet choice, its empty account partition keeps Settings reachable; no old account is relabelled. New wallets default to Mainnet.
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
- Scope limitations: watch-only-only/external-only wallets cannot authenticate Developer Mode with the current supported authority; generic biometric app unlock and Session Logs remain unimplemented. PR #123 must be integrated using the selected `networkProfile.id` for its catalog/cache, not the Testnet helper configuration.
