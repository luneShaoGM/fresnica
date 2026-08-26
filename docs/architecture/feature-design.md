# Fresnica Mobile Feature-First Architecture

## Purpose

Fresnica Mobile uses **feature-first application architecture** instead of carrying forward the old Xaman-style global `services/` model.

This is not a directory rename from `services/` to `features/`.

The design changes the primary unit of application organization from technical services to user-facing product capabilities.

> **Feature = user intent + presentation + feature-local state + use-case orchestration + feature-specific result mapping.**

The central architecture rule remains:

> React Native owns product orchestration. Fresnica Core owns cryptographic meaning. Stellar Gateway owns chain communication.

---

## 1. Architectural model

```text
┌────────────────────────────────────┐
│                APP                 │
│ bootstrap / navigation / providers │
└─────────────────┬──────────────────┘
                  │
                  ▼
┌────────────────────────────────────┐
│              FEATURES              │
│                                    │
│ onboarding  accounts  send         │
│ portfolio   history   trustlines   │
│ security    settings               │
│                                    │
│ UI + local state + product policy  │
│ + use-case orchestration           │
└─────────────────┬──────────────────┘
                  │
                  ▼
┌────────────────────────────────────┐
│                CORE                │
│                                    │
│ fresnica / stellar / storage       │
│ security / network                 │
│                                    │
│ reusable capabilities and ports    │
└─────────────────┬──────────────────┘
                  │
                  ▼
┌────────────────────────────────────┐
│          NATIVE / EXTERNAL         │
│                                    │
│ Fresnica Native SDK / Rust Core    │
│ Horizon / RPC                      │
│ Realm                              │
│ Keychain / Keystore                │
└────────────────────────────────────┘
```

Dependency direction is one-way:

```text
App -> Features -> Core -> Native / External
```

`Shared` may be used by App, Features, and Core only for generic code that does not encode wallet product policy.

---

## 2. What a Feature is

A Feature represents one coherent user-facing capability.

Examples:

- `onboarding`: create or import wallet state;
- `accounts`: manage accounts and signer attachment lifecycle;
- `portfolio`: inspect balances and account portfolio state;
- `send`: prepare, review, sign, submit, and refresh after a payment;
- `history`: inspect Stellar operation history;
- `trustlines`: add or remove asset trustlines;
- `security`: configure application-level security behavior;
- `settings`: configure application preferences.

A Feature is organized around **what the user is trying to do**, not around a technical subsystem.

Correct:

```text
features/
  onboarding/
  accounts/
  portfolio/
  send/
  history/
  trustlines/
  security/
  settings/
```

Incorrect:

```text
features/
  accountService/
  transactionService/
  authService/
  storageService/
```

The latter recreates the old service architecture under a different folder name.

---

## 3. Feature responsibilities

A Feature may own:

- feature-specific screens;
- feature-specific UI components;
- transient feature-local state;
- application/use-case functions;
- feature-specific models and result types;
- product validation and sequencing rules;
- mapping Core/Gateway results into product outcomes;
- product-facing error mapping.

A Feature should answer questions such as:

- what is the user trying to accomplish?
- what must be validated before continuing?
- which capabilities must be called, and in what order?
- when is confirmation required?
- what outcome should the UI receive?
- what data should be invalidated or refreshed after success?

Its primary responsibility is **orchestration**.

---

## 4. Feature non-responsibilities

A Feature must not implement or own:

- cryptographic algorithms;
- KDF, Scrypt, AES-GCM, Ed25519 primitives;
- mnemonic or secret derivation;
- raw private signing;
- `WalletUnlockKey` handling;
- generic raw secret access;
- direct NativeModules security semantics;
- Realm engine implementation;
- Horizon client construction;
- Keychain/Keystore implementation;
- generic networking infrastructure;
- cross-feature authentication policy;
- duplicated signer-resolution rules.

If Fresnica Native SDK provides a high-level secure operation, the Feature calls that operation through the Core boundary instead of reimplementing its internals.

---

## 5. Core vs Feature vs Shared

Use this decision rule when placing code.

### Feature

Put code in `features/` when it expresses **user/product intent**.

Examples:

```text
prepare send
confirm payment
import account
attach signer
add trustline
confirm backup
change application security setting
```

### Core

Put code in `core/` when it provides a **reusable application capability** that multiple Features can depend on.

Examples:

```text
load Stellar account state
build unsigned payment XDR
resolve local signer authorization
submit signed XDR
persist AccountRecord / SignerRecord
parse Stellar identity via Fresnica Core
coordinate transaction signing
```

### Shared

Put code in `shared/` only when it has no wallet-specific business semantics.

Examples:

```text
Button
Modal
formatDate
useDebounce
Result<T>
generic constants
```

A useful shorthand is:

```text
Feature        = Policy
Core           = Capability
Infrastructure = Mechanism
```

---

## 6. Standard Feature shape

A Feature may use the following structure when its complexity requires it:

