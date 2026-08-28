# Fresnica Mobile Realm Persistence Design

**Date:** 2026-08-27

**Status:** Proposed for implementation after written-spec approval

**Branch:** `feat/realm-persistence`

## 1. Purpose

Fresnica Mobile currently has a stable Account/Signer semantic model and an in-memory repository used by tests. The next milestone is to add durable local persistence without allowing the database technology to redefine wallet semantics.

This design introduces Realm strictly as a Mobile platform persistence mechanism. The existing Application Capability contracts remain authoritative.

The governing dependency direction is:

```text
Account / Signer Capability
        |
        v
AccountSignerRepository
        |
        +--> InMemoryAccountSignerRepository   (fast unit tests)
        |
        +--> RealmAccountSignerRepository      (production persistence)
                    |
                    v
                  Realm
```

Realm must not become the domain model, an Application Capability, or a source of wallet-security authority.

## 2. Goals

1. Persist Account, Signer, and Account-Signer relationship state across app restarts.
2. Preserve the existing `AccountSignerRepository` behavioral contract.
3. Keep watch-only as derived state rather than storing another mutable truth.
4. Preserve shared-signer and orphan-cleanup invariants.
5. Persist protected Fresnica signer envelopes only as opaque SDK/Core-owned data.
6. Introduce a real schema version and migration entry point from the first production schema.
7. Return plain Capability records from the Realm adapter rather than Realm live objects.
8. Add native verification that proves Realm is compatible with the RN 0.87 New Architecture shell on Android and iOS.
9. Keep the current in-memory repository for fast deterministic tests.

## 3. Non-goals

This milestone does not implement:

- product UI or navigation;
- onboarding/create/import/watch-only screens;
- Realm Sync or Atlas Device Sync;
- `@realm/react` hooks/providers;
- application state management;
- full-database encryption key lifecycle;
- Keychain/Keystore orchestration;
- app lock/passcode rotation;
- System Auth cleanup orchestration;
- Mainnet enablement;
- transaction/history/portfolio caching;
- generic DAO/ORM abstractions;
- a migration framework beyond the explicit Realm migration entry point.

These concerns remain separate milestones unless implementation evidence shows a hard dependency.

## 4. Existing semantic authority

The existing Capability contract remains unchanged:

```ts
export interface AccountSignerRepository {
  createAccount(account: AccountRecord): void;
  createSigner(signer: SignerRecord): void;
  attachSigner(accountId: string, signerId: string, createdAt: Date): void;
  detachSigner(accountId: string, signerId: string): void;
  deleteAccount(accountId: string): void;
  getAccount(accountId: string): AccountRecord | undefined;
  getSigner(signerId: string): SignerRecord | undefined;
  isWatchOnly(accountId: string): boolean;
}
```

Realm implementation work must not add Realm-specific methods to this interface merely because the database can expose them.

If later product work needs listing, sorting, or observation APIs, those should be designed from product/Capability needs and added intentionally rather than leaking Realm queries upward.

## 5. Dependency selection

### 5.1 Realm package

Use:

```text
realm@20.2.0
```

Rationale:

- it is the current stable Realm JavaScript package line;
- its release contract supports React Native New Architecture;
- it declares React Native compatibility from `>= 0.71.4`;
- Fresnica Mobile is on RN `0.87.0`;
- Fresnica Mobile Android explicitly has `newArchEnabled=true`;
- v20 is local-database-focused after removal of Atlas Device Sync APIs, which matches this milestone.

Do not add `@realm/react`; this repository layer does not need React hooks or provider APIs.

### 5.2 Compatibility risk

Realm 20.2.0 has a reported Linux + Node 22 prebuilt-binary gap. Fresnica Mobile's standard CI uses Node `>=22.13.0`, so implementation must not require the normal Node 22 Jest job to load a real Realm native binary.

The verification strategy therefore separates:

1. normal TypeScript/unit tests on the project-standard Node version;
2. real local-Realm repository integration tests in a compatible Node host job if Realm's available prebuilds permit it;
3. Android and iOS React Native native build/link gates using the actual application shell.

