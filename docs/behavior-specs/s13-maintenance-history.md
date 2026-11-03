# S13 maintenance history — Slice 5b

Status: candidate contract after #152 merged at
`main@1b8aeb6c64d9dab8cf2a67148f44517a3dab15d5`.
Integration base updated to #151 at `b223572205bf35c0c50d3f08c30d2d4ba6c2daac`;
its global-contact identity policy is inherited, not reimplemented in this slice.
S13 / Adapt / clean-room. Foundation 0/2a/2b and Stage 2.5 available; 2c partial.
History owns semantics, Platform wire projection, Activity presentation. Existing
strict scopes apply. Implement from this written specification and Fresnica only;
no donor source/tests/resources/templates. Independent exact-HEAD Work review and
user-controlled merge remain required. No write pipeline, authorization, SDK/Core
contract, dependency, native configuration, Realm schema or maturity change.

## Scope and primary authority

Read successful `extend_footprint_ttl`, `restore_footprint`, `bump_sequence`.
Only literal transaction success qualifies, with exact unpadded Classic source
equal to the viewed account. Association is source-only even if generic from/to,
asset, contract, event or participant fields point at the selected account.
Malformed known shapes remain visible/navigable unsupported rows; foreign detail
is not-associated. Existing common fields/ID, paging, cache/offline/retry/focus,
calendar dates and read-only detail navigation stay unchanged.

Primary references:
- [Horizon extend TTL](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/extend-footprint-ttl)
- [Horizon restore](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/restore-footprint)
- [Horizon sequence](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/bump-sequence)
- [Official Core TTL semantics](https://github.com/stellar/stellar-core/blob/master/src/transactions/ExtendFootprintTTLOpFrame.cpp)

The operation TTL parameter is relative to its application ledger. Horizon prose
calls it a live-until ledger, but Core applies current ledger plus extendTo and
may skip missing/archived/already-longer-lived entries. Show the exact parameter
as an extension horizon in ledgers, not an absolute ledger number/date or proof
that every entry changed. Do not derive a present expiry from device time.

## Validated payloads

- Extend: require wire `extend_to` as a number, an integer from 0 through uint32
  max 4294967295. Do not coerce strings/fractions/nonfinite/negative/out-of-range
  values or use the stale SDK `ledgers_to_expire` name as invented evidence.
- Restore: no additional required operation fields. Describe the historical
  restore operation without inventing entry IDs, contract ownership, counts,
  present availability or asset/amount changes.
- Sequence: require wire `bump_to` as canonical nonnegative decimal string,
  bounded by signed-i64 max 9223372036854775807. Keep the exact string; no JS
  Number conversion, grouping, rounding or scientific notation. This is the
  requested target, not proof of the current sequence or that it increased.
- Preserve only applicable normalized public parameters. Injected amounts,
  events, raw XDR, participants and irrelevant parameters are not monetary or
  association evidence and never enter the normalized row/cache.
- The legacy unsupported `bump_footprint_expiration` spelling is not silently
  reinterpreted as a supported modern operation.

## Presentation and cache

Use existing account identity presentation for the exact source (unambiguous
global address-only contact name, then visible current-network wallet label,
otherwise masked address); stable local
avatar remains address-based. No contract ID/name/avatar is guessed. Localized
maintenance title + existing local time are the secondary line. Tone is neutral,
Other filter only, and the complete monetary column is absent. Do not treat a
sequence or TTL parameter as a balance, fee, income, expense or transaction count.

Detail reuses common source/identity/hash/date rows and adds an exact ungrouped
extension parameter or target sequence where present, with full wrapping.
Localized explanation states the evidence limits above; no nested ledger actions
or affected-entry UI is added. All three locales receive equivalent keys.
Loaded-set search includes localized title, source/transient permitted name,
operation identifiers/hash/type and exact parameter text; existing scope remains.

Add v1 maintenance payloads; validate operation family, literal success, exact
source/account partition, applicable parameters and common fields on cache writes
and reads. Reconstruct via the live mapper, strip unknown fields, deep-freeze
owned payload and preserve list/detail equality. Explicit partition is required;
existing memory/Realm clones preserve it. Keep legacy unsupported operation-type
rows readable; admit operation-shape fallback only for the three new known types
without weakening other unsupported guards. No schema/cursor/security data change.

## Exit evidence and deferred scope

Test all three raw SDK/PublicRead -> History -> cache -> list/detail/search paths;
literal success, source/foreign/injected participants, bounds and wrong types,
zero/max TTL and max sequence above JS safe integer, exact text, no money, Other
filter, localized limits, stripping/freeze/list-detail equality, legacy fallbacks,
memory account/network isolation and real Realm durable close/reopen.
Run appropriate tests/typecheck/lint/locales/architecture/provenance, repository
suite and Android/iOS production JS bundles. Record actual CI and independent
review against exact remote HEAD separately. Unit/helper/Node Realm/JS bundles
are not native acceptance. No device/font/reader/pixel/live-ledger/native retry/
network-switch/performance acceptance is claimed. Stage 9 iOS auth cancel/retry
remains deferred. Remaining classic families, contract constructor variants,
Slice 6 failure/visibility, missing claimable amounts and branded imagery stay open.
