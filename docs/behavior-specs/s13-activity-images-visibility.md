# S13 Activity asset images and reversible visibility — Slice 6c

Status: development candidate, no native product acceptance or maturity promotion.
Trace: S13, Adapt / clean-room (existing Activity list/History reader). The
behavioral target is the independently owned Fresnica Activity screen. Do not
copy donor artwork, images, source structure or tests.

## Public asset imagery

Activity continues to render its existing locally generated deterministic
asset identity avatar by default. An explicitly labeled session button enables
optional public images only on `stellar-mainnet`. The label warns that public
image hosts will be contacted. This is a discretionary display request, not
wallet authorization or asset trust attestation. The session switch is reset on
account/network partition change; unfocus, opt-out and unmount retire the
in-progress image requests. Testnet/custom networks and native XLM stay local.
No account-address image endpoint, no wallet address or account ID in image
requests, no unsolicited image reads before opt-in.

Images are resolved using already configured network-scoped public asset
catalogs, with stable source priority and strict case-sensitive asset code plus
full issuer. Conflicting duplicate icons within one source are rejected for
that source. The image URL must be an explicit public HTTPS URL validated by
the existing public URL boundary; credentials, IP literal, local hosts,
fragments, custom ports and redirects are forbidden. Downloads have six-second
deadlines and abort on cancellation; images must be PNG/JPEG, at most 64 KiB
and 512 × 512, otherwise the full-identity fallback remains. There are at most
two active optional resolution tasks, at most 32 waiting consumers (excess
fall back), 10-minute catalog/image memory TTL and at most 32 image cache
entries per app service. Cache keys use network plus exact asset identity, not
account identity. No image URI goes into History/Realm or navigation state.
Actual image decode errors also fall back. The image cannot change an
operation's asset identity, monetary amount, status or classification.

Single-asset subjects, the two asset-pair subjects and individual monetary
captions use the same decorative imagery policy. Opt-out preserves the existing
native XLM mark and deterministic local visuals, entire-row accessibility,
operation detail routing, concrete dates and ledger amount semantics.

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

Verify source/network/issuer isolation, image input and byte handling,
cancel/timeout/concurrency/cache rules, opt-in default/offline/opt-out,
fallback and both pair images; verify user mark/restore, loaded-set filtering,
no false classification, search and pagination continuity. Run impacted
Activity/navigation tests, type/lint/format, locale/provenance/architecture
checks and exact-HEAD independent Work review. Android/iOS native layout,
dynamic font, screen readers, offline Retry, focus/account/network switching
and image decoding remain **NOT ACCEPTED** until observed in actual native
product flow. Stage 9 iOS real-device System Auth cancellation/retry remains
deferred as previously agreed. No change to transaction/XDR, signing,
submission, recovery or History cache schema.
