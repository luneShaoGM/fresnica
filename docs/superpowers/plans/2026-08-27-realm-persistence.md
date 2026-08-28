# Realm Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable Realm-backed Account/Signer persistence to Fresnica Mobile while preserving the existing Capability repository semantics and proving RN 0.87 Android/iOS compatibility.

**Architecture:** Keep `AccountSignerRepository` as the semantic boundary. Add a Realm adapter under `src/platform/persistence/realm`, keep the in-memory adapter for fast tests, and isolate real Realm native loading to dedicated integration/native gates. Realm objects never escape the platform adapter and protected signer envelopes remain opaque.

**Tech Stack:** React Native 0.87.0 New Architecture, TypeScript 6.0.3, Jest 29.7.0, Realm JavaScript 20.2.0, GitHub Actions, Android Gradle/RN autolinking, CocoaPods/iOS Simulator.

**Spec:** `docs/superpowers/specs/2026-08-27-realm-persistence-design.md`

## Global Constraints

- Use exactly `realm@20.2.0` unless a native gate demonstrates incompatibility; do not silently downgrade.
- Do not add `@realm/react`.
- Preserve `AccountSignerRepository` method signatures and existing Account/Signer field meaning.
- `watchOnly` remains derived from Account-Signer references and must not be persisted.
- Realm persists protected `envelopeJson` only as opaque text; no parser may inspect protected envelope contents.
- Never persist raw secret seeds, raw mnemonics, `WalletUnlockKey`, decrypted signer material, derived private-key bytes, biometric cipher material, or OS authentication secrets.
- Realm schema version starts at `1` and exposes one explicit migration entry point.
- Realm live objects must not escape `src/platform/persistence/realm`.
- Keep `InMemoryAccountSignerRepository` for normal unit tests.
- Standard project CI stays on Node `22.13.0`; normal Jest must not require a Realm native binary.
- Real Realm close/reopen integration runs in a compatible macOS Node 22 job because Realm 20.2.0 has a known Linux + Node 22 prebuilt-binary gap.
- Android and iOS gates must build/link the actual RN 0.87 app with Realm and Fresnica Native SDK together before merge.
- Introduce and commit `package-lock.json` with the Realm dependency, then use `npm ci` in CI/native workflows.
- Do not run `npm audit fix --force` as part of this milestone.
- Do not add product UI/navigation, Realm Sync, database encryption-key lifecycle, Keychain/Keystore orchestration, or System Auth cleanup orchestration.

---

## Locked File Structure

```text
package.json
package-lock.json
jest.config.js

src/platform/persistence/
  index.ts
  repositoryContract.ts

  memory/
    InMemoryAccountSignerRepository.ts
    __tests__/
      InMemoryAccountSignerRepository.test.ts

  realm/
    RealmAccountSignerRepository.ts
    openWalletRealm.ts
    schemas.ts
    mappers.ts
    types.ts
    index.ts
    __tests__/
      mappers.test.ts
      schemas.test.ts
      RealmAccountSignerRepository.realm.integration.test.ts

scripts/
  native-runtime-smoke-entry.js

.github/workflows/
  ci.yml
  native-android-gate.yml
  native-apple-gate.yml

docs/
  mobile-capability-status.md
  fresnica-mobile-handoff.md
```

`repositoryContract.ts` contains reusable behavioral test cases/factory helpers only; it is not a new production abstraction layer.

---

### Task 1: Lock Realm dependency and make native gates canonical

**Files:**
- Modify: `package.json`
- Create: `package-lock.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/native-android-gate.yml`
- Modify: `.github/workflows/native-apple-gate.yml`
- Remote: open Draft PR `feat/realm-persistence -> main` before relying on PR-triggered gates

**Interfaces:**
- Produces: exact `realm@20.2.0` dependency and deterministic `npm ci` dependency installation.
- Produces: PR/main native gates for all future native dependency changes.
- Consumes: existing RN 0.87 New Architecture shell and Fresnica Native SDK 0.2.1 integration.

