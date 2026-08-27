# Fresnica Mobile Capability Rebaseline Design

## Status

Approved direction for the early-stage `fresnica-mobile` project rebaseline.

This design consolidates the current branch graph, aligns Mobile with the upstream Fresnica Application Capability vocabulary, removes the ambiguous Mobile-local `core` architecture layer, and establishes the migration path for the current Fresnica Core / Native SDK compatibility baseline.

## 1. Goals

The rebaseline must:

1. establish one clear long-lived development baseline;
2. preserve the verified React Native 0.87 Android/iOS native consumer work from `work/rn087-native-shell`;
3. absorb the useful Feature-first product organization ideas from `feat/fresnica-mobile-v1` without preserving obsolete terminology;
4. align Mobile architecture with the upstream model:
   - Mobile Feature implements Application Flow;
   - Application Flow consumes Application Capabilities;
   - Capabilities are cross-platform semantic contracts, not mandatory Rust/library implementations;
   - platform mechanisms remain local;
5. reserve `Core` terminology for Fresnica SDK/Rust Core security authority rather than a Mobile application layer;
6. preserve existing Account/Signer separation and wallet-security boundaries;
7. converge Send, future Swap, trustline and other transaction flows on shared Transaction / Ledger Authorization / Signing Coordination infrastructure;
8. verify the real Native SDK / Core compatibility surface before changing package or API versions;
9. clean up superseded branches and draft PRs after the replacement baseline is validated.

## 2. Non-goals

This rebaseline does not attempt to:

- implement the full wallet roadmap;
- standardize Mobile internal source layout across all Fresnica platforms;
- mirror `clients/rust-client` module structure;
- move Horizon/network access into Fresnica Core;
- reimplement secret, mnemonic, protection, signing or cryptographic semantics in TypeScript;
- introduce speculative frameworks or dependency-injection machinery;
- force every upstream Capability to be implemented immediately.

## 3. Source baseline

The implementation baseline is:

```text
work/rn087-native-shell @ 6948345d20abeebf77543f6995bdcca35afcf708
```

This branch contains the most complete current application code and native consumer integration.

`feat/fresnica-mobile-v1` is not used directly as the source baseline because it diverges from `work/rn087-native-shell`: the RN shell branch contains 28 additional native integration commits while `feat/fresnica-mobile-v1` contains one later Feature-first architecture documentation commit.

The useful semantics of that Feature-first document will be incorporated into this rebaseline rather than retained as a competing architecture contract.

## 4. Branch strategy

### Rebaseline branch

```text
refactor/mobile-capabilities
```

is created from `work/rn087-native-shell`.

All rebaseline work is performed there until the architecture and compatibility gates pass.

### Final branch model

After validation:

```text
main
  <- short-lived feat/*
  <- short-lived fix/*
  <- short-lived refactor/*
```

`main` becomes the single long-lived project baseline.

Historical checkpoint branches are not retained after their commits are safely represented in the validated main history.

### Superseded branches

After the replacement baseline is merged, these branches are candidates for deletion:

```text
architecture/phase-1
feat/fresnica-mobile-v1
work/mobile-sdk-usage-baseline
work/native-module-loader-tdd
work/payment-review
work/reviewed-payment-execution
work/stellar-gateway
work/transaction-signer-resolution
work/transaction-signing-coordinator
work/rn087-native-shell
```

Deletion occurs only after verifying the required commits and documents are represented in the replacement baseline.

Existing draft PRs #1, #2 and #10 should be closed as superseded once the new replacement PR is ready.

## 5. Canonical architecture vocabulary

The project adopts the current upstream Fresnica vocabulary.

```text
Mobile Feature
    implements
Application Flow
    consumes
Application Capabilities
    implemented through
Mobile/platform mechanisms + Fresnica SDK/Core where authoritative
```

Definitions:

### Mobile Feature

A Mobile-local product/code-organization unit. It owns screens, feature-local state, product policy and Flow orchestration.

Examples:

```text
onboarding
accounts
send
portfolio
history
trustlines
security
settings
```

A Feature is not the shared cross-platform name for a Capability.

### Application Flow

The product sequence for a user goal: why/when/order/confirmation/UI state.

Examples:

```text
Send
Attach signer
Change passcode
Reveal backup
```

### Application Capability

A reusable cross-platform semantic contract below product Flows.

Examples relevant to Mobile include:

```text
Account
Signer
Payment
Transaction
Balance
Trustline
SDEX
Ledger Authorization
Signing Coordination
Application Security
Network / Gateway
```

Capability maturity follows upstream `Normative`, `Defined` and `Proposed` semantics.

