# Fresnica Native Adapter Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the canonical Fresnica Native SDK v0.2.0 React Native adapter contract into `fresnica-mobile` without exposing secret/unlock-key internals to JavaScript.

**Architecture:** Keep the app-facing `FresnicaCore` interface in TypeScript, backed by a narrow React Native `NativeModules.FresnicaCore` wrapper. Pin the framework/native/adapter versions in one compatibility descriptor and validate generated adapter metadata before native builds. Binary AAR/XCFramework generation remains a one-time consumer-environment build step and is not emulated in JavaScript.

**Tech Stack:** React Native 0.87.0, React 19.2.3, TypeScript, Fresnica Native SDK 0.2.0, Native Binding API 2, React Native canonical adapter source 0.2.0.

**Spec:** `docs/superpowers/specs/2026-08-26-fresnica-mobile-v1-design.md`

## Global Constraints

- React Native is pinned to `0.87.0`.
- Fresnica Native SDK is pinned to `0.2.0`.
- Canonical RN adapter source is pinned to `0.2.0`.
- Native Binding API is `2`.
- React Native module name is `FresnicaCore`.
- Android minimum SDK is 26.
- JavaScript must never receive `WalletUnlockKey`, biometric Cipher objects, raw private signing keys, or a generic routine `signTransactionXdr` API.
- Routine local software signing uses `signWithSystemAuth` or `signWithPasscode`.
- Reveal/export remains explicit and requires a fresh app passcode.

---

### Task 1: Pin adapter compatibility contract

**Files:**
- Create: `src/core/fresnica/compatibility.ts`
- Test: `src/core/fresnica/__tests__/compatibility.test.ts`
- Create: `vendor/fresnica/README.md`

**Interfaces:**
- Produces `FRESNICA_ADAPTER_REQUIREMENTS`.
- Produces `validateAdapterManifest(manifest)` returning a typed success/failure result.

- [ ] Write tests that accept exactly RN 0.87.0 + adapter 0.2.0 + Native SDK 0.2.0 + Native Binding API 2.
- [ ] Write tests rejecting framework/native/binding mismatches with `adapter-rebuild-required`.
- [ ] Implement the immutable descriptor and validator.
- [ ] Document the expected generated binary locations without committing fake binaries.

### Task 2: Define raw native module contract

**Files:**
- Create: `src/core/fresnica/native/NativeFresnicaCoreModule.ts`
- Test: `src/core/fresnica/native/__tests__/NativeFresnicaCoreModule.contract.test.ts`

**Interfaces:**
- Produces `NativeFresnicaCoreModule`, matching the canonical v0.2.0 bridge names and positional arguments.

- [ ] Define the exact bridge operations: account parsing, software-signer lifecycle, external Ed25519 signing, system-auth domain/signer enrollment, system-auth signing and passcode signing.
- [ ] Assert forbidden APIs (`deriveUnlockKey`, `validateUnlockKey`, generic raw `signTransactionXdr`) are not part of the TypeScript contract.

### Task 3: Implement app-facing React Native wrapper

**Files:**
- Create: `src/core/fresnica/native/ReactNativeFresnicaCore.ts`
- Test: `src/core/fresnica/native/__tests__/ReactNativeFresnicaCore.test.ts`
- Modify: `src/core/fresnica/index.ts`

**Interfaces:**
- Implements the existing object-input `FresnicaCore` application port.
- Consumes a `NativeFresnicaCoreModule` dependency so mapping is unit-testable without a native runtime.

- [ ] Write tests proving object inputs map to the canonical positional native calls.
- [ ] Write tests proving system-auth and passcode signing are separate methods.
- [ ] Implement only argument/result mapping; no cryptography or fallback signing.

### Task 4: Wire generated adapter artifacts into native projects

**Files:**
- Generate/update official RN 0.87 Android/iOS project files.
- Generate: `vendor/fresnica/adapter/react-native/fresnica-rn-adapter.aar`.
- Generate: `vendor/fresnica/adapter/react-native/FresnicaRNAdapter.xcframework`.
- Generate: `vendor/fresnica/adapter/react-native/adapter-manifest.json`.
- Vendor/pin Native SDK v0.2.0 Android/Apple release binaries in the native project according to release policy.

**Interfaces:**
- Android host provides React Android, AndroidX biometric/core/annotation and JNA dependencies declared by the adapter contract.
- Apple host links the Native SDK XCFrameworks plus `FresnicaRNAdapter.xcframework` and retains `-ObjC`.

- [ ] Generate the official RN 0.87 app shell rather than hand-authoring a partial native project.
- [ ] Build the canonical adapter once against that exact consumer environment.
- [ ] Validate the generated adapter manifest against Task 1.
- [ ] Run `parseAccount` on Android and iOS.

### Task 5: Native integration verification

**Files:**
- Create: `src/core/fresnica/native/__tests__/parseAccount.smoke.ts` only if a native test harness is used; otherwise keep smoke checks in platform test targets.

**Interfaces:**
- Proves the JavaScript module `FresnicaCore` resolves and both platforms produce equivalent account identity shapes.

- [ ] Verify a valid Testnet-compatible classic `G...` address parses as `classic`.
- [ ] Verify invalid input maps to the stable application error boundary.
- [ ] Verify no native unlock-key material is returned through the RN bridge.
- [ ] Record exact toolchain/build verification results before declaring native integration complete.
