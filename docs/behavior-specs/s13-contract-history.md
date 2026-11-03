# S13 contract history — Slice 5a

Status: implementation contract, based on merged #150 at
`61d69a8af760256a84730547cfbbf307d24c4017`.
S13 / Adapt / clean-room. Foundation 0/2a/2b and Stage 2.5 available; 2c partial.
History owns read meaning, Platform SDK decoding, Activity presentation. Existing
strict scopes apply. Implement from this specification and Fresnica code without
donor source/tests/resources or implementation templates. Independent exact-HEAD
review precedes user-controlled merge. No S20/write/signing/XDR authorization,
submission/recovery, dependency, native config or Realm schema changes.

## Authority and bounded scope

Specialize successful `invoke_host_function` only, with the documented exact
Horizon function discriminators for InvokeContract, CreateContract and
UploadContractWasm. Unrecognized subtypes (including constructor variants until
explicitly covered), failed/missing success and malformed known evidence remain
visible/navigable unsupported shapes. Require exact Classic operation source
and literal successful transaction evidence. Never infer a payment or income
from the function name, arguments, top-level generic from/to or caller identity.

Primary protocol references:
- [Horizon invoke object](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/invoke-host-function)
- [Official Go Horizon operation model](https://github.com/stellar/go-stellar-sdk/blob/main/protocols/horizon/operations/main.go)
- Installed official JS SDK 17.0.1 Horizon types and ScVal/Address decoding APIs.

These establish host variants, parameter encoding and side-effect event fields.
Horizon's asset-event projection is incomplete for general contract behavior;
do not call the event list a complete balance delta or a complete event history.
This slice does not add RPC, effects, per-row lookup or current-balance enrichment.
Footprint TTL/restoration and other remaining classic operation families stay
open as later Slice 5 work; failure/visibility remains Slice 6. Missing claimable
historical amounts, branded imagery and native acceptance remain open.

## Host identity

- InvokeContract: Platform decodes only first two Horizon parameters as exact
  canonical base64 ScVal contract address and symbol (declared types Address and
  Sym). First must be a valid contract C-address, second a valid 1–32-character
  contract function symbol. SDK work stays in Platform; no raw XDR/arguments cross
  into History/cache/features. Reject wrong ScVal types, trailing bytes, invalid
  checksum/noncanonical address, malformed encodings or symbol. Bound input
  parameter count to 128 and first identity values to 512 encoded characters.
  Additional call arguments are not decoded or persisted and never prove payment.
- CreateContract: use explicit newly created valid C-address from Horizon
  `address`; do not derive it from salt or operation ID. No salt persistence.
- UploadContractWasm: explicit upload classification, no guessed contract ID,
  name, code hash or arguments. Only source association; no monetary column.
- Recognize exact documented strings
  `HostFunctionTypeHostFunctionTypeInvokeContract`,
  `HostFunctionTypeHostFunctionTypeCreateContract`,
  `HostFunctionTypeHostFunctionTypeUploadContractWasm`.
  Do not silently treat unknown discriminator text as a generic successful call.

## Asset side-effect evidence

For InvokeContract, normalize `asset_balance_changes` only when an actual array
with at most 128 elements is supplied. Missing/null means unavailable, not zero;
an empty array means no balance events reported, not proof of no balance change.
Malformed supplied arrays fail the specialized row closed, rather than silently
dropping an event and falsely showing a partial summary. Create/upload may have
missing/null/empty events only; contradictory nonempty events are unsupported.

Each event preserves gateway order and contains a full classic asset identity,
exact nonnegative amount (maximum seven decimal places; signed-i128 upper bound
in 10^-7 units), event kind transfer/mint/burn/clawback and the applicable
explicit parties. Use strings/BigInt; never JS Number or a signed-i64 payment
amount helper for the larger SAC domain. Zero is allowed and unsigned/neutral.
Native XLM and an issued asset named XLM remain distinct. Accept wire SDK fields
`asset_type`, `asset_code`, `asset_issuer`; do not infer issuer from caller.

Transfer needs from and to; mint only to; burn/clawback only from. Parties may be
exact G or C addresses. For inapplicable fields accept absent/empty wire values
but reject contradictory nonempty parties. Validate all supplied applicable
parties and assets. Strip unknown metadata. No generic contract tokens or
unverified decimal scales are promoted to classic assets.

Optional event `destination_muxed_id` is a canonical unsigned-u64 decimal string,
valid only on a recipient-bearing event with Classic G recipient. Preserve as
explicit routing-ID evidence distinct from a Memo. Do not manufacture an M
address, assume memo semantics, or resolve a contact name for that routed
destination from its G base. Blank/padded/invalid IDs fail closed. No contact
alias or contract name is inferred across identity kinds or networks.

Derive viewed-account direction per event from explicit parties: incoming,
outgoing, self, or unrelated. Transfer to self is neutral once; mint to the viewed
account is incoming; burn/clawback from it is outgoing. Issuer/caller alone never
receives an implied credit for burning/clawing back. Include only relevant event
quantities in the list preview; full detail still shows every accepted event.
Do not net, aggregate, reorder, deduplicate or silently merge separate events.

## Association and presentation

Detail association is operation source or explicit valid event from/to matching
the viewed Classic account. It never follows arbitrary decoded call arguments,
generic top-level participants or asset issuer alone. Establish event association
independently of amount validity so an explicit participant can receive an honest
unsupported-shape detail if other payload fields are malformed. Inspect bounded
arrays only. Foreign details remain not-associated. Contract-account selection
remains unsupported by the existing History contract; C parties are display data.

Invoke/create rows use stable local contract identity avatar plus masked C-address
as primary subject; upload uses a localized operation title and local generic
operation marker. Contract IDs never borrow ordinary account contact names.
Secondary text has localized operation/function and existing local time. Keep
concrete calendar dates and existing order/cursors/navigation/focus/offline states.

List preview shows at most the first two relevant event quantities in order,
signed with existing incoming blue/outgoing red/self-or-zero neutral tokens.
When more than two relevant events exist, visible localized operation text states
the total and that only the first two are previewed; full detail exposes all.
No relevant events means no monetary column, not zero. Mixed assets retain their
individual identity. No single synthetic net amount or payment direction label.

Detail shows full contract identity where known, raw function symbol as data,
source, host variant and localized limitations. Every accepted event shows its
localized type, full asset issuer, exact formatted quantity, explicit from/to,
viewed-account role/direction and routing ID when supplied. Do not truncate away
event entries or use nested ledger mutation actions. Missing/empty summary has
distinct honest localized explanations. Upload/create must not imply balance
changes. Function text is not a trusted human description or an authorization.

Other filter applies. Loaded-set search covers host subtype, decoded contract ID
and symbol, event kinds/localized text, raw/formatted amounts, complete assets,
all explicit event parties, routing IDs and common operation IDs/hash/source.
Keep names transient, network-scoped and subject to existing no-Memo rules; do
not add contact names for routed recipient bases or contract addresses.

## Cache, tests and exit evidence

Add normalized v1 payloads for this family only; no schema migration or cursor
persistence. Cache revalidates family/subtype/success, source/account partition,
contract identity, events/roles/amounts and native code with the live validation
rules. Canonical projection strips nested metadata, raw args/XDR/salt and unknown
fields, deep-freezes owned data, retains order and list/detail equality. Event
directions must rederive from the supplied partition; do not trust persisted
income labels. Memory and Realm clones preserve explicit partition. Keep old
unsupported operation-type rows readable and allow only this known family's
malformed shape fallback, without widening arbitrary unsupported shapes.

Tests cover all three variants, canonical real SDK ScVal decoding, malformed or
wrong types/trailing data, missing success, source/event participant/foreign
details, source unrelated to event recipients, transfer/self/mint/burn/clawback,
multiple/zero/high-i128 quantities, native/issued XLM and distinct issuers,
missing/empty/invalid/oversized arrays, all exact bound failures, routing IDs,
list preview count, full event detail, search, existing fallback behavior, raw
PublicRead -> History -> cache -> presentation and durable Realm close/reopen.
Capabilities tests must not import presentation; screen tests stay in features.

Run affected tests, real Node Realm History, typecheck, lint/locales, architecture,
provenance, repository suite and production Android/iOS JS bundles. Existing
unrelated passed tests need not be repeated without cause. Independent review
must record exact current remote HEAD. No simulator/device/dynamic-font/reader/
pixel/live-ledger/native offline Retry/switch/performance acceptance is implied.
Stage 9 iOS System Auth cancel/retry stays deferred; do not upgrade maturity.

## Developer evidence and boundaries

The implementation began with a separate implementer using this written contract;
the parent completed the remaining integration, tests and checks. No donor source,
tests or resources were read as implementation templates. SDK validates the
decoded/created contract checksum and canonical encoding in Platform. Pure History
and cache use the existing structural G/C identity validation style; cache is not
a checksum service or ledger authority. Event amounts and per-account direction
are validated independently of the raw function name.

Developer checks passed: 200 suites / 1833 tests, focused History/Platform/Activity/
memory cases, real Node Realm History 1 suite / 25 tests including all three host
variants through close/reopen, typecheck, lint, strict architecture, provenance,
924-key parity across three locales, and Android/iOS production JS bundles.
Local Jest used `--watchman=false`. Final CI and independent exact-HEAD review are
recorded on the PR separately; this evidence is not native product acceptance.
Remaining Slice 5 families, Slice 6, missing historical money enrichment, branded
imagery and unobserved device/accessibility/performance acceptance remain open.
