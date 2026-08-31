# Fresnica Mobile

Stellar-native React Native wallet consuming Fresnica Native SDK as its security authority.

## Current development baseline

`main` is the single long-lived baseline. Feature work uses short-lived `feat/*`, `fix/*`, `refactor/*`, or `docs/*` branches; current onboarding work is on `feat/onboarding-flow`.

Current foundation includes:

- React Native 0.87.0 and Stellar Testnet configuration;
- Account and Signer semantics separated from persistence mechanisms;
- watch-only derived from applicable signer relationships rather than persisted as parallel state;
- Fresnica Native SDK 0.2.1 behind the Mobile-facing `FresnicaSdk` platform boundary;
- Native Binding API 2, Universal SDK API 3 and Core Client API 3 tracked independently;
- canonical React Native adapter source 0.2.1 pinned to `47383bd94b1f88882dd0759f7275bd8b5452dcdb`;
- typed Ledger Authorization, exact-XDR review, transaction freshness checking and shared Signing Coordination;
- Stellar/Horizon mechanisms isolated under `src/platform/stellar`;
- Realm 20.2.0 schema/repository implementation under `src/platform/persistence/realm`.

## Architecture

```text
Mobile Feature
  -> Application Flow
  -> Application Capability
  -> platform / Fresnica SDK mechanisms
```

```text
src/app
  composition, configuration, navigation/application bootstrap

src/features
  product features and Application Flows

src/capabilities
  account / signer / payment / transaction / ledger-authorization / signing

src/platform
  fresnica / stellar / persistence
```

The repository intentionally has no Mobile-local `src/core` layer. `Core` refers to Fresnica SDK/Rust Core security authority. `NativeModules.FresnicaCore` is the upstream React Native runtime module name, not a Mobile architecture layer.

## Security boundary

Fresnica SDK/Core owns secret and mnemonic validation/derivation, protected-envelope semantics, signer identity checks, transaction signing and native System Auth helpers. Mobile owns UI/navigation, persistence, Horizon/network state and product orchestration.

Product credential terminology is **app passphrase**, not PIN/passcode. New passphrases follow the current upstream minimum of 15 Unicode characters. Routine signing prefers System Auth; Reveal/Export, passphrase rotation/recovery and product-classified high-risk actions require a fresh strong passphrase. Binding API 2 compatibility names such as `appPasscode` and `signWithPasscode` remain confined to the native adapter boundary until upstream changes that contract.

`WalletUnlockKey`, raw private keys, mnemonic/secret material, passphrases and biometric cipher/authentication state must not enter normal JavaScript persistence, logs or analytics.

See `docs/application-security-policy.md` for the product policy.

## Current SDK compatibility

```text
Fresnica Native SDK       0.2.1
Native Binding API        2
Universal SDK API         3
Core Client API           3
RN adapter source         0.2.1
Adapter source revision   47383bd94b1f88882dd0759f7275bd8b5452dcdb
React Native              0.87.0
React Native module       FresnicaCore
```

The adapter revision includes upstream PR #121, so Apple exports `FresnicaCore` natively; Mobile carries no module-name patch.

## Fresh-clone native bootstrap

The current source repository does not contain the Fresnica Native SDK or generated React Native adapter binaries. A fresh clone must prepare these pinned native artifacts before the first Android or Apple native build.

Native SDK release:

```text
https://github.com/manran/fresnica/releases/tag/native-sdk-v0.2.1
```

Expected Native SDK layout after bootstrap:

```text
vendor/fresnica/native/
  fresnica-native-sdk-0.2.1.aar
  FresnicaSDK.xcframework/
  FresnicaSDKFFI.xcframework/
```

For Apple, download `FresnicaSDK-0.2.1-apple.zip` from the pinned release and extract both XCFrameworks into `vendor/fresnica/native/`. For Android, place `fresnica-native-sdk-0.2.1.aar` in the same directory. Verify release artifacts against the upstream `SHA256SUMS` before use.

Normal React Native builds also require the one-time generated adapter artifacts:

```text
vendor/fresnica/adapter/react-native/
  fresnica-rn-adapter.aar
  FresnicaRNAdapter.xcframework/
  adapter-manifest.json
```

The adapter is built once from the pinned canonical adapter source in this project's own React Native/native toolchain. Normal app builds must not rebuild Rust/Core, UniFFI, or the adapter automatically.

See `vendor/fresnica/README.md` for exact bootstrap/build commands and `docs/mobile-native-integration.md` for integration details.

## Persistence status

Realm v1 persists only Account, Signer and Account-Signer reference records. `watchOnly` remains derived, and protected `envelopeJson` is stored as an opaque value. Raw secrets and authentication credentials are excluded from the schema. Database encryption-key lifecycle is intentionally deferred to the Application Security milestone.

Android and Apple RN runtime smoke have both been manually verified with:

```text
FRESNICA_PARSE_ACCOUNT_SMOKE_OK realm=ok
```

The macOS restart integration test exists, but its latest GitHub Actions runs have not executed because GitHub did not allocate a runner (`runner_id=0`, no steps). Do not treat that infrastructure failure as a passing automated test.

## Sources of truth

Upstream integration guidance:

- `manran/fresnica/docs/platforms/mobile/framework-adapter.md`
- `manran/fresnica/docs/platforms/mobile/sdk-usage.md`
- `manran/fresnica/adapters/react-native/README.md`

Local integration details: `docs/mobile-native-integration.md`.
Local capability status: `docs/mobile-capability-status.md`.
Continuation rules: `docs/fresnica-mobile-handoff.md`.
