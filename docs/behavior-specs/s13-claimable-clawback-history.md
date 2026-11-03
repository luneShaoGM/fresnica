# S13 Claimable Balance / Clawback history

Status: Slice 4 merged through #150 at
`main@61d69a8af760256a84730547cfbbf307d24c4017`; historical implementation base
`d6e744a119c9b8eadaab5adc6652d1fabae9112e` after merged #149.
S13 / Adapt / clean-room; Foundation 0/2a/2b and Stage 2.5 available, 2c partial.
History owns read meaning, Platform decodes Horizon, Activity owns presentation;
existing strict scopes apply. No S11 claim/Clawback write capability, action,
authorization, signing, XDR, submission/recovery, balance mutation or maturity
upgrade. Implement from this contract and Fresnica source, without donor
source/tests/resources/structure. Independent exact-HEAD review precedes merge.

## Authority and supported shapes

Specialize successful `create_claimable_balance`, `claim_claimable_balance`,
`clawback` and `clawback_claimable_balance`. Only literal successful transaction
evidence qualifies. Validate exact unpadded Classic source, full asset identity,
bounded decimal strings (<=7 fractional places, signed-i64 stroops), and relevant
roles. Native XLM is distinct from issued XLM. Malformed/missing/unsuccessful
evidence stays an explicit visible/navigable unsupported shape without money.
Common operation ID/hash/date/order/cursor and exact detail route remain intact.

Primary protocol evidence:
- [Create operation](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/create-claimable-balance)
  supplies canonical asset, amount and claimants with predicates; a balance ID is
  not a mandatory operation field. Never invent its ID from the operation ID.
- [Claim operation](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/claim-claimable-balance)
  supplies balance_id and claimant, not the historical asset/amount.
- [CAP-35](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0035.md)
  defines issuer clawback as burning tokens, not issuer income. Ordinary clawback
  has asset/from/amount; claimable clawback supplies a balance ID only. Installed
  official SDK 17.0.1 Horizon declarations corroborate these wire fields.

This slice projects operation evidence only. Do not add per-row effect/current
balance lookups or invent historical amounts from raw unrelated fields, local
pending intent, cached create records, current claimable status, or a 404 for an
already consumed balance. Effect-backed enrichment remains an explicit separate
gap, not completed amount parity. Missing amount is not zero or an error loading
the operation: render a localized amount-unavailable explanation in detail and
omit its list monetary column.

## Create Claimable Balance

- Parse canonical `asset` (native or Code:Issuer), a positive exact amount and
  1-10 claimant entries. Validate each exact Classic destination and bounded
  known predicate tree; preserve claimant order and condition structure.
- Normalize known unconditional/and/or/not/absolute-before/relative-before
  predicates, with bounded nesting (maximum four recursive edges) and exactly
  two children for and/or. Accept documented camelCase and SDK snake_case time
  keys without silently selecting conflicting aliases. Preserve exact deadline
  strings; never evaluate current eligibility or use device time as authority.
  Unknown/malformed/cyclic/excessively deep predicates retain unsupported shape.
- Association is source or an explicit claimant destination, never asset issuer
  alone or injected generic from/to/account fields. Source+claimant retains source
  funding meaning once; do not duplicate or split the amount across claimants.
- Source funding from a non-issuer account displays minus/red actual escrowed
  quantity. Native funding also debits the source. An issuer creating its own
  issued asset is issuance, not an expense; omit its list monetary column.
  A claimant sees a conditional claimable record with no income/monetary column.
  Creation is never proof the claimant received tokens or can claim them now.
- Asset identity is the subject, with local full-identity avatar/code and a
  localized created/funded/issued/claimant label as appropriate. Detail shows
  amount explicitly as claimable quantity, asset/issuer, creator and each
  claimant with a localized condition summary/structure. A localized explanation
  states conditions and current balance availability are not established by this
  historical record. Do not label airdrops trusted, safe, spam or scam from this
  fact alone; keep all records visible.

## Claim and claimable Clawback reference records

- Require `balance_id` as exact lowercase v0 XDR ID (00000000 plus 64 hex
  characters). Preserve the full ID in detail/search; never confuse it with the
  operation ID. Claim additionally requires explicit claimant == source.
- Claim belongs only to that claimant/source. Claimable clawback belongs only
  to its source issuer; no former claimant/issuer association may be guessed from
  the ID. Reject foreign detail even when injected generic from/to fields match.
- Render distinct localized Claimable balance claimed / Claimable balance
  clawed back labels with stable local balance-reference identity, existing time
  and calendar dates, no monetary column. Detail shows balance ID, actor and
  amount-unavailable explanation. Claimable clawback also carries a localized
  clawback warning explaining that tokens were removed, not paid to the issuer.

