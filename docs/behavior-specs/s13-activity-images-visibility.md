# S13 Activity local asset fallback and reversible visibility — Slice 6c

Status: development candidate, no native product acceptance or maturity promotion.
Trace: S13, Adapt / clean-room (existing Activity list/History reader). The
behavioral target is the independently owned Fresnica Activity screen. Do not
copy donor artwork, images, source structure or tests.

## Public asset icons — stage-2 implementation candidate (not native accepted)

The earlier #166 image code was removed because RN 0.87 fetch could not
bound response bytes during receipt or refuse redirects before network I/O.
The new S06 Phase 2 candidate replaces that approach with a shared,
default-OFF, Mainnet-only native-backed image port. It stores only the
local bounded image bytes in memory; no URLs are handed to RN remote Image.
The owning [S06 icon contract](s06-token-metadata-icons.md) controls
metadata freshness, source matching, privacy consent, network lifetime and
native safety/acceptance gates.

Activity continues to use deterministic local full-identity avatars when
opted out, no native capability is available, or a request fails. Source
logos never represent issuer trust and do not change Hidden Assets, raw
History, filters, pagination, operation detail or transaction authority.
Native product-flow and security network fixtures are **not accepted** yet.

## User-controlled visibility, no automatic Dust/Spam verdict

No amount threshold, issuer popularity, unknown valuation, token code or
catalog branding can classify anything as Dust, Spam or a scam. All ledger
records remain shown by default. A reversible **Manage hidden assets** panel
lists the exact issued-asset identities present in loaded Activity entries.
Only an explicit tap hides/restores that full `(code, issuer)` asset identity.
Native XLM cannot be marked hidden. The panel scrolls independently on
short screens. It never deletes History, alters persisted cache, causes a
network request or adjusts the raw pagination cursor.

Any entry explicitly involving a manually hidden issued asset is omitted from
the current Activity presentation while hidden; this includes paired
operations with the selected asset and claim/claimable-clawback references
whose asset identity was verified by the S13 operation-effects projection.
References without verified asset identity remain ID-only and visible. The **Show hidden activity** action
temporarily reveals all, and **Restore** removes the original local
presentation preference. Failed and unknown records without confirmed asset
identity are never suppressed by guessing. Hidden identities and temporary
show mode exist only in current Activity screen state and reset on
account/network switch or screen remount. This is a reversible display filter,
not a persistent spam list or a ledger assertion.

## Evidence boundary

For this slice, verify default-off consent and that only native bounded
transport supplies optional public image bytes; preserve asset identity
fallback and the existing whole-row accessible navigation. Verify explicit
user hide/restore, mixed asset pairs, no automatic Dust/Spam verdict, loaded
set/search/pagination continuity and network/account visibility reset. Run
Activity/navigation tests, type/lint/format, locale/provenance/architecture
checks and exact-HEAD independent Work review. Android/iOS native layout,
dynamic font, screen readers, offline Retry, focus/account/network switching
remain **NOT ACCEPTED** until actual native product-flow evidence. Native
branded imagery now requires separate native safety and device acceptance. Stage 9 iOS real-device System Auth
cancellation/retry remains deferred as previously agreed. No change to
transaction/XDR, signing, submission, recovery or History cache schema.

## 2026-11-09 Activity completion candidate

The current user explicitly restores Today/Yesterday and requests a compact
unified filter entry instead of three permanent actions. The newer
[s13-activity-controls-completion.md](s13-activity-controls-completion.md)
supersedes earlier absolute-only dates, default-show-all technical controls, and
inline visibility buttons. Shared S06 safety/consent and S13 History authority stay
unchanged. Native acceptance and L3 partial maturity are not promoted.