- [ ] **Step 1: Open a Draft PR from `feat/realm-persistence` to `main`**

Use title:

```text
feat: add Realm account signer persistence
```

Body must state that the PR begins with dependency/native compatibility verification and remains draft until Realm repository semantics, real reopen integration, and Android/iOS runtime gates pass.

- [ ] **Step 2: Add exact Realm dependency and generate the first npm lockfile**

Run in a clean checkout of the feature branch:

```bash
npm install --save-exact realm@20.2.0
```

Expected package change:

```json
"dependencies": {
  "@stellar/stellar-sdk": "17.0.1",
  "react": "19.2.3",
  "react-native": "0.87.0",
  "realm": "20.2.0"
}
```

Expected: `package-lock.json` is created and records Realm 20.2.0 exactly.

- [ ] **Step 3: Verify lockfile install on the project Node version**

Run:

```bash
rm -rf node_modules
npm ci
npm run check
```

Expected: dependency installation succeeds; current TypeScript/Jest suite remains green. Do not import/open Realm in the normal Jest suite yet.

- [ ] **Step 4: Switch standard CI from `npm install` to `npm ci` and remove obsolete feature push trigger**

Update `.github/workflows/ci.yml` to:

```yaml
on:
  push:
    branches:
      - main
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.13.0'
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 5: Make Android native gate run on `main`, pull requests, and manual dispatch**

Replace the trigger with:

```yaml
on:
  push:
    branches:
      - main
  pull_request:
  workflow_dispatch:
```

Change `Install JavaScript dependencies` from:

```yaml
run: npm install
```

to:

```yaml
run: npm ci
```

Do not change Fresnica Native SDK pins/checksums or the adapter build shim in this task.

- [ ] **Step 6: Make Apple native gate run on `main`, pull requests, and manual dispatch**

Use the same trigger and `npm ci` change as Android. Do not change Fresnica SDK/native adapter semantics.

- [ ] **Step 7: Push the dependency/CI commit and inspect all three PR workflow results**

Required evidence:

```text
CI                      PASS
Native Android Gate     PASS build/link/smoke
Native Apple Gate       PASS build/link/smoke
```

At this point the native smoke still verifies FresnicaCore only; passing proves Realm 20.2.0 can coexist at build/link/autolink level with the RN 0.87 + Fresnica shell.

If either native gate fails because Realm 20.2.0 itself is incompatible, stop this plan and investigate the package/platform failure before writing repository code.

- [ ] **Step 8: Commit**

```text
build: lock Realm native persistence dependency
```

---

### Task 2: Add schema v1 and plain-object mapping boundary

**Files:**
- Create: `src/platform/persistence/realm/types.ts`
- Create: `src/platform/persistence/realm/schemas.ts`
- Create: `src/platform/persistence/realm/mappers.ts`
- Create: `src/platform/persistence/realm/__tests__/schemas.test.ts`
- Create: `src/platform/persistence/realm/__tests__/mappers.test.ts`

**Interfaces:**
- Produces: `ACCOUNT_ENTITY`, `SIGNER_ENTITY`, `ACCOUNT_SIGNER_REFERENCE_ENTITY` schema-name constants.
- Produces: `walletRealmSchemas` and `WALLET_REALM_SCHEMA_VERSION = 1`.
- Produces: plain row shapes `PersistedAccount`, `PersistedSigner`, `PersistedAccountSignerReference` used only inside Realm persistence.
- Produces: `toPersistedAccount`, `fromPersistedAccount`, `toPersistedSigner`, `fromPersistedSigner`, `toPersistedReference`.
- Consumes: Capability `AccountRecord`, `SignerRecord`, `AccountSignerReference`.

- [ ] **Step 1: Write failing schema tests without loading Realm native runtime**

Create `schemas.test.ts`:

```ts
import {
  ACCOUNT_ENTITY,
  ACCOUNT_SIGNER_REFERENCE_ENTITY,
  SIGNER_ENTITY,
  WALLET_REALM_SCHEMA_VERSION,
  walletRealmSchemas,
} from '../schemas';