## Ordinary Clawback

- Require an issued asset whose issuer equals operation source, explicit Classic
  holder `from` different from issuer, nonnegative exact amount and optional
  explicit valid muxed holder display identity with its Classic association base.
  Do not infer a muxed base or use a base contact name/Memo for a muxed identity.
- Association is issuer/source or explicit holder base. Foreign issuer/holder
  mismatches and injected unrelated participants cannot authorize ready detail.
  Issuer view is neutral and never shows income. Holder view shows minus/red
  actual removed quantity (zero remains neutral/unsigned); keep source/holder
  roles explicit even when viewed from the issuer.
- Use asset identity as list subject and localized Clawback label; detail shows
  issuer, exact holder display/base as appropriate, asset and quantity removed.
  Include localized clawback warning for both views. This is protocol event
  classification, not a metadata/reputation or future eligibility verdict.

## Product integration, cache and evidence

Keep the existing Other filter, loaded-set-only search, concrete calendar dates,
ordering, focus/pagination, offline stale/Retry and stale-request guards. Search
all relevant raw/formatted quantities, full asset identities, claimants/actors,
balance IDs, localized labels and common IDs/hash/type; transient names obey S22
network/exact-address/no-Memo rules and never enter cache/navigation. No nested
claim/cancel/burn actions, remote images or new dependencies.

Add normalized v1 family payloads, validating family/success/roles/partition,
native code, amounts, predicates, ID and derived funding/clawback display role.
Strip unknown nested fields, freeze owned data and preserve list/detail equality.
Retain legacy unsupported operation-type rows until revalidation; allow malformed
new-family operation-shape fallback without allowing arbitrary unknown shapes.
No Realm schema migration or persisted cursor. Preserve best-effort writes and
network/account isolation; cache is replaceable UX data, not ledger authority.

Tests cover four families, creator/issuer/claimant/holder/foreign/source+claimant
roles, no false income/issuance expense, predicate bounds/aliases and no current
eligibility inference, known versus unavailable money, zero clawback, exact high
amounts/IDs/muxed identity, malformed success/assets/IDs/roles, raw PublicRead ->
History -> cache -> list/detail/search, legacy/stripping/mutation/partition and
real Realm close/reopen. Run typecheck, applicable lint/locales, architecture /
provenance, repository tests and Android/iOS JS bundles.

Native/device/dynamic-font/reader/pixel, live ledger receipts, native offline
Retry/network switching and performance acceptance remain NOT RUN unless observed.
Stage 9 iOS System Auth cancellation/retry stays deferred. Effect-backed missing
amount enrichment, contract/remaining-family Slice 5, and failure/visibility
Slice 6 remain open; this candidate does not assert full Activity parity.

## Implementation and developer evidence (2026-11-03)

A separate implementer used this written behavior contract and existing Fresnica
code. No donor source, tests, comments, resources or implementation structure was
used as a template; no direct migration is claimed. The four new read kinds reuse
existing amount/asset validation, paging, hydration, repository and row/detail
primitives. The normalized v1 payloads contain only family-owned public evidence;
unknown claimant/asset metadata is stripped. Unknown predicate operator keys are
rejected rather than simplified (an exception to metadata stripping); an explicit
valid claimant destination still establishes detail association when its predicate
is malformed, allowing honest unsupported-shape detail without authorizing a
foreign or injected participant. This preserves
fail-closed conditional semantics. Camel/snake time aliases normalize to snake
keys; conflicting aliases fail. Signed-i64 relative/epoch strings and signed
extended-year absolute text remain exact; summaries explain historical conditions
without evaluating device time or current eligibility. Native assets require XLM
when revalidating normalized cache; reference rows strip injected money fields.

Developer-run evidence: focused History/Activity/PublicRead tests passed
17 suites / 313 tests; real Node Realm History passed 1 suite / 24 tests, including
all four families through durable close/reopen, deep ownership and partition
isolation. Typecheck passed. Touched lint: 0 errors, 3 existing no-void warnings.
The full repository checks, production JS bundles, CI and independent exact-HEAD
review are recorded separately against the eventual PR HEAD. These helper/unit/
Node Realm checks do not establish native product-flow acceptance.

Known gap: operation-only claim and claimable-clawback records still have no
historical asset/quantity. Resolving them requires a later bounded authoritative
effects/enrichment contract; the current reference-only projection does not close
full amount parity. Slice 5/6, branded metadata imagery and all unobserved native/
device acceptance stay open. No write action or security/lifecycle boundary changed.