If the dedicated real-Realm host test cannot be made deterministic without changing the project Node baseline, do not silently weaken verification. Keep semantic contract tests in the normal suite and require both RN native platform gates before merge.

If RN 0.87 native compilation reveals a genuine Realm 20.2.0 incompatibility, stop and reassess the Realm package choice rather than silently downgrading to an older major.

## 6. Target source structure

```text
src/platform/persistence/
  index.ts

  memory/
    InMemoryAccountSignerRepository.ts
    __tests__/

  realm/
    RealmAccountSignerRepository.ts
    openWalletRealm.ts
    schemas.ts
    mappers.ts
    types.ts
    index.ts
    __tests__/
```

No new `domain`, `dao`, `entity-service`, or generic `database` layer is introduced.

## 7. Realm data model

Realm schema version starts at:

```text
schemaVersion = 1
```

The database contains three persisted object types.

### 7.1 `AccountEntity`

```text
id                string   primary key
address           string
identityKind      string
networkId         string
label             string
sortOrder         int
hidden            bool
createdAt         date
updatedAt         date
```

Semantic source: `AccountRecord`.

`identityKind` must round-trip exactly as:

```text
classic | contract
```

Realm does not define a second Account type system.

### 7.2 `SignerEntity`

```text
id                    string   primary key
publicKey             string
kind                  string
envelopeJson          string?
envelopeRevision      string?
recoveryKind          string?
backupState           string?
providerId            string?
providerMetadataJson  string?
createdAt             date
updatedAt             date
```

Semantic source: `SignerRecord`.

The database treats `envelopeJson` as opaque text. The Realm layer must never parse, inspect, normalize, or derive information from a protected Fresnica signer envelope.

### 7.3 `AccountSignerReferenceEntity`

```text
id         string   primary key
accountId  string
signerId   string
createdAt  date
```

Reference id remains the existing deterministic form:

```text
${accountId}:${signerId}
```

The schema deliberately stores identifiers instead of Realm object links. This preserves the existing Account/Signer/reference semantics, avoids Realm cascade/link behavior becoming wallet semantics, and makes orphan-cleanup rules explicit in repository code.

## 8. Mapping boundary

`mappers.ts` owns conversion between Realm objects and plain Capability records.

Required properties:

- Realm live objects never leave `src/platform/persistence/realm`;
- returned Account/Signer values are plain objects;
- returned `Date` values are copied as ordinary `Date` instances;
- nullable Realm strings map back to the existing optional TypeScript fields;
- unknown persisted enum strings fail closed with a stable persistence error rather than being cast blindly.

Example direction:

```text
Realm AccountEntity
   -> mapAccountFromRealm(...)
   -> plain AccountRecord
```

This protects application code from Realm object invalidation/liveness semantics.

## 9. Repository behavior

`RealmAccountSignerRepository` implements the existing `AccountSignerRepository` interface and receives an already-open Realm instance through its constructor.

It does not own global database lifecycle.

```text
openWalletRealm()
   -> Realm
   -> new RealmAccountSignerRepository(realm)
```

This keeps opening/migration/closing separate from repository semantics and makes tests deterministic.

### 9.1 Create account

Before insertion, reject an existing account with the same:

```text
(networkId, address)
```

using the existing stable error:

```text
duplicate-account-identity
```

Realm primary keys do not replace this composite semantic uniqueness rule.

### 9.2 Create signer

Persist the `SignerRecord` without redefining signer identity or envelope semantics.

Do not introduce a new public-key uniqueness rule in this milestone because the current Capability repository contract does not define one.

### 9.3 Attach signer

Within one Realm write transaction:

1. require Account to exist, otherwise `account-not-found`;
2. require Signer to exist, otherwise `signer-not-found`;
3. create or replace the deterministic Account-Signer reference.

This preserves current idempotent relationship behavior.

### 9.4 Detach signer

Within one Realm write transaction:

1. delete the Account-Signer reference if present;
2. evaluate signer orphan state after reference removal;
3. delete Signer records with no remaining Account-Signer references.

