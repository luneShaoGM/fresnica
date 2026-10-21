# S10 / Stage 6 — Swap-C1 account and ledger preflight

Status: **isolated read-only Capability; exact-HEAD independent Work review pending; no transaction preparation**. Based on merged Swap-A PR #102 and Swap-B PR #103.

Authoritative contract: [Fresnica Path Payment / Swap (PR #188)](https://github.com/Fresnica/fresnica/blob/38e804b435be5d3c6a0400de4e79f102822cb8e0/docs/capabilities/path-payment.md). The official test vectors remain unchanged (Git blob c5252a572522c8eadb2fb42f0244373921e1688f).

## Responsibility

The new assertPathPaymentPreflight function is a read-only eligibility assertion taking a selected PathPaymentQuote, explicit slippage basis points, Classic wallet source account identity, full network context, an injected wall/monotonic clock, and a network-bound account/ledger query port. It returns only Promise<void>, **never an approved reusable transaction, operation, XDR or authorization object**.

- Before Horizon I/O, verify wallet network ID, quote network ID and network passphrase against the active network **and** the bound SDK Gateway. Verify that the selected quote source is the current Classic account, source/destination are Classic G addresses, source/destination assets are valid and different, and Memo syntax is valid.
- Invoke Swap-B derivePathPaymentProtection **before** ledger reads and **again after all awaits**, so the quote must not become expired (wall or monotonic clock) while preflight loads data. Strict-send checks the exact fixed source amount; strict-receive checks worst-case **sourceMaximum**, not merely the quoted source.
- Re-fetch live source and destination account states. **Missing destination fails** with destination_missing; Path Payment does not inherit Payment's CreateAccount behavior. Same-account Swap reads one source account; SEP-29 memo-required rule applies only to cross-account destinations. A bad Horizon account identity or network change during an awaited read fails closed.
- Reuse StellarSdkGateway normalized account/trustline balances and ledger fee/reserve values through a small read-only port. The SDK exposes its configured network; **no new network switching authority** is introduced.
- XLM source availability = balance − selling liabilities − minimum sponsored reserve − fee; it must cover the exact or worst-case source debit. An issued source requires a fully authorized trustline with balance − selling liabilities covering the debit, plus sufficient native fee reserve. The **issuer as source** does not need its own trustline but still needs fee capacity.
- Destination credit capacity = limit − balance − buying liabilities, for a fully authorized destination trustline; the **issuer as destination** can receive its own issued asset without a trustline. XLM destination must remain within Stellar signed-i64 capacity including buying liabilities.
- Require each referenced **external issuer** to exist as an active Classic account. Intermediate assets do not impose wallet trustlines. No automatic ChangeTrust or extra reserve/fee operation. Unknown or malformed account/ledger results fail closed, and provider exception messages are not returned as eligibility outcomes.

## Why Swap-C is split

Swap-C1 checks **ledger eligibility at the time of this read**, not at the time of an eventual transaction. It does **not** guarantee liquidity, reserve offers, or rule out crossing the source account's own offer (cross_self is a network result). In strict-send, actual output can exceed the quoted destination amount; this check uses the quote and the network remains authoritative.

**Swap-C2 remains mandatory:** re-run preflight and Swap-B expiry/slippage at actual preparation; bind the exact selected path, source/destination accounts and assets, memo, fee, network and derived limit; apply separate Transaction TimeBounds and independently inspect decoded exact-XDR operation against reviewed intent. No reachable signing or submission until then. Swap-D owns authorization, signing, submit and uncertain/pending reconciliation.

## Evidence / acceptance

- Tests cover strict-send, worst-case strict-receive, liabilities, reserve/fee, trustline authorization/capacity, missing destination, external issuer and issuer-as-endpoint behavior, same-account Swap, cross-account SEP-29, identity/network races, quote expiration across awaited reads, invalid ledger/account responses and provider exceptions.
- SDK composition test exercises StellarSdkGateway's read-only port with real Stellar StrKey account validation and a mocked Horizon server. Neither a transaction builder nor submit is used.
- **Not verified:** live Horizon liquidity, real Testnet path construction/execution, signer authorization, hardware/multisig, actual App flow, iOS/Android native acceptance. Heavy CI jobs skipped are not native acceptance. S10 remains **L2 partial**.

No SDEX, Soroban Swap, Realm schema changes, user-facing UI or transaction submission is included.