```text
features/send/
  screens/
    SendScreen.tsx
    SendReviewScreen.tsx

  components/
    AmountInput.tsx
    RecipientInput.tsx

  state/
    sendStore.ts

  application/
    prepareSend.ts
    submitSend.ts

  model/
    SendDraft.ts
    SendReview.ts
    SendError.ts

  __tests__/

  index.ts
```

This is a template, not a mandatory directory checklist.

Simple Features should stay simple. Do not create empty `services/`, `repositories/`, `controllers/`, `facades/`, `managers/`, or `usecases/` directories merely for symmetry.

Create structure only when the Feature has code that needs that boundary.

---

## 7. Application functions replace global Service methods

Global service-style APIs such as:

```ts
transactionService.send(...)
accountService.delete(...)
```

should become explicit product use-case functions where appropriate:

```ts
prepareSend(...)
submitSend(...)
deleteAccount(...)
attachSignerToAccount(...)
```

Application functions receive narrow dependencies rather than constructing infrastructure directly.

Example shape:

```ts
type SendDependencies = {
  walletRepository: WalletRepository;
  stellarGateway: StellarGateway;
  signerResolver: SignerResolver;
  transactionSigner: TransactionSigner;
};

async function prepareSend(
  input: SendDraft,
  deps: SendDependencies,
): Promise<SendReview> {
  // product validation and orchestration only
}
```

Do not instantiate Horizon, Realm, or `NativeModules.FresnicaCore` inside screens or feature functions.

Dependency composition belongs to App/providers/bootstrap.

---

## 8. Dependency rule between Features

Features should not depend on another Feature's internal implementation.

Avoid:

```text
send -> portfolio internals
trustlines -> accounts internals
swap -> send internals
```

Otherwise Features become a dependency graph of product modules and lose their boundaries.

Preferred patterns:

### Shared reusable capability

Move reusable behavior downward into Core:

```text
Send -------┐
            ├-> AccountSnapshotRepository
Portfolio --┘
```

### Cross-feature composition

Move orchestration upward into App or an application-level coordinator.

### Refresh/invalidation

When a transaction affects another Feature's displayed state, invalidate shared durable/cache state instead of calling that Feature's private refresh function.

Example:

```text
transaction submitted
        |
        v
invalidate account snapshot/history cache
        |
        +---- Portfolio reloads its own view
        +---- History reloads its own view
```

---

## 9. State ownership

### Feature-local transient state

Zustand may hold transient Feature state such as:

- current send draft;
- selected asset in a flow;
- current step of onboarding;
- temporary request/loading/error state;
- view preferences that do not represent wallet truth.

Feature stores should be local and small by default.

### Durable wallet truth

Durable wallet state belongs to application-owned repositories/storage:

- `AccountRecord`;
- `SignerRecord`;
- `AccountSignerReference`;
- opaque signer envelope;
- network caches;
- secure cleanup tasks.

Do not mirror complete persisted account/signer collections into a global Zustand store.

### Secrets

Never place the following in Feature state, Zustand, navigation params, logs, analytics, or Realm truth:

- private keys;
- mnemonic phrases;
- app passcodes;
- native unlock keys;
- parsed signer envelope internals.

---

## 10. Signing is a Core/application capability, not a transaction Feature detail

Send, future Swap, trustline changes, and future dApp signing must not implement independent authentication flows.

Incorrect:

```text
send/signTransaction.ts
swap/signTransaction.ts
trustlines/signTransaction.ts
```

Correct:

```text
Send ---------┐
Swap ---------|
Trustlines ---+--> Shared Signing Coordinator
Future dApp --┘             |
                            v
                    Fresnica Native SDK
                            |
                            v
                        Rust Core
```

A Feature decides **that signing is required**.

The shared signing coordinator decides **how the protected signer is authorized**.

The Native SDK/Core decides **the cryptographic meaning and signing operation**.

This boundary prevents the old class of behavior where Send and Swap independently chose different password/biometric flows.

---

## 11. Transaction Feature pattern

A transaction Feature should follow the common transaction lifecycle rather than invent its own signing/authentication pipeline.

Conceptually:

```text
user intent
   |
validate feature input
   |
load current Stellar state
   |
build unsigned transaction
   |
derive immutable review from exact XDR
   |
user confirms
   |
reload authorization state
   |
resolve authorized local signer(s)
   |
shared signing coordinator
   |
Fresnica Native SDK / Core
   |
submit signed XDR through Stellar Gateway
   |
normalize result
   |
invalidate/refresh affected caches
```

Feature-specific code owns the intent and product checks.

Shared Core code owns reusable transaction, authorization, signing, and network capabilities.

---

## 12. Error ownership

Errors should be normalized at boundaries.

### Native/Core boundary

Convert Native SDK errors into stable Fresnica/Core error categories.

### Gateway boundary

Convert Horizon/RPC/network failures into stable Stellar/network error categories.

### Feature boundary

A Feature converts those capability errors into product outcomes suitable for its screen/flow.

A screen should not branch on arbitrary native exception strings or Horizon implementation details.

---

## 13. Testing rule

Every Feature should be testable at its application boundary without requiring a running React Native native app for ordinary business-rule tests.

Use injected Core/Repository/Gateway ports to test:

- validation;
- call order where order is business-significant;
- confirmation boundaries;
- error/result mapping;
- refresh/invalidation behavior;
- regression cases.

Native integration tests are reserved for verifying the actual adapter/native boundary, not basic Feature orchestration.

For security-sensitive transaction behavior, preserve regression tests that prove all transaction Features use the shared signer/authentication path.

---

## 14. Example: Send Feature

### Owns

- recipient/asset/amount/memo form;
- local send draft;
- send-specific validation;
- payment review presentation;
- sequencing of build -> review -> confirm -> sign -> submit;
- send-specific result mapping;
- invalidation/refresh intent after submission.

### Depends on

- Stellar Gateway;
- transaction review capability;
- signer resolver;
- shared signing coordinator;
- wallet repository/cache ports.

### Does not own

- Horizon client construction;
- signer cryptography;
- biometric-vs-passcode policy;
- private keys/unlock keys;
- generic submission infrastructure.

---

## 15. Example: Accounts Feature

### Owns

- account list and account management UI;
- add watch-only flow;
- attach signer flow;
- downgrade to watch-only flow;
- delete-account confirmation and product policy;
- labels, sorting, hiding and other account-facing behavior.

### Depends on

- WalletRepository;
- Fresnica Core account parsing/identity verification;
- secure cleanup capability;
- Stellar account state when required by the operation.

### Does not own

- encryption of signer material;
- parsing/mutating Core envelope internals;
- Realm implementation details;
- native secure-storage implementation.

---

## 16. Example: Security Feature

`security` is the user-facing configuration Feature, not the implementation home for every security primitive.

### Owns

- security settings screens;
- change-passcode flow;
- enable/disable system-auth product flow;
- user confirmation and recovery UX;
- product-facing security state/results.

### Depends on

- shared application security coordinator;
- Fresnica Core / Native SDK secure operations;
- OS secure-storage/system-auth ports.

### Does not own

- KDF;
- encryption algorithms;
- biometric Cipher orchestration in JavaScript;
- signing policy duplicated per Feature;
- unlock-key material.

---

## 17. Migrating old Services

Old Service code should be classified, not mechanically renamed.

| Old responsibility | New home |
| --- | --- |
| create/import account product flow | `features/onboarding` / `features/accounts` |
| delete/manage account product flow | `features/accounts` |
| send payment product flow | `features/send` |
| swap product flow | future `features/swap` |
| trustline product flow | `features/trustlines` |
| load Stellar account | `core/stellar` |
| build/submit transaction | `core/stellar` |
| resolve signer authorization | `core/stellar/signing` |
| persist wallet records | `core/storage` |
| shared signing/auth policy | `core/security` / signing coordinator |
| encrypt/decrypt signer material | Fresnica Native SDK / Rust Core |
| mnemonic derivation | Fresnica Native SDK / Rust Core |

The migration rule is therefore:

```text
old Service responsibility
        |
        +--> Feature   when it is product intent/orchestration
        |
        +--> Core      when it is reusable capability
        |
        +--> Remove    when Fresnica Core now owns it
```

---

## 18. Feature Contract

Every Fresnica Mobile Feature follows this contract:

1. Represents one coherent user-facing capability.
2. May own screens, Feature UI, local transient state, application functions, and Feature-specific models/errors.
3. Depends on narrow Core ports and shared generic utilities.
4. Does not implement cryptography, raw secret handling, network/storage engines, or generic infrastructure.
5. Does not expose internal implementation for another Feature to depend on.
6. Keeps durable wallet truth in repositories/storage rather than Feature state.
7. Moves cross-Feature reusable capability downward into Core, not sideways into another Feature.
8. Moves cross-Feature product composition upward into App/application coordination.
9. Keeps Feature state local by default.
10. Is independently testable at its application boundary.
11. Uses shared transaction authorization/signing infrastructure rather than choosing biometric/passcode behavior itself.
12. Calls high-level Fresnica Native SDK operations whenever the SDK already owns the security/cryptographic operation.

---

## 19. Review checklist for a new Feature

Before adding a new Feature such as Swap, ask:

- Is this a real user-facing capability rather than a technical subsystem?
- Which behavior is unique to this Feature?
- Which behavior already exists as a Core capability?
- Is any new code duplicating signer/authentication/transaction logic?
- Is durable truth being incorrectly placed in Zustand?
- Is this Feature importing internals from another Feature?
- Can reusable behavior be moved into an existing Core port instead?
- Does Fresnica Native SDK already provide the security operation?
- Can the application logic be tested without a native runtime?
- Are secrets/private signing material excluded from JS state and APIs?

If these questions cannot be answered cleanly, the Feature boundary is probably wrong.

---

## 20. Summary

The Fresnica Mobile Feature model is intentionally not a new Service layer.

It changes the organizing principle of the application:

```text
Old architecture:
technical services -> screens

Feature-first architecture:
user capability -> Feature orchestration -> reusable Core capabilities
```

The guiding distinction is:

> **Feature decides why, when, and in what product sequence an operation happens. Core provides the reusable capability for how it happens. Fresnica Native SDK/Rust Core remains the authority for cryptographic meaning.**
