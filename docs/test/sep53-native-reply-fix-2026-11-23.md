# SEP-53 native reply fixes — 2026-11-23

This development validation record follows the merged-feature acceptance report at main `f644b60ed46c10789138d9649d3fc2104f6584a3`. It records fixes for F-01 and the previously deferred iOS reply-expiry P3. The user requested one consolidated change set for their own final review; no separate Work Review or automatic merge is part of this work.

## Problems and changes

| Finding | Change |
| --- | --- |
| F-01: Android Fabric bypassed the legacy SEP-53 reply hook. Reject left the website waiting; successful replies could enter ordinary current-document message injection. | Fabric `RNCWebViewManager.postMessage` first delegates SEP-53 commands to the existing one-use native reply registry. Missing, malformed or consumed handles remain fail-closed. Ordinary non-SEP-53 messages retain their normal behavior. |
| iOS P3: the native callback expired after 120 seconds, while the review could still consume a passphrase and the website ignored Promise rejection. | Native expiry metadata reaches JS through Fabric Codegen. Expiry closes the review, clears secure input, retires the generation and frees the session slot. Confirmation checks before consuming input; asynchronous work checks again. Wrong-passphrase retry retains the deadline. Native rejection returns a correlated error in the original document. |
| Acceptance helper could expose arbitrary page text on an unrecognized sensitive screen. | The new temporary driver uses fixed output allowlists, sensitive-page step markers, password redaction and structural-only output for unknown pages. It has no raw-tree or screenshot action. Disposable recovery material stays in process memory and is discarded after backup verification. This is a test-tool correction, not a Fresnica product defect. |

The change reuses the existing application session, secure passphrase input, native reply registry and SDK/Core signing. It does not add a signing implementation or change transaction submission/recovery semantics. The contract is [S19](../behavior-specs/s19-dapp-message-signing.md).

## Repository and native validation

| Layer | Actual result | Boundary |
| --- | --- | --- |
| Repository gates | `npm run check`: 306 suites / 2,910 tests passed, including type, lint, architecture, provenance, locale and patch checks. | Automated checks, not native product acceptance. |
| Focused lifecycle tests | Four suites / 77 tests passed, with 19 new cases covering deadline validation, expiry, clock rollback after scheduling, delayed confirmation/completion, retry, busy input and original-document Promise rejection. | Test doubles and controlled clocks. |
| Android build | Debug app and androidTest APK built successfully for arm64-v8a / Fabric. | Emulator candidate. |
| Android native regression control | Pre-fix APK: original 17 passed, all five new Fabric cases failed with `fabric-native-reply-not-received`. Fixed APK: 22 passed / 0 failed / `forbiddenConnections=0`. | Real WebView, AndroidX reply proxy and compiled Fabric manager; explicitly synthetic response data. |
| iOS build | Pinned native SDK verification, `pod install --deployment`, regenerated event serialization and Debug iPhone 15 / iOS 17.2 build passed. | Simulator candidate; not a real device. |
| iOS native runtime | Real WKWebView metadata and both 120-second timeout paths passed. | Runtime/transport helper; wallet review UI and real signing are not exercised by this helper. |

The new Android cases cover cancellation to the original document, synthetic success, one-use/missing/malformed/unknown handles, real new-document retirement and History API retention. The invalid-handle case includes an ordinary-message positive control. The new-document case also checks the native registry read-only, so a detached reply proxy alone cannot produce a false pass. The runner requires all five case names and the final success marker.

The first new-fixture run failed because the test React Context lacked the current React Native `EventDispatcherProvider` interface. That fixture setup was corrected before the red/green comparison above. The failed setup run is preserved and is not counted as evidence of the product defect.

## iOS real timeout evidence

The helper loaded `https://example.com` and kept the same document for the full, unchanged native 120-second lifetime. It used the actual `WKScriptMessageHandlerWithReply` callback and production `freighterInjection`. No native timer was shortened and no PrivacyShield rule was changed.

| Observation | Direct native Promise | Production injection |
| --- | --- | --- |
| Native deadline received relative to JS receipt | 119,995 ms | 120,000 ms |
| Failure delivery relative to native deadline | +220 ms | +187 ms |
| Verified HTTPS origin, main frame and reply handle | Passed | Passed |
| Original document retained | Passed | Passed |
| Result | Promise rejected with the expected expiry error | Matching `messagedId`, `request-unavailable`, `apiError.code = -1`, `apiError.apiCode = -1`, no `signedBlob` |

