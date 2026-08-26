# Fresnica Native Artifacts

This directory is reserved for binaries generated or pinned from the canonical `manran/fresnica` release/adapter toolchain.

First integration pins:

- React Native: `0.87.0`
- Fresnica Native SDK: `0.2.0`
- React Native adapter source: `0.2.0`
- Native Binding API: `2`
- React Native module: `FresnicaCore`

Expected generated adapter outputs:

```text
vendor/fresnica/adapter/react-native/
  fresnica-rn-adapter.aar
  FresnicaRNAdapter.xcframework/
  adapter-manifest.json
```

The binaries must be produced by the canonical `manran/fresnica` adapter tooling in the real RN 0.87 consumer environment. Do not commit fake placeholder AAR/XCFramework files and do not rebuild Rust/UniFFI as part of normal app builds.

Android hosts must provide the adapter/native SDK dependencies declared by the canonical adapter contract, including AndroidX biometric/core/annotation and JNA. Apple hosts must link the Fresnica Native SDK XCFrameworks and generated React Native adapter XCFramework with `-ObjC` retained.
