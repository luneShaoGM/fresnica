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

parallel security fix:
main -> fix/android-release-signing     PR #14
```

Stages 1-4 are source-complete in stacked PRs. Earlier PRs remain unmerged because their required GitHub Actions runs failed before workflow steps executed. PR #19 is the first recent staged PR whose CI runner has started real steps again; its final validation result is still authoritative.

---

## Stage 1 — Runtime Product Shell and Wallet Home

**Status:** SOURCE COMPLETE — PR #16 — CI EXTERNALLY BLOCKED

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

## Stage 2 — Send Product Flow

**Status:** SOURCE COMPLETE — PR #17 — CI EXTERNALLY BLOCKED

**Delivered**

- form -> exact-XDR review -> authorization/submission -> result;
- native and issued Balance assets;
- Stellar `G...` and muxed `M...` destinations;
- exact decimal amount validation and 28-byte UTF-8 text memo validation;
- Unicode memo review decoding from exact SDK XDR bytes;
- submit boundary re-derives `PaymentReview` from exact XDR;
- freshness -> current ledger authorization -> signer resolution -> shared Signing Coordination -> exact signed XDR submission;
- System Auth first, app-passphrase fallback only when required;
- submitted / rejected / uncertain / authorization-blocked / watch-only / unsupported-multisig remain distinct.

**Non-goals**

- no path payment / swap;
- no multi-operation transaction UI;
- no Agent signing.

---

## Stage 3 — Activity / History Read Flow

**Status:** SOURCE COMPLETE — PR #18 — CI EXTERNALLY BLOCKED

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

**Status:** SOURCE COMPLETE — PR #19 — CI RUNNING

**Normative source**

Upstream Fresnica Trustline is Normative. Mobile follows the shared semantic contract instead of treating Stellar SDK `Operation.changeTrust` as the product contract.

**Delivered**

- stable ordinary issued-asset identity `CODE:GISSUER`;
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

**Regression scope**

- canonical limit;
- issuer existence and issuer flags;
- reserve + fee preflight;
- existing trustline rejection;
- zero-balance/liability removal requirements;
- liquidity-pool relationship protection;
- orphaned issuer removal;
- self-trust and invalid asset identity;
- exact-XDR review binding and account-source binding;
- watch-only and multiple local signer gates;
- Horizon account-state, ledger-parameter and liquidity-pool mapping;
- ChangeTrust XDR construction.

**Non-goals**

- no Set Limit product UI in v1;
- no Asset Discovery/catalog/ranking integration yet;
- no liquidity-pool-share ChangeTrust product support;
- no multisig coordination;
- no Agent authorization.

---

## Stage 5 — Swap / SDEX Flow

**Status:** NEXT AFTER STAGE 4 VALIDATION

**Goal**

Implement swap only after Balance + Send + Trustline transaction patterns are proven.

**Implementation scope**

- inspect donor swap UX and transaction rhythm without copying donor Vault/authentication internals;
- define SDEX quote/read boundary separately from write execution;
- distinguish strict-send / strict-receive semantics explicitly;
- preserve full source/destination asset identity and exact decimal amounts;
- bind source asset, destination asset, amount, limit/slippage and path to exact reviewed transaction XDR;
- enforce quote freshness/expiry before signing;
- reuse shared Transaction submission and Signing Coordination;
- keep biometric/passphrase behavior identical in policy to Send/Trustline;
- fail closed on unsupported route/account/trustline conditions.

**Acceptance criteria**

- quote expiration is enforced before signing;
- UI cannot detach review from the exact path/transaction being signed;
- deterministic rejection and uncertain submission remain distinct;
- no swap-specific authentication path exists.

---

## Stage 6 — Security and Account Lifecycle Completion

**Status:** PARTIALLY BLOCKED BY CORE

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
1. Runtime Product Shell + Wallet Home        SOURCE COMPLETE / CI BLOCKED
2. Send                                      SOURCE COMPLETE / CI BLOCKED
3. Activity / History                        SOURCE COMPLETE / CI BLOCKED
4. Trustline / Manage Assets                 SOURCE COMPLETE / CI RUNNING
5. Swap / SDEX                               NEXT
6. Security & account lifecycle completion   PARTIALLY CORE-BLOCKED
7. Multisig / external providers             FUTURE
8. Production hardening / Mainnet gate       PARALLEL
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