A Capability does not require Mobile to compile or embed a Rust implementation. Mobile may implement a Capability using Stellar JS SDK, repositories and platform code while delegating Core-owned security operations to Fresnica Native SDK/Core.

### Platform mechanism

Implementation details such as:

```text
React Native
NativeModules
Stellar JS SDK
Horizon
Realm
Keychain / Keystore
LocalAuthentication / Android Biometrics
```

These do not define cross-platform wallet meaning.

## 6. Remove the Mobile-local Core layer

The current source shape is approximately:

```text
src/
  app/
  core/
    fresnica/
    stellar/
    storage/
```

This is no longer acceptable as the long-term architecture because `Core` is now reserved for Fresnica Rust Core/security authority and the current directory mixes several different responsibilities.

Target direction:

```text
src/
  app/
    bootstrap/
    navigation/
    composition/

  features/
    onboarding/
    accounts/
    send/
    portfolio/
    history/
    trustlines/
    security/
    settings/

  capabilities/
    account/
    signer/
    payment/
    transaction/
    signing/
    ledger-authorization/
    balance/
    trustline/
    ...

  platform/
    fresnica/
      native/
    stellar/
    persistence/
    authentication/
```

This is a responsibility model, not a requirement to create empty directories. Only create a Capability or platform module when real code requires the boundary.

## 7. Fresnica Native SDK boundary

The underlying React Native native module name may remain:

```text
NativeModules.FresnicaCore
```

because that is an upstream adapter/runtime contract.

Normal Mobile TypeScript should not present a Mobile-owned architectural abstraction named `FresnicaCore`.

The application-facing adapter should use SDK-oriented naming such as:

```text
FresnicaSdk
FresnicaNativeSdk
```

The exact symbol name is selected during implementation based on the least disruptive migration.

The adapter remains narrow and exposes high-level SDK operations only.

Mobile must not expose or implement routine low-level cryptographic primitives, raw unlock keys, raw private signing or envelope internals.

## 8. Capability placement of existing code

Existing code is classified semantically rather than mechanically renamed.

### Fresnica adapter

Current `src/core/fresnica/*` moves conceptually to:

```text
src/platform/fresnica/native/*
```

It is an adapter to Fresnica Native SDK/Core, not a Mobile Capability implementation by itself.

### Stellar gateway

Current Horizon/Stellar SDK implementation becomes platform mechanism code, for example:

```text
src/platform/stellar/*
```

Capability-facing ports may live with the relevant Capability when their semantics are stable.

### Persistence

Repository interfaces and application wallet records should be separated from concrete persistence mechanisms.

Conceptually:

```text
Capability/domain records + repository contracts
        |
        v
platform/persistence Realm implementation
```

The current in-memory repository remains useful for tests during the migration.

### Review / transaction logic

Exact-XDR review semantics belong to the Transaction Capability.

Payment-specific interpretation belongs to Payment where applicable, while review/signing binding belongs to Transaction.

### Signing

The current `signReviewedPayment` behavior is generalized into shared Signing Coordination rather than remaining payment-specific.

The target lifecycle is:

```text
prepared transaction
  -> exact review
  -> confirmation
  -> refresh ledger authorization
  -> resolve valid local signer
  -> shared Signing Coordination
       -> system auth when registered and allowed
       -> Fresnica passcode fallback
       -> Fresnica Native SDK/Core signing
  -> submit exact signed transaction
```

Send, future Swap, trustline changes and future dApp signing must not implement separate biometric/passcode flows.

## 9. Account / Signer invariants

The rebaseline preserves the established security/domain rules:

1. Account identity and signer capability remain separate.
2. Watch-only remains the absence of an applicable local signer, not a mutable parallel truth.
3. Account, Signer and Recovery Source are not assumed one-to-one.
4. Protected signer envelopes remain opaque to Mobile.
5. Raw secret, mnemonic and WalletUnlockKey never become normal application state or persistence.
6. Signer attach must preserve Fresnica SDK/Core identity verification semantics.
7. `C...` contract identities are not treated as Ed25519 software signers.
8. Reveal/Export requires a fresh Fresnica application passcode.
9. Biometrics/System Auth gates routine authorization; it does not replace Fresnica cryptographic authority.

## 10. Native SDK / Core version migration rule

Do not equate a Fresnica Core release/version label with the Native SDK package version.

The migration must separately inspect and record:

```text
Fresnica Core version/state
Native SDK release/package version
Native Binding API version
Universal SDK API version
Core Client API version
React Native adapter source/binary compatibility
```

The existing Mobile baseline currently pins Native SDK `0.2.1` and RN adapter source `0.2.0`.

