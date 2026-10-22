# Stage 6 / S10 — Swap-D2c authorized submit, result and recovery product flow

Status: **cohesive product integration candidate, pending independent exact-HEAD Work review**. Baseline is PR #108 merged main@65b75838ad67645ae6d9438e071511f239f0b050, whose reviewed D2b unsigned-XDR Preview was APPROVED P1/P2/P3 = 0. Normative authority remains upstream Fresnica/fresnica PR #188 Path Payment specification.

## User journey and authority boundaries

Same-account Classic wallet Actions → Swap input → strict-send/strict-receive verified quote and route → C1/C2 live preflight / exact **unsigned reviewed XDR** → clear review of account, source/destination assets and issuers, mode, path, fixed quote values, slippage-protected minimum-receive/maximum-send, fee and transaction TimeBounds → **user must explicitly slide to authorize**.

This user action enters the **existing reviewed Path Payment D1 adapter**, not a new signing or broadcast flow. AppServices injects its existing StellarSdkGateway transaction gateway, exact-XDR-inspecting StellarPathPaymentSdkGateway, native Fresnica SDK, account/signer Realm repository and durable transaction recovery repository. Only the current account's **single protected local signer** is accepted. D1 enforces full current network ID/passphrase, reviewed quote/XDR semantic identity and medium ledger signer threshold, including async account selection/focus generation (D2a) and mutable account identity checks.

D1's existing shared submission chooses System Auth when registered. With no System Auth available it returns **passphrase-required without submitting anything**. UI clears its password and requires a **new deliberate slide** to sign the **same original reviewed XDR**, using a secure, non-autofilled app-passphrase field. System Auth cancellation/errors do **not** submit or silently fall back to a different signature, and never auto-retry.

Only the generic existing Transaction Capability may persist the original submitting transaction hash **before** network broadcast. Submitted, rejected, authorization-blocked, unsupported-signer and uncertain results are distinguished with accurate localized explanations; hashes/ledger/result code are shown when available. If broadcast status cannot be proven, it remains **uncertain under the original hash**. UI supplies **no re-broadcast button**, while stable D1 economic-intent checking and a product account-scoped pending check block further Swap signatures until reconciliation.

Route blur, unmount, account switch or A→B→A during native auth/Horizon awaits invalidates the original D2a live selection/focus epoch and UI attempt generation. Stale completions cannot navigate, unlock another attempt or show another account's outcome. Loss of session after a durable pending creation preserves that unresolved record for future reconciliation; it never fabricates success.

## Durable pending and terminal results

The pre-existing Realm pending-submission schema is unchanged. The Swap product gains **only an account/network/intent-scoped read**: listByAccount(networkId, accountId, intentKind). The Realm and InMemory repositories implement the read without changing the generic Transaction persistence contract used by Send and Trustline. Entries are filtered again by exact source and path-payment intent kind, newest first, limited to ten. Unresolved and **terminal confirmed/rejected** states are visible to the **same wallet even after App restart**, including when cold-start reconciliation has already resolved the hash.

Existing TransactionReconciliationCoordinator automatically runs on **cold start**, **foreground** and **network reconnect**, querying original hashes on the configured network. User-triggered **Check pending transactions** invokes the coordinator's manual-refresh; it never constructs, signs or resubmits XDR. Results are shown only while the original App selection and route focus remain current. If Realm history read fails after network acceptance, an independent recovery warning appears, **not** a misleading transaction failure.

## Validation and boundaries

Test-first regressions cover unchanged XDR and signer across System Auth/passphrase, watch-only/multisigner rejection, account/network/focus loss, restored account-scoped pending and terminal records, confirmed/rejected/unknown reconciliation, cancelled auth, no duplicate submission, and no cross-account leakage. UI tests cover explicit slide, secure password, double-slide de-duplication, pending disabling confirmation, uncertain hash without retry, terminal status after restart and no false failure on post-acceptance history read error. Realm restart integration verifies terminal account-scoped metadata without migration.

**Not yet claimed:** no physical-device System Auth cancellation/retry; no native UI interaction acceptance; no live Horizon/Testnet Path Payment broadcast; no hardware/external/multisig. App config currently targets Stellar Testnet; tests use mocked signer/transport and the inherited exact-XDR builder. Android/iOS release JS bundles and CI gates do **not** constitute native-device or real-ledger evidence. S10 remains **L2 partial** until final product aggregate acceptance; user requested physical-device acceptance last.

This is the second larger S10 product batch, per docs/mobile-development-workflow.md, grouping authorization/result/recovery into **one PR and one independent Work exact-HEAD review**. P1/P2 block Merge; after Work APPROVED, user chooses Merge. Previously uncommitted user plans/status ledgers, UI evaluation and docs/test must remain outside this PR.
