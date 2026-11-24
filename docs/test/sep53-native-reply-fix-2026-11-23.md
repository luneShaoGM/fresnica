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

## iOS P3 follow-up — 2026-11-24 / PR #230

The [independent Work review](https://github.com/luneShaoGM/fresnica/pull/230#pullrequestreview-6032299649) examined `16540b7021d57dea7c601e49421f4405eefa7efa` and concluded APPROVED with P1 = 0, P2 = 0 and one P3. The [remaining timing finding](https://github.com/luneShaoGM/fresnica/pull/230#discussion_r4674370962) concerns wall-clock rollback after the native handle is created but before JavaScript receives the request and schedules its timer. The historical approval applies only to that reviewed HEAD; this follow-up is for the owner's consolidated review and is not merged.

Implementation commit: `bcc8cb0933378817f2bc49543afd23c5f506f032`, parent `16540b7021d57dea7c601e49421f4405eefa7efa`.

### Fix and isolation

The existing native 120-second `dispatch_time` timeout now emits a typed expiry event after removing the still-live, one-use reply handle. It uses the original verified HTTPS origin and reply UUID, and does not retain the request body or introduce another clock-domain conversion. Consumed handles emit no expiry event. The original native Promise still rejects through its existing callback.

Fabric Codegen transports the boolean expiry marker. `SecureDappWebView` accepts it only from trusted iOS main-frame metadata with a valid origin and reply UUID; a flag inside page JSON cannot provide that authority. The feature matches the current document origin and handle, then uses the existing generation/session expiry path. Synchronous refs also cover request and expiry delivery before a React commit. Old, mismatched or duplicate events cannot retire a new request. The Unix deadline remains an additional early confirmation/completion guard, and wrong-passphrase retry retains its original deadline. SDK/Core signing and secure-input ownership are unchanged.

### Automated and generated-code verification

| Layer | Actual result | Evidence boundary |
| --- | --- | --- |
| Regression control | The new JS regressions produced 8 expected failures against the old implementation, across 2 suites. | Red evidence, not a post-fix failure. |
| Focused JS verification | 3 suites / 63 tests passed; the change adds 12 Jest cases overall. | Component/transport harnesses and the existing secure-input cleanup test. |
| Complete repository gate | `npm run check` passed: 306 suites / 2,922 tests, including type, lint, formatting, architecture, provenance, locale and native patch gates. | Automated checks, not device acceptance. |
| Fabric Codegen regression | The new assertion failed against the old schema; patched schema/header/serialization passed. | Actual Codegen execution. |
| Fresh package compatibility | The locked WebView 14.0.1 tarball matched its package-lock SHA-512; apply, check, second-apply idempotence and Codegen passed. | Fresh package and already-patched dependency paths both checked. |

The clock regression starts the simulated native lifetime before message delivery, advances 15 seconds in transit, rolls wall time back before JS timer setup and expires at the original 120-second lifecycle. Tests also cover same-batch delivery, obsolete confirmation, SDK resolve/reject after expiry, fresh-request recovery, invalid origins/UUIDs and Android rejection of the iOS expiry marker. The feature harness asserts review removal and generation/session retirement; the unchanged shared secure-input test separately verifies native input clearing and transient-buffer destruction on unmount.

The first complete gate stopped only at formatting of the modified Codegen test, after its Codegen/typecheck stages had passed. That file was formatted with the repository formatter and the complete gate then passed. The first offline package-cache attempt returned `ENOTCACHED`; the successful fresh-package check used the integrity-verified locked tarball. These unsuccessful setup/check attempts remain in the evidence and are not counted as passes.

Evidence directory: `/Users/lune/.codex/.chatgpt-projects/g-p-6ab1f61c087c8191bc1941dfdecacf86/acceptance/2026-11-24-sep53-expiry-p3`. Core records: `baseline.json`, `implementation-source.json`, `js-expiry-p3-tests-result.json`, the red/green JS logs, `npm-check-final-result.json`, `npm-check-final.log`, `ios-expiry-codegen-before.*`, `ios-expiry-patch-codegen.*` and `ios-expiry-fresh-tarball-codegen.*`.

### Simulator build and runtime evidence

The iOS worktree was clean before switching from its prior owned detached commit to `bcc8cb0933378817f2bc49543afd23c5f506f032`. Postinstall, the pinned Apple SDK check and `pod install --deployment` passed; both dependency lock files retained their hashes. The actual generated Fabric header contains the boolean expiry field, its serializer includes the payload property and the native event mapping populates it.

The Debug iPhone 15 / iOS 17.2 Simulator build passed from **09:52:30 to 09:55:54 on 2026-11-24 (Asia/Shanghai)**. Native build evidence is `ios-p3-baseline.json`, `ios-p3-postinstall-result.json`, `ios-p3-sdk-result.json`, `ios-p3-podinstall-result.json`, `ios-p3-codegen-evidence.json` and `ios-p3-build-result.json`. These results establish a compiled Simulator candidate; they do not establish real-device or wallet-product acceptance.

The controlled-clock runtime passed on its first launch, **10:00:30–10:02:35 on 2026-11-24 (Asia/Shanghai)**. It used actual WKWebView, production `SecureDappWebView` and production Freighter injection in one `https://example.com` document. A temporary Metro passthrough wrapper added only the public fixture's document-end request script while forwarding the real WebView props, handlers and ref. This auxiliary test entry point did not exercise the wallet review/signing UI.

The control request used the real JS clock and was consumed early through the production surface with a standard failure response. Only after the active request had received its native handle/deadline did the helper offset its own RN `Date.now()` by **-300,000 ms**. It used **no JS lifetime timer**; the actual native timeout remained 120 seconds. The Mac and Simulator system clocks, native timeout and PrivacyShield were unchanged. Both timeout signals arrived while the helper clock was still behind and the Unix deadline still appeared in the future; the clock was restored before a final settle window.

| Runtime observation | Actual result |
| --- | --- |
| Consumed control | Original webpage settled after 41 ms; RN observed the page result after 3 ms in its own clock domain. No native expiry event over 121,707 ms of observation. |
| Active native expiry | Exactly one trusted notification, matching the original origin/handle, after 120,698 ms from RN request receipt. |
| Active original-document outcome | Promise failure observed after 120,680 ms from the webpage request, with matching request ID/source, `request-unavailable`, API code -1 / apiCode -1, and no `signedBlob`. |
| Ordering and isolation | Active receipt preceded rollback; rollback preceded native expiry. No early timeout, navigation, duplicate outcome, unexpected expiry or watchdog expiry. |
| Final settling | 1,007 ms after clock restoration; no late duplicate or control expiry. Server exited 0. |

Elapsed values above are measured within their own JS realm; no native-uptime/JS-clock or cross-realm clock conversion is used. The native signal and original-document error are actual Simulator runtime evidence. The component tests establish the review/generation/input lifecycle behavior separately; this helper does not establish native wallet UI, signing or real-device acceptance.

- Current iOS `Fresnica.debug.dylib` SHA-256: `e3c1e7f8b4c2f91bb436afcda4c74754fdde3e29b7c5ddacad24696eac3aab71`.
- Loader stub SHA-256: `3e324bc507c58520599f203a9eaf8e7958017aef651ed1a6376046cfb77e7579` (not used as the actual native code identity).
- Temporary helper bundle SHA-256: `05f122e65e25101d468f7c08883a2208b6994cf1c7f8e5641d05c1d4da06d5ee`.
- Runtime records: `ios-p3-runtime.json`, `ios-p3-runtime-run.json` and `ios-p3-runtime-server.log`.

One read-only RDC connection error occurred while reading the running test. The existing process/result was resumed without relaunching the app, restarting the server or rerunning the 120-second scenario.

### Follow-up evidence preservation and cleanup

The six helper source files are retained in `ios-p3-helper-source/`; their hashes and scope are in `ios-p3-helper-provenance.json`. The bundle and app identities are also recorded in `ios-p3-helper-bundle-result.json` and `ios-p3-app-artifact.json`.

Cleanup completed at **10:03:41 on 2026-11-24 (Asia/Shanghai)**. The owned app was terminated and the owned Simulator shut down successfully; the pre-existing Simulator remained booted. The helper server had exited successfully and port 8791 had no listener. The two CocoaPods-generated diffs were restored only after matching the previously saved generated patch exactly. The isolated iOS worktree is clean at the implementation commit; runtime and helper source hashes are unchanged. No unknown changes or original user resources were removed. See `ios-p3-cleanup.json`.

This follow-up preserves the existing Android acceptance boundaries and does not repeat unaffected Android native execution. iOS wallet review/input clearing, actual wallet signing and real-device acceptance remain unexecuted; Stage 9 System Auth cancellation/retry remains deferred. Documentation commit `ad890bcd7c9aded37beb20ce726f23852638749c` records this evidence without changing its tested runtime source. The later main integration is described below. The new PR HEAD is for consolidated user review, with no new independent Work approval or PR merge claimed.

### Main integration during finalization — PR #231

The pre-push check detected that main had advanced from `f644b60ed46c10789138d9649d3fc2104f6584a3` to `d84502472e1f0e4ca81942f52fd54647246bcb9d` through the separate [PR #231 layout change](https://github.com/luneShaoGM/fresnica/pull/231). PR #230 remained open at its old reviewed HEAD. The developer integrated this current main into the repair branch without rewriting remote history or merging PR #230.

The automatic merge preserved both changes without a textual conflict. Only two paths overlapped: `DappBrowserScreen.tsx` gained the main toolbar font-scaling attribute while retaining all expiry/ref/generation handling; `DappSignSheet.tsx` retained the confirmation-before-input guard and busy/expiry/input gating together with main's keyboard avoidance, handled taps, insets and contrast styling. The existing secure-input owner and unmount cleanup are unchanged.

Integrated implementation commit: **`b7103d834cd7bf028c057d74ea7394cb270d104b`**. Its exact tree `3cdbaec9bdee3e3a074d36122ad663ce061e6cac` passed `npm run check` on **2026-11-24 10:08:35–10:09:34 (Asia/Shanghai)**: **308 suites / 2,947 tests passed**. This includes the expiry regressions and the shared modal, secure-input and layout tests. The earlier 306 / 2,922 result remains the actual pre-integration P3 result; the additional suites/tests come from the newly merged main work.

Tracked native Android/iOS source, patch/Codegen scripts, SDK/vendor inputs, dependency manifests, `SecureDappWebView`, `freighterInjection`, `browserTransport` and secure-input implementations are byte-identical to the relevant `bcc8cb0` source. The iOS build and 120-second helper were therefore not repeated. Their actual executed HEAD remains `bcc8cb0933378817f2bc49543afd23c5f506f032`; they are not reported as executions of the integrated commit. In particular, the prior Android observation that an initial tap only dismissed the keyboard is historical: main's handled-tap/inset changes mean that exact product interaction must not be carried forward as acceptance of the new layout. Full wallet UI and real-device acceptance boundaries above remain open.

The first integration identity preflight attempted to read the generated, untracked `ios/Podfile.lock` from Git and stopped before npm started. The corrected check compared tracked native inputs; the actual iOS lock-file hashes remain in the earlier build evidence. No tests or source changes were hidden by that setup correction. Integration evidence is `main-integration-identity-preflight.json`, `main-integration-validation.json`, `npm-check-main-integration.log` and `main-integration-commit.json`. The final evidence update changes documentation only relative to `b7103d8`.
