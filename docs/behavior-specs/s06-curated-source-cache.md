# S06 curated asset source cache — LC5 consumer, phase 1

Status: implementation candidate, pending exact-HEAD independent Work review,
required CI and native product-flow acceptance. Owner: S06 Trustline/Add Asset.
Stellar reference role: persistent per-source curated asset lists with 12-hour
expiry. Decision: **Adapt** to Fresnica's Capability/Platform/App/Feature layers.
No donor code, resources, or unapproved metadata services are migrated.

## Authority and boundaries

- Only Mainnet's three explicit `lobstr`, `soroswap` and `stellarexpert`
  source IDs participate in this cache. URL selection is internal and fixed.
  Testnet or unknown networks never read Mainnet snapshots or request those
  sources; manual exact code + issuer remains available.
- Cache identity is `networkId + sourceId`; asset identity is **exact**
  `code + full issuer`, including case. Public name/domain/icon strings
  remain untrusted display candidates, never proof of verified issuer,
  approval, value, reserve, transaction eligibility, or a safe image origin.
- The cached data contains normalized public directory rows and timestamps
  only. No account address, balance, signer, XDR, wallet permission or History
  data. Cache failure cannot prevent successful online reads or authorize a
  stale trustline. Existing Balance freshness and live Trustline review/
  signing/preflight requirements remain authoritative.
- Explicitly user-entered arbitrary JSON/TOML URLs and the existing
  `/.well-known/stellar.toml` fallback stay **uncached**; unverified metadata
  must not be silently promoted into a durable trusted source. Full issuer
  TOML resolution and 7-day token metadata caching belong to phase 2.
- Remote brand icon download is **not** introduced by this PR; the separate
  default RN transport size/redirect security blocker remains. A stored icon
  URL is never fetched/rendered in this slice.

## Runtime / persistence contract

1. The existing `HttpAssetCatalog` read is wrapped by the public
   `CachedAssetCatalog` port, injected once in AppServices; it uses an
   isolated Realm v10 top-level source snapshot entity. Other wallet schemas,
   migration records, recovery and Account/Signer lifetime are unchanged.
2. A successfully validated per-source list replaces only its own snapshot.
   Fresh snapshots (age under **12 hours**) are returned without a network
   read. Expired snapshots hydrate the Add Asset list immediately, marked as
   cached, while the active Mainnet source is revalidated. An authentic empty
   array or recognized empty list is valid; a malformed/unknown/nonempty
   invalid body must never replace a previously usable snapshot.
3. Source failures retain last-good data as stale and expose retry. The same
   source has a **30-second session-only failure cooldown** to avoid hammering.
   An explicit Retry bypasses cooldown. A partial successful result must say
   some selected sources were unavailable; a truly empty all-failed result
   is not presented as an authoritative empty directory. Source priority and
   case-sensitive asset identity remain unchanged.
4. Exactly one partition is affected by a malformed schema, corrupt JSON,
   size limit, duplicate identity or invalid timestamp. Public snapshots are
   limited to **3000 assets** and **900000 serialized JSON characters** per
   source, with bounded optional display strings. Wrong-network access
   fails closed; no stale cursor or signed artifact is saved.
5. Screen dismissal, focus/foreground deactivation, account/network switch
   and AppServices retirement abort work and reject late replies before cache
   publication. Within the same source, only the newest started refresh can
   replace the persisted snapshot; older out-of-order success/failure cannot
   clobber a newer response. Failures to write Realm are best-effort.
6. This slice does **not** add network fetch endpoints. The inherited
   `HttpAssetCatalog` adapter now rejects *reported* redirects before
   parsing/caching any body, but default React Native fetch still cannot
   guarantee refusal **before** following a redirect, or enforce the size
   limit while receiving the HTTP body. Its 1 MB after-read check is **not**
   claimed as a
   native transport security proof. A separately approved transport hardening
   is required before the broader phase-2 metadata/image scope is promoted.

## Validation and remaining acceptance

Automated: exact-source/network/schema contracts; real Realm v9->v10
migration and reopen retaining Account, Pending, Balance, History and dApp;
per-source corruption and no cross-source damage; 12-hour TTL, manual
refresh, 30-second cooldown, offline stale fallback, bad-list rejection,
independent source results, out-of-order and post-close rejection;
Mainnet Add Asset cached/partial/Retry view and unchanged Trustline guard.

Not claimed: live API provider verification, actual OS offline/foreground
round-trip or process-restart *UI* sequence, large-body native transport safety,
redirection blocking, dynamic font, VoiceOver/TalkBack, real iOS/Android Add
Asset flow, or Stage 9 iOS System Auth cancellation/retry. CI and repository
Realm tests are not native product acceptance. S06 remains at its existing partial maturity and
other LC5 consumers are unchanged.

## Subsequent one-phase/one-PR plan

- **Phase 2 (one PR after phase 1 merge):** full token metadata/resolver,
  verified TOML source policy, 7-day successful metadata cache with failure
  cooling, candidate selection and *separately validated* native image
  transport (bounded while receiving, redirect refusal before the next
  request, cancellation). Integrate common local-fallback icon across
  consumer surfaces only once that transport is independently reviewed.
- **Phase 3 (one PR after phase 2 merge):** remaining currently in-scope LC5
  consumers (dApp detail/icon candidates, claimable current-state snapshots
  and bounded resolver caching) after confirming each owning product contract.
  Do not invent a cloud service, expand claim authority or duplicate existing
  Balance/History caches. Explicitly record intentionally deferred consumers.
