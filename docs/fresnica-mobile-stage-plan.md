# Fresnica Mobile Staged Execution Plan

> Purpose: execution roadmap for the Fresnica Mobile rewrite after the onboarding, persistence, Application Security, Product Shell structure and first Balance slice.
>
> This file is an execution checklist, not a speculative wishlist. Each stage has a concrete goal, prerequisites, implementation scope, acceptance criteria and explicit non-goals. Update status here as work lands.

## Operating rules

- Git/source/tests/CI are truth. Documentation records intent and evidence but does not override code.
- Xaman/Stellar donor code is UX/information-architecture reference only. Fresnica Application Capabilities and SDK/Core remain behavior/security authority.
- One branch / one product goal. Do not mix unrelated fixes into a stage PR.
- Keep Account, Signer, Ledger Authorization, Signing Coordination and Application Security boundaries intact.
- Exact XDR remains the transaction identity from review through signing and submission.
- Never persist app passphrase, mnemonic, raw secret, WalletUnlockKey, decrypted signer material or biometric authorization state in ordinary JS state/Realm.
- Do not emulate missing Core security APIs in JavaScript.
- Agent/AI standing authorization is explicitly deferred until Core exposes transaction-specific authority constraints. See `docs/deferred-agent-authorization.md`.
- GitHub Actions runs that fail before any step executes are external CI gates. Do not weaken checks or claim green.

## Current stack

```text
main
  -> feat/realm-persistence             PR #12
       -> feat/onboarding-flow          PR #13
            -> feat/product-shell       PR #15
                 -> feat/product-shell-navigation  PR #16
                      -> feat/send-product-flow    PR #17
                           -> feat/history-read-flow  PR #18
                                -> current execution stages

parallel security fix:
main -> fix/android-release-signing     PR #14
```

Product Shell/Balance, Send and History now have source-complete stacked PRs. Required GitHub Actions remain externally blocked before workflow steps execute, so no blocked PR is merged while independent rewrite stages continue.

---

## Stage 1 — Runtime Product Shell and Wallet Home

**Status:** SOURCE COMPLETE — PR #16 — CI EXTERNALLY BLOCKED

**Evidence**

- `App.tsx` hands ready wallets to one `ProductRuntime` instead of the legacy terminal `WalletReadyScreen`.
- typed product navigation owns Wallet / Activity / Settings and public account IDs only;
- current-account switching drives Wallet Home and a fresh Balance read;
- Add Account and Security Settings are routed through the same product runtime;
- navigation reducer tests cover tab roots, visible-account cycling, reconciliation and fail-closed unknown actions/accounts;
- Wallet balance loads ignore stale asynchronous responses after account/request changes;
- GitHub Actions CI run #216 failed before checkout with no executed job steps. PR #16 is intentionally unmerged and marked `blocked: required CI execution unavailable`.

**Goal**

Make the formal product structure the actual post-onboarding runtime instead of leaving structural screens disconnected from `App.tsx`.

**Prerequisites**

- Realm onboarding bootstrap exists.
- Product route vocabulary exists.
- Wallet Home Balance Capability exists.

**Implementation scope**

- introduce a small typed application navigation state owned by `src/app/navigation`;
- establish main tabs: Wallet / Activity / Settings;
- route Wallet Home, Accounts/Account Details, Security Settings and Add Account through the shared shell;
- keep sensitive or transaction review state out of route params;
- select the current account deterministically from persisted bootstrap accounts;
- preserve Wallet Home loading / inactive / active / error balance behavior;
- refresh balance when the selected account changes;
- keep Send / Manage Assets destinations present but not falsely claim completion.

**Acceptance criteria**

- post-onboarding app no longer renders the legacy `WalletReadyScreen` as the terminal shell;
- current account switching changes the account shown by Wallet Home and triggers a fresh balance read;
- Wallet / Activity / Settings destinations are reachable through the same typed shell;
- Add Account and Security Settings continue to use existing capability dependencies unchanged;
- no passphrase/mnemonic/XDR is placed in navigation state;
- route/state reducer tests cover valid navigation, account switching and fail-closed unknown routes.

**Non-goals**

- no external navigation dependency unless dependency reproducibility is first solved;
- no Send transaction orchestration;
- no Trustline transaction;
- no Agent authorization.

---

## Stage 2 — Send Product Flow

**Status:** SOURCE COMPLETE — PR #17 — CI EXTERNALLY BLOCKED

**Evidence**

