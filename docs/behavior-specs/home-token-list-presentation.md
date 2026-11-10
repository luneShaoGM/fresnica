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
