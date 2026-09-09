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
Native SDK release/tag    native-sdk-v0.3.0
Native SDK package        0.3.0
Native Binding API        3
Universal SDK API         5
Core Client API           5
RN adapter source         0.3.0
Adapter source commit     b1d0427ec5c5398c3bb2e01b886e4e3084e46a73
React Native              0.87.0
JS module                 FresnicaCore
Android minSdk            26
Apple minimum iOS         13.4
```

The adapter revision includes upstream PR #121 (`Align Apple React Native module name`), so Apple natively exports `FresnicaCore` via `RCT_EXTERN_REMAP_MODULE`. Mobile must not patch the bridge module name locally.

Native SDK 0.3.0 adds the SEP-53 high-level React Native bridge operations `signMessageWithSystemAuth` and `signMessageWithPasscode`. The bridge signs the exact UTF-8 bytes of the JavaScript string and does not expose `WalletUnlockKey`, raw message-signing primitives, or a generic hash signer. `prepareEd25519Signing` / `applyEd25519Signature` remain the external-signer boundary.

The exact 0.3.0 adapter source still requires two checkout-only Android compatibility patches in the RN 0.87 / Gradle 9.4.1 consumer build: Fresnica issues #128 (included-build init evaluation) and #129 (JVM target alignment). These patches change adapter build compatibility only; they do not change the Native/SDK contract and must be removed when upstream ships the canonical fixes.

## Mobile-owned files

```text
vendor/fresnica/
  FresnicaNative.podspec
  native/
    fresnica-native-sdk-0.3.0.aar
    FresnicaSDK.xcframework/
    FresnicaSDKFFI.xcframework/
  adapter/react-native/
    fresnica-rn-adapter.aar
    FresnicaRNAdapter.xcframework/
    adapter-manifest.json
```

Native SDK files come from the published `native-sdk-v0.3.0` release and are verified against its SHA256SUMS. Adapter binaries are generated from the pinned canonical adapter source inside the actual Mobile toolchain.

## Android

Required host dependencies:

```gradle
implementation files("../../vendor/fresnica/native/fresnica-native-sdk-0.3.0.aar")
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
  --native-android-aar "$PWD/vendor/fresnica/native/fresnica-native-sdk-0.3.0.aar" \
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

This result has been manually observed on both Android emulator and Apple simulator for the current feature branch.

## Normal CI

Normal CI validates compatibility and native linkability. It must not silently rebuild adapter binaries in ordinary product builds. The dedicated Realm integration workflow runs a real close/reopen repository test on macOS when a runner is allocated.

At the current milestone, recent GitHub Actions jobs have failed before checkout with `runner_id=0` and no steps; those infrastructure failures are not treated as successful automated validation.
