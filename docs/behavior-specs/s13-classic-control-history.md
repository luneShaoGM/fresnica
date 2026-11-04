# S13 classic account controls — Slice 5e

Baseline main 248f5052dfc556ef18f5d08e7b472c46cab45380. S13 Adapt/clean-room;
Foundation 0/2a/2b and Stage 2.5 available, 2c partial. Written before implementation
from Fresnica and official Horizon operation contracts; no donor implementation.

Successful account_merge, set_options, revoke_sponsorship and historical inflation
receive neutral Other rows, source/peer identity, no invented monetary amount.
Merge requires account equal to source and distinct Classic into; source and into
are associated and the other party is the row identity. Revoke associates source
or its explicit target owner; no generic injected participants. Options/inflation
associate source only. All require literal success and exact Classic source.

Keep applicable validated public parameters, strip unknown/inapplicable fields.
Merge preserves account/into. Options preserves optional inflation_dest Classic,
master_key_weight/low_threshold/med_threshold/high_threshold and signer_weight
integer 0..255, signer_key G/T/X StrKey-shaped string paired with signer_weight,
home_domain exact printable UTF-8 <=32 bytes including empty (clear), and optional
set/clear flag arrays containing distinct known 1/2/4/8 with no overlap. Empty
options are valid. Do not interpret weights/flags as present account state.

Revoke requires exactly one target family: account_id; claimable_balance_id;
data_account_id plus data_name (1..64 UTF-8 bytes); offer_id canonical positive
i64 string; trustline_account_id plus either canonical CODE:G issuer asset or
64-hex trustline_liquidity_pool_id; signer_account_id plus signer_key. Validate
owners as Classic, balance ID 00000000+64hex, signer G/T/X shape, asset code1..12
alphanumerics; prevent mixed/incomplete target fields. Actual reserve/payout or
new sponsorship cannot be inferred. Inflation has no operation-specific payload
and must not invent payout, amount or present support for creating inflation.

Detail displays every preserved parameter in full wrapping with localized labels
and evidence limits. Search includes parameter values and common/local identity.
Historical keys/IDs remain exact strings. Never link home_domain as executable URL
or introduce write/auth/signing actions. SDK only projects public fields.

Cache stores frozen own parameters and derived peer; reconstruct through live
mapper under explicit partition and compare peer to reject corruption. Strip
unknown metadata, maintain list/detail equality/legacy fallbacks and partition
isolation. No schema/dependency/native or security-pipeline changes.

Primary authority: official Horizon account-merge, set-options, revoke-sponsorship
operation pages and stellar/go-stellar-sdk protocols/horizon/operations/main.go.
Tests cover each target shape, optional zero/empty, bounded/wrong types, literal
success, source/foreign/target association, cache ownership/stripping/reopen,
neutral/no money/Other/search/locales/full details. Exact-HEAD independent review
and CI required; user has authorized merge after clean review and required CI.
Unit/NodeRealm/bundles are not native acceptance. Stage9 iOS auth stays deferred.