describe('wallet Realm schema', () => {
  it('starts at schema version 1 with exactly three object types', () => {
    expect(WALLET_REALM_SCHEMA_VERSION).toBe(1);
    expect(walletRealmSchemas.map(schema => schema.name)).toEqual([
      ACCOUNT_ENTITY,
      SIGNER_ENTITY,
      ACCOUNT_SIGNER_REFERENCE_ENTITY,
    ]);
  });

  it('does not persist watchOnly or raw secret material', () => {
    const serialized = JSON.stringify(walletRealmSchemas);
    expect(serialized).not.toContain('watchOnly');
    expect(serialized).not.toContain('mnemonic');
    expect(serialized).not.toContain('secretSeed');
    expect(serialized).not.toContain('WalletUnlockKey');
  });
});
```

- [ ] **Step 2: Write failing mapper tests for plain-copy and fail-closed enums**

Create `mappers.test.ts` with fixtures that verify:

```ts
const account = fromPersistedAccount({
  id: 'account-a',
  address: 'GACCOUNT',
  identityKind: 'classic',
  networkId: 'stellar-testnet',
  label: 'Primary',
  sortOrder: 0,
  hidden: false,
  createdAt: new Date('2026-08-27T00:00:00.000Z'),
  updatedAt: new Date('2026-08-27T00:00:00.000Z'),
});

expect(account).toEqual(expect.objectContaining({ identityKind: 'classic' }));
expect(account.createdAt).not.toBe(persisted.createdAt);
```

and:

```ts
expect(() =>
  fromPersistedSigner({ ...validSignerRow, kind: 'unknown-kind' }),
).toThrow('invalid-persisted-signer');
```

Also assert `envelopeJson` round-trips byte-for-byte as a string and is not parsed.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
npx jest src/platform/persistence/realm/__tests__/schemas.test.ts src/platform/persistence/realm/__tests__/mappers.test.ts --runInBand
```

Expected: FAIL because Realm persistence modules do not exist.

- [ ] **Step 4: Implement persistence row types**

Create `types.ts`:

```ts
export type PersistedAccount = {
  id: string;
  address: string;
  identityKind: string;
  networkId: string;
  label: string;
  sortOrder: number;
  hidden: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PersistedSigner = {
  id: string;
  publicKey: string;
  kind: string;
  envelopeJson?: string | null;
  envelopeRevision?: string | null;
  recoveryKind?: string | null;
  backupState?: string | null;
  providerId?: string | null;
  providerMetadataJson?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PersistedAccountSignerReference = {
  id: string;
  accountId: string;
  signerId: string;
  createdAt: Date;
};
```

These are storage row shapes, not new domain types.

- [ ] **Step 5: Implement schema constants as plain `Realm.ObjectSchema` values using type-only imports**

Create `schemas.ts`:

```ts
import type Realm from 'realm';

export const WALLET_REALM_SCHEMA_VERSION = 1;
export const ACCOUNT_ENTITY = 'AccountEntity';
export const SIGNER_ENTITY = 'SignerEntity';
export const ACCOUNT_SIGNER_REFERENCE_ENTITY = 'AccountSignerReferenceEntity';

export const accountSchema: Realm.ObjectSchema = {
  name: ACCOUNT_ENTITY,
  primaryKey: 'id',
  properties: {
    id: 'string',
    address: 'string',
    identityKind: 'string',
    networkId: 'string',
    label: 'string',
    sortOrder: 'int',
    hidden: 'bool',
    createdAt: 'date',
    updatedAt: 'date',
  },
};

export const signerSchema: Realm.ObjectSchema = {
  name: SIGNER_ENTITY,
  primaryKey: 'id',
  properties: {
    id: 'string',
    publicKey: 'string',
    kind: 'string',
    envelopeJson: 'string?',
    envelopeRevision: 'string?',
    recoveryKind: 'string?',
    backupState: 'string?',
    providerId: 'string?',
    providerMetadataJson: 'string?',
    createdAt: 'date',
    updatedAt: 'date',
  },
};

export const accountSignerReferenceSchema: Realm.ObjectSchema = {
  name: ACCOUNT_SIGNER_REFERENCE_ENTITY,
  primaryKey: 'id',
  properties: {
    id: 'string',
    accountId: 'string',
    signerId: 'string',
    createdAt: 'date',
  },
};

export const walletRealmSchemas = [
  accountSchema,
  signerSchema,
  accountSignerReferenceSchema,
];
```

