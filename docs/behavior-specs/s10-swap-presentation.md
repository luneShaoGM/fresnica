# S10 Swap presentation on current main

Decision: Adapt the existing Fresnica branch `stage6/add-assets-sheet-2026-10-23@7e708b4623388fdbcaef409d70eef2b5bab1984a`. Owner: `features/swap`, shared presentation in `ui/components`. Phase 0/Stage 0A and the existing light-theme foundation apply; Phase 2c remains partial. Existing S10 execution uses the Phase 6 shared transaction/recovery pipeline; this slice does not promote product/native maturity.

## This slice

- Reuse the branch's amount-input role, account identity card and transaction-result presentation with current main's existing form/quotes/review/result state machine.
- Accept a single decimal comma as a decimal separator. Never silently remove signs, letters or excess precision, combine decimal separators, or truncate a nonzero amount. Invalid, zero and out-of-int64 amounts remain visible and cannot request quotes. Capability validation remains authoritative.
- Account cards are display-only. The exact-review source/destination and full asset issuer rows remain visible; masking a header address does not replace exact transaction identity.
- Submitted is success; uncertain is unverified; rejected/authorization-blocked/unsupported-signer are failures. Always preserve original hash, result code, authorization and ledger when available. No result page offers a second submission.
- Keep current pending-history/reconciliation actions and history-read failures, including after an accepted broadcast. Copy and explorer actions operate only on public hashes through injected platform functions; failures allow retry and cannot change transaction status. Explorer links use the original network/hash. Obsolete output callbacks do not update a different screen/session.
- Preserve explicit slide authorization, transient passphrase handling, quote expiry/slippage, account-selection/focus lifetime, exact-XDR binding, pending/uncertain and recovery semantics.
- Strict architecture enforcement adds `features/swap`; UI remains presentation-only. No cache/repository/schema, dependency, signing or submission-capability changes.

## Remaining branch inventory

| Branch area | Disposition after this slice |
| --- | --- |
| Add/details sheets | Already adapted and merged by PR #117; do not overwrite its fixes. |
| SwapAmountInput, account card, result presentation | Adapt in this slice and wire into current Swap. Other screens consume shared components only in a later scoped migration. |
| Paired pay/receive editing, debounced automatic quotes, path/settings picker, Max and live spendable projection | Deferred: adapt separately against current read lifecycle and capability authority. Do not import the old SwapPreviewScreen wholesale. |
| Old CachedSpendableAsset/readCachedBalanceSnapshot/rememberSpendableAssets, duplicate balance repositories and Realm schema | Superseded by main; exclude. Cached balance is not spendable or signing authority. |
| Branch-specific Home/account/navigation restyling | Deferred; not required for this Swap presentation slice. |

Provenance: existing Fresnica code and new adaptation only; no Stellar/Xaman source consulted/copied. Automated zero donor collisions is not proof of historical authorship. Validate changed UI and connected submission/recovery tests, types/lint/architecture/provenance/locales and CI. Simulator, physical-device, dynamic-font and TalkBack/VoiceOver acceptance remain unperformed; Stage 9 iPhone System Auth cancellation/retry remains deferred.
