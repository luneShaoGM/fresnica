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

Fresnica owns cryptography, protected-envelope semantics, signer verification, transaction signing, native Keychain/Keystore authorization, the Native SDK release, and canonical adapter source. Mobile owns React Native/native toolchains, stored adapter binaries, Realm, navigation, screens, network behavior, and product orchestration.

Normal Mobile builds link binaries only. They do not compile Rust/Core, run UniFFI, or rebuild the React Native adapter.

## Version pins

```text
Native SDK release/tag    native-sdk-v0.2.1
Native SDK package        0.2.1
Native Binding API        2
Universal SDK API         3
Core Client API           3
RN adapter source         0.2.1
Adapter source commit     084742d1f023bec3ec22689f819dbe8b5f888269
React Native              0.87.0
JS module                 FresnicaCore
Android minSdk            26
Apple minimum iOS         13.4
```

Pin these axes independently. The adapter source version is not the Native SDK version even when both currently read 0.2.1.

## Mobile-owned files

```text
vendor/fresnica/
  FresnicaNative.podspec
  native/
    fresnica-native-sdk-0.2.1.aar
    FresnicaSDK.xcframework/
    FresnicaSDKFFI.xcframework/
  adapter/react-native/
    fresnica-rn-adapter.aar
    FresnicaRNAdapter.xcframework/
    adapter-manifest.json
```

The Native SDK files come from the published `native-sdk-v0.2.1` release and must be verified against its SHA256SUMS. Adapter binaries are generated from the pinned canonical adapter source inside the actual Mobile toolchain.

## Android

The host declares the Native SDK AAR, generated RN adapter AAR, and required runtime dependencies. The currently required dependency set is:

```gradle
implementation files("../../vendor/fresnica/native/fresnica-native-sdk-0.2.1.aar")
implementation files("../../vendor/fresnica/adapter/react-native/fresnica-rn-adapter.aar")
implementation "org.jetbrains.kotlin:kotlin-stdlib:1.9.24"
implementation "net.java.dev.jna:jna:5.12.1@aar"
implementation "androidx.annotation:annotation:1.8.2"
implementation "androidx.biometric:biometric:1.1.0"
implementation "androidx.core:core:1.12.0"
```

React Native itself supplies `com.facebook.react:react-android` at the pinned framework version.

Adapter source 0.2.1 is consumer-toolchain neutral. Its build tool invokes this project's `android/gradlew`, temporarily injects the adapter as a subproject, and uses Mobile's plugin resolution/repositories/compileSdk policy. Do not reintroduce a Fresnica-owned Gradle/AGP/Kotlin override shim.

One-time build:

```sh
node .fresnica-upstream/adapters/react-native/tooling/fresnica-adapter.mjs \
  build react-native \
  --platform android \
  --project "$PWD" \
  --native-android-aar "$PWD/vendor/fresnica/native/fresnica-native-sdk-0.2.1.aar" \
  --out "$PWD/vendor/fresnica/adapter/react-native"
```

## Apple

Extract the published Apple package so both of these exist:

```text
vendor/fresnica/native/FresnicaSDK.xcframework
vendor/fresnica/native/FresnicaSDKFFI.xcframework
```

After React Native pods are installed, build the adapter once:

```sh
node .fresnica-upstream/adapters/react-native/tooling/fresnica-adapter.mjs \
  build react-native \
  --platform apple \
  --project "$PWD" \
  --native-apple-sdk-xcframework "$PWD/vendor/fresnica/native/FresnicaSDK.xcframework" \
  --native-apple-ffi-xcframework "$PWD/vendor/fresnica/native/FresnicaSDKFFI.xcframework" \
  --out "$PWD/vendor/fresnica/adapter/react-native"
```

Then normal CocoaPods integration uses `vendor/fresnica/FresnicaNative.podspec` to link the Native SDK, FFI framework, and generated RN adapter. `-ObjC` is required.

The upstream real-consumer validator is:

```sh
bash .fresnica-upstream/adapters/react-native/apple/validate-consumer.sh "$PWD"
```

## Runtime smoke

Both platforms must prove:

```text
React Native
  -> NativeModules.FresnicaCore
  -> FresnicaRNAdapter
  -> Fresnica Native SDK
  -> Rust Core
  -> parseAccount result returned to JavaScript
```

The repository smoke entry validates a successful Classic account parse plus the stable `invalid-input` error for invalid input. Success marker:

```text
FRESNICA_PARSE_ACCOUNT_SMOKE_OK
```

Android runtime is allowed to be validated on a developer-owned emulator rather than consuming GitHub runner disk for emulator images. Native CI still verifies adapter build, manifest, and APK compile/link.

## Normal CI

Normal CI validates compatibility and native linkability. It should fail with `adapter rebuild required` when the stored adapter manifest does not match the pinned consumer contract. It must not silently rebuild the adapter in ordinary product builds.