Because the import is type-only and schemas are plain objects, normal Jest does not load Realm native code.

- [ ] **Step 6: Implement strict mappers**

Use explicit validators for:

```text
AccountIdentityKind: classic | contract
SignerKind: protected-software | hardware | external
RecoveryKind: mnemonic | secret
BackupState: pending | confirmed | not-required
```

`fromPersistedAccount` throws `invalid-persisted-account` on an invalid identity kind. `fromPersistedSigner` throws `invalid-persisted-signer` on invalid signer/recovery/backup enum values.

Every returned Date uses:

```ts
new Date(row.createdAt.getTime())
```

Optional Realm nulls map to TypeScript `undefined`.

- [ ] **Step 7: Run focused and full normal tests**

Run:

```bash
npx jest src/platform/persistence/realm/__tests__/schemas.test.ts src/platform/persistence/realm/__tests__/mappers.test.ts --runInBand
npm run check
```

Expected: PASS without loading a Realm native binary in Linux Node 22 CI.

- [ ] **Step 8: Commit**

```text
feat: define Realm wallet schema boundary
```

---

### Task 3: Share repository behavior tests and implement Realm repository

**Files:**
- Create: `src/platform/persistence/repositoryContract.ts`
- Modify: `src/platform/persistence/memory/__tests__/InMemoryAccountSignerRepository.test.ts`
- Create: `src/platform/persistence/realm/RealmAccountSignerRepository.ts`
- Create: `src/platform/persistence/realm/openWalletRealm.ts`
- Create: `src/platform/persistence/realm/index.ts`
- Modify: `src/platform/persistence/index.ts`
- Create: `src/platform/persistence/realm/__tests__/RealmAccountSignerRepository.realm.integration.test.ts`
- Modify: `jest.config.js`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `defineAccountSignerRepositoryContract(name, createRepository)` reusable behavioral test definition.
- Produces: `RealmAccountSignerRepository implements AccountSignerRepository`.
- Produces: `openWalletRealm({ path? }) -> Promise<Realm>` and `migrateWalletRealm`.
- Produces: `npm run test:realm` dedicated integration command.
- Consumes: Task 2 schemas/mappers and existing Capability repository contract.

- [ ] **Step 1: Extract shared repository contract tests from the in-memory test**

Create `repositoryContract.ts` exporting a test helper used only from tests:

```ts
import type { AccountSignerRepository } from '../../capabilities/account/AccountSignerRepository';

export type RepositoryFactory = () =>
  | AccountSignerRepository
  | Promise<AccountSignerRepository>;

export function defineAccountSignerRepositoryContract(
  name: string,
  createRepository: RepositoryFactory,
): void {
  describe(name, () => {
    // concrete tests below
  });
}
```

The contract must include these concrete cases:

```text
account create/get round-trip
signer create/get round-trip
duplicate same-network address rejection
same address on different network allowed
attach toggles watch-only true -> false
detach toggles false -> true and removes orphan signer
shared signer survives deleting one account
last-account deletion removes orphan signer
optional envelope/provider fields round-trip
Date timestamps round-trip
```

Use fresh repository state per test.

- [ ] **Step 2: Point the existing in-memory suite at the shared contract and run it**

The in-memory suite becomes:

```ts
import { defineAccountSignerRepositoryContract } from '../../repositoryContract';
import { InMemoryAccountSignerRepository } from '../InMemoryAccountSignerRepository';

defineAccountSignerRepositoryContract(
  'InMemoryAccountSignerRepository',
  () => new InMemoryAccountSignerRepository(),
);
```

