# S13 trust authorization and sponsorship history — Slice 5c

Status: candidate contract after #154 merged at
`main@f08dba6a3d40e6b9f5537ef97689f7433c643656`.
S13 / Adapt / clean-room. Foundation 0/2a/2b and Stage 2.5 available, 2c partial.
History owns semantics/cache, Platform wire projection, Activity presentation;
existing strict scopes apply. Implementation uses this contemporaneous contract
and Fresnica, without donor source/tests/resources/templates. Independent exact-
HEAD Work review and user-controlled merge remain required. No write actions,
SDK/Core authorization, signing, XDR, submission/recovery, dependencies, native
configuration, Realm schema or maturity changes.

## Authority and four operation types

Read successful `allow_trust`, `set_trust_line_flags`,
`begin_sponsoring_future_reserves`, `end_sponsoring_future_reserves`.
Require literal transaction success, exact unpadded Classic source and stable
existing common fields. Keep old unsupported rows readable and malformed known
shapes visible/navigable as unsupported. Preserve paging/order/date/focus/offline/
Retry and detail route identity. Never derive money, fees or live account state.

Primary references:
- [Allow trust](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/allow-trust)
- [Begin scope](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/begin-sponsoring-future-reserves)
- [End scope](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/end-sponsoring-future-reserves)
- [Official Horizon wire model](https://github.com/stellar/go-stellar-sdk/blob/main/protocols/horizon/operations/main.go)
- [Core trust flag validation](https://github.com/stellar/stellar-core/blob/master/src/transactions/SetTrustLineFlagsOpFrame.cpp)

Prefer the official wire model over inaccurate illustrative docs: allow_trust
uses boolean authorize/authorize_to_maintain_liabilities, not a numeric authorize.
SetTrustLineFlags numeric arrays are omitempty: absent means an empty mask; an
invalid present value must not be treated as absent. SDK 17.0.1 agrees on fields.

## Trust controls

Both types require an issued asset with exact valid code/Classic issuer, issuer
equal to source, exact Classic trustor distinct from issuer. AllowTrust also
requires explicit trustee == source. No issuer/participant may be guessed from
generic from/to. Association is source or explicit valid trustor, independently
of other shape validity so malformed records remain honest unsupported details
for their actual participants. Foreign injected generic participants are denied.

AllowTrust requires both explicit booleans. true/false means authorized;
false/true means maintain liabilities only; false/false means authorization
revoked. Both true, missing, numeric, null or other values fail closed rather
than silently choosing full/restricted/revoked meaning. No payment is implied.

SetTrustLineFlags preserves exact set/clear bit arrays in order, max three
elements each. Missing arrays normalize empty, present null/non-array/wrong
types/duplicates/unknown bits fail closed. Only known bits 1 (authorized),
2 (maintain liabilities), 4 (clawback enabled) are recognized. Set mask cannot
contain 4 or both 1+2; clear mask may contain any unique subset. Set and clear
cannot overlap. Empty masks are valid historical instructions, not proof of
state change. Detail describes requested flag changes, never current trustline
flags or eligibility. Do not borrow account SetOptions flag meanings.

List subject is full-identity asset/avatar/code; secondary is localized auth
state or flag-update label plus existing local time. No monetary column. Detail
shows issuer/trustor, full asset identity, precise localized auth outcome or
set/clear flag names (explicit None for empty masks), plus historical-state limits.
Use full wrapping for new flag text/identity rows. Do not add grant/revoke actions.

## Sponsorship scopes

Begin: source is sponsor, explicit sponsored_id is beneficiary. End: source is
beneficiary, explicit begin_sponsor is sponsor. Require exact Classic identities
and distinct parties; no account creation, sponsor or counterparty inference.
Association is source or the relevant explicit peer only; generic from/to,
wrong-family peer fields and arbitrary asset issuers cannot authorize detail.
Establish explicit peer association independently of other shape fields, but
invalid/missing peer evidence never becomes a valid specialized record.

Normalize both party identities and viewed role sponsor/beneficiary. List subject
is the other party with existing stable local account identity and permitted
global unambiguous address-only contact/current-network wallet label fallback.
No Memo-specific aliases or guessed muxed identity. History amounts/network/
account isolation is unchanged by global contact metadata. No monetary column.

Localized labels say sponsorship scope opened/closed, not XLM sent/received or
all sponsorship removed. End closes the transaction's future-reserve sponsorship
scope; it is not revoke_sponsorship and does not undo already-sponsored entries.
Detail shows sponsor/beneficiary and an explanation that no amount, affected
entries, count or current sponsorship status is established by the operation.

## Integration, cache and evidence

All four use Other filter and loaded-set search. Include localized labels,
auth/flag names, exact numeric bits, all actual parties, full code:issuer and
existing IDs/hash/type/source; permitted names stay transient and never persist
in History/navigation. Keep calendar dates rather than Today/Yesterday.

Add normalized v1 payloads without schema/cursor changes. Cache reconstructs via
the live mapper, validating family/literal success/asset/native distinctions,
roles/source/explicit partition, booleans and masks. Canonical cache flag arrays
are required even when empty; do not repair a missing cached array as wire
omitempty. Cached auth discriminants and role cannot silently coerce to another
meaning. Strip unknown metadata, freeze owned nested arrays/asset, preserve list/
detail equality, keep memory/Realm isolation. Allow shape fallback only for these
known new operation types, without widening unrelated unsupported shapes.

Tests cover all types and both viewed roles; exact participants/issuer and
foreign injection, literal success, all auth states, missing/contradictory/wrong
fields, known/unknown/duplicate/disjoint/empty flags and the clawback rule; raw
SDK/PublicRead -> History -> cache -> list/detail/search, no money/no false live
state, locale parity, corruption/strip/freeze/legacy/memory and durable Realm
close/reopen. Run appropriate checks/tests and Android/iOS JS bundles. Separate
developer evidence from independent review/CI against exact remote HEAD.

Node Realm/unit/JS bundles do not establish native acceptance. Native/device/
dynamic-font/reader/pixel/live-ledger/offline Retry/switch/performance acceptance
and Stage 9 iOS auth cancel/retry remain deferred. Remaining account merge,
options/data/revoke/inflation families, contract constructor variants, Slice 6
failure/visibility, missing claimable amounts and branded imagery stay open.
