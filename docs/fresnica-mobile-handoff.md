# Fresnica Mobile Project Handoff

> Historical continuation notes. Product shell and rewrite rules live in `docs/stellar-product-information-architecture.md`. Capability evidence lives in `docs/mobile-capability-status.md`. Do not treat the “next milestone is Product Shell” section below as current.

> Purpose: continuation baseline for the independent `fresnica-mobile` React Native application.
>
> Upstream Mobile SDK contract source of truth: `manran/fresnica/docs/platforms/mobile/sdk-usage.md`.
> Framework adapter source of truth: `manran/fresnica/docs/platforms/mobile/framework-adapter.md` and `manran/fresnica/adapters/react-native/README.md`.

## 1. Current baseline

`main` remains the single long-lived baseline. Feature work is intentionally stacked while milestones are reviewed:

```text
main
  -> feat/realm-persistence       # PR #12, open / not merged
       -> feat/onboarding-flow    # onboarding + Application Security milestone
            -> next: product shell / formal UI
```

Do not silently merge or flatten this stack. Retarget later PRs as their parent milestones merge.

```text
React Native              0.87.0
Fresnica Native SDK       0.2.1
Native Binding API        2
Universal SDK API         3
Core Client API           3
RN adapter source         0.2.1
Adapter source revision   47383bd94b1f88882dd0759f7275bd8b5452dcdb
React Native module       FresnicaCore
Realm                     20.2.0
Initial product network   Stellar Testnet
```

These are separate compatibility axes. Do not infer one version from another.

## 2. Architecture vocabulary

```text
Mobile Feature
  -> Application Flow
  -> Application Capability
  -> platform implementation mechanisms
```

`Core` is reserved for Fresnica SDK/Rust Core security authority. Mobile intentionally has no TypeScript `src/core` layer.

```text
src/app
  application composition/config/navigation

src/features
  product screens and Application Flows

src/capabilities
  Account / Signer / Payment / Transaction / Ledger Authorization /
  Signing Coordination / Application Security

src/platform
  fresnica       RN -> Native SDK integration
  stellar        Stellar SDK / Horizon mechanisms
  persistence    Memory + Realm repository implementations
```

## 3. Security ownership

Fresnica SDK/Core owns secret/mnemonic validation and derivation, protected-envelope semantics, signer identity verification, transaction signing, and native System Auth primitives.

Mobile owns UI/navigation, persistence, Horizon/network state, exact-XDR review, Ledger Authorization interpretation, and the product policy deciding when System Auth versus a fresh strong passphrase is required.

Product terminology is **app passphrase**. The first protected-wallet Create/Import flow establishes it; new passphrases require at least 15 Unicode characters. Routine signing is biometrics/System-Auth-first. Reveal/Export, passphrase rotation/recovery and product-classified high-risk actions require fresh passphrase authorization.

Binding API 2 still contains compatibility method/field names such as `signWithPasscode` and `appPasscode`. Keep those names only at the Fresnica platform boundary until upstream changes the binding contract; do not expose passcode/PIN terminology in product/domain UI.

Never persist passphrase, mnemonic, raw secret, WalletUnlockKey, decrypted signer material or biometric authentication state in Realm or ordinary application/global JavaScript state.

See `docs/application-security-policy.md` and `docs/mobile-capability-status.md`.

## 4. Account / Signer / persistence model

Account and Signer remain separate concepts.

```text
AccountRecord
SignerRecord
AccountSignerReference
```

Mandatory invariants:

1. Account != Signer.
2. Watch-only is derived from absence of an applicable local signer.
3. A Classic account may use a signer public key different from its master address.
4. `C...` identities are not Ed25519 software signers.
5. Protected envelope JSON is opaque to Mobile.
6. Shared signer records survive while any Account still references them.

Realm v1 stores only:

```text
AccountEntity
SignerEntity
AccountSignerReferenceEntity
```

It uses stable IDs rather than Realm object links. Reads are mapped to detached plain domain records. Unknown persisted enum values fail closed. Database encryption-key lifecycle and SecureCleanupTask persistence are deferred to later Application Security work.

## 5. Current onboarding product slice

The current Testnet onboarding flow is real application behavior rather than a mock/demo flow:

