# Fresnica Mobile Staged Execution Plan

> Purpose: execution roadmap for the Fresnica Mobile rewrite. This is an execution checklist, not a speculative wishlist. Git/source/tests/CI remain the source of truth.

## Operating rules

- Xaman/Stellar donor code is UX/information-architecture reference only. Fresnica Application Capabilities and SDK/Core remain behavior/security authority.
- One branch / one product goal. Do not mix unrelated fixes into a stage PR.
- Keep Account, Signer, Ledger Authorization, Signing Coordination and Application Security boundaries intact.
- Exact XDR remains the transaction identity from review through signing and submission.
- Never persist app passphrase, mnemonic, raw secret, WalletUnlockKey, decrypted signer material or biometric authorization state in ordinary JS state/Realm.
- Do not emulate missing Core security APIs in JavaScript.
- Agent/AI standing authorization is deferred until Core exposes transaction-specific authority constraints. See `docs/deferred-agent-authorization.md`.
- Required CI must execute real steps before merge. A workflow failure before checkout is an external gate, not a code result.
- Do not treat SDK operation availability as an implicit Application Capability contract.

## Current stack

```text
main
  -> feat/realm-persistence             PR #12
       -> feat/onboarding-flow          PR #13
            -> feat/product-shell       PR #15
                 -> feat/product-shell-navigation  PR #16
                      -> feat/send-product-flow    PR #17
                           -> feat/history-read-flow  PR #18
                                -> feat/trustline-flow  PR #19
                                     + native gate recovery PR #22
                                       (includes Android compatibility commits from PR #20)

payment conformance rebaseline:
feat/trustline-flow
  -> feat/payment-conformance-rebaseline       PR #21

parallel security fix:
main -> fix/android-release-signing             PR #14
```

Stages 1-4 are source-complete. PR #22's exact combined native-recovery head executed and passed normal CI, Realm Integration, Native Android Gate and Native Apple Gate, then was merged into `feat/trustline-flow` as merge commit `8741beb4...`. PR #20's Android commits are preserved in that history and GitHub marked #20 merged when they entered the base through #22.

PR #19's first post-integration runs, and an immediate retry of its core CI, failed before any workflow step executed (`steps:null`), so Stage 4 remains externally blocked on runner allocation rather than being relabeled green without a real current-head run.

Payment was re-audited against the newer upstream Normative contract in PR #21. Its Payment implementation, normal CI and Realm Integration have already passed on the pre-native-integration head. This documentation correction intentionally creates a new PR #21 head so GitHub can validate the current Payment changes against the updated Trustline/native base.

---

## Stage 1 — Runtime Product Shell and Wallet Home

**Status:** SOURCE COMPLETE — PR #16 — VALIDATED IN COMBINED NATIVE STACK

**Delivered**

- `App.tsx` enters one `ProductRuntime` after onboarding;
- Wallet / Activity / Settings share typed navigation;
- navigation carries public account IDs only;
- account switching drives Wallet Home and a fresh Balance read;
- Add Account and Security Settings use the same product runtime;
- stale balance requests are ignored after account changes.

**Acceptance**

- ready wallets no longer terminate at the legacy placeholder shell;
- selected-account changes refresh the displayed ledger balance;
- no mnemonic/passphrase/XDR enters navigation state.

---

## Stage 2 — Send Product Flow / Payment Conformance

**Status:** IMPLEMENTED — PR #17 — CURRENT NORMATIVE REBASELINE IN PR #21

PR #17 established the first Send product flow. PR #21 supersedes its older Payment assumptions with the current upstream Normative contract.

**Current delivered semantics**

- form -> exact-XDR review -> authorization/submission -> result;
- native and issued Balance assets;
- current destination scope is Classic `G...`; muxed `M...` is rejected unless the shared contract is deliberately expanded;
- exact positive seven-decimal amount semantics without JavaScript floating point;
- text memo is limited to 28 UTF-8 bytes and preserved exactly rather than trimmed;
- source/destination account state and current ledger base fee/reserve are loaded during preparation;
- missing destination + XLM prepares exact `CreateAccount`; missing destination + issued asset fails closed;
- CreateAccount starting balance must satisfy the current two-base-reserve minimum;
- source native availability accounts for protocol minimum balance, selling liabilities and fee;
- source issued payments require the exact trustline, full authorization and available balance unless the source is the issuer;
- destination issued payments require the exact trustline, full authorization and receiving capacity unless the destination is the issuer;
- SEP-29 `config.memo_required=1` is enforced before XDR construction;
- `PaymentReview` exposes the actual `Payment` vs `CreateAccount` operation derived from exact XDR;
- preparation and submission bind source, destination, operation, amount, asset, memo and fee to the exact reviewed XDR;
- freshness -> current ledger authorization -> signer resolution -> shared Signing Coordination -> exact signed XDR submission;
- System Auth first, app-passphrase fallback only when required;
- submitted / rejected / uncertain / authorization-blocked / watch-only / unsupported-multisig remain distinct.