The first implementation should preserve current in-memory behavior by cleaning all true orphans rather than assuming only the directly detached signer can be orphaned.

### 9.5 Delete account

Within one Realm write transaction:

1. delete the Account if present;
2. delete all references owned by the Account;
3. evaluate all Signers after reference deletion;
4. delete only Signers with no remaining references.

Deleting one account must never delete a Signer still referenced by another Account.

### 9.6 Watch-only

Do not persist a `watchOnly` field.

The result remains derived from current relationship state:

```text
watchOnly(accountId) = no AccountSignerReference exists for accountId
```

The Realm adapter may compute this with a Realm query, but the semantic meaning remains the existing Capability invariant.

## 10. Realm lifecycle

`openWalletRealm.ts` owns the Realm configuration.

Initial configuration:

```text
filename/schema path: Fresnica-owned app-local Realm path
schema: AccountEntity, SignerEntity, AccountSignerReferenceEntity
schemaVersion: 1
migration: explicit version-aware migration callback
```

The migration callback for version 1 performs no data transformation because no prior production Realm schema exists. It still exists as the single future migration entry point.

The app-composition layer will eventually own one Realm instance for the relevant application lifetime and close it on teardown/reload boundaries where appropriate.

This milestone does not add application composition wiring before a real product flow consumes the repository.

## 11. Security boundary

Realm may persist:

- public Stellar account addresses;
- public signer keys;
- account labels/order/visibility metadata;
- Account-Signer references;
- opaque `envelopeJson` returned by Fresnica SDK/Core;
- envelope revision and recovery/backup metadata;
- provider metadata already permitted by `SignerRecord`.

Realm must not persist:

- raw secret seeds;
- raw mnemonic phrases;
- `WalletUnlockKey`;
- decrypted signer material;
- derived private key bytes;
- biometric cipher/key material;
- OS authentication secrets.

No Realm mapper or schema code may parse protected envelopes.

### 11.1 Database encryption

Realm file encryption is intentionally deferred from schema v1.

Reason: a stable Realm encryption key requires an OS Keychain/Keystore lifecycle, recovery behavior, lock semantics, reinstall/restore policy, and key-rotation behavior. Those belong with the upcoming Application Security milestone rather than being improvised inside persistence.

This does not move cryptographic authority into JavaScript. Protected signer secrets remain protected by Fresnica SDK/Core envelopes independently of Realm file encryption.

When database encryption is added later, it must be introduced as a platform security mechanism without changing Account/Signer Capability semantics.

## 12. Secure cleanup boundary

`SecureCleanupTask` already exists in Signer semantics, but `AccountSignerRepository` currently exposes no secure-storage cleanup orchestration.

This Realm milestone therefore must not claim that deleting a Signer also removes every OS System Auth registration or external-provider secret.

Repository deletion means durable Mobile record/reference deletion only.

A later Application Security/Signer lifecycle milestone should connect orphan-signer deletion to SDK/platform secure cleanup using an explicit retryable workflow. Do not hide that behavior inside Realm callbacks.

## 13. Error handling

Preserve existing stable domain/persistence errors where already defined:

```text
duplicate-account-identity
account-not-found
signer-not-found
```

Add only narrow persistence-integration errors when data on disk violates the expected schema semantics, for example:

```text
invalid-persisted-account
invalid-persisted-signer
```

Do not surface raw Realm implementation errors as long-lived cross-application semantic contracts. Unexpected Realm open/write failures may be wrapped at the platform boundary with their cause retained for diagnostics.

## 14. Testing strategy

### 14.1 Shared repository contract tests

Extract/reuse repository behavioral cases so both implementations are held to the same semantics:

```text
InMemoryAccountSignerRepository
RealmAccountSignerRepository
```

Required contract cases:

