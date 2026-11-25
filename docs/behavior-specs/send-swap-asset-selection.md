# Send / Swap asset selection — S07 / S10

Phase 2c remains partial; this is a bounded product presentation slice under §7 Send/Swap and the existing transaction pipeline. Adopt Stellar asset-picker behavior, adapt to Fresnica feature state and Balance/Path Payment contracts. Clean-room implementation: no donor code, tests or resources copied. Owners: features/assets, features/send, features/swap; assets remains wallet presentation, not a UI-layer capability dependency. Existing strict Swap scope remains enforced; the new asset-selection files are added to strict architecture coverage.

- Both forms show one selected asset and open the existing bottom sheet with a searchable vertical list, cancel, empty result and clear-search actions. Each item shows the existing icon, code, full issuer (native marked explicitly), balance and selection indicator. Search matches code and issuer, case-insensitively; no metadata names are fabricated.
- Send candidates are XLM plus positive-balance trustlines; liquidity pool shares remain excluded by Balance. A future issuer-owned obligation requires a Capability contract; no synthetic issuer assets are invented. Deep-link/asset-detail prefills use the same eligible set and fail closed if unavailable. Switching clears amount and errors.
- Swap candidates remain XLM plus the current account's trustlines, including zero balances; issuer-owned synthetic obligations and pool shares are absent from the Balance contract. Selecting the opposite asset exchanges both sides; any selection clears amounts and quotes. Ordinary selections preserve the other side. Explicit Switch does the same reset.
- Selection is code + issuer identity, never code alone. One-asset Send has no active dropdown. Cancel preserves selection/amount. A closed picker clears search. Preparation disables selection; session/account/network retirement unmounts or closes the picker. No additional metadata source, transaction or persistence pipeline.

Validation: automated search/identity, zero-balance filtering, cancellation/selection, Send reset and three-asset Swap exchange regressions. Native visual, keyboard, screen-reader and device acceptance must be reported separately. Stage 9 iOS System Auth cancel/retry remains deferred.

## Send form presentation — 2026-11-24

- Details and Recipient omit the instructional Step 1/Step 2 line; the existing flow order, screen titles, Back/Cancel and Continue actions remain.
- The selected asset card uses the same 18-point horizontal inset as the Send amount/recipient fields. Page spacing belongs to the Send container; the shared picker and its sheet retain their existing spacing. Full credit issuer identity stays visible.
- Send displays credit Available inside the selected asset card only. Its accessibility label includes the exact projected available balance or Unknown. Native XLM retains its existing Balance display; this presentation change does not introduce a reserve/fee calculation.
- Credit availability and blocked reasons still guard Continue in both steps, including unknown facts. Existing selection, amount reset, cancellation and transaction authorization semantics remain unchanged.
