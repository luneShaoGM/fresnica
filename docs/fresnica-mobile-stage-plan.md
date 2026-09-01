# Fresnica Mobile Staged Execution Plan

> Purpose: execution roadmap for the Fresnica Mobile rewrite. Git/source/tests/CI are the source of truth.

## Operating rules

- Xaman/Stellar donor code is UX/information-architecture reference only. Fresnica Application Capabilities and SDK/Core remain behavior/security authority.
- One branch / one product goal. Do not mix unrelated fixes into a stage PR.
- Keep Account, Signer, Ledger Authorization, Signing Coordination and Application Security boundaries intact.
- Exact XDR remains transaction identity from review through signing and submission.
- Never persist app passphrase, mnemonic, raw secret, WalletUnlockKey, decrypted signer material or biometric authorization state in ordinary JS state/Realm.
- Do not emulate missing Core security APIs in JavaScript.
- Do not treat SDK operation availability as an implicit Application Capability contract.
- Agent/AI standing authorization remains deferred until Core exposes transaction-specific authority constraints.
- Required CI must execute real steps before merge. `runner_id=0` / `steps:null` is an external gate, not a code-test result.

## Current stack

```text
main
  -> feat/realm-persistence                    PR #12
       -> feat/onboarding-flow                 PR #13
            -> feat/product-shell              PR #15
                 -> feat/product-shell-navigation PR #16
                      -> feat/send-product-flow PR #17
                           -> feat/history-read-flow PR #18
                                -> feat/trustline-flow PR #19
                                     + native recovery PR #22 merged into branch
                                       (includes Android compatibility from #20)

feat/trustline-flow
  -> feat/payment-conformance-rebaseline       PR #21
       |- feat/path-payment-platform-mechanisms PR #23
       `- feat/recovery-export-flow             PR #24

