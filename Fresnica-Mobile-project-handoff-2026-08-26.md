# Fresnica Mobile Project Handoff --- 2026-08-26

> Purpose: continuation document for future ChatGPT conversations
> working on the **`fresnica-mobile`** application. It records the
> mobile product boundary, architecture, security invariants inherited
> from Fresnica Core/SDK, application responsibilities, development
> rules, and recommended implementation order.
>
> Upstream Core/SDK source of truth:
> `https://github.com/manran/fresnica`
>
> Mobile repository: treat the actual `fresnica-mobile` repository as
> the application source of truth once it exists/is connected. Do not
> assume that the Core/SDK repository is the mobile application
> repository.

------------------------------------------------------------------------

## 1. Project identity

`fresnica-mobile` is the native mobile wallet application built on top
of Fresnica's Core/SDK stack.

It is **not** a mobile rewrite of Fresnica cryptography and it is
**not** the place to implement wallet cryptographic primitives.

Target layering:

``` text
fresnica-mobile
  React Native application
  ├── screens / navigation / product UX
  ├── application state
  ├── Realm persistence
  ├── Horizon / network orchestration
  ├── OS authentication integration
  ├── transaction review and submission
  └── product-specific wallet workflows
          ↓
  Fresnica React Native adapter
          ↓
  Fresnica Native SDK
          ↓
  platform-neutral Fresnica SDK semantics
          ↓
  Rust Core
```

The primary rule is:

> **Mobile owns the wallet product. Fresnica SDK/Core owns cryptography
> and security semantics.**

The mobile application must consume the high-level Fresnica SDK API and
must not duplicate secret derivation, encryption, transaction signing,
mnemonic handling, or signer verification in TypeScript/JavaScript.

------------------------------------------------------------------------

## 2. Relationship with the upstream `fresnica` repository

The upstream `manran/fresnica` repository owns:

-   Rust Core;
-   platform-neutral `FresnicaSdk`;
-   Native SDK / UniFFI bindings;
-   Android package;
-   Apple XCFramework packages;
-   React Native adapter source/tooling;
-   WASM binding;
-   canonical security semantics;
-   cross-platform test vectors and conformance;
-   SDK packaging/release documentation.

`fresnica-mobile` owns:

-   React Native screens and navigation;
-   mobile application state;
-   Realm schema/configuration/migrations;
-   Account/Signer persistence;
-   Horizon and Stellar network orchestration;
-   onboarding/create/import/watch-only flows;
-   passcode, lock, biometric and settings UX;
-   transaction construction/review/submission orchestration;
-   send/receive/swap product flows;
-   assets and trustlines;
-   balances and portfolio;
-   transaction history/cache;
-   contacts/address-book UX;
-   backup/export UX;
-   hardware/external signer UX when supported;
-   mobile-specific telemetry, error presentation and recovery UX.

Do not move application concerns into Core merely to make mobile
implementation easier.

Do not move cryptographic/security semantics into mobile merely to avoid
an SDK change. If the mobile application needs a security operation that
belongs semantically in SDK/Core, add a narrow upstream SDK operation
instead.

------------------------------------------------------------------------

## 3. Security invariants inherited from Fresnica

These are architectural constraints, not optional implementation
preferences.

### 3.1 Account identity and signer capability are separate

Conceptually:

``` text
AccountRecord
  identity/address/network/product metadata

SignerRecord
  signer public identity
  signer kind/provider metadata
  protected signer envelope when applicable

AccountSignerReference
  account ↔ signer relationship
```

Consequences for mobile:

-   a Stellar `G...` address represents account identity;
-   an account does not necessarily have a local signer;
-   watch-only means there is no applicable local signing capability;
-   watch-only accounts have no secret/mnemonic and no Fresnica
    protected signer envelope;
-   attaching a secret/mnemonic to a watch-only account must be
    validated by SDK/Core against the expected signer public identity
    before persistence is changed;
