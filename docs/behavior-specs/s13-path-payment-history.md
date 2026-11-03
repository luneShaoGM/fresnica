# S13 Path Payment / Swap history

Status: Slice 2 implementation contract, based on main
`c7e525bf0bb64863756078561e6d40feee143c55`. Slice 1 merged through #147;
native acceptance remains pending. This is read-only History presentation,
not a change to S10 quote, prepare, authorize, sign, submit or recovery.

Trace: S13; Adapt / clean-room. Foundation 0/2a/2b and Stage 2.5 available,
2c partial; no maturity promotion. Owners: History capability for meaning,
Platform for Horizon decoding/cache mechanism, Activity for presentation,
app for current-network identity composition. Existing strict scopes apply.
Implement from this specification and Fresnica contracts. No donor source,
tests, resources or component structure may be used as a coding template.

## Inputs and interpretation

- Specialize `path_payment_strict_send` and `path_payment_strict_receive`.
  Preserve exact operation ID, transaction hash, order, cursors and detail route.
- Horizon `source_amount` with `source_asset_*` is the actual sent leg;
  `amount` with `asset_*` is the actual received leg. Never substitute
  `source_max`, `destination_min`, a quote, balance or local pending intent.
  See the official [strict-send object](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/path-payment-strict-send)
  and [strict-receive object](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/path-payment-strict-receive).
- Carry successful-transaction evidence from Horizon. Only literal true may
  produce the specialized settled projection; false/missing evidence retains
  an explicit unsupported shape with no monetary column. Failed-operation
  status/visibility is reserved for Slice 6.
- Both actual amounts must be positive decimal strings, <=7 fractional places
  within Stellar signed-i64 stroops. Preserve exact strings and avoid Number.
  Missing/malformed amounts/assets/endpoints retain unsupported rows; never
  invent zero. Native XLM and issued XLM are different assets.
- Preserve sender/recipient display identities including explicit muxed forms,
  with their base Classic identities solely for account association/direction.
  Require explicit from/to bases; do not guess a sender from another field.
  Source account must agree with sender base. Current Classic account matching
  both endpoints is self; sender only outgoing; recipient only incoming;
  neither neutral. An issuer-only association must never imply income.

## List, detail and search

- Self paths between distinct full asset identities display Swap and the asset
  pair (source -> destination). Same-asset self paths remain self path payments.
  External paths retain counterparty identity/name priority from Slice 1 and a
  localized path-payment label plus asset pair in the secondary description.
  Do not label an external payment Swap because its assets differ.
- Right column shows the received/destination actual amount and asset; incoming
  uses + and incoming blue, outgoing uses the actual sent/source amount and
  asset with minus/red. Self Swap shows destination leg as its summary with
  positive tone, and identifies the pair/Swap so it does not imply net income;
  both exact legs are explicit in detail. Neutral paths have no directional sign.
  Keep at most seven decimal places, exact full raw values searchable.
- Reuse local identity avatars and semantic theme tokens. Asset pairs must
  retain issuer identity in their projection/avatar identity even with equal
  codes. No external image requests. Concrete calendar dates remain.
- Include paths in Payments filter, preserving current-loaded-set-only scope.
  Search both leg amounts, codes, issuers, participant/base identities, exact
  operation type, IDs/hash, localized labels and eligible transient names.
- Detail exposes actual sent and received amounts/assets/issuers, direction,
  explicit sender/recipient identities and existing exact-operation/common
  fields/explorer. Existing contact rules apply; muxed identities must not pick
  a base contact or acquire a Memo. No new ledger actions.

## Cache and failure behavior

- Add the path projection to normalized list/detail cache, stripping unknown
  fields and checking operation family, successful evidence, amount/asset
  shape, participant roles/base identities and sender/source agreement.
  Reject malformed cache through existing best-effort cache failure behavior.
- Preserve v1 existing entries including legacy unsupported path rows; these
  remain honest offline fallbacks until online revalidation replaces them.
  Additive JSON payload support does not require Realm schema migration.
  Retain partition isolation, entry/detail consistency, no saved cursors,
  immutable snapshots and best-effort cache writes.
- Existing loading/offline/stale, refresh failure/retry, pagination, inactive,
  focus invalidation and stale-request cancellation behavior remain unchanged.

## Exit evidence

Automated coverage: both path modes and actual versus limit fields, each
direction, self Swap versus external payment, same-code/different-issuer,
native versus issued XLM, explicit muxed endpoints, exact high/low amounts,
failed/missing-success/malformed fallback, foreign detail rejection, list
render/navigation, search/filter, cache normalization/legacy fallback and
real Realm close/reopen. Run affected tests, typecheck, lint, locales,
architecture/provenance, repository check and Android/iOS JS bundles.

Independent exact-HEAD review is required before user-controlled merge.
Native layout, dynamic font, accessibility, live ledger paths, offline Retry,
network/account switching and real-device product acceptance remain separate
and must be marked unexecuted unless actually observed. Stage 9 iOS System
Auth cancellation/retry remains deferred. Slices 3-6 remain deferred.
