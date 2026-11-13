# Home Token list presentation maintenance — 2026-11-10

Scope: S05/S06 Home and shared public-address abbreviation (S02/S09/S11/S13/S22).
Maturity remains unchanged: existing Home product maintenance, no L4 promotion.
Decision: Adapt, clean-room presentation using Fresnica components and AppTheme.
Feature owner: Home; balance/reserve truth remains the Balance Capability.
No new architecture scope or business/security boundary is introduced.

Reference evidence: pinned Stellar `bd0f4540b2496a57314e4e29bc6fcf8ff691b60f`,
`src/components/Modules/AssetsList/Tokens/{TokensList,NativeItem,TokenItem}`.
Only visible roles were studied; source, resources and implementation structure
are not migration templates. Independent implementation review is required
before merge under the provenance policy.

## Visible behavior

- Home Token lists have no bottom refresh text/button, including the empty
  issued-token state. Pull-to-refresh and automatic silent revalidation remain
  available; real failures retain their existing retry feedback.
- The category header directly precedes pinned XLM, without an empty footer band.
- XLM stays outside the independently scrolling issued-token region. Show its
  logo/name, a prominent available balance when verified, and a muted reserve
  row. Until available is known, label the shown ledger total as account balance.
- Issued rows show a plain token avatar, code and abbreviated issuer on the
  left, and a small token icon with the balance on the right. Avoid a second
  duplicate code line. Preserve full asset identity for taps and accessibility.
- Do not invent fiat rates, token metadata, locked amounts or reorder controls
  absent from the current Fresnica product contract.
- Revalidation retains an accepted XLM breakdown within the same account,
  network and reader while the new request is pending. Replace it on success;
  clear it on failure. Reject changed totals, stale balances, other partitions
  and obsolete responses. This is display continuity, never spending authority.
- All existing abbreviated public addresses use the shared formatter:
  trimmed input, first four + literal `...` + last four; at most eight characters
  remain whole. Full copy/share/QR/review identities remain exact.

## Acceptance and evidence boundaries

Automated checks cover abbreviation, refresh continuity, failures, focus,
account/network/reader changes, obsolete completion and total matching.
Native layout, repeated refresh, large text and screen-reader acceptance on
iOS/Android remain separate from JSX/hook tests. No native acceptance is
claimed by these repository checks. Stage 9 iOS device System Auth remains deferred.

## Asset-row visual alignment — 2026-11-10

This S05/S06 maintenance slice adapts the visible roles established by the
reference above; implementation is independently written in Fresnica.

- Issued rows use 35-point rounded, cover-fit avatars, compact 55-point minimum
  height (allowed to grow for accessibility), no per-row separator, a single-line
  code with middle truncation and a muted issuer subtitle. Prefer an existing
  validated metadata domain; otherwise use the shared abbreviated issuer.
  Domain display reads only the current network-scoped icon/metadata port and
  never initiates another remote request or implies issuer authenticity.
- The amount prefix is a 12-point rounded, bordered token icon. Display exact
  decimal strings with grouped integer digits and without redundant trailing
  fractional zeros; never convert monetary values to Number or round them.
  Keep full exact balances and issuer identity in accessibility labels and tap
  callbacks. Single-line amounts may visually ellipsize on narrow screens.
  Above 1.5x system font scale, move amounts to a full-width next line and
  allow code/amount wrapping; never disable system text scaling.
- XLM remains pinned with a more prominent, theme-colored name and amount,
  distinct local monochrome XLM amount symbol, and the existing available versus
  account-balance label. Its muted reserve row groups a lock capsule, label,
  small XLM symbol and amount. Unknown reserves remain a dash; do not show zero.
- Reuse the already owner-approved XLM artwork family. Do not copy donor code,
  fonts or unrelated artwork. Use platform monospace fonts for monetary text.
- No fiat estimates/toggle, LOCKED figures, privacy balance mode, ordering,
  transaction changes or new persistence are introduced. Existing refresh,
  failure, account/network isolation and image-privacy rules remain authoritative.
- Verify exact decimal formatting, same-code/different-issuer callbacks and
  accessibility, unavailable/ready XLM, cached-domain fallback, privacy/session
  revocation and domain update after metadata completion even without an image.
  Native narrow-screen, large-text, dark-theme and screen-reader acceptance
  remains separate from repository tests; no product maturity promotion.

## Refresh failure light feedback — 2026-11-12

S05/S06 presentation maintenance; maturity and Capability ownership unchanged.
Adapt the user-reported clipped failure feedback using existing Fresnica UI,
independently written with no donor implementation or new architecture scope.

- With cached balances, show a compact, politely announced text hint below the
  asset scrolling region, outside the height-limited header and pinned XLM.
  Text wraps with system font size; no fixed height, overlay or large Retry button.
- Keep the failure/previous-balances message visible so cached data is never
  presented as current. Pull-to-refresh remains the retry path. Fresh success
  removes the hint; other accounts/networks use their own existing display state.
- No-cache failures retain their full error state and explicit retry action.
  Detail sheets keep their existing timestamp and Retry presentation.
- Repository layout/behavior checks are distinct from Android/iOS native visual,
  large-text and screen-reader acceptance; native acceptance is not claimed.
