# S10 / Stage 6 — Swap-A Path Payment quote Capability

Status: **new isolated Capability (L2 partial); no App composition or Swap UI.**
Exact authority: [Fresnica/fresnica PR #188](https://github.com/Fresnica/fresnica/pull/188), merged at `38e804b435be5d3c6a0400de4e79f102822cb8e0`, `docs/capabilities/path-payment.md`.
Official test fixture: `spec/test-vectors/path-payment-v1.json`, unchanged upstream Git blob **`c5252a572522c8eadb2fb42f0244373921e1688f`**.

## Delivered in Swap-A

- `src/capabilities/path-payment/types.ts` — stable, read-only `PathPaymentQuoteRequest`, `PathPaymentQuote`, and injectable `PathPaymentQuoteGatewayPort`. Identity includes **network ID + passphrase**, source/destination Classic account, source/destination Classic asset, mode, fixed amount and optional memo. Same-account source/destination is the Normative Swap specialization; same **asset** is invalid.
- `loadPathPaymentQuotes` — supports both **strict_send (exact source)** and **strict_receive (exact destination)** using the existing Network-bound Stellar SDK query adapter. Inputs validated **before any Horizon I/O**. Public account/issuer address checking is an injected platform validation port; no `@stellar/stellar-sdk` dependency in Capability. The gateway publishes its bound network context; mismatches before or after awaited provider I/O fail closed.
- Amounts use `BigInt` integer stroops up to Stellar signed int64 and maximum seven decimal places; no JS floating-point conversion of wallet amounts. Quote/source/destination amounts become exact canonical 7dp strings. Asset codes/issuers are case-sensitive. Existing Payment memo validation is reused without taking Payment's CreateAccount semantics.
- Provider candidates are normalized in their **received order**, with the selected fixed side checked against the request. Reject empty routes (`route_unavailable`), provider errors/invalid amounts/path data (`quote_unavailable`), invalid requests/network mismatches (`invalid_request`). **All candidate validation fails closed**, rather than silently dropping mismatches. Intermediate path omits both endpoint assets and cannot exceed five.
- Immutable quote snapshots include request, quoted source/destination amounts, path, `quotedAtUnixMs` and `expiresAtUnixMs = quotedAtUnixMs + 30_000` for audit and future validation. Time is captured **after provider receipt**, not at request start. The existing SDK gateway does not expose an observed ledger sequence, so no ledger freshness is invented.
- Only the dependency-free quote boundary is introduced. There is **no reachable Swap product entry**, prepare, review, signer, XDR building, fee/reserve/preflight or transaction submission in this Slice.

## Official vector coverage ledger

| `path-payment-v1.json` section                                                         | Swap-A disposition                                                                                        |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Schema `fresnica-path-payment-v1`                                                      | Loaded verbatim; verified Git blob against upstream                                                       |
| `swap`                                                                                 | Same-account source/destination and strict-send sell-exact / strict-receive buy-exact identities asserted |
| `path`                                                                                 | Maximum five intermediates, endpoints excluded, malformed provider paths rejected                         |
| `quote_ttl.maximum_seconds`                                                            | Each unprepared quote records a 30-second maximum audit timestamp                                         |
| `quote_ttl` expiry-at-boundary, monotonic enforcement, prepared-transaction TimeBounds | **NOT implemented in Swap-A**; required in Swap-B and later prepare slice                                 |
| `selection` tie-break ordering / exact candidate selection                             | **NOT implemented in Swap-A**; preserve provider order pending Swap-B                                     |
| `slippage` floor/ceil stroop calculations and 0–1000 bps policy                        | **NOT implemented in Swap-A**; no slippage parameter/default exists yet                                   |

**Passing the covered sections does not mean the complete upstream vector suite passes.** Swap-A quotes cannot be used for transaction preparation. Until Swap-B/Swap-C, expiry/selection/slippage/preflight cannot be bypassed because no product composition, authorization or submission path exists.

## Next boundaries

1. **Swap-B**: deterministic strict-send/strict-receive selection, path identity/ties; monotonic and wall-clock 30s expiry gating at the equality boundary; explicit 0–1000 bps integer-stroop slippage with all official vector cases. Preparing an expired quote must fail `quote_expired`; quote expiry does not cancel a previously prepared transaction.
2. **Swap-C**: source/liabilities/reserve/fees, destination existence, issuer and trustline authorization/capacity, SEP-29; exact selected quote/path/slippage/memo/fee/network → prepared transaction review; safe Transaction TimeBounds and an exact-XDR review identity.
3. **Swap-D**: common authorizing/sign/submit/uncertain→pending reconciliation with anti-double-submit behavior. **Swap UI last**, after required Capability invariants are proven.

No SDEX offer flow, Soroban swap, automatic ChangeTrust, existing transaction write flow or Realm migration is created by Swap-A.

## Acceptance status

- Code/test CI + Work exact-HEAD independent review are required before merge.
- Actual current-network Horizon path liquidity, real Testnet path submission, hardware/multisig timeout and iOS/Android UI acceptance are **not claimed** and remain separate gates.
- `S10` remains **L2 partial** (Capability implemented/tested but not composed into the user-facing App) after this slice; do not promote to L3/L4 automatically.
