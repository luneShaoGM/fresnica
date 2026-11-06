# S10 paired amount editing and automatic quotes

Decision: Adapt the remaining Fresnica Swap interaction roles from branch `stage6/add-assets-sheet-2026-10-23@7e708b4623388fdbcaef409d70eef2b5bab1984a` on current main after PR #118. Owner: `features/swap`; composition: `app/navigation`. Phase 0/Stage 0A and the existing light-theme foundation apply; Phase 2c remains partial. S10 continues to reuse the established Phase 6 exact-XDR authorization/sign/submit/recovery pipeline. No product/native maturity promotion.

- Editing Pay sets `strict_send`; editing Receive sets `strict_receive`. Store one fixed amount and its mode; derive the opposite side exclusively from the currently selected quote. A previous derived number is never a new fixed amount unless the user explicitly edits that side.
- Valid changes debounce a quote request by 500 ms. Invalid/zero/over-precision/out-of-int64 input never requests quotes. Preserve PR #118 amount normalization: no silent sign removal, digit filtering or truncation.
- Manual Get Quotes/Requote remains available. It consumes a pending debounce so one edit cannot cause a duplicate request. A failed request stops; retry requires an edit, manual action or a fresh foreground/focus lifecycle. There is no periodic retry loop.
- New amount, mode, asset selection or asset exchange immediately invalidates old quotes and outstanding requests. Editing remains possible during a quote read; the obsolete response cannot replace the latest draft or unlock a newer request. Editing is disabled during exact-review preparation.
- Asset exchange swaps source/destination, clears the fixed amount and quote, and returns to strict-send. Never silently reuse a number for a different economic direction. Asset identity includes code case and issuer; existing distinct source/destination selection behavior remains.
- No automatic quote is initiated in the background, after route blur/close, or for a different selected account. Backgrounding invalidates quote/prepare work; returning may refresh the current valid draft. Existing in-flight explicit authorization/submission and terminal/recovery views retain their current lifecycle so System Auth background handoff is not reinterpreted as a new trade.
- Quote choice, expiry, slippage and exact-XDR review remain authoritative through current capabilities. No input effect prepares, authorizes, signs or submits. No cache/spendable projection, new dependency, Realm/schema or transaction-capability change.

Validation covers strict-send/receive request identity, selected quote projection, debounce/manual interaction, supersession and out-of-order results, failure/retry, exchange, background/focus/close and exact-review continuation. Native product-flow, simulator/physical-device, dynamic-font and TalkBack/VoiceOver acceptance remain unperformed. Stage 9 real-iPhone System Auth cancellation/retry remains deferred.

Provenance: reuse current Fresnica components and workflow contracts; implement this adaptation without consulting/copying Stellar/Xaman source. The old full Swap implementation and duplicate cache are not imported. Remaining route/settings controls, Max/live spendable and other-screen styling stay separate slices.


## 2026-11-06 S10 quote expiry and default slippage closure

Status: **Swap interaction correction candidate** on
`main@49aec7fa0846399f5fa1056422cbdba3c497fae6` (after the
user-merged #173 plan rebaseline). Product traceability: S10.
Owner: `features/swap/SwapPreviewScreen.tsx`. Decision: **Adapt** the
observable Stellar exchange behavior using current Fresnica components and
capabilities; no donor implementation or styling copied.

- Quote freshness is a time-limited **UI affordance**, not signing authority.
  An already expired quote, or one expiring while its route card remains open,
  displays the existing localized expiration error, disables Review and leaves
  manual Requote available. The route's expiry timer is cancelled/replaced on
  selection change, route blur, backgrounding or component disposal. A queued
  old Review callback rechecks the real deadline **before** any live ledger
  read, unsigned build or authorization attempt.
- Keep the existing Capability's **independent monotonic + Unix-time
  expiration checks** in `derivePathPaymentProtection` and the C1/D1
  exact-XDR review/submission pipeline. Display-side clock scheduling is
  intentionally not proof that the underlying quote remains valid.
- Fresh Swap form default slippage is **50 basis points (0.5%)**, matching
  Stellar's product default of 5 permille. Fresnica's existing 10/50/100
  basis-point presets, explicit custom 0–1000-bps validation and frozen
  slippage-to-reviewed-XDR identity remain unchanged. This is a safer
  default, not a change to user-selected custom slippage.
- Preserve existing pay/receive fixed-side draft, debounced/manual quotes,
  selected path, live-spendable Max, account/network isolation, System Auth
  handoff, passphrase, submission and uncertain/recovery behavior. No
  dependency, Realm schema, remote image/Token Icon component, Balance
  cache, authorization or native transport changes in this slice.

Validation scope: automated UI-level quote already-expired, timer expiry,
old queued Review callback, route switch timer replacement and default
slippage selection; previously validated Path Payment preflight,
signing/uncertain/recovery is unchanged and should not be reimplemented or
misreported as newly accepted. Device-level quote transition, large text,
TalkBack/VoiceOver, live Horizon broadcasts and Stage 9 iOS real-device
System Auth cancellation/retry remain deferred. Independent Work must review
the PR's exact remote HEAD; the user chooses merge timing.