- Create new mnemonic-backed protected wallet through Fresnica SDK/Core;
- Import mnemonic;
- Import Stellar `S...` secret;
- Add watch-only `G...` or `C...` account;
- atomically persist protected Account + Signer + reference through Realm;
- establish the app passphrase on the first protected signer;
- keep generated mnemonic plaintext only in the explicit one-time backup UI;
- persist generated-mnemonic backup state as `pending` until explicit confirmation;
- after interruption/restart, use fresh-passphrase SDK `reveal` to recover the pending mnemonic instead of persisting plaintext;
- route successfully initialized wallets to the wallet landing screen.

Existing-wallet Add Account now supports **Create new wallet**, **Import recovery phrase**, **Import Stellar `S...` secret**, **Derive from recovery phrase**, and the existing watch-only path. Create remains unchanged: all unique protected targets verify before generation/write, generated mnemonic backup stays `pending`, and default/current changes only after confirmation. Import reuses the same App Passphrase and post-persistence System Auth orchestration. HD accepts only eligible visible current-network mnemonic-backed protected sources with `backupState=confirmed|not-required`, verifies the current App Passphrase across all unique protected targets, then calls canonical `deriveMnemonicSigner` for an explicit SEP-5 index/path without Reveal or envelope parsing. Derived backup state inherits the source; duplicate/watch-only upgrade, System Auth repair and default-before-current selection reuse the existing orchestration. Exact HD code/runtime target `b33baae27c9ff680aaff907566fbeb0ba02772aa` passes 76/414 full checks, Realm 31/31 and disposable Android API 36 native+Realm acceptance; PR #50 final head `44775245...` also passed all four remote gates including Apple simulator runtime. Merged `main@a2b17eba...` subsequently passed one-wallet Android+iOS aggregate acceptance across Create + Import + HD, restart/default recovery and Native System Auth registration/repair, so S01 is now `L3 / L4 partial`. L4 still requires a repeatable required aggregate gate plus trustworthy dynamic-font and screen-reader focus-order acceptance.

S05 Home/Balance is also now aggregate-accepted on merged `main@ab794fa78829a66c403a9c7f00e131d35e350ca3` and is recorded as **`L3 / L4 partial`**. Android production UI covered protected active, funded read-only and inactive accounts, authoritative `XLM 10000.0000000`, Asset Details, focus-return invalidation into `Balances unavailable`, retry recovery and pull-to-refresh. iOS used a fresh signed Debug build on a disposable iPhone 15 Pro simulator and independently covered active/Asset Details, read-only, inactive and a temporary acceptance-only Horizon XHR failure followed by `Try again` recovery to the same authoritative balance. The accepted Friendbot product flow was not repeated; it was used only as fixture infrastructure where needed. All temporary fixtures/fault injection, disposable devices, screenshots and Metro were removed afterward, and the product entry was restored exactly. L4 remains open because S05 aggregate is not a required CI/E2E gate, iOS did not independently repeat the focus-return fault path, and reliable dynamic-font plus TalkBack/VoiceOver focus-order acceptance is still outstanding.

## 6. Application Security / signing state

Implemented Mobile Application Security foundation:

- query System Auth availability;
- query device System Auth Protection Domain state;
- query signer-scoped System Auth enrollment;
- initialize the device domain with real platform biometric/system authentication;
- register/repair every protected software signer after proving its current app passphrase;
- remove a newly initialized empty domain when every signer registration fails;
- disable the device domain;
- surface Native/Core registration failures rather than treating biometric success as passphrase success.

Signing Coordination owns the product authorization branch:

```text
routine
  -> use System Auth when enrolled
  -> otherwise require app passphrase fallback

passphrase-required
  -> skip System Auth entirely
  -> require fresh app passphrase
```

The framework-safe verification-only current-passphrase gap is closed by canonical React Native adapter revision `c5eae08...`, which exposes Native SDK 0.3.1 `verifyProtectedSignerPassphrase`. Existing-wallet Create, Import and HD additional-account consume that primitive through shared Mobile orchestration without a private bridge. PR #50 exact-head Apple runtime and merged-main dual-platform aggregate acceptance are now complete; S01 is `L3 / L4 partial`, with the remaining S01 debt limited to repeatable required aggregate gating and accessibility/dynamic-font closure.

One explicit upstream gap still blocks safe app-session lock: generic existing-domain System Auth challenge for app-session authorization (conceptually `authenticateSystemAuth(reason)`).

