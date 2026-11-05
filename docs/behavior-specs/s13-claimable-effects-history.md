# S13 effect-backed claimable quantities — Slice 6b

Written before code, Fresnica/official Horizon effects evidence only; clean-room,
S13Adapt, same maturity/strict boundaries. Claim and claimable clawback currently
retain only balance ID. Add an optional network/account-scoped read-only effects
port, wired through existing verified NodeReadSession/display lifecycle gate.
List and detail use the same enrichment mapper before normalized entry creation.
At most four concurrent record enrichments, each at most two 200-effect pages;
unknown/failed/foreign/malformed operation skips read. Errors/incomplete/ambiguous
proof keep honest ID-only unavailable fallback, never fail normal history read.
Do not follow supplied next URLs; use bounded opaque cursor on exact operation.
Validate each effect operation link path matches requested operation and dense
page/cursor shape. Existing Node abort/deadline/backoff applies to public reads.

Claim requires exactly one matching claimable_balance_claimed effect, same
balance ID/account/source and valid canonical asset plus positive bounded i64
amount. ClawbackClaimable requires exactly one matching balance-ID clawed_back
effect for source and exactly one account_credited effect for the same issuer,
credit asset issuer equal to source, positive i64 amount. This is a burned
quantity, NEVER issuer income. Duplicate/conflicting/foreign typed effects fail
closed to unavailable. Do not derive quantity from current balance or creation.

Preserve minimal frozen evidence (exact operation, complete and normalized
effects) alongside enriched reference fields; cache reconstructs through the
same verifier, binds operation/balance/account/partition and compares monetary
fields to proof. Unknown values cannot create money. Keep legacy ID-only cache.

List claim shows known received asset/quantity with incoming sign; clawback shows
known burned asset/quantity neutrally (no positive sign). Detail always shows ID,
asset/quantity where verified and burned explanation, otherwise unavailable.
Search includes verified quantity/canonical asset; never raw unvalidated effects.

List and detail cache must share canonical enrichment. A validated enriched detail
may upgrade only an exactly matching ID-only reference (same common identity,
family, source,balanceID,success) and update both list/detail atomically. Matching
existing enriched entry may be retained across a later unavailable read without
fabricating evidence or crossing partitions; conflicting proofs never combine.
No schema/dependency/native/write/auth/signing/submission/recovery change.

Primary source: stellar/stellar-horizon@6a13f41808586884c9a7b1beecd92088b7284070
internal/ingest/processors/effects_processor.go addClaimClaimableBalanceEffects
and addClawbackClaimableBalanceEffects. Claimed effect includes asset/amount;
clawback issuer credited event is explicitly emitted although funds are burned.
Test real wire->port->mapper->cache->row/detail/search, pagination bounds/cancel,
partial/duplicate/wrongop/issuer/network/foreign failures, cachelegacyupgrade and
close/reopen, nofalseincome, signed exactdecimal precision. ExactHEADreview+CI
then authorizedmerge. Native/device acceptance separate;Stage9auth deferred.

A six-second enrichment batch budget bounds list/detail latency. Four workers
stop on abort; HTTP combines the budget signal with NodeReadSession cancellation.
Timeout returns only already validated canonical entries (others stay ID-only),
never late mutation of returned data or state. SDK fallback discards results after
abort even if its transport cannot cancel. Reads still have their own node deadline.