Run:

```bash
npx jest src/platform/persistence/memory --runInBand
```

Expected: PASS before Realm implementation work continues. If the new contract reveals an existing in-memory semantic bug, fix the in-memory adapter first and record the behavior as the repository authority.

- [ ] **Step 3: Add the failing Realm integration suite**

Create `RealmAccountSignerRepository.realm.integration.test.ts` that imports real Realm/opening code and uses a unique temp Realm path.

Skeleton:

```ts
import Realm from 'realm';
import { defineAccountSignerRepositoryContract } from '../../repositoryContract';
import { RealmAccountSignerRepository } from '../RealmAccountSignerRepository';
import { openWalletRealm } from '../openWalletRealm';

let realm: Realm | undefined;
let path: string;

afterEach(() => {
  if (realm && !realm.isClosed) realm.close();
  Realm.deleteFile({ path });
});

defineAccountSignerRepositoryContract(
  'RealmAccountSignerRepository',
  async () => {
    path = `fresnica-test-${Date.now()}-${Math.random()}.realm`;
    realm = await openWalletRealm({ path });
    return new RealmAccountSignerRepository(realm);
  },
);
```

Also add one explicit close/reopen test that persists Account + Signer + reference, closes Realm, reopens the same path, and verifies records/watch-only state remain correct.

- [ ] **Step 4: Exclude real Realm integration from normal Jest and add dedicated script**

Update `jest.config.js` so normal `npm test` ignores:

```text
.realm.integration.test.ts
```

Add package script:

```json
"test:realm": "jest --runInBand --runTestsByPath src/platform/persistence/realm/__tests__/RealmAccountSignerRepository.realm.integration.test.ts"
```

- [ ] **Step 5: Run the dedicated suite on a host where Realm native runtime is available and verify RED**

Run on macOS Node 22.13.0:

```bash
npm ci
npm run test:realm
```

Expected: FAIL because `RealmAccountSignerRepository` / `openWalletRealm` do not exist yet.

- [ ] **Step 6: Implement `openWalletRealm` and explicit migration entry point**

Create:

```ts
import Realm from 'realm';
import { WALLET_REALM_SCHEMA_VERSION, walletRealmSchemas } from './schemas';

export type OpenWalletRealmOptions = {
  path?: string;
};

export function migrateWalletRealm(): void {
  // Schema v1 has no predecessor to transform. This is the single future migration entry point.
}

export function openWalletRealm(
  options: OpenWalletRealmOptions = {},
): Promise<Realm> {
  return Realm.open({
    path: options.path,
    schema: walletRealmSchemas,
    schemaVersion: WALLET_REALM_SCHEMA_VERSION,
    onMigration: migrateWalletRealm,
  });
}
```

Do not add `deleteRealmIfMigrationNeeded`.

- [ ] **Step 7: Implement `RealmAccountSignerRepository` with explicit transactions**

Constructor:

```ts
export class RealmAccountSignerRepository implements AccountSignerRepository {
  constructor(private readonly realm: Realm) {}
}
```

`createAccount`:

```ts
const duplicate = this.realm
  .objects<PersistedAccount>(ACCOUNT_ENTITY)
  .filtered('networkId == $0 AND address == $1', account.networkId, account.address)[0];
if (duplicate) throw new Error('duplicate-account-identity');

this.realm.write(() => {
  this.realm.create(ACCOUNT_ENTITY, toPersistedAccount(account));
});
```

`createSigner` writes `toPersistedSigner(signer)`.

`attachSigner` validates Account and Signer first. Inside one write transaction, delete an existing deterministic reference with the same id if present, then create the new reference. Do not import/use Realm `UpdateMode` solely for this operation.

`detachSigner` and `deleteAccount` must perform reference deletion and orphan cleanup inside the same Realm write transaction.

Use an internal `deleteOrphanSignersInCurrentWrite()` helper that:

1. obtains all signer ids referenced by current reference rows;
2. iterates current signer rows;
3. deletes only signers whose ids are not referenced.