Do not emulate the remaining gap with `reveal`, dummy signing/XDR, `reprotect`, or a JavaScript KDF/verifier.

## 7. Transaction architecture

```text
Feature intent
 -> build unsigned transaction
 -> derive review from exact XDR
 -> user confirmation
 -> assert freshness
 -> reload ledger signer/threshold state
 -> Ledger Authorization
 -> Signing Coordination
      -> routine: signWithSystemAuth(...) when enrolled
      -> app-passphrase fallback through binding-level signWithPasscode(...)
      -> passphrase-required: fresh passphrase only
 -> submit exact signed XDR
 -> normalize accepted / rejected / uncertain
 -> refresh/invalidate state
```

Features must not implement their own biometric/passphrase branching. High-risk classification belongs centrally in Application Security / Signing Coordination.

## 8. Native SDK / adapter boundary

Mobile-facing TypeScript uses `FresnicaSdk` under `src/platform/fresnica`. Native runtime module name remains exactly:

```text
NativeModules.FresnicaCore
```

Adapter source 0.2.1 is consumer-toolchain neutral and is built inside the Mobile-owned native toolchain. The pinned revision includes upstream PR #121, which fixes Apple module export through `RCT_EXTERN_REMAP_MODULE`; no local Apple remap shim is allowed.

Normal product builds consume pinned Native SDK/adapter binaries. They do not compile Rust/Core or silently rebuild the adapter.

## 9. Verified evidence

Foundation implemented and exercised:

- Account/Signer relationship semantics;
- Memory and Realm repository implementations;
- Realm schema v1 and strict detached mappers;
- production app composition using Realm + `NativeModules.FresnicaCore`;
- first-run Create/Import/Watch-only onboarding;
- generated mnemonic backup confirmation and restart recovery;
- Add Account watch-only path;
- typed Classic Ledger Authorization;
- exact-XDR Payment review and transaction freshness checking;
- shared Signing Coordination;
- System Auth enable/repair/disable and signer registration;
- Stellar/Horizon gateway mechanisms;
- normalized submission outcomes;
- Fresnica compatibility checks.

Both Android and Apple have been manually verified in actual RN runtime with:

```text
FRESNICA_PARSE_ACCOUNT_SMOKE_OK realm=ok
```

The latest Onboarding + Application Security milestone was manually verified through the agreed product test list, including System Auth enrollment using the app passphrase established during wallet creation/import. Local `typecheck`, normal Jest and Realm integration suites were also reported passing at the milestone validation points. GitHub Actions runner allocation has previously failed before checkout (`runner_id=0`, no executed steps), so do not describe automated CI as green without new evidence.

## 10. Next milestone: Product Shell / formal UI

The current screens deliberately optimized for proving flows, not final product polish. The next milestone should stop adding temporary screen structure and establish the reusable product shell:

1. formal multi-feature navigation;
2. a small reusable UI foundation (tokens and only the controls currently needed);
3. productized Onboarding screens using the existing capabilities unchanged;
4. formal Wallet Home / account presentation;
5. Security Settings moved into normal navigation;
6. Send as the first complete business Feature over Payment / Transaction / Ledger Authorization / Signing / Gateway.

Xaman is an approved UX and information-architecture donor. Reuse useful interaction patterns, hierarchy, empty/loading/error states and navigation ideas; do not import Xaman secret authority, PIN/password model, Account/Signer coupling or signing/biometric implementation. Fresnica capabilities and SDK/Core remain the behavior/security authority.

Persisted wallet truth remains Realm-owned. Navigation/global state must not become another wallet database, and sensitive recovery/passphrase values must not be placed in navigation params or persistent stores.

## 11. Development rules

Before adding wallet/security behavior, check the pinned Fresnica SDK/adapter contract. If upstream already owns the semantic operation, call it rather than reproduce it in Mobile.

When upstream and Mobile disagree, classify the finding explicitly as one of:

- Mobile bug;
- dependency/toolchain limitation;
- Fresnica upstream contract/documentation/implementation inconsistency.

For an upstream inconsistency, record the concrete file/API, reproduction condition and recommended correction. Avoid permanent hidden Mobile compatibility patches.

Xaman may be used as a UX reference only; it is not the implementation authority for Fresnica security semantics.
