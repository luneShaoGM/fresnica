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
RN adapter source commit  084742d1f023bec3ec22689f819dbe8b5f888269
React Native module       FresnicaCore
```

The Native SDK and adapter are separate products. The Native SDK remains the published `native-sdk-v0.2.1` binary release. Adapter source 0.2.1 is built once inside this application's React Native/native toolchain and the generated binary is then linked by normal app builds.

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
