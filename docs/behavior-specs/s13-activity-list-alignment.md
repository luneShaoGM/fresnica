# S13 Activity list alignment

Status: Slice 1 merged through PR #147 at
`main@c7e525bf0bb64863756078561e6d40feee143c55`, including S22 #145/#146.
Slice 2 merged through PR #148 at
`main@0171f860842b87904761309c749297ddfbf18c83`, specified in
[`s13-path-payment-history.md`](s13-path-payment-history.md). Slice 3 merged through
PR #149 at `main@d6e744a119c9b8eadaab5adc6652d1fabae9112e`, specified in
[`s13-offer-pool-history.md`](s13-offer-pool-history.md). Slice 4 merged through
PR #150 at `main@61d69a8af760256a84730547cfbbf307d24c4017`, specified in
[`s13-claimable-clawback-history.md`](s13-claimable-clawback-history.md).
Slice 5a merged through #152 at `main@1b8aeb6c64d9dab8cf2a67148f44517a3dab15d5`, specified in
[`s13-contract-history.md`](s13-contract-history.md). Slice 5b merged through #154 at `main@f08dba6a3d40e6b9f5537ef97689f7433c643656`,
specified in [`s13-maintenance-history.md`](s13-maintenance-history.md). Slice 5c
trust/sponsorship merged through #157; specified in
[`s13-trust-sponsorship-history.md`](s13-trust-sponsorship-history.md). Existing cache,
cursor, detail identity, submission and recovery contracts remain in force.

Contact policy amendment: merged S22 #151 supersedes older network-scoped contact
wording below. Contacts are global public metadata; ambiguous exact identities
do not choose a name. Wallet labels and History routes/cache/amount meanings stay
network/account-scoped, and Memo-specific contacts still cannot match plain rows.

Trace: S13, with S22 local identity presentation. Decision: Adapt / clean-room
behavior rewrite. Owner: features/activity; History remains ledger authority,
Contacts owns local contact identity, app owns account/network composition, ui owns
presentation. Foundation 0/2a/2b and Stage 2.5 are available; 2c remains partial.
No donor code, tests, component structure, images or resources are implementation
templates. Independent implementation review is required before merge.

## Target inventory and delivery boundaries

| Slice | Target | Current delivery |
| --- | --- | --- |
| 1 | Payment, account funding, ordinary trustline list identity and amount layout | Merged #147; native acceptance pending |
| 2 | Path-payment and Swap read projection, asset pair, destination-leg summary | Merged #148; successful actual legs only, native acceptance pending |
| 3 | Buy/sell/passive/cancelled offers and liquidity pool read presentation | Merged #149; intent-only offers and two actual signed reserve legs, native acceptance pending |
| 4 | Claimable Balance and Clawback roles, amounts and risk classification | Merged #150: four operation families, exact roles/conditions, known creation/holder amounts, ID-only claim and claimable clawback; effect-backed missing asset/amount enrichment and native acceptance remain open |
| 5 | Contract identity and asset-change summaries; remaining operation families | Slice 5a merged #152: invoke/create/upload identity and reported SAC events; Slice 5b merged #154: TTL extension/restoration and sequence adjustment; Slice 5c merged #157 adds trust authorization/flags and sponsorship scopes; remaining classic families and native acceptance open |
| 6 | Failed-operation read contract and controls; Dust/Spam/technical visibility | Deferred; do not invent classifications without data |

Each later slice updates its owning behavior contract, read/cache projection,
list/detail/search and directly affected tests together. These rows describe the
full requested target, not implemented capability or native acceptance claims.

## Slice 1 user-visible behavior

- Keep localized concrete calendar-date section labels. Never replace them with
  Today/Yesterday or relative dates. Preserve gateway order and operation-ID rows.
- One accessible row opens the existing exact operation detail route. Do not add
  nested participant-menu buttons, change navigation parameters or pass contact
  data into navigation/History persistence.
- Payment and account funding use account identity as the subject: a stable
  address-derived local avatar, then an exact address-only current-network contact
  name, then a visible current-network Classic account label, then a masked public
  address (first four / last four characters). A name change must not change the
  avatar identity. Never borrow a name from another network or infer the base of
  a muxed identity. Memo-specific contacts cannot match an address-only History
  record: this slice does not have an authoritative operation Memo projection.
- Contact edits/deletes update displayed names without a Horizon reload. Contact
  read failure degrades to account label/address; the history remains readable.
  Local names stay in transient presentation only and are searchable in the
  current loaded set. Account/network switching must not reuse another partition.