**Validation**

- PR #21 normal CI: green on the pre-native-integration head;
- PR #21 Realm Integration: green on the pre-native-integration head;
- current-base full revalidation: triggered by the latest documentation/head update; runner execution remains authoritative.

**Non-goals**

- no path payment / swap;
- no multi-operation transaction UI beyond exact CreateAccount-vs-Payment selection;
- no Agent signing.

---

## Stage 3 — Activity / History Read Flow

**Status:** SOURCE COMPLETE — PR #18 — VALIDATED IN COMBINED NATIVE STACK

**Delivered**

- paged descending Horizon account operations behind `StellarGateway`;
- normalized History model independent of raw Horizon JSON;
- payment and create-account specialized entries;
- unknown/malformed specialized operations remain explicit unsupported entries;
- exact amount strings and full issued-asset identity;
- loading / inactive / unsupported account / error / empty / refresh / load-more states;
- pagination deduplication by stable operation ID;
- stale account/request results ignored;
- raw Horizon records and cursors never enter product navigation.

**Non-goals**

- no persistent History cache/gap recovery;
- no search/filter layer yet;
- no transaction actions from History.

---

## Stage 4 — Trustline / Manage Assets Flow

**Status:** SOURCE COMPLETE — PR #19 — NATIVE RECOVERY INTEGRATED; CURRENT-HEAD CI EXTERNALLY BLOCKED

**Normative source**

Upstream Fresnica Trustline is Normative. Mobile follows the shared semantic contract instead of treating Stellar SDK `Operation.changeTrust` as the product contract.

**Delivered**

- stable ordinary issued-asset identity `CODE:GISSUER`; asset code case is preserved exactly;
- Add / Remove product flow for Classic accounts;
- Add uses Fresnica canonical default limit `708269837873.6765`;
- Add rejects existing trustlines, inactive issuers and issuer self-trust;
- Add preflights current XLM against minimum balance, selling liabilities, one additional base reserve and transaction fee;
- issuer `AUTH_REQUIRED` and clawback flags are surfaced as expected initial state in review, then ledger state is expected to refresh after confirmation;
- Remove requires an existing trustline and rejects non-zero balance, buying liabilities or selling liabilities;
- Remove checks held liquidity-pool shares and blocks removal when a referenced pool uses the asset;
- Remove does not require an orphaned/deleted issuer to exist;
- platform layer exposes account ledger facts, ledger reserve/fee parameters, liquidity-pool reserves and ChangeTrust construction without owning Capability policy;
- every review is reconstructed from exact unsigned ChangeTrust XDR and rejects operation-source override;
- submission re-derives Trustline semantics from the exact XDR before account/signer checks;
- Payment and Trustline share one transaction submission pipeline: freshness -> current ledger authorization -> threshold resolution -> Signing Coordination -> exact signed XDR submit;
- Manage Assets lists current ordinary issued trustlines, supports manual code+issuer Add and review/remove of existing issued assets;
- routine authorization uses System Auth first and app-passphrase fallback;
- submitted / rejected / uncertain / authorization-blocked / unsupported-signer / watch-only / unsupported-multisig remain distinct;
- returning to Wallet remounts Portfolio and refreshes ledger balances.

**Native validation**

- the Android adapter compatibility work tracks upstream #128/#129 and remains checkout-only/fail-closed;
- the Apple runtime-smoke sequencing fix preserves the existing timeout and real Realm + `FresnicaCore.parseAccount` assertions;
- PR #22 exact head passed CI, Realm Integration, Native Android and Native Apple together before merge into `feat/trustline-flow`;
- PR #19 current head is `8741beb4...`; its post-integration workflows currently fail before steps because a runner is not allocated, so the PR remains open until a real current-head run executes.

**Non-goals**

- no Set Limit product UI in v1;
- no Asset Discovery/catalog/ranking integration yet;
- no liquidity-pool-share ChangeTrust product support;
- no multisig coordination;
- no Agent authorization.

---

## Stage 5A — Path Payment Swap

**Status:** BLOCKED ON SHARED CAPABILITY CONTRACT — UPSTREAM Fresnica/fresnica#134

**Boundary decision**

The donor Swap flow uses immediate routed exchange through `PathPaymentStrictSend` / `PathPaymentStrictReceive`. The current upstream Normative `SDEX` Capability instead defines `ManageSellOffer` / `ManageBuyOffer`, order books, offers and fills. Mobile must not use SDEX offer semantics as an implicit Swap contract.

Upstream issue #134 requests a dedicated Path Payment / Swap Application Capability (or an explicit shared extension) covering strict-send/strict-receive intent, quote/path identity, freshness, slippage protection, trustline/capacity rules, exact review and conformance vectors.

**Safe work before the contract lands**

- inspect donor Swap UX and quote/confirmation rhythm;
- keep Horizon/Stellar transport research at the platform-mechanism level only;
- reuse existing exact-asset identity, current ledger facts, Transaction and Signing Coordination concepts;
- do not ship Mobile-only authoritative quote/slippage/path-payment policy.

