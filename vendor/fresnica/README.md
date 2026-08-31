# Fresnica Native Integration Artifacts

This directory is Mobile-owned storage for the pinned Fresnica Native SDK binaries and the one-time generated React Native adapter binaries.

## Pinned integration baseline

```text
React Native              0.87.0
Fresnica Native SDK       0.2.1
Native Binding API        2
Universal SDK API         3
Core Client API           3
RN adapter source         0.2.1
RN adapter source commit  47383bd94b1f88882dd0759f7275bd8b5452dcdb
React Native module       FresnicaCore
```

The Native SDK and adapter are separate products. The Native SDK remains the published `native-sdk-v0.2.1` binary release. Adapter source 0.2.1 is built once inside this application's React Native/native toolchain and the generated binary is then linked by normal app builds.

The pinned adapter revision includes upstream PR #121, which exports the Apple adapter as the shared `FresnicaCore` JavaScript module through `RCT_EXTERN_REMAP_MODULE`. Mobile must not patch the Apple module name locally.

## Fresh-clone bootstrap

A fresh clone does not contain the native SDK or generated adapter binaries. Prepare them before the first native build.

### 1. Download the pinned Native SDK release

Use the exact release:

```text
https://github.com/manran/fresnica/releases/tag/native-sdk-v0.2.1
```

Download:

```text
fresnica-native-sdk-0.2.1.aar
FresnicaSDK-0.2.1-apple.zip
SHA256SUMS
```

The current upstream SHA-256 values are:

```text
fresnica-native-sdk-0.2.1.aar
6a7a05861970608e42a50546abeb19881e5bc47b3b4b6f6e3116a04d6a41529f

FresnicaSDK-0.2.1-apple.zip
dccb756ca034a42df760114031ea2abf7b0e95cabebda6fe536c29f1dcd5a3d2
```

Prefer verifying against the release `SHA256SUMS` file rather than copying these values by hand when bootstrapping a new checkout.

### 2. Stage the Native SDK binaries

Create:

```text
vendor/fresnica/native/
```

Copy the Android AAR to:

```text
vendor/fresnica/native/fresnica-native-sdk-0.2.1.aar
```

Extract `FresnicaSDK-0.2.1-apple.zip`; it contains exactly:

```text
FresnicaSDK.xcframework/
FresnicaSDKFFI.xcframework/
```

Move both into:

```text
vendor/fresnica/native/FresnicaSDK.xcframework/
vendor/fresnica/native/FresnicaSDKFFI.xcframework/
```

Both Apple frameworks are required. `FresnicaSDK.xcframework` depends on the accompanying UniFFI FFI framework.

### 3. Prepare the React Native adapter binaries

Normal application builds consume generated adapter binaries. Expected layout:

```text
vendor/fresnica/adapter/react-native/
  fresnica-rn-adapter.aar
  FresnicaRNAdapter.xcframework/
  adapter-manifest.json
```

The adapter artifacts are generated once from the pinned canonical source revision:

```text
47383bd94b1f88882dd0759f7275bd8b5452dcdb
```

using this Mobile project's own React Native/native toolchain. Follow the upstream canonical build commands in:

```text
manran/fresnica/docs/platforms/mobile/sdk-usage.md
manran/fresnica/docs/platforms/mobile/framework-adapter.md
manran/fresnica/adapters/react-native/README.md
```

After generation, normal app builds link the stored binaries and must not rebuild Rust/Core, UniFFI, or the adapter automatically.

### 4. Apple CocoaPods bootstrap

Once the two Native SDK XCFrameworks and `FresnicaRNAdapter.xcframework` are present, install/update pods using the repository's normal Apple bootstrap path. `FresnicaNative.podspec` links all three frameworks.

If the adapter still needs to be generated in a fresh environment, follow the upstream adapter bootstrap/build procedure first, then run the normal `bundle exec pod install` path afterward.

## File layout

```text
vendor/fresnica/
  README.md
  FresnicaNative.podspec
  native/
    fresnica-native-sdk-0.2.1.aar
    FresnicaSDK.xcframework/
    FresnicaSDKFFI.xcframework/
  adapter/
    react-native/
      fresnica-rn-adapter.aar
      FresnicaRNAdapter.xcframework/
      adapter-manifest.json
```

Do not place Rust/Core source, UniFFI generation output, or canonical adapter source in the normal Mobile build path.

## Android host dependencies

The raw Native SDK AAR requires:

```text
org.jetbrains.kotlin:kotlin-stdlib:1.9.24
net.java.dev.jna:jna:5.12.1@aar
androidx.annotation:annotation:1.8.2
```

The RN adapter additionally requires host-provided:

```text
com.facebook.react:react-android:0.87.0
androidx.biometric:biometric:1.1.0
androidx.core:core:1.12.0
```

The canonical adapter source does not own Mobile's Gradle, AGP, Kotlin plugin, JDK, repositories, or compileSdk. Adapter source 0.2.1 invokes this project's own `android/gradlew` and builds inside the consumer-owned Android environment.

## Apple linkage

Normal iOS builds link all three generated/pinned frameworks:

```text
FresnicaSDK.xcframework
FresnicaSDKFFI.xcframework
FresnicaRNAdapter.xcframework
```

`FresnicaNative.podspec` is the Mobile-owned CocoaPods bridge for these vendored frameworks. Keep `-ObjC` so the React Native Objective-C registration shim is retained.

## Rebuild rule

Rebuild the RN adapter only when a real compatibility boundary changes: React Native compatibility, Native Binding API, canonical adapter source, or a native toolchain change that actually requires rebuilding it. Realm, screens, navigation, and normal application source changes do not rebuild the adapter.

Normal CI should validate `adapter-manifest.json`; it must not silently rebuild the adapter as part of every application build.