`getAccount/getSigner` map live Realm rows immediately to plain Capability records using Task 2 mappers.

`isWatchOnly(accountId)` checks whether any reference row exists for the account; do not store a watch-only property.

- [ ] **Step 8: Run real Realm contract/reopen integration**

On macOS Node 22.13.0:

```bash
npm run test:realm
```

Expected: all shared repository semantics plus explicit close/reopen persistence PASS.

- [ ] **Step 9: Add a dedicated macOS Realm integration job to `.github/workflows/ci.yml`**

Add:

```yaml
  realm-integration:
    runs-on: macos-15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.13.0'
          cache: npm
      - run: npm ci
      - run: npm run test:realm
```

Do not move standard Linux unit CI to macOS.

- [ ] **Step 10: Run all normal checks**

Run:

```bash
npm run typecheck
npm test
npm run check
```

Expected: normal tests pass without executing `.realm.integration.test.ts`.

- [ ] **Step 11: Commit**

```text
feat: persist account signer state with Realm
```

---

### Task 4: Extend real Realm verification through restart and orphan cleanup

**Files:**
- Modify: `src/platform/persistence/realm/__tests__/RealmAccountSignerRepository.realm.integration.test.ts`
- Modify if required by test evidence: `src/platform/persistence/realm/RealmAccountSignerRepository.ts`

**Interfaces:**
- Consumes: real Realm adapter/opening from Task 3.
- Produces: durable restart evidence for watch-only, shared signer and final-orphan cleanup semantics.

- [ ] **Step 1: Add a failing multi-reopen lifecycle regression**

Test sequence:

```text
open Realm
create account-a + account-b + shared signer
attach shared signer to both accounts
close Realm
reopen
verify both accounts non-watch-only and signer exists
delete account-a
close Realm
reopen
verify account-b and shared signer still exist
delete account-b
close Realm
reopen
verify shared signer is absent
```

- [ ] **Step 2: Run dedicated integration and observe result**

Run:

```bash
npm run test:realm
```

If it passes immediately, retain the regression as evidence. If it fails, diagnose the repository transaction/query behavior before changing implementation.

- [ ] **Step 3: Make only the minimal repository fix if RED exposed a real lifecycle bug**

Do not redesign schemas or add cascade links. Preserve explicit id/reference semantics.

- [ ] **Step 4: Re-run dedicated and normal suites**

Run:

```bash
npm run test:realm
npm run check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```text
 test: verify Realm signer lifecycle across restarts
