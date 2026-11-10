# S13 Activity avatar alignment — 2026-11-10

Written before implementation; S13 Adapt/clean-room, same L3 partial maturity.
Follow-up to merged #182 at maina953cba9e9cc94990be7cdb66f4890c41268327c.
A merged PR cannot accept another mergeable change; all avatar work goes into one
new linked PR. Behavior inputs: independent pinned reference audit
[s13-avatar-reference-audit-2026-11-10.md](s13-avatar-reference-audit-2026-11-10.md),
Stellar bd0f4540b2496a57314e4e29bc6fcf8ff691b60f. No donor source/test/art copied.

## Presentation

Activity account subjects use a 40-unit rounded square (radius11) address image,
not local green identicons, contact branding or initials. If remote avatars are
OFF, unavailable, loading or rejected, show an independently drawn generic person
symbol. Names/Memo do not change avatar identity. Other AccountIdentityCard
consumers retain their current behavior; compact Activity injects this visual.
Single asset subjects keep shared S06 exact-identity TokenAssetIcon inside an
Activity-only 40-unit frame with radius11 and cover image scaling. Other Token
consumers keep contain scaling; approved local missing-token art is unchanged. Asset pairs
use 40-unit canvas with two25-unit images diagonally overlapping, first upperleft,
second lowerright; preserve normalized asset order even if a side is unavailable.
Contracts including create/upload/asset origin/invoke and TTL/restore use an
independently drawn document glyph, never a contract/deployer/balance-ID identicon.
ID-only claimable references use their known source account or generic fallback;
never fabricate an asset image from balance ID. Monetary-caption asset icons
use10-unit frames. Scope does not alter exact amount, title, detail, participant,
failed no-money, filter, pagination or cache authority.

## New independent address-media privacy contract

Account avatars have an explicit Settings -> Privacy switch, default OFF.
Disclose destination StellarCN (horizon.stellarcn.org), full displayed public
account/counterparty addresses, IP and request time. Token image preference,
including its default ON, never enables account-avatar requests. Persist the
optional boolean in the existing validated JSON network-settings store (no Realm
schema change); absent old values mean OFF, nonboolean rejected. Save failure
leaves the prior effective permission intact; toggles do not retire the network
or change transaction/account authority. Never fetch an avatar during code tests
or development using real wallet/contact addresses.

The sole provider protocol is HTTPS horizon.stellarcn.org/avatar/v2/{address}
with size=256. Address is trimmed full G56 or M69 uppercase public shape, preserving
M text; invalid/empty input never sends a request. No Memo/name/secret/network or
arbitrary URL input is transmitted. Provider ownership/availability, M support,
generation algorithm, account authenticity and pixel equality are NOT attested.
Do not copy provider or default-profile artwork or use another identicon algorithm.

Reuse existing native SafePublicTransport readIcon, with bounded bytes/dimensions,
public-IP/TLS policy and no redirects before I/O. React Native Image receives
only bounded inline PNG/JPEG data URIs, never external URLs. At most two active
account image loads, bounded waiting, six-second per-consumer budget; cancel on
consumer leave, background/offline, OFF, retirement. Independent caller aborts
must not cancel another consumer; duplicate queued identities reuse completed
memory images. At most64 memory-only images,10-minuteTTL, no persistent image or
address log. OFF/close clear memory; late results cannot repopulate it. Readability
changes invalidate waiting work and cause mounted active rows to retry on resume.
Cache identity is exact trimmed address within the network-service lifetime;
network retirement clears it. Decode failure retires that image and stays generic
until a later explicit retry/lifetime change (no infinite image-error loop).

## Evidence and scope

Test old default OFF and persisted opt-in/OFF/failure, no Token-consent coupling,
exact provider inputs, G/M isolation, bounds/timeouts/queue/independent cancel,
late-result cache fencing, lifecycle restart, safe data URI fallback, all affected
row families and pair ordering, whole-row accessibility. Run current tests/type/
lint/architecture/provenance/locale, production JS bundles and independent exact
HEAD review+actualCI. New code uses Fresnica capability/platform boundaries, with
no signing/XDR/submit/recovery or wallet Realm schema changes. Native product,
real avatar-service and visual/screen-reader acceptance remain separate; no actual
address is sent while implementing or testing. Stage9 real-iPhone auth deferred.
