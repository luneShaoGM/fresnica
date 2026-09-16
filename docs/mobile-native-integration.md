# Fresnica Mobile Native Integration

This document is the local consumer guide derived from the upstream Mobile framework-adapter contract, Mobile SDK usage guide, and canonical React Native adapter README.

## Ownership and build model

```text
Fresnica Rust Core
  -> Fresnica SDK
  -> Fresnica Native SDK binary
  -> one-time consumer-built React Native adapter binary
  -> Fresnica Mobile application
```

Fresnica owns cryptography, protected-envelope semantics, signer verification, transaction signing, native authorization primitives, Native SDK releases and canonical adapter source. Mobile owns its React Native/native toolchains, stored adapter binaries, Realm, navigation, screens, network behavior and product orchestration.

Normal Mobile builds link binaries only. They do not compile Rust/Core, run UniFFI or rebuild the React Native adapter.

## Version pins

```text
Native SDK release/tag    native-sdk-v0.3.1
Native SDK package        0.3.1
Native Binding API        3
Universal SDK API         5
Core Client API           5
RN adapter source         0.3.0
Adapter source commit     c5eae08e84b197d534a05f02ae1a230a1e245f28
React Native              0.87.0
JS module                 FresnicaCore
Android minSdk            26
Apple minimum iOS         13.4
```

The adapter revision includes upstream PR #121 (`Align Apple React Native module name`), so Apple natively exports `FresnicaCore` via `RCT_EXTERN_REMAP_MODULE`. Mobile must not patch the bridge module name locally.

Native SDK 0.3.1 retains the SEP-53 high-level React Native bridge operations introduced with 0.3.0: `signMessageWithSystemAuth` and `signMessageWithPasscode`. The bridge signs the exact UTF-8 bytes of the JavaScript string and does not expose `WalletUnlockKey`, raw message-signing primitives, or a generic hash signer. `prepareEd25519Signing` / `applyEd25519Signature` remain the external-signer boundary.

Native SDK 0.3.1 adds the platform-native `FresnicaSignerAuthorization.verifyProtectedSignerPassphrase(...)` helper. It verifies the exact protected envelope + application passphrase + expected signer identity, wipes the derived `WalletUnlockKey` before returning, has no persistent side effects, and does not expose signer secret material. Canonical React Native adapter source package 0.3.0 at revision `c5eae08e84b197d534a05f02ae1a230a1e245f28` now exports that operation as a boolean-only Promise. Mobile consumes only that canonical method through `FresnicaSdkPort`; no private bridge, unlock-key API, mnemonic return or raw secret API is introduced.

The exact 0.3.0 adapter source still requires two checkout-only Android compatibility patches in the RN 0.87 / Gradle 9.4.1 consumer build: Fresnica issues #128 (included-build init evaluation) and #129 (JVM target alignment). These patches change adapter build compatibility only; they do not change the Native/SDK contract and must be removed when upstream ships the canonical fixes.

## Mobile-owned files

```text
vendor/fresnica/
  FresnicaNative.podspec
  native/
    fresnica-native-sdk-0.3.1.aar
    FresnicaSDK.xcframework/
    FresnicaSDKFFI.xcframework/
  adapter/react-native/
    fresnica-rn-adapter.aar
    FresnicaRNAdapter.xcframework/
    adapter-manifest.json
```

Native SDK files come from the published `native-sdk-v0.3.1` release and are verified against its SHA256SUMS. Adapter binaries are generated from the pinned canonical adapter source inside the actual Mobile toolchain.

## Android

Required host dependencies:

```gradle
implementation files("../../vendor/fresnica/native/fresnica-native-sdk-0.3.1.aar")
implementation files("../../vendor/fresnica/adapter/react-native/fresnica-rn-adapter.aar")
implementation "org.jetbrains.kotlin:kotlin-stdlib:1.9.24"
implementation "net.java.dev.jna:jna:5.12.1@aar"
implementation "androidx.annotation:annotation:1.8.2"
implementation "androidx.biometric:biometric:1.1.0"
implementation "androidx.core:core:1.12.0"
```

React Native supplies `com.facebook.react:react-android` at the pinned framework version.

Adapter source 0.3.0 is consumer-toolchain neutral. Its tooling invokes this project's `android/gradlew`, temporarily injects the adapter as a subproject, and uses Mobile's plugin resolution/repositories/compileSdk policy. Do not reintroduce a Fresnica-owned Gradle/AGP/Kotlin override shim.

One-time adapter build:

```sh
node .fresnica-upstream/adapters/react-native/tooling/fresnica-adapter.mjs \
  build react-native \
  --platform android \
  --project "$PWD" \
  --native-android-aar "$PWD/vendor/fresnica/native/fresnica-native-sdk-0.3.1.aar" \
  --out "$PWD/vendor/fresnica/adapter/react-native"
```

CI validates adapter build/manifest and APK compile/link but does not boot an Android emulator. Runtime validation may use a developer-owned emulator to avoid GitHub runner disk pressure.

## Apple

Extract the published Apple package so both exist:

```text
vendor/fresnica/native/FresnicaSDK.xcframework
vendor/fresnica/native/FresnicaSDKFFI.xcframework
```

After React Native pods are bootstrapped, build the adapter once:

```sh
node .fresnica-upstream/adapters/react-native/tooling/fresnica-adapter.mjs \
  build react-native \
  --platform apple \
  --project "$PWD" \
  --native-apple-sdk-xcframework "$PWD/vendor/fresnica/native/FresnicaSDK.xcframework" \
  --native-apple-ffi-xcframework "$PWD/vendor/fresnica/native/FresnicaSDKFFI.xcframework" \
  --out "$PWD/vendor/fresnica/adapter/react-native"
```

CocoaPods integration uses `vendor/fresnica/FresnicaNative.podspec` to link the Native SDK, FFI framework and generated RN adapter. Keep `-ObjC` so Objective-C registration metadata is retained.

Upstream real-consumer validation:

```sh
bash .fresnica-upstream/adapters/react-native/apple/validate-consumer.sh "$PWD"
```

## Runtime smoke

The current smoke verifies both Realm native runtime and Fresnica Native SDK in the same RN process:

```text
React Native
  + Realm 20.2.0 open/write/read/close
  + NativeModules.FresnicaCore
      -> FresnicaRNAdapter
      -> Fresnica Native SDK
      -> Rust Core
      -> parseAccount
```

It validates a successful Classic account parse, stable `invalid-input` behavior and a Realm in-memory round-trip. Success is:

```text
FRESNICA_PARSE_ACCOUNT_SMOKE_OK realm=ok
```

The callback payload must also contain:

```json
{"realm":"ok"}
```

2026-09-16 local validation is anchored to implementation commit `e6f4098bdcfcf1700fc1546120dfce3ff97214bf` plus the smoke-carrier-only follow-up `66b41c67ffe6efdb4b3771efd208e5f425ab5976`. The upstream 0.3.1 manifest verifier accepts the generated RN artifacts as React Native 0.87.0 / Native SDK 0.3.1 / Native Binding API 3 / adapter source 0.3.0. iOS completed a fresh Xcode simulator rebuild before returning `FRESNICA_PARSE_ACCOUNT_SMOKE_OK`; Android completed the standard `npm run smoke:android -- --rebuild` path on a disposable Android 16 / API 36 AVD and returned the same marker. Both callbacks reported Realm `ok`, exact Classic identity, `invalid-input`, external-signing bridge presence and SEP-53 bridge presence.

The S01 verification prerequisite at `32c16852d9d57575234ece9119d20297e243e654` pins adapter revision `c5eae08e84b197d534a05f02ae1a230a1e245f28` with the same Native SDK 0.3.1. Fresh canonical generation yields Android adapter SHA-256 `22b21406d108f23d65e7c2bd67d960c66561b77dbecf53ed5c28fb97bb190268` and Apple adapter SHA-256 `ba13d945aa76e22e135bd603d0c83d5f619cd73d66749db207c58cf8b41692a2`, both accepted by the upstream manifest verifier. These are consumer-built artifact digests from this validation run, not Native SDK release pins; the canonical manifest verifier and pinned source revision are the repeatability authority. The extended runtime smoke additionally requires protected-signer verification: correct passphrase succeeds; wrong passphrase is `invalid-passcode`; expected-signer mismatch is `identity-mismatch`; malformed protected data is `invalid-protected-data`; Realm/envelope state stays unchanged and the verification result contains no sensitive material.

A Metro v0.87 process that has already hot-swapped between the smoke `index.js` and the production `index.js` can retain a stale incremental graph and fail inside `DeltaBundler/Graph.js` before JavaScript executes. This is a Metro carrier failure, not a Fresnica Native result. For cross-platform smoke runs, let each command own a fresh Metro or restart Metro with `--reset-cache` between runs rather than reusing a previously smoke-mutated process.

## Normal CI

Normal CI validates compatibility and native linkability. It must not silently rebuild adapter binaries in ordinary product builds. The dedicated Realm integration workflow runs a real close/reopen repository test on macOS when a runner is allocated.

At the current milestone, recent GitHub Actions jobs have failed before checkout with `runner_id=0` and no steps; those infrastructure failures are not treated as successful automated validation.