-   signer mismatch must fail before mobile mutates the stored account;
-   detaching a signer removes local signing capability while preserving
    the account identity;
-   a `C...` smart-contract address is not an Ed25519 public key and
    must not be treated as if an arbitrary `S...` proves ownership.

The Realm model must preserve this separation instead of collapsing
Account and Signer into one record.

### 3.2 Core/SDK remains the cryptographic authority

Mobile must not implement:

-   secret/mnemonic validation or derivation;
-   signer identity derivation;
-   signer identity verification;
-   Scrypt;
-   AES-GCM protected signer envelopes;
-   passcode re-protection;
-   transaction hashing/signing;
-   external Ed25519 signature verification;
-   security error classification.

Those operations belong to Fresnica Core/SDK.

### 3.3 Application/OS responsibilities

Mobile does own:

-   Keychain / Keystore lifecycle;
-   biometric prompts;
-   application lock/session policy;
-   persistence;
-   network state;
-   Horizon interaction;
-   transaction submission policy;
-   ledger signer weight/threshold interpretation where required by
    product behavior;
-   UI and recovery flows.

OS biometrics gate access to application capabilities; they do not
replace Fresnica's cryptographic semantics.

### 3.4 WalletUnlockKey

`WalletUnlockKey` is an internal native software-signing capability
derived from the Fresnica passcode.

Rules:

-   it is not an export/reveal credential;
-   Reveal/Export requires a fresh Fresnica app passcode;
-   raw WalletUnlockKey must not enter normal React Native
    JavaScript/TypeScript code;
-   normal mobile signing should prefer a high-level SDK operation such
    as passcode-authenticated transaction signing;
-   OS biometric authentication may gate native access to the signing
    capability without changing the underlying Fresnica security model.

### 3.5 Reveal / Export

Revealing/exporting secret material is intentionally stronger than
routine signing.

> **Reveal/Export always requires a fresh Fresnica application
> passcode.**

A successful biometric unlock or an already-unlocked application session
must not silently grant export authority.

------------------------------------------------------------------------

## 4. Fresnica SDK usage from mobile

Mobile should treat the Fresnica SDK as the wallet-security service
boundary.

Expected high-level operations include:

-   account parsing;
-   secret protection/import;
-   mnemonic protection/import;
-   mnemonic generation;
-   passcode re-protection;
-   Reveal/Export;
-   routine transaction signing with passcode;
-   external Ed25519 signing preparation;
-   external Ed25519 signature application;
-   stable DTO/error mapping.

The React Native layer should be thin:

``` text
React Native product flow
      ↓
mobile service/repository boundary
      ↓
Fresnica RN adapter
      ↓
Native SDK
      ↓
FresnicaSdk
```

Do not add a TypeScript crypto facade that reimplements SDK behavior.

If an SDK call already performs a complete security operation, mobile
should call that operation rather than decomposing it into lower-level
key operations.

------------------------------------------------------------------------

## 5. React Native boundary

React Native is the canonical first mobile framework consumer of the
Native SDK.

Upstream validation has already established a working React Native
0.87 + CocoaPods Apple consumer path as of 2026-08-25.

Important integration rule:

-   do not reconstruct React Native Apple header namespaces by guessing
    `node_modules` paths;
-   rely on the CocoaPods-installed React framework/header environment
    used by the upstream Fresnica adapter;
-   keep the adapter mechanical;
-   never move wallet security policy or cryptographic semantics into
    the RN bridge.

For `fresnica-mobile`, prefer ordinary TypeScript domain/application
services above the bridge. Only native/platform-specific concerns should
cross into native mobile code.

------------------------------------------------------------------------

## 6. Mobile application architecture

Use a layered application structure with explicit boundaries.

Recommended conceptual layers:

``` text
UI / Navigation
      ↓
Application workflows
      ↓
Domain-facing repositories/services
      ├── Fresnica SDK service
      ├── Wallet persistence repository
      ├── Stellar network service
      ├── Platform authentication service
      └── External signer providers
```

