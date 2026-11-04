# S13 Activity local asset fallback and reversible visibility — Slice 6c

Status: development candidate, no native product acceptance or maturity promotion.
Trace: S13, Adapt / clean-room (existing Activity list/History reader). The
behavioral target is the independently owned Fresnica Activity screen. Do not
copy donor artwork, images, source structure or tests.

## Branded asset images — explicitly deferred

This slice **does not offer** remote branded image downloads, public image
consent controls, image transport adapters, or external image requests. Activity
continues to use the deterministic full-identity local avatar (including the
issuer) and the independent native-XLM mark. Images do not imply asset trust.
The public curated catalog remains an Add Asset concern; Activity does not
contact public image hosts and never sends account identities for decoration.

The previously attempted fetch adapter cannot meet the security and functional
requirements in React Native 0.87.0's default whatwg-fetch/XHR path: it supplies
no Response.body.getReader() and does not enforce redirect: error before native
network requests. Returning a local fallback on every default-native response
is not successful image integration. Allowing arrayBuffer() as a workaround
would remove the 64 KiB memory guard.

A separately reviewed future image slice requires **both**:
- A supported native/verified streaming image transport that enforces a 64 KiB
  byte cap *while receiving*, with cancellation, deadline and no unbounded
  allocation even if Content-Length is absent or wrong.
- Redirect refusal at the actual network transport boundary **before** a
  secondary request, including tests showing a forbidden target receives no
  traffic. Post-response URL checks are not sufficient.

Then implement opt-in on Mainnet only, exact case-sensitive asset code plus
issuer source matching, stable trusted source priority, no private/local/IP
literal/credential/fragment/custom-port URLs, PNG/JPEG validation and 512 by
512 dimension cap, two active resolutions, bounded queue and memory-only TTL
cache. No image metadata or bytes in History/Realm/navigation and no wallet
account derived keys. Verify both Android and iOS **native product flows**
before claiming the feature available. Do not copy donor artwork or source.

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
operations with the selected asset. The **Show hidden activity** action
temporarily reveals all, and **Restore** removes the original local
presentation preference. Failed and unknown records without confirmed asset
identity are never suppressed by guessing. Hidden identities and temporary
show mode exist only in current Activity screen state and reset on
account/network switch or screen remount. This is a reversible display filter,
not a persistent spam list or a ledger assertion.

## Evidence boundary

For this slice, verify the absence of any public image request/opt-in or
unsafe image transport in AppServices/Activity; preserve asset identity
fallback and the existing whole-row accessible navigation. Verify explicit
user hide/restore, mixed asset pairs, no automatic Dust/Spam verdict, loaded
set/search/pagination continuity and network/account visibility reset. Run
Activity/navigation tests, type/lint/format, locale/provenance/architecture
checks and exact-HEAD independent Work review. Android/iOS native layout,
dynamic font, screen readers, offline Retry, focus/account/network switching
remain **NOT ACCEPTED** until actual native product-flow evidence. Native
branded imagery remains deferred. Stage 9 iOS real-device System Auth
cancellation/retry remains deferred as previously agreed. No change to
transaction/XDR, signing, submission, recovery or History cache schema.