**Required implementation semantics once shared**

- distinguish strict-send / strict-receive explicitly;
- preserve full source/destination asset identity and exact decimal amounts;
- bind source asset, destination asset, path, protection amount, fee/network and time bounds to exact reviewed XDR;
- enforce quote/path freshness immediately before signing;
- reuse shared Transaction submission and Signing Coordination;
- keep System Auth/passphrase behavior identical in policy to Send/Trustline;
- fail closed on unsupported route/account/trustline/capacity conditions.

**Acceptance criteria**

- quote expiration is enforced before signing;
- UI cannot detach review from the exact path/transaction being signed;
- deterministic rejection and uncertain submission remain distinct;
- no Swap-specific authentication path exists.

---

## Stage 5B — SDEX Offer Management

**Status:** NORMATIVE CONTRACT AVAILABLE — SEPARATE PRODUCT STAGE

Upstream `SDEX` is already Normative for pair-relative market reads and offer writes. It is not a substitute for Path Payment Swap.

When prioritized, this stage should implement `ManageSellOffer` / `ManageBuyOffer` create/update/cancel and market/account reads using the upstream exact `n/d` price, liability, reserve, authorization and review semantics. It must remain a separate product surface from immediate Swap.

---

## Stage 6 — Security and Account Lifecycle Completion

**Status:** PARTIALLY BLOCKED BY CORE; INDEPENDENT WORK MAY PROCEED WHILE STAGE 5A WAITS

**Can proceed independently**

- Reveal/Export product UI using `passphrase-required`;
- explicit destructive-action confirmations;
- secure cleanup/retry orchestration design and tests;
- Realm database-encryption-key lifecycle design.

**Blocked on upstream authorization primitives**

- app session lock requiring generic existing-domain System Auth challenge;
- existing-wallet protected-signer provisioning requiring framework-safe current-passphrase verification;
- complete wallet-wide passphrase rotation/recovery where current adapter cannot safely prove the existing passphrase.

**Forbidden workaround**

Do not use `reveal`, dummy XDR/signing, `reprotect`, or a second JavaScript KDF/verifier to emulate missing authorization primitives.

---

## Stage 7 — Multisig / External Signer Providers

**Status:** FUTURE

- multiple applicable signers/weights and threshold accumulation;
- external/provider signer coordination;
- Hash-X / signed-payload support only when provider semantics are explicit;
- preserve non-Ed25519 signer identities without pretending they are local Ed25519 signers.

Agent/AI authorization remains outside this stage until Core authority constraints become transaction-specific.

---

## Stage 8 — Production / Release Hardening

**Status:** PARALLEL TRACK

- Android release-signing strategy with no debug-key fallback (PR #14);
- reproducible npm dependency resolution and committed lockfile;
- CI/native gates use `npm ci` once lockfile provenance is trusted;
- pin CI actions/toolchain references where practical;
- audit cleartext/network-security configuration;
- release artifact verification/signing checks;
- keep Mainnet disabled until product and release gates pass.

Do not fabricate a lockfile or dependency hashes manually.

---

## Deferred — Agent / AI Standing Authorization

**Status:** DEFERRED BY PRODUCT DECISION

Mobile v1 does not expose or persist the current coarse Core Agent capability. Revisit only after Core adds transaction-specific authority constraints such as destination, asset, amount/value and execution/time bounds through a stable Mobile-facing API.

When revisited, it must reuse shared Ledger Authorization / Signing Coordination rather than introducing an alternate signing path.

---

## Execution order

```text
1. Runtime Product Shell + Wallet Home        SOURCE COMPLETE / VALIDATED IN COMBINED STACK
2. Send / Payment conformance                 PR #21 CURRENT-BASE REVALIDATION TRIGGERED
3. Activity / History                         SOURCE COMPLETE / VALIDATED IN COMBINED STACK
4. Trustline / Manage Assets                  SOURCE COMPLETE / CURRENT-HEAD RUNNER BLOCKED
5A. Path Payment Swap                         BLOCKED ON UPSTREAM CAPABILITY #134
5B. SDEX Offer Management                     SEPARATE / NORMATIVE READY
6. Security & account lifecycle completion    PARTIALLY CORE-BLOCKED; UNBLOCKED SLICES MAY PROCEED
7. Multisig / external providers              FUTURE
8. Production hardening / Mainnet gate        PARALLEL
```

## Definition of done for every stage

A stage is complete only when:

1. donor behavior was inspected where product behavior is being migrated;
2. Capability/platform ownership is explicit;
3. minimal implementation is complete;
4. regression tests cover critical invariants/failure paths;
5. no sensitive state leaks into navigation/persistence/logging;
6. final branch diff contains only stage-related changes;
7. real CI steps are green, or the stage is explicitly marked externally blocked with no checks weakened;
8. capability/status/handoff documentation matches implemented behavior;
9. the stage PR is not merged while required validation is unavailable.