1. account create/get round-trip;
2. signer create/get round-trip;
3. duplicate `(networkId, address)` rejection;
4. attach signer changes watch-only from true to false;
5. detach signer changes watch-only back to true;
6. deleting one of two accounts sharing a signer preserves the signer;
7. deleting the final reference removes the orphan signer;
8. contract identities remain valid Account identities but are not implicitly software signers;
9. optional protected-envelope/provider fields round-trip exactly;
10. Date fields round-trip with the same timestamps.

### 14.2 Mapper unit tests

Normal project Jest tests verify:

- plain-object output;
- nullable/optional conversion;
- enum validation;
- protected envelope opacity;
- Date copying;
- stable invalid-persisted-record errors.

These tests must not require loading a Realm native binary.

### 14.3 Real local-Realm integration test

Where Realm's supported host prebuild permits deterministic CI execution, run a dedicated local Realm integration test that proves:

1. create Account/Signer/reference;
2. close Realm;
3. reopen the same Realm path;
4. repository reads the same records;
5. watch-only and shared-signer semantics survive reopen;
6. deleting the final reference persists orphan cleanup after another reopen.

Because Realm 20.2.0 has a known Linux + Node 22 prebuild gap, this test must not make the standard Node 22 CI job flaky. A dedicated compatible host runtime may be used solely for the Realm host integration test.

### 14.4 React Native native gates

Realm is a native dependency. Before merge, Android and iOS gates must build the actual RN 0.87 application shell with Realm installed.

The existing native workflows currently target the historical `work/rn087-native-shell` push ref. This milestone must update their triggers so the canonical `main`/pull-request workflow can validate future native dependency changes.

Required native evidence:

- Android debug build/link succeeds with Realm and Fresnica Native SDK together;
- iOS Simulator build/link succeeds with Realm and Fresnica Native SDK together;
- no duplicate C++/linker/native-module registration conflict is introduced.

A minimal runtime Realm open/close smoke should be added if it can reuse the existing native smoke harness without creating a test-only application architecture.

## 15. CI expectations

Before merge, require:

```text
npm run typecheck
npm test
npm run check
```

plus the Realm-specific integration/native evidence described above.

The dependency audit findings already present in the repository remain a separate dependency-security task. Do not run `npm audit fix --force` as part of Realm integration.

## 16. Implementation boundaries

This milestone may change:

```text
package.json / package-lock.json
src/platform/persistence/**
repository contract test organization
Android/iOS dependency integration generated by Realm autolinking
.github/workflows native gate triggers/verification
docs/mobile-capability-status.md
docs/fresnica-mobile-handoff.md
```

It should not change:

```text
Fresnica SDK signing APIs
Transaction/Payment semantics
Ledger Authorization semantics
Account/Signer field meaning
watch-only meaning
NativeModules.FresnicaCore runtime contract
product UI/navigation
```

## 17. Rollback

Implementation will live on `feat/realm-persistence`, forked from the verified merged `main` baseline.

If Realm native integration proves incompatible with RN 0.87 or the existing Fresnica native shell:

1. do not weaken security or Capability semantics to make Realm fit;
2. keep `main` unchanged;
3. revert the Realm feature branch to the last green task commit as needed;
4. reassess the persistence mechanism/version with evidence from the failed native gate.

No migration concern exists on `main` until the Realm feature is merged.

## 18. Success criteria

The milestone is complete when:

1. `realm@20.2.0` is integrated without adding `@realm/react`;
2. `RealmAccountSignerRepository` implements the existing repository contract;
3. Account, Signer, and reference state survives Realm close/reopen;
4. watch-only remains derived and survives restart correctly;
5. shared-signer deletion behavior matches the in-memory implementation;
6. orphan signers are removed only after their final Account reference is removed;
7. protected signer envelopes remain opaque and raw secret material is never added to Realm schemas;
8. schema version 1 and one explicit migration entry point exist;
9. Realm objects do not escape the platform persistence adapter;
10. normal TypeScript/Jest checks pass;
11. Android and iOS RN 0.87 native gates build/link the app with Realm and Fresnica Native SDK together;
12. Mobile capability/handoff documentation records Realm production persistence truthfully;
13. the feature is merged through a short-lived PR directly back to `main`.