parallel security hardening:
main -> fix/android-release-signing             PR #14
```

The exact combined native-recovery head from PR #22 executed and passed CI, Realm Integration, Native Android Gate and Native Apple Gate before it was merged into `feat/trustline-flow` as `8741beb4...`. Subsequent current-head runs on #19/#21/#23 have intermittently failed before checkout because GitHub allocated no runner. Those attempts must not be relabeled as code failures or as green validation.

---

## Stage 1 — Runtime Product Shell and Wallet Home

**Status:** SOURCE COMPLETE — PR #16 — VALIDATED IN COMBINED NATIVE STACK

Delivered:

- one post-onboarding `ProductRuntime`;
- typed Wallet / Activity / Settings roots;
- navigation carries public account identity only;
- account switching refreshes Balance and ignores stale requests;
- Add Account and Security Settings share the same runtime shell.

---

## Stage 2 — Send Product Flow / Payment Conformance

**Status:** IMPLEMENTED — PR #17 — CURRENT NORMATIVE REBASELINE IN PR #21

PR #21 supersedes older Payment assumptions from PR #17 with the current upstream Normative contract.

Current semantics:

- Classic `G...` destination scope; muxed `M...` is rejected unless the shared contract explicitly expands;
- exact positive seven-decimal amounts without JavaScript floating point;
- exact text memo preservation with 28 UTF-8 byte bound;
- current source/destination account state plus ledger fee/reserve preflight;
- missing destination + XLM -> exact `CreateAccount`; missing destination + issued asset -> reject;
- current two-base-reserve minimum for CreateAccount;
- native availability accounts for minimum balance, selling liabilities and fee;
- issued source/destination trustline authorization and capacity checks with issuer special cases;
- SEP-29 `config.memo_required=1` enforcement;
- review derives actual `Payment` vs `CreateAccount` from exact XDR;
- source/destination/operation/amount/asset/memo/fee are bound to exact reviewed XDR;
- freshness -> ledger authorization -> signer resolution -> Signing Coordination -> exact signed-XDR submission;
- routine System Auth first, fresh app-passphrase fallback only when required;
- submitted / rejected / uncertain / authorization-blocked / watch-only / unsupported-multisig remain distinct.

Validation evidence:

- PR #21 normal CI and Realm Integration passed on its pre-native-integration implementation head;
- current-base reruns are presently subject to intermittent runner-allocation failure.

---

## Stage 3 — Activity / History Read Flow

**Status:** SOURCE COMPLETE — PR #18 — VALIDATED IN COMBINED NATIVE STACK

Delivered:

- descending Horizon account-operation pagination behind `StellarGateway`;
- normalized History model independent of raw Horizon JSON;
- Payment/CreateAccount specialized entries;
- unsupported/malformed operations remain explicit rather than disappearing;
- exact amount/issued-asset identity preservation;
- loading/inactive/error/empty/refresh/load-more states;
- stable deduplication and stale-request protection;
- raw Horizon records/cursors never enter navigation.

---

## Stage 4 — Trustline / Manage Assets

**Status:** SOURCE COMPLETE — PR #19 — NATIVE RECOVERY INTEGRATED; CURRENT-HEAD RUNNER BLOCKED

Delivered:

- exact case-sensitive ordinary asset identity `CODE:GISSUER`;
- Add/Remove flow using canonical Fresnica limit `708269837873.6765`;
- issuer existence/self-trust/state checks;
- reserve + fee + liability preflight;
- Remove requires zero balance/buying liabilities/selling liabilities;
- liquidity-pool relationship protection;
- orphaned issuer removal support;
- exact ChangeTrust XDR review and semantic re-derivation before submit;
- shared reviewed-transaction submission with Payment;
- System Auth/passphrase behavior shared through Signing Coordination;
- watch-only and unsupported multiple-local-signer configurations fail closed.

Native recovery evidence:

- Android checkout-only compatibility tracks upstream #128/#129 and keeps canonical adapter build/manifest/AAR/app-link checks;
- Apple runtime-smoke sequencing keeps the original timeout and real Realm + `FresnicaCore.parseAccount` assertions;
- PR #22 exact head passed all four executable gates together before merge.

---

## Stage 5A — Path Payment Swap

**Status:** PRODUCT SEMANTICS BLOCKED ON UPSTREAM Fresnica/fresnica#134; PLATFORM MECHANISMS SOURCE-COMPLETE IN PR #23

Boundary decision:

- donor Swap uses immediate routed `PathPaymentStrictSend` / `PathPaymentStrictReceive`;
- current Normative SDEX describes `ManageSellOffer` / `ManageBuyOffer`, order books, offers and fills;
- Mobile must not use SDEX offer semantics as an implicit Swap contract.

Upstream #134 requests shared strict-send/strict-receive, quote/path identity/freshness, slippage protection, trustline/capacity, review and conformance semantics.

PR #23 deliberately implements platform mechanisms only:

- independent `StellarPathPaymentGateway`;
- Horizon strict-send/strict-receive route transport with provider order and exact amount strings preserved;
- exact case-sensitive path asset normalization;
- caller-driven unsigned StrictSend/StrictReceive XDR builders with explicit path, protection amount, fee and timeout;
- no route ranking, slippage calculation, quote TTL, requote policy, trustline policy or product UI.

Once #134 lands, the product Capability must bind source/destination assets, path, protection amount, fee/network and time bounds to exact reviewed XDR and reuse shared Transaction + Signing Coordination. No Swap-specific authentication path is allowed.

---

## Stage 5B — SDEX Offer Management

**Status:** NORMATIVE CONTRACT AVAILABLE — SEPARATE PRODUCT STAGE

When prioritized, implement `ManageSellOffer` / `ManageBuyOffer` create/update/cancel and market/account reads using upstream exact `n/d` price, liability, reserve, authorization and review semantics. Keep this separate from immediate Path Payment Swap.

---

## Stage 6 — Security and Account Lifecycle Completion

**Status:** RECOVERY EXPORT SOURCE-COMPLETE IN PR #24; REMAINDER PARTIALLY CORE-BLOCKED

### Recovery Export — PR #24

Implemented:

- only exactly one complete `protected-software` signer may expose export;
- watch-only, hardware/external, incomplete and multiple-signer configurations are unavailable/fail closed;
- Fresnica Core `reveal` receives the stored envelope, a fresh app passphrase and expected signer public key;
- returned recovery material kind must match persisted recovery kind;
- high-assurance export deliberately does not substitute System Auth/biometrics for the fresh passphrase;
- Account Details exposes export only when eligible;
- navigation carries only public `accountId`;
- passphrase state is cleared before awaiting Core reveal;
- revealed mnemonic/secret stays screen-local and is explicitly cleared by Hide/Done;
- mnemonic passphrase/language/index are preserved when Core returns them;
- no automatic clipboard copy, persistence or logging of recovery material.

Regression scope:

- single protected signer eligibility;
- watch-only / multiple / hardware-external fail-closed gates;
- exact fresh-passphrase + expected-public-key Core reveal call;
- recovery-kind mismatch rejection;
- public-account-only navigation and unknown-account rejection.

### Can proceed independently later

- explicit destructive-action confirmations;
- secure cleanup/retry orchestration design and tests;
- Realm database-encryption-key lifecycle design.

### Blocked on upstream authorization primitives

- app session lock requiring a generic existing-domain System Auth challenge;
- existing-wallet protected-signer provisioning requiring framework-safe current-passphrase verification;
- complete wallet-wide passphrase rotation/recovery where current adapter cannot safely prove the existing passphrase.

**Forbidden workaround:** do not use `reveal`, dummy XDR/signing, `reprotect`, or a second JavaScript KDF/verifier to emulate those missing authorization primitives.

---

## Stage 7 — Multisig / External Signer Providers

**Status:** FUTURE

- multiple applicable signers/weights and threshold accumulation;
- external/provider signer coordination;
- Hash-X / signed-payload only when provider semantics are explicit;
- preserve non-Ed25519 identity without pretending it is a local Ed25519 signer.

Agent/AI authorization remains outside this stage until Core authority constraints become transaction-specific.

---

## Stage 8 — Production / Release Hardening

**Status:** PARALLEL TRACK

- Android release signing must never fall back to repository debug key (PR #14);
- reproducible npm dependency resolution / lockfile provenance;
- pin CI actions/toolchain references where practical;
- audit cleartext/network-security configuration;
- release artifact verification/signing checks;
- keep Mainnet disabled until product and release gates pass.

---

## Deferred — Agent / AI Standing Authorization

**Status:** DEFERRED BY PRODUCT DECISION

Do not expose/persist the current coarse Core Agent capability. Revisit only after transaction-specific destination/asset/amount/value/execution/time constraints exist through a stable Mobile-facing API, and reuse Ledger Authorization / Signing Coordination rather than creating an alternate signing path.

---

## Execution order

```text
1.  Runtime Product Shell + Wallet Home       SOURCE COMPLETE / COMBINED-STACK VALIDATED
2.  Send / Payment conformance                PR #21 / CURRENT RUNNER INTERMITTENT
3.  Activity / History                        SOURCE COMPLETE / COMBINED-STACK VALIDATED
4.  Trustline / Manage Assets                 SOURCE COMPLETE / CURRENT-HEAD RUNNER BLOCKED
5A. Path Payment platform mechanisms          PR #23 SOURCE COMPLETE / RUNNER BLOCKED
5A. Path Payment product semantics             BLOCKED ON UPSTREAM #134
5B. SDEX Offer Management                     SEPARATE / NORMATIVE READY
6.  Recovery Export                           PR #24 SOURCE COMPLETE / VALIDATION PENDING
6.  Other security/account lifecycle          PARTIALLY CORE-BLOCKED
7.  Multisig / external providers             FUTURE
8.  Production hardening / Mainnet gate       PARALLEL
```

## Definition of done for every stage

A stage is complete only when:

1. donor behavior was inspected where product behavior is migrated;
2. Capability/platform ownership is explicit;
3. minimal implementation is complete;
4. regression tests cover critical invariants/failure paths;
5. no sensitive state leaks into navigation/persistence/logging;
6. final branch diff contains only stage-related changes;
7. real CI steps are green, or the stage is explicitly marked externally blocked without weakening checks;
8. capability/status/handoff documentation matches implemented behavior;
9. the stage PR is not merged while required executable validation is unavailable.
