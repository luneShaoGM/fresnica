# S13 Activity controls and calendar grouping — 2026-11-09

Contemporaneous specification before implementation. S13, Adapt/clean-room,
Feature owner Activity, same L3 partial maturity; no signing/write/cache-schema
change. Base main118460b8556641d2e1e28a0561bd71e7fd22ec67. Current user requests
one PR, comparison with Stellar, removal of the three oversized permanent actions,
restoration of Today/Yesterday, and completion of remaining Activity work.
This instruction supersedes earlier concrete-date-only decisions.

## Main surface and controls

A compact right-header filter icon opens a scrollable Activity filter sheet;
the default list has no three full-width technical/media/asset-management buttons.
Search stays available; existing loaded-set operation categories move into the
sheet with visible selected state. A native pull-to-refresh and an accessible
refresh action in the sheet preserve retry/manual reconciliation. A small active
filter indicator explains when the loaded list is restricted. Dismiss via explicit
close, backdrop or system back; no state or data is lost on dismiss. Close on
account/network changes and background/unfocus. Long full issuer labels wrap
and the sheet scrolls at large font sizes; whole rows remain accessible buttons.

One reversible Show hidden activity switch includes explicitly technical records,
small received native payments, and exact issued assets manually hidden by the
user. Default hidden; unknown or failed records are never suppressed as technical
or dust by guessing. The separate Show failed transactions switch includes failed records in the list;
default off. Explicit Failed category remains available for targeted inspection.
Technical types: data, sequence, sponsorship begin/end/revoke, TTL/restore.
Trust authorization/flags hide only when neither source nor trustor is current.
set_options and inflation stay visible.
The existing manual hide list remains screen-session-only, code+fullissuer keyed,
resets per network/account/remount, never mutates raw history or cursor/cache.
No automatic spam verdict from asset name, popularity, value, branding or S11
current-balance risk. S11 live Claimable classifications are not S13 historical
operation authority.

Small received-payment rule: successful literal true payment or path-payment,
direction incoming or self, destination/received asset truly native XLM (not an issued
asset called XLM), positive canonical decimal <=0.1 XLM, exact seven-decimal
integer comparison. For paths compare destinationAmount/destinationAsset. Outgoing, failed, unknown status, malformed/excess precision, non-native asset,
create-account, claim/clawback and other families stay visible. This is only a
reversible local amount display rule, not a dust/spam/scam or valuation assertion.
Explain the threshold in the sheet. Loaded-set filtering never reads extra pages.

Public logos use the existing shared S06 native-bounded port and consent state,
with a compact setting row in the sheet and external-provider explanation. No
new image fetching, metadata authority, default-on media or consent reset on
sheet open. Missing/unsafe/unavailable image keeps the approved local fallback.
Both assets in an asset pair use shared TokenAssetIcon, with stable compact frames
and descriptive row accessibility. Account avatar identity remains independent.

## Dates

Group by device local calendar day. Current date -> localized Today; preceding
local date -> localized Yesterday; all other dates -> existing absolute formatter.
Use calendar subtraction, not a 24-hour elapsed interval (DST/month/year safe).
Do not label future dates Today/Yesterday. Update while foreground across
midnight, and on resume; periodically re-evaluate local time-zone changes.
Only group headers are relative; cache last-updated and operation detail retain
their absolute timestamps. Monetary values and ledger timestamps are unchanged.

## Exit evidence

Tests cover sheet open/close/back, all category/hidden/failed/reset/search/pagination
paths, exact dust boundary and exclusions, calendar boundaries/DST/future dates,
relative-header locales, midnight/resume cleanup, shared icon delegation and pair
layout. Run relevant automated tests plus type/lint/architecture/provenance/locale
and dual JS bundles. Independent exact-HEAD Work review and actual CI required.
Attempt actual Android/iOS product checks without modifying unrelated checkouts,
clearing user wallets or changing account/signing state. Record precise evidence
levels: fixtures/helper/native emulation are not real-ledger, real-device or
screen-reader acceptance. Stage9 iOS System Auth cancel/retry remains deferred.

Filters use draft state: Cancel discards type/hidden/failed/manualasset edits; Apply
commits them atomically. Public icon consent is a separate immediate session setting
(especially immediate opt-out), unaffected by filter Cancel. Existing operation
category semantics are retained; advanced amount/asset/direction query composition
is not introduced by this UI correction.

## Completion scope after independent behavior investigation

Reference review at Stellar bd0f4540b2496a57314e4e29bc6fcf8ff691b60f confirms
additional axes. This PR also adds direction (received/sent), distinct Swap/Offer/
Pool types, exact full-identity assets present in loaded entries, amount <=/>=
10/25/50/100/250/500/1000. Each group is single choice and deselectable; groups
combine. Comparison and quantity must both be selected to restrict amounts.
Labels explicitly include equality. Active chips remove each field independently.
Assets are loaded-history scoped, not a claim that the list contains all held
assets. Search remains AND with filters as an explicit Fresnica preservation.

Amount filtering uses exact integer decimals, only verified successful actual
quantities, not offer intent, trust limit, failed amount or pool share count.
When asset/direction and amount are combined, all predicates bind to the same
actual quantity leg. Self path exchanges expose outgoing source and incoming
destination legs; issuer clawback burns are neutral, never received issuer income.
Unknown quantities cannot satisfy an amount or direction condition. With asset
alone any explicit normalized entry asset may match, including offer intents.
No fiat conversion or code-only issuer matching. Failed rows may match type and
show-failed, but never fabricate asset/amount/direction to satisfy those filters.
These are deliberate safe Adapt differences from the reference.

Reference audit evidence (paths only, no code copied): Events/EventsView,
Modal/FilterEvents, Events/helpers/eventsOperationVisibility and eventsOperationFilters
at the fixed SHA above. The independent behavior report is retained separately;
there was no reference native App execution or pixel-level acceptance.