- donor Send step structure was inspected; Fresnica keeps the product rhythm as form -> exact-XDR review -> authorization/submission -> result without copying donor Vault/signing semantics;
- Send validation preserves decimal amounts as strings, enforces at most seven decimal places and signed-int64 stroop bounds, supports Stellar `G...` and muxed `M...` destinations, and enforces the 28-byte UTF-8 text memo limit;
- visible native and issued Balance assets are selectable;
- account signer lookup is an explicit repository operation shared by Memory and Realm implementations, with repository contract coverage;
- Send fails closed for watch-only accounts and for multiple attached signers instead of silently choosing a signer;
- unsigned payment construction goes through the shared `StellarGateway.buildPayment`;
- review is built immediately from the exact unsigned XDR and held as local Feature state rather than navigation parameters;
- Unicode text memo review decodes exact SDK 17 XDR bytes as UTF-8 instead of byte-to-code-unit corruption;
- the submission boundary re-derives `PaymentReview` from exact XDR before checking the account and signing, so mutable JavaScript review fields cannot redirect authorization semantics;
- confirmation reuses existing `submitReviewedPayment`: freshness -> current ledger authorization -> signer resolution -> shared Signing Coordination -> exact signed XDR submission;
- routine signing keeps System Auth first, then asks for the app passphrase only when the shared signing layer returns `passcode-required`;
- app passphrase exists only in local Review state and is cleared before the passphrase-backed submit await;
- result UI preserves submitted / deterministic rejected / uncertain / authorization-blocked / unsupported-signer / watch-only / unsupported-multisig distinctions;
- leaving the result returns to Wallet, remounting Wallet Home and refreshing ledger balance state;
- CI run #217 failed with no executed steps (`steps: null`), so PR #17 remains unmerged and marked `blocked: required CI execution unavailable`.

**Goal**

Deliver the first complete business Feature over the existing Payment / Transaction / Ledger Authorization / Signing Coordination / Gateway foundations.

**Implementation scope**

- donor comparison for destination, asset, amount, memo, review, confirmation and result behavior;
- input validation for Stellar destination and exact decimal amount;
- build unsigned payment through the Payment capability;
- derive review strictly from the exact unsigned XDR;
- render destination, asset, amount, memo, fee and expiry from `PaymentReview`;
- user confirmation -> freshness check -> reload ledger authorization -> resolve signer -> Signing Coordination -> submit exact signed XDR;
- result screen for accepted / deterministic rejected / uncertain;
- refresh Wallet balance after returning from submission;
- keep high-risk authorization policy centralized rather than inside Send UI.

**Acceptance criteria**

- UI cannot alter semantic payment fields after review without rebuilding/re-reviewing XDR;
- submission re-derives semantics from exact XDR instead of trusting caller-supplied review fields;
- normal protected software signer uses System Auth first when enrolled and passphrase fallback otherwise;
- expired reviews never sign;
- deterministic rejection and uncertain transport outcomes remain distinct;
- regression tests prove exact-XDR preservation from review through submission;
- watch-only and unsupported multisig cases fail closed before signing.

**Non-goals**

- no path payment / swap;
- no multi-operation transaction UI;
- no Agent signing.

---

## Stage 3 — Activity / History Read Flow

**Status:** SOURCE COMPLETE — PR #18 — CI EXTERNALLY BLOCKED

**Evidence**

- donor Events/Activity implementation was inspected for account-change reset, loading/refresh/load-more behavior and its presenter boundary; donor cache-gap/backfill complexity is intentionally not copied into v1;
- `StellarGateway` exposes paged account operations instead of leaking Horizon collection objects to Features;
- Horizon reads are fixed to descending order with validated page sizes and paging-token cursors; account 404 remains an explicit inactive state;
- `History` Capability owns a normalized read model independent of Horizon raw JSON;
- v1 specializes `payment` and `create_account` while every other operation type remains an explicit `unsupported` entry instead of being silently dropped;
- malformed specialized operation shapes degrade to `unsupported` entries while invalid common identity/time fields fail closed;
- native and issued payment amounts remain exact strings and issued asset identity keeps code + issuer;
- payment direction distinguishes incoming/outgoing/self/neutral and uses base destination identity while preserving muxed display identity where relevant;
- contract accounts do not inherit Classic Horizon operation-history semantics;
- Activity owns loading / inactive / unsupported-account / error / empty / ready / refreshing / load-more states;
- account/request changes invalidate stale asynchronous History responses;
- pagination appends through `mergeHistoryEntries`, deduplicating operation IDs while preserving order;
- raw operation records, cursors and History entries are not placed in product navigation; operation-details remains reserved for stable `accountId + operationId` addressing;
- CI run #219 failed with no executed steps (`steps: null`), so PR #18 remains unmerged and marked `blocked: required CI execution unavailable`.

**Goal**

Replace Activity placeholders with a read-only Horizon-backed operation history model.

**Implementation scope**

- define a normalized History Capability/read model independent of Horizon raw JSON;
- load operation history for current Classic account;
- normalize supported operation types and preserve unknown operations as explicit unsupported entries rather than silently dropping them;
- add pagination/refresh semantics;
- operation detail route uses stable account + operation identifiers only.

**Acceptance criteria**

- switching accounts invalidates history state;
- network errors and empty history are separate states;
- Horizon objects do not escape into feature UI;
- pagination does not duplicate entries.

**Non-goals**

- no persistent History cache/gap recovery in this first slice;
- no search/filter layer yet;
- no transaction signing from History;
- no Agent authorization.

---

## Stage 4 — Trustline / Manage Assets Flow

