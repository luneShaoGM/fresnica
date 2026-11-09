# S11 Claimable Balance — Fresnica product contract (2026-11-09)

**Reference:** self-developed Stellar Claimable category, item, detail and
service at audited donor commit `bd0f4540b2496a57314e4e29bc6fcf8ff691b60f`.
**Original S11 delivery:** merged PR #178 on `main@f898e8f04e9096dfdd553d00400e5dbc73f20978`.
**UI parity follow-up:** Claimable presentation adapted to Stellar's
Home in-place category switch; [side-by-side delta](../s11-claimable-ui-parity-delta.md).
**Product owner:** S11 Claimable Balance. Architecture: React Native feature,
application `capabilities/claimable`, public Horizon gateway and
network/account-scoped Realm v13 cache. **Decision:** Adapt the team's
self-developed behavior; no direct source blob copies. User expressly
authorized adaptation/migration on 2026-11-09. File-level provenance
review remains required before any future byte-for-byte copy.

## Entry and presentation

- Home's `Assets ▼` header opens an in-place category chooser. The
  Claimable option appears only for a current or previously observed balance
  on this network/account, or in Developer Mode. The selected category
  changes the Home asset area, **without navigating to another screen**.
  LP remains unavailable until SDEX/LP is implemented. A clock badge with
  a count of **SAFE + currently eligible** records uses only a fresh
  current-network/account snapshot.
- Readable identity uses the existing public `TokenAssetIcon` and
  semantic theme. Main rows group SAFE then expandable SUSPECT, with SPAM
  collapsed by default and 20 items added per View More action. Pull refresh
  forces a new snapshot. Empty/failed/offline states distinguish a stale
  display-only cache from trustworthy live status.
- Details use the existing Fresnica centered, height-bounded `AppModal`
  with asset identity, amount, colored availability state card and Claim
  action above a scrollable, expandable technical block containing full
  Claimable Balance ID, sponsor, issuer and ledger modified time. Risk and
  unavailable reasons remain visible before confirming.
  Display-only Mark spam/Restore normal is partitioned by network, account,
  balance ID. Neither flag creates trustline, account authority or a signer.
- SAFE/SUSPECT is a display heuristic, not cryptographic asset safety
  proof. Unknown credit assets remain SUSPECT, large/dust/bursty issuers
  may be SPAM. A user may override a record's visual risk but **not**
  its Claimant, predicate, network or exact transaction semantics.
- Relative predicates whose true creation-time ledger epoch is unknown
  remain UNKNOWN and cannot be claimed. Explicit AND, OR, NOT,
  unconditional and absolute predicates are parsed with bounded depth,
  node count and numeric range. Claim eligibility is recomputed from
  current time, not blindly trusted from saved UI state.
- Inactivity, backgrounding, leaving Home, account/network switching or
  category changes retire the live Claim review. A monotonically increasing
  category epoch makes the old attempt invalid even if a user immediately
  switches back to Claimable before React commits another frame. This is
  checked by the existing authorization/sign/submit pipeline, not merely
  a UI state change. Durable pending/outcome recovery remains authoritative.

## Ledger/cache and transaction

- Query only the authoritative **current** network Horizon
  `/claimable_balances?claimant={account}`, 50 items per page with cursor
  integrity; 20 pages / 1,000 records maximum. A malformed row, claimant
  mismatch, repeated ID/cursor, missing full-page cursor, excess total,
  timeout or incomplete pagination fails closed, preserving the prior
  cache instead of storing a partial snapshot.
- Public snapshot TTL 1 h and retry cooldown 30 s. Realm v13 stores
  only validated public read records and per-account/network spam
  overrides. No key material, XDR, authorization tokens or secrets
  are persisted in Claimable Realm entities.
- Claim requires an active Classic account, the exact current network,
  a single supported local signer and live Horizon by-ID verification
  with the exact matching claimant, asset identity, amount and predicate.
  Credit assets must have a live authorized trustline.
- Prepare using current ledger base fee and one
  `claimClaimableBalance` operation. Independently inspect exact
  unsigned XDR source, network passphrase, operation ID, fee,
  expiry, absent memo, absent signatures and absent per-operation source.
  Review displays the complete credit asset identity, including the issuer,
  and stores that exact XDR in local feature state, **never** navigation params.
- Before signing, re-read current live eligibility. The S11 route/account/
  foreground focus epoch must remain current across asynchronous eligibility
  reads, ledger authorization and native System Auth/passphrase signing.
  A retired route discards any returned signed XDR **before** creating a
  durable pending intent or broadcasting. Once a pending record exists, the
  pre-existing uncertain/check-only recovery semantics remain authoritative;
  a route blur cannot retroactively cancel an accepted broadcast.
  Call the existing `submitReviewedTransaction` with claimable intent identity and
  the existing SDK/Core protected signer, authorization, app passphrase,
  ledger weights, persisted pre-broadcast pending hash, submission and
  uncertain/recovery semantics. Never double-broadcast on uncertain.
- Claim result distinguishes submitted, rejected, uncertain, unsupported,
  passphrase-required, watch-only and insufficient authorization. A
  'Check original status' action invokes the existing recovery coordinator.
  No native capability is claimed merely because helper tests pass.

## Verification and deferred evidence

Automated tests should cover strict Claimant, predicate, malformed
response, cross-network isolation, partial vs complete pages, cache
retirement, exact-XDR inspection, signer gating, re-read before signing,
Realm v12→v13 public migration, and current-account Home entry.

iOS/Android native transaction, visual accessibility and background/auth
cancellation remain for Stage 9. S09 iOS real-device System Auth
cancel/retry is explicitly still deferred. Current S13 claim/clawback
history remains a **historical operation feed**, not the S11 live
claimable source of truth.