### UI / Navigation

Owns:

-   screens;
-   navigation;
-   forms;
-   review screens;
-   loading/error/empty states;
-   user confirmation;
-   accessibility;
-   product interaction.

It should not know encrypted envelope formats or cryptographic
primitives.

### Application workflows

Coordinates complete user actions such as:

``` text
Create wallet
Import wallet
Add watch-only account
Attach signer
Detach signer
Send payment
Swap
Add trustline
Sign transaction
Reveal/export backup
Change passcode
Lock/unlock application
```

A workflow may coordinate persistence, Horizon and SDK operations, but
security decisions remain delegated to the SDK/native boundary.

### Persistence

Realm stores application state and wallet metadata.

Persist:

-   accounts;
-   signers and references;
-   protected signer envelopes returned by SDK;
-   network/account metadata;
-   user preferences;
-   cached balances/assets/history as appropriate;
-   contacts and application metadata.

Do not persist raw secrets, raw mnemonics, raw WalletUnlockKey,
biometric credentials, or temporary plaintext signing material.

### Network

The mobile network layer owns:

-   Horizon requests;
-   network selection;
-   account state;
-   balances;
-   sequence numbers;
-   fee data;
-   transaction submission;
-   submission retry/recovery policy;
-   transaction history;
-   asset/trustline state.

Core/SDK should not become an HTTP/Horizon client merely for mobile
convenience.

------------------------------------------------------------------------

## 7. Wallet/account lifecycle

The mobile product should support these account modes without conflating
them.

### Locally signed account

Has:

-   account identity;
-   local signer reference;
-   protected signer material;
-   normal local signing capability after required authentication.

### Watch-only account

Has:

-   account identity;
-   no applicable local signer;
-   no secret/mnemonic;
-   no protected local signer envelope;
-   no Fresnica passcode requirement merely to observe the account.

The user may later attach a compatible local signer. SDK/Core must
verify identity before mobile commits the change.

### External/hardware signer

Use the callback-free SDK boundary:

``` text
prepare_ed25519_signing
  → transaction hash/context/XDR/network information

external provider signs

apply_ed25519_signature
  → SDK/Core verifies signature
  → signed transaction result
```

Mobile owns provider transport, device session and UX.

### Passkey smart account

Passkey smart accounts are a separate `C...` contract-account
authorization model.

Do not model them as an Ed25519 WalletUnlockKey variant.

The current upstream smart-account provider is
experimental/Testnet-only. Do not expose it as production-ready without
a new upstream security/readiness decision.

------------------------------------------------------------------------

## 8. Passcode, biometric authentication and application lock

These concepts must remain distinct.

### Fresnica passcode

Used by Fresnica security operations such as:

-   protecting signer material;
-   signing through passcode-based SDK operations;
-   changing/re-protecting passcode;
-   Reveal/Export.

### Biometric authentication

Face ID / Touch ID / Android biometrics are OS-level authentication
mechanisms.

They may:

-   unlock the application;
-   gate native access to routine signing capability;
-   reduce repeated passcode entry for approved routine actions.

They must not:

-   expose WalletUnlockKey to JS;
-   substitute for fresh Fresnica passcode during Reveal/Export;
-   become a second implementation of signer encryption.

### Application lock

The mobile app owns session behavior:

-   when the app locks;
-   background/foreground handling;
-   timeout;
-   biometric-first unlock UX;
-   fallback to Fresnica passcode where appropriate;
-   cancellation/retry behavior.

Authentication behavior should be consistent across Send, Swap and other
transaction flows. Shared signing/authentication orchestration should be
reused rather than independently implemented per screen.

------------------------------------------------------------------------

## 9. Transaction architecture

A transaction flow should conceptually be:

``` text
User intent
   ↓
Build transaction from current network/account state
   ↓
Review exact transaction
   ↓
User confirms
   ↓
Authentication/signing orchestration
   ↓
Fresnica SDK signs or external signer path runs
   ↓
Submit exact signed transaction
   ↓
Refresh state/history
```

The exact XDR reviewed by the user must be the transaction passed into
signing unless the product explicitly returns to review after a change.

Avoid transaction-type-specific authentication implementations.

Send, Swap, trustline changes and future transaction types should
converge on shared review/sign/submit infrastructure where their
security behavior is the same.

------------------------------------------------------------------------

## 10. Stellar-first product direction

`fresnica-mobile` is a Stellar wallet application.

Do not inherit XRPL-specific domain architecture from Xaman.

Xaman may be used as a reference for:

-   mature wallet interaction patterns;
-   transaction review UX;
-   biometric-first signing UX;
-   onboarding ergonomics;
-   account switching;
-   security messaging;
-   error/recovery interaction.

But Fresnica's Stellar account, signer, asset, trustline, Horizon and
transaction semantics are authoritative.

Likewise, Freighter Mobile or other Stellar wallets may be studied for
Stellar-specific UX, but they are references rather than architecture
dependencies.

------------------------------------------------------------------------

## 11. Product capability roadmap

Build the application in vertical slices while establishing reusable
foundations.

### Foundation

-   RN project/toolchain;
-   Fresnica Native SDK integration;
-   navigation;
-   application state conventions;
-   Realm initialization/migrations;
-   network selection/configuration;
-   platform secure-storage/authentication abstraction;
-   shared error model.

### Wallet onboarding

-   create account;
-   generate mnemonic through SDK;
-   import secret;
-   import mnemonic;
-   add watch-only account;
-   restore persisted accounts;
-   account switching.

### Security/settings

-   Fresnica passcode setup;
-   application lock;
-   biometric enable/disable;
-   passcode change/re-protection;
-   Reveal/Export with fresh passcode;
-   signer attach/detach.

### Portfolio

-   account balances;
-   assets;
-   trustlines;
-   native XLM;
-   refresh/cache behavior;
-   network error handling.

### Transactions

-   shared transaction review;
-   shared authentication/signing;
-   Send;
-   Receive;
-   submission result/recovery;
-   transaction history.

### Trading/assets

-   trustline management;
-   SDEX/Swap;
-   asset discovery/selection;
-   price/quote UX as product requirements become concrete.

### Extended wallet capabilities

-   contacts;
-   backup/export;
-   SEP/anchor workflows;
-   external/hardware signers;
-   passkey smart accounts when upstream production readiness permits.

Avoid implementing every roadmap item before validating the foundational
vertical slices.

------------------------------------------------------------------------

## 12. Persistence principles

Realm schema design must follow domain semantics rather than UI screen
shape.

Minimum conceptual entities:

``` text
Account
Signer
AccountSignerReference
AppSettings
NetworkConfiguration
```

Additional cached entities may be introduced for:

``` text
Asset
Balance
Trustline
TransactionHistory
Contact
```

Rules:

-   migrations are explicit;
-   protected SDK output may be persisted;
-   plaintext secret/mnemonic must not be persisted;
-   raw unlock keys must not be persisted;
-   watch-only accounts must remain representable without fake signer
    data;
-   account deletion and signer deletion must not accidentally become
    the same operation;
-   network-specific identity must be modeled explicitly where required.

Do not over-design the Realm schema before the first vertical wallet
flows make concrete persistence requirements clear.

------------------------------------------------------------------------

## 13. Error handling

Preserve stable SDK/Core security errors rather than replacing them with
generic JavaScript exceptions.

Application errors should retain enough category information to
distinguish:

-   invalid passcode;
-   identity mismatch;
-   invalid secret/mnemonic;
-   unsupported account/signer type;
-   signing failure;
-   external signer failure;
-   network failure;
-   Horizon rejection;
-   transaction submission failure;
-   persistence failure;
-   user cancellation.