The rebaseline will compare the current upstream package/release/compatibility docs and source before changing any of these values.

A version is changed only if the actual consumer contract requires it.

## 11. Upstream 2.1 / Capability adaptation

Before implementation completes, inspect current upstream:

```text
docs/architecture.md
docs/application-flows.md
docs/application-capabilities.md
docs/core-security-boundary.md
docs/platform-implementation.md
docs/platforms/mobile/*
docs/capabilities/*
docs/sdk/*
```

and current release/API manifests relevant to Mobile.

For every existing Mobile behavior touched by the rebaseline:

- `Normative` Capability semantics must be preserved;
- `Defined` Capability agreed boundaries/security invariants must be preserved;
- Reference Semantics may be adopted where appropriate;
- useful Mobile implementation evidence should be recorded so it can later support an upstream docs PR.

Special attention is required for current Transaction, Signing Coordination and Ledger Authorization changes upstream.

## 12. Migration sequence

The implementation should proceed in small, verifiable stages.

### Stage A — protect the current baseline

- verify the rebaseline branch starts at RN shell HEAD;
- preserve existing unit/typecheck/native gate configuration;
- record existing tests and CI state before structural moves.

### Stage B — architecture naming and adapter migration

- introduce target platform/capability structure only where needed;
- move/rename the Fresnica native adapter away from Mobile `core` terminology;
- preserve compatibility tests during the move;
- keep `NativeModules.FresnicaCore` only at the native adapter boundary.

### Stage C — transaction capability extraction

- classify/move exact review logic to Transaction;
- classify ledger signer/threshold behavior under Ledger Authorization;
- generalize payment-specific signing coordination into shared Signing Coordination;
- keep the existing reviewed-payment behavior passing throughout the migration.

### Stage D — persistence/domain boundary cleanup

- move durable Account/Signer semantics out of infrastructure naming;
- retain in-memory repository for tests;
- prepare a clean contract for future Realm implementation without implementing speculative schema beyond known invariants.

### Stage E — upstream compatibility update

- compare current Native SDK/Core/RN adapter compatibility state;
- update pins/manifests/code only where required;
- update compatibility tests and documentation.

### Stage F — documentation and branch convergence

- replace stale local handoff references to old `mobile-sdk-usage.md` paths and old Service/Core terminology;
- add a Mobile Capability support/conformance matrix appropriate to current implemented scope;
- create replacement PR to `main`;
- close superseded PRs;
- delete superseded branches once the replacement is merged and verified.

## 13. Testing and verification

The rebaseline must not claim native behavior has passed unless the relevant platform check actually ran.

Required automated validation where available:

```text
npm run typecheck
npm test
npm run check
```

Existing native CI gates should continue to validate Android/iOS consumer integration.

Security-sensitive regression coverage must prove at minimum:

- reviewed transaction XDR remains identical to the XDR passed for signing;
- insufficient/unsupported ledger authorization fails before user authentication;
- System Auth vs passcode fallback remains centralized;
- payment code does not own an independent biometric/passcode implementation;
- Account/Signer watch-only invariants survive the move;
- SDK errors remain normalized at the adapter boundary.

## 14. Branch/PR cleanup safety rule

No historical branch is deleted merely because its name looks obsolete.

Before marking a branch safe to delete:

1. compare it with the replacement branch/main;
2. verify it has no unique required source, test, native integration or architecture evidence;
3. preserve any still-useful documentation in the replacement baseline;
4. verify no active PR should remain the source of truth.

Only then close its PR and delete the branch.

## 15. Success criteria

The rebaseline is successful when:

1. one branch contains all current verified RN/native/application foundation work;
2. no Mobile architecture layer is called `Core` except references to actual Fresnica SDK/Core or the upstream native module boundary;
3. Feature, Flow, Capability and platform mechanism meanings are distinct in code/docs;
4. current payment execution uses reusable Transaction / Ledger Authorization / Signing Coordination boundaries;
5. existing tests remain green after structural migration;
6. current upstream Native SDK/Core compatibility has been verified and accurately recorded;
7. a clean replacement PR targets `main`;
8. obsolete PRs are closed and obsolete branches are identified as safe to delete;
9. future work can branch directly from `main` without depending on a chain of `work/*` checkpoint branches.

## 16. Rollback strategy

The rebaseline starts from the immutable historical RN shell commit and uses a dedicated branch.

If a structural stage proves incorrect:

- revert that stage on `refactor/mobile-capabilities`;
- do not mutate historical checkpoint branches;
- retain the previous verified tests as regression anchors.

No force-update of `main` or historical development refs is required for the rebaseline.
