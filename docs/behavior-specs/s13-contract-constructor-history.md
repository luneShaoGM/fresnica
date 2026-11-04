# S13 contract creation identity and constructors — Slice 5f

Foundation0/2a/2b, Stage2.5 available;2cpartial. S13Adapt clean-room. This spec
precedes implementation from Fresnica and official Horizon ingress, not donor.

Horizon CreateContract and CreateContractV2 `address` is the preimage deployer,
not the created contract identity. Correct existing create mapping: never put
that address into contractId. Capture `from=address` plus validated G/C deployer,
or `from=asset` plus canonical asset evidence (native or issued code:issuer).
Both create kinds specialize even with no created C-address. Row identity is
explicit deployer, or canonical asset, otherwise no guessed identity. Detail
labels deployer/origin asset and explicitly says created contract ID unavailable.
No derivation from device/default network, salt or truncated params.

Recognize exact HostFunctionTypeHostFunctionTypeCreateContractV2 as constructor.
Keep distinct hostFunction=create-v2. Constructor arguments are not Invoke's
Address/Sym identity prefix and are not decoded, persisted or shown. Existing
invoke decoding remains exact/canonical SDK-owned. Upload remains identityless.

V2 can carry reported SAC balance events. Share exact event/amount/asset/party
validation and at-most-two list legs with invoke; expose all validated events
in detail. Association for invoke/V2 is source or explicit valid event party;
ordinary create/upload source-only. A deployer alone is not event/association
proof for unrelated accounts. Old-create nonempty events stay unsupported.

Cache reconstruction uses distinct kind, deployer/asset evidence and events,
revalidates explicit partition, directions, source/family/success; strips old
untrusted contractId from create payload rather than reusing wrong identity.
Legacy create entries with only old contractId may become invalid cache and
re-fetch under existing partition recovery. No schema/signing/write changes.

Primary authority: stellar/stellar-horizon@6a13f41808586884c9a7b1beecd92088b7284070
internal/ingest/processors/operations_processor.go CreateContract and V2 cases;
internal/integration/invokehostfunction_test.go address equals deployer tests.
Cover normal G/factoryC deployers,assetpreimages,V2noargs/events,foreignroles,
exact wire discriminate,unknown/malformedfailclosed,cacheoldidentity rejection,
list/detail/search/locale/Realm; CI and independent exactHEADreview separate.
Native acceptance and Stage9 realauth remain distinct/deferred.
