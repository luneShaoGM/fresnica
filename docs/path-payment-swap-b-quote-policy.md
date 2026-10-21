# Stage 6 / S10 — Swap-B deterministic quote policy

Status: **Capability policy only, awaiting exact-HEAD independent Work review; not App-composed.**

Normative source: [Fresnica/fresnica Path Payment / Swap](https://github.com/Fresnica/fresnica/blob/38e804b435be5d3c6a0400de4e79f102822cb8e0/docs/capabilities/path-payment.md). The official _spec/test-vectors/path-payment-v1.json_ remains **unchanged**, Git blob _c5252a572522c8eadb2fb42f0244373921e1688f_. Swap-A's strict network/asset/account validation and quote normalization remain authoritative.

## Delivered boundary

- **selectBestPathPaymentQuote(quotes)** returns the **original winning quote object**, without altering provider order, path or amount. Only candidates sharing the same canonical request snapshot from one Swap-A load may be compared. Strict send maximizes quoted destination; strict receive minimizes quoted source. Ties choose fewer intermediate assets, then a deterministic, case-sensitive lexical path identity; perfect ties preserve provider order. Comparisons use integer BigInt stroops, not Number or locale-dependent collation. Missing candidates return route_unavailable, mixed identity invalid_request, and a mismatched fixed side quote_unavailable.
- Swap-A quote loading now requires an injected **nowMonotonicMs()** along with **nowUnixMs()** and records both anchors **after** the awaited provider response. The original quotedAtUnixMs/expiresAtUnixMs remain review/audit fields. The additional quotedAtMonotonicMs is an unpersisted live-session anchor. No silent wall-clock fallback is introduced; a future App/Platform composition must provide an actual monotonic source, not substitute a wall clock.
- **derivePathPaymentProtection(quote, slippageBps, clock)** checks expiry before returning any protection amount. The quote must have a valid maximum 30-second lifetime. If wall-clock now reaches expiresAtUnixMs, monotonic elapsed time reaches the same allowance, the monotonic clock goes backward (e.g., process/restart/reset), or clock metadata is invalid, it returns quote_expired. A device clock rollback cannot extend the monotonic lifetime. An earlier-than-30-second recorded expiry is honored by both clock checks.
- Slippage is an **explicit integer from 0 to 1000 basis points**, inclusive. Strict-send produces positive destinationMinimum = floor(destinationStroops * (10000 - bps) / 10000); strict-receive returns sourceMaximum = ceil(sourceStroops * (10000 + bps) / 10000). All arithmetic uses BigInt, never binary floating-point wallet amounts. No hidden default, no weakening rounding, no unrepresentable signed Stellar i64 limit. Invalid basis points return slippage_out_of_range; non-positive or unrepresentable limits return slippage_exceeded.
- Returned immutable data binds the **exact original selected quote**, mode, explicit slippage and one named limit (destinationMinimum or sourceMaximum). No prepared XDR, transaction operation, authorization or submission is introduced.

## Official conformance coverage

| Vector / invariant                                                                 | This Slice                                                       |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| selection: best strict-send destination, least strict-receive source, shorter path | **All three official cases covered directly**                    |
| selection: lexical path identity and stable perfect ties                           | Additional deterministic tests                                   |
| slippage: send floor, receive ceil, zero bps, reject >1000 bps                     | **All four official cases covered directly**                     |
| slippage: overflow, floor-to-zero, invalid bps                                     | Additional focused tests                                         |
| quote_ttl: maximum 30s, equality boundary, monotonic lifetime and clock rollback   | Covered with injected clocks at value-only protection derivation |
| quote_ttl: actual transaction preparation and Transaction TimeBounds               | **Not integrated**; required in Swap-C/Transaction               |
| path, swap, schema                                                                 | Existing Swap-A tests remain authoritative                       |

Passing covered tests does **not** establish readiness for a real swap. Swap-C **must** invoke the expiry/slippage policy at the point of exact quote preparation, then apply a separate Transaction TimeBounds policy. An already prepared transaction's lifetime is not automatically canceled by a later quote expiry, and expiry after an uncertain submission is not proof of failure.

## Explicitly out of scope

No UI entry, actual selected-quote payment preparation, network switching UX, reserve/fee/liability/trustline/issuer/SEP-29 preflight, XDR review, authorization, signing, transaction submission, uncertain/pending reconciliation, native device acceptance, or cross-restart quote persistence. A monotonic clock reset fails closed and requires a new quote.

After a reviewed merge, S10 remains **L2 partial**, not L3/L4. Capability approval is separate from native Product Flow acceptance and all Swap-C/Swap-D gates.