**Status:** NEXT

**Goal**

Turn Manage Assets from structure-only into a real Classic trustline product flow.

**Implementation scope**

- donor comparison for asset discovery/add/remove behavior;
- define stable issued-asset identity `CODE:GISSUER`;
- build Change Trust transaction through a dedicated capability boundary;
- exact-XDR review/sign/submit uses the same transaction architecture as Send;
- fail closed on assets or account types the first version cannot safely support.

**Acceptance criteria**

- adding/removing a trustline is impossible without exact-XDR review;
- account/network identity is checked before build and before submit;
- accepted trustline changes refresh Portfolio.

---

## Stage 5 — Swap / SDEX Flow

**Status:** PLANNED

**Goal**

Implement swap only after Balance + Send + Trustline transaction patterns are proven.

**Implementation scope**

- define SDEX quote/read boundary;
- distinguish strict-send / strict-receive semantics explicitly;
- route all signing through shared Signing Coordination;
- preserve review integrity for source asset, destination asset, amount, limits and path;
- compare donor swap UX but do not copy donor authentication behavior.

**Acceptance criteria**

- quote expiration is enforced;
- review cannot be detached from the exact transaction/path being signed;
- biometric/passphrase behavior matches Send through the shared policy layer.

---

## Stage 6 — Security and Account Lifecycle Completion

**Status:** PARTIALLY BLOCKED BY CORE

**Goal**

Complete remaining wallet lifecycle/security surfaces once required upstream APIs exist.

**Work that can proceed independently**

- Reveal/Export product UI using `passphrase-required` authorization;
- explicit destructive-action confirmations;
- secure cleanup/retry orchestration design and tests;
- Realm database-encryption-key lifecycle design.

**Upstream-blocked work**

- app session lock requiring generic existing-domain System Auth challenge;
- existing-wallet protected-signer provisioning requiring safe verification-only current-passphrase API;
- complete product-wide passphrase rotation/recovery if current adapter cannot prove existing passphrase safely.

**Forbidden workaround**

Do not use `reveal`, dummy signing/XDR, `reprotect`, or a second JavaScript KDF/verifier to emulate missing authorization primitives.

---

## Stage 7 — Multisig / External Signer Providers

**Status:** FUTURE

**Goal**

Extend Ledger Authorization and Signing Coordination only after provider contracts are mature.

- support multiple applicable signers/weights and threshold accumulation;
- provider-backed external signer coordination;
- Hash-X / signed-payload support only when provider semantics are explicit;
- preserve preauth/hash/signed-payload identities without pretending they are local Ed25519 signers.

Agent/AI authorization remains outside this stage until Core authority constraints are sufficiently specific.

---

## Stage 8 — Production / Release Hardening

**Status:** PARALLEL TRACK

**Goal**

Make builds reproducible and release-safe before Mainnet.

- resolve Android release-signing strategy without repository debug key fallback (PR #14 already removes the unsafe fallback);
- generate and commit an npm lockfile from a trusted dependency resolution;
- switch CI/native gates from `npm install` to `npm ci`;
- pin CI actions/toolchain references where practical;
- audit platform cleartext/network-security configuration;
- add release artifact verification/signing checks;
- keep Mainnet disabled until product flows and release controls meet acceptance gates.

Do not fabricate a lockfile through manual editing. If dependency resolution cannot be executed reproducibly in the current environment, mark it gated rather than inventing hashes.

---

## Deferred — Agent / AI Standing Authorization

**Status:** DEFERRED BY PRODUCT DECISION

Mobile v1 does not expose or persist the current coarse Core Agent capability. Revisit only after Core adds transaction-specific authority constraints such as destination, asset, amount/value and execution/time bounds, with a stable Mobile-facing API.

When revisited, it must reuse shared Ledger Authorization / Signing Coordination rather than introducing an alternate signing path.

---

## Execution order

```text
1. Runtime Product Shell + Wallet Home        SOURCE COMPLETE / CI BLOCKED
2. Send                                      SOURCE COMPLETE / CI BLOCKED
3. Activity / History                        SOURCE COMPLETE / CI BLOCKED
4. Trustline / Manage Assets                 NEXT
5. Swap / SDEX
6. Security & account lifecycle completion (unblocked subset first)
7. Multisig / external providers
8. Production hardening / Mainnet gate

Parallel whenever independent:
- release-signing and dependency reproducibility
- upstream Core/adapter issue tracking
```

## Definition of done for every stage

A stage is complete only when:

1. donor behavior was inspected where product behavior is being migrated;
2. Capability/platform ownership is explicit;
3. minimal implementation is complete;
4. regression tests cover the critical invariant/failure path;
5. no sensitive state leaks into navigation/persistence/logging;
6. final branch diff contains only stage-related changes;
7. real CI steps are green, or the stage is explicitly marked `blocked: required CI execution unavailable` with no checks weakened;
8. route/capability/handoff documentation is updated to match shipped behavior;
9. the stage PR is not merged while required validation is unavailable.
