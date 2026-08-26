# Fresnica Mobile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a testable `fresnica-mobile` foundation with RN 0.87 metadata, Testnet configuration, Core boundary types, Account/Signer domain invariants, and an in-memory repository before native/Realm integration.

**Architecture:** The first slice is deliberately pure TypeScript around the approved feature-first architecture so domain/security rules can be proven independently of React Native native builds. Native SDK/adapter and Realm will plug into stable ports in the next slice.

**Tech Stack:** React Native 0.87.0, React 19.2.3, TypeScript, Jest, GitHub Actions, Zustand 5, React Navigation 7, Stellar SDK 17.x.

**Spec:** `docs/superpowers/specs/2026-08-26-fresnica-mobile-v1-design.md`

## Global Constraints

- App/product name is Fresnica; repository/project identity is `fresnica-mobile`.
- Milestone 1 is Stellar Testnet only.
- React Native is 0.87.0; Node.js >= 22.13.0.
- Account and Signer are separate persisted concepts.
- `watchOnly` and `canSign` are derived, never persisted AccountRecord truth.
- Private keys, mnemonics, passcodes, native unlock keys and signer envelope internals must not be application state.
- Fresnica Native SDK is the future signing/security authority; TypeScript must expose only narrow safe ports.

---

### Task 1: Foundation metadata and CI

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `jest.config.js`
- Create: `.github/workflows/ci.yml`
- Create: `src/app/config/appConfig.ts`
- Test: `src/app/config/__tests__/appConfig.test.ts`

**Interfaces:**
- Produces `APP_CONFIG` with `appName`, `projectName`, and one immutable Testnet network config.

- [ ] Add Jest/TypeScript project metadata and CI using Node 22.
- [ ] Write a failing test asserting Fresnica naming, Testnet-only network ID, Horizon URL and network passphrase.
- [ ] Push test-only commit and confirm GitHub Actions fails because `APP_CONFIG` does not exist.
- [ ] Implement the smallest immutable `APP_CONFIG` that passes.
- [ ] Confirm CI passes.

### Task 2: Wallet domain types and invariants

**Files:**
- Create: `src/core/storage/domain/types.ts`
- Create: `src/core/storage/domain/walletInvariants.ts`
- Test: `src/core/storage/domain/__tests__/walletInvariants.test.ts`

**Interfaces:**
- Produces `AccountRecord`, `SignerRecord`, `AccountSignerReference`, `SecureCleanupTask`.
- Produces `isWatchOnly(accountId, references)`.
- Produces `findOrphanSignerIds(signers, references)`.

- [ ] Write failing tests proving watch-only is derived from missing references and signer orphan detection respects shared signers.
- [ ] Confirm CI fails because invariant functions are absent.
- [ ] Implement minimal types/functions.
- [ ] Confirm CI passes.

### Task 3: In-memory wallet repository contract

**Files:**
- Create: `src/core/storage/WalletRepository.ts`
- Create: `src/core/storage/InMemoryWalletRepository.ts`
- Test: `src/core/storage/__tests__/InMemoryWalletRepository.test.ts`

**Interfaces:**
- Produces atomic application-level operations for create account, create signer, attach signer, detach signer, delete account, and lookup.
- Deleting an account deletes an orphan signer but preserves a signer referenced by another account.

- [ ] Write failing lifecycle tests including shared signer preservation and watch-only downgrade.
- [ ] Confirm CI red.
- [ ] Implement minimal repository behavior.
- [ ] Confirm CI green.

### Task 4: Fresnica Core safe TypeScript port

**Files:**
- Create: `src/core/fresnica/types.ts`
- Create: `src/core/fresnica/FresnicaCore.ts`
- Test: `src/core/fresnica/__tests__/FresnicaCore.contract.test.ts`

**Interfaces:**
- Produces safe interfaces for compatibility, account parsing, generation/import, re-protection, export and protected transaction signing.
- Must not expose `WalletUnlockKey`, private-key decrypt, or generic secret getter APIs.

- [ ] Write compile/runtime contract tests for the allowed surface and sensitive-field absence.
- [ ] Confirm CI red.
- [ ] Implement interface/types only; no fake cryptography.
- [ ] Confirm CI green.

### Task 5: Foundation barrel and milestone verification

**Files:**
- Create: `src/core/storage/index.ts`
- Create: `src/core/fresnica/index.ts`
- Create: `src/app/config/index.ts`
- Update: `README.md`

**Interfaces:**
- Produces documented foundation imports for the next Native SDK/Realm slice.

- [ ] Add exports and update README with current milestone status and branch purpose.
- [ ] Run CI (`npm test` and `npm run typecheck`) through GitHub Actions.
- [ ] Verify no XRPL/Xaman domain naming exists in new source.
- [ ] Commit milestone.
