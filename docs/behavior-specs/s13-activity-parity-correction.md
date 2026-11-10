# S13 Activity parity correction — 2026-11-10

User-authorized follow-up to #184; main677325b0d3558ffe159fc95ce5565a463acd3e02.
Stage4/S13 Adapt, clean-room, L3 partial. Behavior input: pinned independent avatar
reference audit and subsequent investigation of Stellar bd0f4540. No donor code/art
copied. One Activity correction PR, no signing/submit/recovery changes.

## Silent refresh

Routine foreground synchronization must not add a bottom polling/checking notice,
spinner or dim/flash Activity buttons. Retain existing rows, scroll position and
loaded pages when unchanged. Use internal single-flight guards, not changing button
appearance, for background head requests. Explicit pull-to-refresh and load-more
retain feedback. Actual offline, wrong-network and failed reads remain honest.

## Address media

Default address avatars ON (absent preference means ON), preserving explicitly
persisted OFF and independent Token preference. Update all privacy disclosures.
Use exact full displayed public address; no contact name/Memo/secret is sent.
Keep existing fixed HTTPS StellarCN endpoint and direct bounded transport rather
than adding a second third-party processor. Pinned donor uses wsrv proxy; this is
an explicit transport Adapt, not a claim of identical routing. The 2026-11-10 fixed
zero-public-key test image is PNG256x256/89963 bytes (same PNG/JPEG Accept header);
old native64KiB limit rejected it. Add avatar-only256KiB native byte budget with
unchanged public-IP/TLS/no-redirect/time/dimension checks; keep Token icon64KiB.
Validate matching JS base64 limits, abort/OFF/retirement and bounded memory.
Use a bounded60-second per-consumer queue budget (native request still8 seconds),
so waiting visible rows are not discarded after just6 seconds. Virtualize Activity
rows to avoid mounting/fetching500 offscreen avatars during cache expansion.
Do not use actual wallet/contact addresses in development requests.

## Transaction context and titles

Read operations in descending pages15, include_failed and join transactions.
Only accept joined transaction memo when hash matches exact operation transaction
hash; validate typed text/id/hash/return (Horizon hash base64 -> canonical hex).
Carry optional display-only recipient+typedMemo context into normalized history
and cache. Old records without context remain valid; malformed context fails
closed and never supplies a contact name. Memo applies only to its exact recipient.
Resolve names: unique exact typedMemo contact, unique address-only contact,
network-scoped visible wallet label, masked address. No remote name authority.
Pair titles use source / destination, not Swap/arrow. Contract invoke uses known
trusted catalog name if available, otherwise masked contract identity or operation
label; create/upload/TTL/restore use operation labels, never deployer/asset title.
Failed display discards transaction Memo (its DTO cannot prove recipient binding)
and may preserve validated intent subject, never executed amount,
asset change or success. Legacy failed cache lacks subject and falls back honestly.

## Loaded history

Hydrate network/account-scoped cache, revalidate newest pages until overlapping the
cache head or exhaustion, bounded120 pages. Merge fresh records ahead of cache,
deduplicate by operation ID; numeric paging-token ordering without Number loss.
Never retain persisted cursors as online authority. Fill current-session history
in background toward500 entries, with online cursors only; at most120 pages per
fill, stop on repeated cursor/partition leave/manual refresh. Guard each async
result by current request generation. Transient errors preserve content and retry;
never infer completeness from empty filtered results. Touching list end after user
scroll triggers one next page (button remains accessible fallback). Search operates
on loaded records; entering search clears advanced filters, applying filters clears
search; preserves global default visibility/dust policy. Today/Yesterday retained.

## Verification

Tests cover real-size image bounds without live wallet addresses; defaultON and
explicitOFF persistence; late results and cancellation; hash-bound memo and exact
recipient names; failed intent without money; title families; cache catch-up,
background bounds, repeated cursor, pagination retry and account switch; no normal
polling notice/button flashing. Native transport changes require platform builds
and meaningful native checks. Report simulator/device execution separately from
helper/Jest/CI. Stage9 real-iPhone System Auth remains deferred.