Run: 2026-11-23 17:30:53–17:32:58 (Asia/Shanghai), implementation commit `a9762e09bcfa947c05eeb6e731df21cd562e5215`. The later fixture/specification commit does not change iOS or production application source.

## Artifact identity and local evidence

- Baseline APK SHA-256: `6ab9f610af28e1a8f12841ae6d35a67ae1d189460959e4fae3dab9fa35636cd0`.
- Fixed Android app APK SHA-256: `034605013e649a8608f6095934b8c66c0c4338b3867191189e6614bf4856ff9d`.
- Android test APK SHA-256: `86e104075f441c3aaf98375cbe25d3f5fbb5e368d0648a0432c289f0d43927b9`.
- iOS actual code carrier `Fresnica.debug.dylib` SHA-256: `0d0002adb03336308cdff8bf1d792b8a35cda0019974a6448e98f37a85d9d646`. The executable loader stub is recorded separately and is not used as the code identity.
- Local evidence directory: `/Users/lune/.codex/.chatgpt-projects/g-p-6ab1f61c087c8191bc1941dfdecacf86/acceptance/2026-11-23-sep53-fix`.

Key records are `npm-check-result.json`, `npm-check.log`, `android-build-result.json`, `android-native-red-green-summary.json`, the before/after native logs, `ios-fix-build-result.json`, `ios-fix-codegen-evidence.json`, `ios-fix-app-artifact.json`, `ios-sep53-runtime.json` and `ios-sep53-runtime-run.json`. Safe helper sources and their hashes are retained with the evidence. No recovery phrase, App Passphrase or raw successful signature is included in this report.

## Android native product-flow acceptance

The installed candidate APK hash matched the fixed APK above. Testing used the normal production entry point and navigation on the isolated Android emulator `emulator-5556`, with an unfunded disposable wallet and Stellar Testnet. No Friendbot funding, payment, or other ledger mutation was performed. Public fixture address: `GDEMYAZ5UNZLTUPJGD5IVBIO4QR2LXJEY4FLUI334DEWUY5CG3VQQI3I`.

The official `https://play.varialwallet.com` Extension playground used its Freighter SDK 7.0.0. Native UI observations checked the review, selected account, network, exact quoted message and passphrase state. Input went through the real secure native field; signatures came from the existing SDK/Core pipeline. The independent verifier used `@stellar/stellar-sdk` 17.0.1 to verify Ed25519 over SHA-256 of the SEP-53 prefix and the exact UTF-8 bytes.

| Checklist scope | Actual observation | Result |
| --- | --- | --- |
| F-01 / D05 cancellation | Native Reject returned the original request ID, `user-declined`, API code -2, no signature; the official website stopped waiting. A later request opened a fresh review. | Passed on this Android candidate. |
| D05 empty passphrase | Correct native review/account/network/message; empty secure input; Sign disabled. | Passed. |
| D05 wrong passphrase and retry | Actual Sign displayed the fixed authorization error, retained the review, cleared input and disabled Sign. The original webpage remained pending without a signature. Fresh correct App Passphrase then completed the same request and verified successfully. | Passed. |
| D04 original Unicode text | Official button requested `  café ✓  `. Native review preserved the exact quoted text. All 13 UTF-8 bytes verified; trimmed bytes failed verification. | Passed. |
| D04 literal Base64-looking text | Official button requested raw `YQ==`. The four literal UTF-8 bytes verified; decoded `a` failed verification. | Passed. |
| D04 explicit Base64 | A protocol fixture sent `blob: "YQ=="` with `blobEncoding: "base64"` through the real browser bridge. Native review showed `"a"`; fresh App Passphrase produced an actual SDK signature. The one-byte decoded message verified; literal `YQ==` failed verification. | Passed. This request used a protocol fixture, not the official website's button. |
| D06 pending same-origin reload | A real `Page.reload` changed the main-document loader while review was pending. Review and secure input disappeared. A passive observer installed before reload saw no response to the old ID in the new document. A new request opened a fresh empty review and cancelled with the correct new ID. | Passed for pending-review reload and new-request recovery only. |

Every successful D04 response contained a 64-byte signature matching the original request ID and the current public account. The helper verified the signature in memory and cleared its copy; raw signatures and App Passphrases were not written into evidence.