UI maps these categories to user-facing copy and recovery actions.

Do not infer that every signing error is an incorrect password.

------------------------------------------------------------------------

## 14. Testing strategy

Testing should follow the boundaries.

### TypeScript/application tests

Test:

-   workflow orchestration;
-   reducers/stores/application state;
-   persistence mapping;
-   navigation decisions;
-   error mapping;
-   transaction review state;
-   biometric/passcode branching with mocked platform services.

### Native SDK integration tests

Verify:

-   RN adapter calls;
-   DTO/error mapping;
-   account create/import/watch-only flows;
-   passcode signing;
-   Reveal/Export boundary;
-   signer attach/detach;
-   platform packaging compatibility.

Do not duplicate Rust cryptographic vector tests in TypeScript.

### Real platform gates

Use real iOS/macOS/Android environments when the behavior depends on:

-   CocoaPods/Xcode;
-   XCFramework linking;
-   Keychain;
-   Face ID/Touch ID;
-   Android Keystore/Biometrics;
-   AAR packaging;
-   native lifecycle behavior.

Never claim a real-platform validation passed when only static or mocked
tests ran.

------------------------------------------------------------------------

## 15. Upstream Fresnica state relevant to mobile

At the source handoff dated 2026-08-25, upstream Fresnica had
established:

-   platform-neutral `FresnicaSdk`;
-   generalized Native SDK / UniFFI binding;
-   Android AAR packaging and consumer compile gate;
-   Apple `FresnicaSDK.xcframework` and FFI packaging;
-   iOS and macOS slices;
-   independent Swift consumer validation;
-   React Native 0.87 + CocoaPods Apple consumer validation;
-   SDK operations for wallet
    protection/generation/re-protection/reveal/signing/external signing;
-   account/signer separation;
-   watch-only attach/detach semantics;
-   Web/WASM boundary;
-   experimental Testnet passkey smart-account provider.

These are upstream facts, not a promise that the current upstream `main`
is unchanged.

At the start of future implementation work, verify current
`manran/fresnica` main and the current mobile repository before relying
on exact API names or package versions.

------------------------------------------------------------------------

## 16. Upstream limitations relevant to mobile

### Hardware/Ledger

Ledger transport implementation remained gated at the 2026-08-25 handoff
because:

``` text
stellar-ledger / Stellar CLI: 27.1.0
stellar-ledger dependency:     stellar-xdr 27.0.0
Fresnica Core:                 stellar-xdr 28.0.0
```

Do not:

-   downgrade Fresnica XDR merely to add Ledger;
-   add a hidden 28 → 27 conversion layer.

Mobile may design the external-signer UX boundary, but production Ledger
integration should wait for an upstream-compatible provider or an
explicitly reviewed conversion boundary.

### Passkey smart accounts

The upstream provider was:

-   based on `smart-account-kit 0.6.2`;
-   Testnet-only;
-   validated with real WebAuthn/Testnet flow;
-   configured to require WebAuthn user verification.

It remains experimental until production/security assumptions are
deliberately reviewed.

------------------------------------------------------------------------

## 17. Development rules for future conversations

At the beginning of a new `fresnica-mobile` development conversation:

1.  Read this handoff.
2.  Locate and inspect the current `fresnica-mobile` repository.
3.  Verify the current mobile `main`/working branch before editing.
4.  Inspect the current mobile docs/tasks/roadmap if present.
5.  Check current upstream `manran/fresnica` only when
    SDK/API/security/package state matters.
6.  Read upstream `docs/mobile-sdk-usage.md` before implementing
    SDK-facing wallet/security flows when available.
7.  Prefer existing mobile architecture and patterns over introducing
    speculative abstractions.
8.  Keep changes surgical and define verifiable success criteria.
9.  Never reimplement Fresnica cryptography in TypeScript.
10. Never ask the user to repeat an established architectural decision
    unless current code genuinely conflicts with it.