- Trustline changes use asset identity (case-sensitive code plus exact issuer),
  asset avatar and code as title. Zero limit is removal. Positive limit remains
  "Trustline changed": the ledger record alone cannot prove Add versus Set Limit.
  Do not display the limit as a monetary balance change. Detail may retain limit.
- Middle secondary line contains localized operation text and local time joined
  by a middle dot. Payment uses its direction label; account funding uses Create
  account (its direction remains in the signed amount). Time includes seconds.
  Unknown operations retain an explicit
  localized unsupported description and type, and remain navigable and searchable.
- Right column has signed numerical amount above asset code and a small asset
  avatar. Income is blue through the `incoming` semantic theme token, expense red,
  self/neutral unsigned with muted color. Use an equal-width numerical style.
  Payment and account funding preserve exact input strings and format at most
  seven decimal places, without conversion to JS Number. Keep exact raw amounts
  searchable even if a display formatter shortens them. Do not change shared
  formatting defaults or detail formatting for unrelated product surfaces.
  Existing action/positive colors remain unchanged. The default incoming color
  has its own theme token because the current action and positive tokens are
  green; custom/image palettes may override it through the existing semantic seam.
- Omit the entire monetary column for trustlines and unsupported rows. Do not
  replace missing money with zero or put an unsupported warning in that column.
- Reuse the shared AccountIdentityCard with a compact read-only presentation if
  practical; existing default card consumers retain their behavior. Avatars are
  decorative within the accessible row. Do not introduce an external avatar
  service or leak ledger addresses via unsolicited image requests.
- Asset metadata/registry images are not currently wired to History. Render a
  deterministic full-identity asset fallback (including issuer, also for assets
  named XLM that have an issuer) and a distinct native-XLM mark. Branded images
  remain deferred to the owning asset-metadata integration; do not claim image
  parity. Generate local visuals independently; do not copy donor assets.
- Use theme tokens, single-line ellipsized titles/secondary text, a flexible
  middle area, a right-aligned amount area, minimum touch height and content-driven
  row height. Primary titles use middle ellipsis; secondary text uses tail
  ellipsis. Do not add per-row divider lines. Keep narrow screens and dynamic font
  in the native acceptance list.

## Evidence required

Automated: name priority/exact identity/network isolation, memo-only nonmatch,
contact removal/failure fallback and subscription wiring, payment directions and
large exact amounts, zero/positive trustline presentation, unsupported fallback,
date/time placement, amount splitting, detail navigation and search preservation.
Run typecheck, applicable lint, strict architecture, locales and provenance checks,
plus affected Activity/contacts/navigation tests. CI and an independent review
must reference the exact current remote PR head.

Native product acceptance remains pending: Android/iOS real layout, small screens,
dynamic font, avatar rendering, contact edits while the list is visible, account /
network switch, cached offline rows, refresh/pagination, detail return and screen
reader traversal. Unit tests, JS bundles or helper screenshots do not close it.
Stage 9 iOS real-device System Auth cancellation/retry remains deferred.

## Developer verification (2026-11-02 candidate)

- All stages of the repository `npm run check` pipeline passed, with Jest invoked
  using `--watchman=false` for the sandboxed host: 192 suites / 1544 tests passed.
  This includes TypeScript, lint, script/format checks, aliases, strict architecture,
  fixed-snapshot provenance, locales and the existing WebView patch verification.
- Android and iOS production-mode JS bundles passed. An external temporary Metro
  configuration watches the shared dependency directory and disables Watchman;
  repository/native build configuration and dependencies were not changed.
  The existing React Native private-featureflag export warning uses its normal
  file-resolution fallback.
- A clean-room implementer worked from this behavior contract and Fresnica source,
  without opening donor source. The parent checked the implementation and evidence;
  this is not the independent exact-HEAD PR review.
- No Realm schema/cache DTO, signing, authorization, exact-XDR or submission/recovery
  code changed. Realm integration/native builds/device flows were not repeated for
  this presentation-only delta. The dependency PRs retain their own review and
  migration evidence requirements.
- Independent exact-remote-HEAD review and native product acceptance remain separate
  gates. No full Activity parity, branded-asset image parity or L3/L4 upgrade is
  asserted by these automated results.

S13 Slice 5c merged via #157 (`d1585ac1ecea0dfd081de5f8528c6289ffa92e91`).
Slice 5d candidate adds operation-only account data history (name, no content or
add/update/delete inference), specified in `s13-account-data-history.md`.
Current maturity and native acceptance remain unchanged; other classic families,
failure/visibility, constructor variants, amount enrichment and imagery stay open.