```

Use commit message without the leading space:

```text
test: verify Realm signer lifecycle across restarts
```

---

### Task 5: Extend RN runtime smoke to prove Realm and Fresnica coexist at runtime

**Files:**
- Modify: `scripts/native-runtime-smoke-entry.js`
- Modify: `.github/workflows/native-android-gate.yml`
- Modify: `.github/workflows/native-apple-gate.yml`

**Interfaces:**
- Consumes: installed Realm 20.2.0, existing FresnicaCore parseAccount smoke, RN 0.87 New Architecture app.
- Produces: one runtime smoke result proving both native modules can execute in the same app process.

- [ ] **Step 1: Extend smoke entry with a Realm open/write/read/close check before reporting success**

Add:

```js
import Realm from 'realm';
```

Define a smoke schema:

```js
const SmokeRecordSchema = {
  name: 'SmokeRecord',
  primaryKey: 'id',
  properties: {
    id: 'string',
    value: 'string',
  },
};
```

Inside `run()`, after the existing FresnicaCore parse/error assertions:

```js
const realm = await Realm.open({
  path: 'fresnica-native-smoke.realm',
  schema: [SmokeRecordSchema],
  schemaVersion: 1,
});
try {
  realm.write(() => {
    realm.create('SmokeRecord', { id: 'realm-smoke', value: 'ok' });
  });
  const persisted = realm.objectForPrimaryKey('SmokeRecord', 'realm-smoke');
  if (persisted?.value !== 'ok') {
    throw new Error('Realm runtime smoke write/read failed');
  }
} finally {
  realm.close();
}
```

Include:

```js
realm: 'ok'
```

in the reported success summary.

This smoke schema is test-only and must not import production wallet schemas into the runtime harness.

- [ ] **Step 2: Tighten Android success assertion**

Keep the existing marker assertion and add a JSON/text assertion that the result contains Realm success, for example:

```bash
grep -F '"realm":"ok"' "$RUNNER_TEMP/android-native-runtime-smoke.json"
```

- [ ] **Step 3: Tighten Apple success assertion**

Add the equivalent Realm success grep for Apple.

- [ ] **Step 4: Push and require both native gates to pass**

Required evidence:

```text
Android: app builds, launches, FresnicaCore.parseAccount succeeds, Realm open/write/read succeeds
Apple:   app builds, launches, FresnicaCore.parseAccount succeeds, Realm open/write/read succeeds
```

If one platform fails, use systematic debugging; do not suppress the Realm smoke or disable New Architecture.

- [ ] **Step 5: Commit**

```text
test: verify Realm native runtime integration
```

---

### Task 6: Documentation, PR review, and merge readiness

**Files:**
- Modify: `docs/mobile-capability-status.md`
- Modify: `docs/fresnica-mobile-handoff.md`
- Modify if necessary: `README.md`
- Remote: update Draft PR body and mark ready only after all gates pass

**Interfaces:**
- Produces: truthful current persistence capability status and one merge-ready short-lived PR.
- Consumes: all Task 1-5 verification evidence.

- [ ] **Step 1: Update capability status from in-memory-only to Realm production persistence**

Change Account/Signer persistence evidence to state:

```text
Realm-backed local persistence implemented for Account, Signer and Account-Signer references.
In-memory repository retained for unit tests.
watch-only remains derived.
```

Do not claim database file encryption, secure cleanup orchestration, onboarding UI or Mainnet.

- [ ] **Step 2: Update handoff with exact persistence invariants and verification**

Record:

```text
Realm JS 20.2.0
schemaVersion 1
AccountEntity / SignerEntity / AccountSignerReferenceEntity
Realm objects do not escape platform persistence
protected envelopes stored opaque
normal CI Node 22 + macOS real-Realm integration
Android/iOS runtime Realm + Fresnica smoke evidence
```

- [ ] **Step 3: Scan repository for forbidden persistence drift**

Search for:

```text
watchOnly in Realm schema
encryptionKey in Realm config
@realm/react
WalletUnlockKey in persistence
mnemonic in Realm schema
secretSeed in Realm schema
Realm.Object outside src/platform/persistence/realm
```

Expected: no prohibited persistence/security leakage. References in docs/tests explaining prohibitions are allowed.

- [ ] **Step 4: Run fresh full verification on the final feature head**

Required:

```bash
npm ci
npm run typecheck
npm test
npm run test:realm   # macOS Realm host
npm run check
```

Required GitHub Actions:

```text
CI / test                    success
CI / realm-integration       success
Native Android Gate          success
Native Apple Gate            success
```

- [ ] **Step 5: Review the complete PR diff against the written spec**

Explicitly verify:

- no Capability method signature changed;
- no Realm live object escaped the adapter;
- no watch-only column exists;
- no raw secret material schema exists;
- shared signer semantics match in-memory contract;
- schema version/migration entry point exist;
- native workflow pins for Fresnica SDK remain unchanged;
- no product UI/application-security scope was pulled in.

- [ ] **Step 6: Update PR body with verification evidence and mark Ready for review**

PR summary must include Realm version, schema v1, repository semantic coverage, real close/reopen integration, Android/iOS native runtime evidence, and explicitly deferred database encryption/System Auth cleanup.

- [ ] **Step 7: Commit documentation**

```text
docs: record Realm persistence baseline
```

- [ ] **Step 8: Merge only after user chooses the integration option and final verification is green**

After merge, verify `main` contains the Realm feature head before treating Realm as the development baseline.