D04 success verification times were 18:08:47, 18:10:07 and 18:11:08 on 2026-11-23 (Asia/Shanghai). D06 reload and new-request cancellation completed by 18:13:10. The production source is the verified implementation at `615bbd3ce1120c2b31c618020deb3b5bc86e7d3a`; subsequent report updates change documentation only.

### Android evidence index

- Cancellation and empty input: `android-d05-cancel-status.json`, `android-d05-cancel-native-trace.json`, `android-d05-empty-passphrase-ui.json`.
- Wrong-passphrase execution: `android-d05-wrong-pass-confirmed-ui.json`, `android-d05-wrong-pass-confirmed-web.json`; successful retry uses the Unicode result below.
- D04 successful independent verification: `android-d04-unicode-success-verified.json`, `android-d04-literal-verified.json`, `android-d04-base64-verified.json`. Corresponding request and native review records are stored beside them.
- D06: `android-d06-before-reload-ui.json`, `android-d06-same-origin-reload.json`, `android-d06-after-reload-ui.json`, `android-d06-new-document-old-id-trace.json`, `android-d06-new-document-review.json`, `android-d06-new-document-cancelled.json`, `android-d06-new-document-final-old-id-trace.json`, `android-d06-final-ui.json`.

### Interrupted attempts and helper boundaries

Earlier UI attempts are retained and are not counted as passes. One attempt used Back without confirming a fresh native review and left the app in the launcher. Another reached review but subsequently showed Wallet locked while the driver injected an error string containing multiple R keys. Source inspection identified React Native Debug's two-R reload shortcut and the Modal/Activity focus check as a plausible cause; no runtime trace conclusively attributed that reload. A public error string without R keys subsequently exercised the real wrong-passphrase path successfully. No product lock setting or privacy boundary was changed.

A preliminary `android-d04-unicode-verified.json` was sampled before a signature had returned and records `passed: false`; it is not the final result. After tapping non-action review content to dismiss the keyboard and then confirming, the original request completed. The successful result is explicitly `android-d04-unicode-success-verified.json`. Tap acknowledgements, structural keyboard observations and preparatory UI snapshots alone were never treated as signing evidence.

The final CDP helper requires observing a new matching `SUBMIT_BLOB` before reporting request success. The explicit Base64 request is a synthetic protocol input, while its review, secure input, SDK signing and signature verification are real. This differs from the Android transport fixture's deliberately synthetic response payload.

## Remaining acceptance boundaries

- Android D04 is complete for the three specified byte cases on this emulator candidate.
- D05's duplicate-request, watch-only account, account mismatch and network mismatch product branches remain unexecuted in this repair session.
- D06's full revoke/account/network/background/back matrix, especially changes during SDK signing, remains unexecuted. The pending same-origin reload result does not stand in for that matrix. Late obsolete native handles were separately checked by the native transport regression fixture.
- iOS wallet-review expiry/input clearing, actual wallet signing and legal-request-to-review on a real device remain unexecuted. The real 120-second WK runtime result and automated review tests do not replace those product flows.
- Stage 9 iOS real-device System Auth cancellation/retry remains deferred. Unaffected historical validations were not repeated.
- This report does not promote S19 to full native acceptance or L4 maturity.

## CI and cleanup

At implementation HEAD `615bbd3ce1120c2b31c618020deb3b5bc86e7d3a`, GitHub CI ran `npm ci` and `npm run check` successfully. Android, Apple and Realm workflows completed successfully at their planning/disposition layers; their heavy jobs were explicitly skipped. The native builds and runtime results reported above are local executions and are not attributed to those skipped CI jobs.

The disposable Android wallet app data was cleared successfully. The private helper process, dedicated Metro 8093 and this session's emulator process were stopped; the 9227 CDP forward and 8093 reverse were removed. The pre-existing emulator remained available. The iOS helper server and app were stopped and only this session's simulator was shut down. Cleanup records are `android-fix-cleanup.json` and the iOS cleanup record. `android-product-final-evidence-summary.json` checks the saved D04/D05/D06 evidence and confirms that only the pre-existing Android emulator remains, all three owned Android processes have stopped, and the original repository and isolated iOS worktree are clean. Final helper sources and SHA-256 values are retained under `helpers/`. No unrelated workspace reset, cleanup, merge or independent Work approval was performed.
