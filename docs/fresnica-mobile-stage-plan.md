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
- raw Horizon records and cursors never enter product navigation;
- the migrated Activity presentation can search within entries already loaded into the current client page set without changing the History capability boundary.

**Non-goals**

- no persistent History cache/gap recovery;
- no server-side/global history search or authoritative filter policy; the current search is client-local over already-loaded entries and the filter affordance remains presentation-only;
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

This stage must not invent a Mobile-only semantic contract while the shared Path Payment/Swap capability remains unresolved.

**Allowed preparatory work while blocked**

- inspect donor UX and interaction patterns;
- prepare platform mechanism boundaries that do not own product semantics;
- keep exact asset identity and exact decimal values intact;
- keep any route/quote data out of persistence and ordinary logs;
- add tests for platform parsing/building mechanics without claiming product-policy conformance.

**Blocked product work**

- strict-send vs strict-receive product semantics;
- quote identity/freshness and re-quote rules;
- route selection and slippage policy;
- trustline/capacity/issuer policy;
- review identity and exact XDR binding;
- accepted/rejected/uncertain result semantics.

---

## Stage 5B — SDEX Offer Management

**Status:** NORMATIVE CONTRACT AVAILABLE — SEPARATE PRODUCT STAGE

This stage is separate from Path Payment/Swap. It must follow the upstream Normative SDEX Application Capability contract and conformance vectors rather than reusing Exchange terminology loosely.

**Required semantics before product completion**

- pair identity is `BASE / COUNTER`, with full native or case-sensitive `CODE:GISSUER` asset identity and `BASE != COUNTER`;
- user amount is always expressed in BASE units and price is always COUNTER per BASE;
- SELL maps to `ManageSellOffer(selling=BASE, buying=COUNTER, amount=BASE, price=COUNTER/BASE)`;
- BUY maps to `ManageBuyOffer(selling=COUNTER, buying=BASE, buy_amount=BASE, price=COUNTER/BASE)`;
- BUY/SELL direction must not be erased by price inversion;
- decimal input is exact and limited to seven decimals without JavaScript floating point;
- price is rationalized to a signed-int32 `n/d` before preflight/review/XDR and the same effective rational is used everywhere;
- liability arithmetic must match Stellar stroop semantics rather than naive decimal multiplication;
- create/update/cancel reserve and liability behavior must follow the shared contract, including release-before-replace on update and ownership checks on cancel;
- issued-asset trustline/auth/capacity and issuer/orphaned-asset cases must follow the contract;
- normalized orderbook semantics are BID = BUY BASE and ASK = SELL BASE;
- review must expose actual operation family, pair, side, amount, effective `n/d`, total, fee, network and any extra trustline requirement;
- implementation must pass `spec/test-vectors/sdex-v1.json` before being called conformant.

---

## Stage 6 — Security / Account Lifecycle

**Status:** PARTIALLY BLOCKED; INDEPENDENT WORK MAY CONTINUE

**Available now**

- System Auth enable / status / repair / disable;
- pending mnemonic backup recovery;
- account metadata and signer inventory presentation;
- explicit watch-only handling;
- application-level policy screens that do not emulate missing Core primitives.

**Blocked or deferred**

- app session lock / unlock remains blocked until the shared application-security contract exposes the required Core primitive;
- Agent/AI standing authority remains deferred;
- multisig coordination beyond explicit unsupported outcomes remains deferred.

---

## Stage 7 — dApps / Authorization Surface

**Status:** STRUCTURE ONLY

The product tab and visual shell may exist before browser/authorization behavior. Do not introduce dApp permission, signing or origin-trust policy until the corresponding Application Capability/security contract is explicit.

---

## Stage 8 — Production Hardening

**Status:** PARALLEL

- Android release signing remains isolated in PR #14;
- release builds must never fall back to the debug signing key;
- native gates remain mandatory for native dependency/runtime changes;
- CI failures before runner checkout remain external blockers, not grounds to weaken checks.

---

## Merge discipline

Before a stage is merged:

1. source scope matches the stage goal;
2. architecture check passes;
3. TypeScript passes;
4. Jest passes;
5. Realm Integration passes when persistence is touched;
6. Native Android/Apple gates pass when native/runtime boundaries are touched;
7. required CI has actually executed real steps on the current head;
8. docs reflect the exact merged behavior and explicit non-goals.

If a gate cannot execute because GitHub does not allocate a runner, keep the stage open and continue only work that does not require pretending the gate passed.
