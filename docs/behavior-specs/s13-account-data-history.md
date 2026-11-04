# S13 account data history — Slice 5d

Baseline: main d1585ac1ecea0dfd081de5f8528c6289ffa92e91 (#157 merged).
S13 / Adapt / clean-room; Foundation 0/2a/2b and Stage 2.5 available, 2c partial.
History owns semantics/cache; Platform projects public wire; Activity owns rendering.
Existing strict scopes apply. This contemporaneous specification precedes code.
No donor source, tests or resources; independent implementation review required.

## Contract

Read successful manage_data operations using existing maintenance presentation.
Require literal success and exact unpadded Classic source equal to viewed account.
Only source associates detail, even for malformed records; injected to/from,
trustors, assets or amounts do not grant association. Other/neutral, account
identity, existing calendar dates/time, no monetary column or write action.

Require name string of 1–64 UTF-8 bytes; preserve whitespace and Unicode exactly.
Reject unpaired surrogates, control characters, nonstrings and oversized names.
Wire name becomes dataName. Store only name, common identity and success. The
value is deliberately neither projected nor persisted/displayed/searched. This
is an operation-only record: do not infer add/update/delete or current existence,
content, reserve change, permissions or payment from it. A missing value is not
needed to render this limited operation evidence. No account-data editor added.

Primary authority:
- https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/manage-data
- https://github.com/stellar/go-stellar-sdk/blob/main/protocols/horizon/operations/main.go
The Horizon operation documents a bounded name and set/modify/delete operation;
SDK protocol serializes name/value as strings. Do not interpret empty wire value
as proof of deletion or decode it into a user-facing action.

## Surface and cache

Localized title Account data changed. Detail adds exact full-wrapping Data name
and a localized evidence-limit explanation. Loaded-set search includes name and
existing operation/common identity/contact terms; never values. Existing source
identity/contact policy stays unchanged. Three dictionaries use equivalent keys.

Extend maintenance v1 cache reconstruction via the live mapper, requiring exact
operation family, success, source and explicit account/network partition. Reject
missing/invalid canonical name; strip irrelevant fields and freeze owned data.
Keep legacy operation-type fallback readable; allow operation-shape fallback for
this known type without changing other-family guards. No schema/dependency/native,
SDK/Core authorization/signing/submission/recovery or lifecycle changes.

## Acceptance

Cover raw SDK/PublicRead -> History -> cache -> list/detail/search, literal-success
and source/foreign association, UTF-8 64-byte boundary, unpaired surrogates/control,
whitespace preservation, missing/wrong name, injected value/amount/participants,
no money, Other filter, three locales and full detail text. Validate cache
list/detail equality, unknown stripping, freeze, account/network isolation and
real Realm close/reopen. Run relevant checks/full suite/production JS bundles.
Independent exact remote HEAD review and actual CI are separate evidence.
No native acceptance claimed; native offline/retry/switch, accessibility/device
and Stage 9 iOS auth remain deferred. Remaining Activity families stay open.
