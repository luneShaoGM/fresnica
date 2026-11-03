# S13 Offer / liquidity-pool history

Status: Slice 3 implementation candidate from main
`0171f860842b87904761309c749297ddfbf18c83` (Slice 2 merged through #148).
Read-only Activity/History projection; no SDEX/LP write action, quote, XDR,
authorization, signing, submission, recovery or balance mutation is added.

Trace: S13 / Adapt / clean-room. Foundation 0/2a/2b and Stage 2.5 available,
2c partial; no product maturity upgrade. History owns meaning, Platform owns
Horizon decoding and cache storage, Activity owns presentation, ui stays generic.
Existing strict History/Activity scopes apply. Implement from this contract and
Fresnica source without donor source/tests/resources/structure as templates;
independent exact-HEAD implementation review precedes user-controlled merge.

## Operation evidence

- Support `manage_buy_offer`, `manage_sell_offer`, `create_passive_sell_offer`,
  `liquidity_pool_deposit` and `liquidity_pool_withdraw` only on literal successful
  transaction evidence. False/missing/malformed success or invalid family fields
  retain explicit unsupported shape, ID/order/date and navigation, with no money.
- Preserve exact ID, hash, cursor and source identity. These operation families
  affect the source account: specialize only for the current Classic source;
  issuer-only/other-account involvement is not a balance change. Detail rejects
  foreign source even when unrelated injected from/to fields match the wallet.
- Asset identity is native XLM or exact case-sensitive code + Classic issuer;
  validate shapes as the existing path read boundary does. Distinct issuers with
  the same code are different assets; issued XLM is never native. No remote
  metadata/image calls, new SDK dependency or account/Memo guessing.
- All token/share quantities remain exact decimal strings, <=7 fractional places
  and signed-i64 stroops bounds, without Number arithmetic. Offer quantity and
  actual reserve legs may be zero; pool shares must be positive. Invalid values
  never become zero. Preserve valid raw strings for cache/search.

## Offers: intent is not settlement

Inputs follow the official [buy](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/buy-offer),
[sell](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/sell-offer)
and [passive-sell](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/passive-sell-offer) objects.
Normalize distinct buying/selling assets, amount, exact `price_r.n/d` and offer ID
where the family supplies it. Validate rational components as positive signed-i32
integers. Manage-family offer IDs must be decimal strings in nonnegative i64
range; preserve precision and never accept a lossy numeric ID. Passive creation
need not supply an offer ID. Do not derive traded amounts by multiplying price.

- Buy quantity describes buying asset; sell/passive quantity describes selling
  asset. Detail labels it explicitly as order quantity, shows its denomination,
  buying/selling identities and issuers, exact rational price and offer ID when
  present. The rational is identified as order price, without inventing a
  unit conversion formula. Add localized explanation that quantity is an order
  instruction and does not prove executed volume or remaining order state.
- Zero manage amount is an offer-cancellation instruction; positive manage
  amount is Buy offer changed / Sell offer changed. Passive creation gets its
  own label; do not infer an existing order was created, updated, filled or
  remains open. Passive zero is invalid rather than a cancellation.
- List title is the selling -> buying pair, secondary line is localized operation
  plus existing local time. Pair avatar uses both full asset identities.
  Omit the monetary column entirely: no income/expense sign or settlement color
  for order quantity or cancellation. Keep offers in existing Other filter.

## Liquidity pools: actual reserve legs only

Inputs follow official [deposit](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/liquidity-pool-deposit)
and [withdraw](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/liquidity-pool-withdraw) objects.
Normalize a 64-character lowercase hex pool ID, exactly two distinct actual
canonical reserve assets (`native` or `Code:Issuer`) with amounts, and actual
shares (`shares_received` for deposit; `shares` redeemed for withdraw).
Use only `reserves_deposited` / `reserves_received`; never substitute
`reserves_max`, `reserves_min`, price constraints or current pool balances.
Require at least one actual reserve leg positive and shares positive. Preserve
actual reserve ordering. Missing/malformed actual data stays unsupported.

- List title is the reserve pair, secondary is localized Pool deposit / Pool
  withdrawal with local time. Both actual reserve amounts appear separately in
  the trailing area, each with its asset code/local identity, formatted to at most seven fractional
  places; deposit legs are negative/red, withdrawal legs positive/incoming
  blue. Do not collapse two assets, compute net value or describe shares as a
  native token deposit. Existing one-amount rows retain their presentation.
- Detail exposes pool ID, both actual reserve amounts/full identities/issuers
  and explicit shares received/redeemed. It reuses common source/hash/type/date,
  explorer and exact-operation routing. No deposit/withdraw/cancel action.
- Keep pools in existing Other filter. Search loaded entries by localized label,
  raw/formatted quantities, shares, pool ID, source, both asset identities and
  common IDs/hash/type. Offers additionally search offer ID/price components.

## Cache, lifecycle and exit checks

Add normalized family payloads to existing v1 list/detail JSON cache. Retain old
unsupported operation-type records until online revalidation replaces them;
allow new malformed known-family shape fallback, not arbitrary unknown shapes.
Validate success, family, source against supplied partition, all amounts/assets,
price/ID and derived cancellation semantics; strip unknown fields, freeze owned
objects and preserve list/detail consistency. No Realm schema migration, saved
cursor, local names, secrets or navigation payload expansion.

Preserve existing cache best-effort writes, current-network isolation, loading,
empty/inactive, refresh-failure/retry, offline stale display, pagination/focus
invalidation and stale-request guards. Extend list/detail/search and directly
affected tests together. Include raw PublicReadGateway -> History -> cache ->
presentation coverage, buy/sell denomination, zero/positive/passive semantics,
huge IDs/amounts and rational bounds, malformed/unsettled fallback, actual versus
limit reserves, two leg signs, foreign detail/partition rejection, legacy cache,
unknown-field stripping and real Realm close/reopen/isolation tests.

Run typecheck, focused + repository tests, lint, locales, architecture/provenance
and Android/iOS JS bundles. Native layout/dynamic fonts, screen readers, live
ledger receipts, offline Retry/network switching and real-device acceptance must
remain NOT RUN unless observed. Stage 9 iOS System Auth cancellation/retry is
still deferred. Claimable/Clawback, contracts and failure/visibility rules remain
Slices 4-6 after this batch is reviewed and merged.

## Candidate evidence boundaries (2026-11-03)

- Clean-room implementation uses this behavior contract and existing Fresnica
  read/cache/presentation code. No donor source/tests/resources were opened or
  used as implementation templates; no SDK write/signing or native change.
- Local typecheck passed. Focused History/Activity/PublicRead automated tests:
  15 suites / 249 tests. Real Node Realm History repository integration:
  1 suite / 23 tests, including durable close/reopen and partition isolation.
  These are automated/helper evidence, not native product-flow acceptance.
- Full repository checks, Android/iOS JS bundles, CI and independent exact-HEAD
  implementation review are recorded with the candidate PR's current HEAD.
  This contract alone does not claim those gates passed or authorize merge.
- Native layout/dynamic fonts, screen readers, live ledger receipts, offline
  Retry/network switching and real-device acceptance: NOT RUN. Stage 9 iOS
  System Auth cancellation/retry remains deferred. No maturity promotion.