11. Batch coherent work before requesting human synchronization or
    real-device validation.
12. Be explicit about which tests actually ran and which platform
    validations remain outstanding.

If the mobile repository has its own automated
development-bundle/checkpoint workflow, use that workflow as the
synchronization source of truth. Do not assume the upstream Core
repository's bundle path or CI artifact names apply to
`fresnica-mobile`.

------------------------------------------------------------------------

## 18. Recommended initial implementation order

For a new or early-stage `fresnica-mobile`, prioritize a narrow
end-to-end wallet slice.

### Phase 1 --- application shell and SDK integration

Establish:

``` text
RN application boots
  → Native SDK loads
  → SDK version/basic call succeeds
  → Realm opens
  → navigation/state shell works
```

Success means the real app can consume Fresnica SDK on target platforms.

### Phase 2 --- account persistence and watch-only

Implement the account model without requiring secrets first:

``` text
add G... watch-only
  → SDK parses/validates identity
  → persist Account without Signer
  → restore after restart
  → display account
```

This forces the Account/Signer separation to be correct early.

### Phase 3 --- create/import local signer

Implement:

``` text
create/import
  → SDK generates/protects/verifies
  → mobile persists protected result
  → account/signing relationship persists
  → no plaintext signer material remains in JS state
```

### Phase 4 --- lock/authentication

Implement application lock, passcode and biometric orchestration before
building many transaction types.

### Phase 5 --- first complete Send flow

Build:

``` text
load account state
  → construct payment
  → review exact transaction
  → confirm
  → authenticate
  → SDK sign
  → Horizon submit
  → result/history refresh
```

Use this as the reference transaction architecture.

### Phase 6 --- additional transaction/product flows

Only after Send is structurally sound, extend shared infrastructure to:

-   trustlines;
-   Swap/SDEX;
-   other Stellar operations.

Do not independently rebuild signing/authentication per feature.

------------------------------------------------------------------------

## 19. Decisions that must survive context loss

If only a short set of facts is retained, retain these:

1.  **`fresnica-mobile` is the application; `fresnica` is the Core/SDK
    upstream.**
2.  **Account identity and signer capability are separate. Watch-only
    has no local signer.**
3.  **Core/SDK owns cryptography and security semantics. Mobile owns UI,
    persistence, OS auth and network orchestration.**
4.  **Do not implement secret/mnemonic derivation, encryption or
    transaction signing in TypeScript.**
5.  **Raw WalletUnlockKey must not enter normal React Native JS/TS
    code.**
6.  **Reveal/Export always requires a fresh Fresnica passcode.**
7.  **Biometrics are an OS authentication gate, not a replacement
    cryptographic credential.**
8.  **Realm must preserve Account/Signer separation and never persist
    plaintext signing material.**
9.  **Transaction types should share
    review/authentication/signing/submission infrastructure.**
10. **Xaman is a UX/engineering reference, not the Stellar domain
    architecture.**
11. **Passkey smart accounts are separate C-address authorization, not
    Ed25519 WalletUnlockKey accounts.**
12. **Ledger remains gated until the upstream XDR compatibility problem
    is deliberately resolved.**
13. **Verify current mobile and upstream repositories before relying on
    handoff-era versions or exact APIs.**
14. **Prefer incremental vertical slices over building the entire wallet
    roadmap at once.**

------------------------------------------------------------------------

## 20. Immediate next step

Before implementing new mobile functionality, inspect the actual current
`fresnica-mobile` repository and compare it with this architecture.

The first concrete task should be chosen from the real repository state
rather than guessed from this handoff.

If the repository is still at an early bootstrap stage, begin with:

> **React Native application shell + Fresnica Native SDK integration +
> minimal Realm/account model, with watch-only as the first persisted
> wallet vertical slice.**

If those foundations already exist, continue from the first incomplete
vertical slice while preserving all security and ownership boundaries
above.
