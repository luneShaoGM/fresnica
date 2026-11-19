# Actions alignment

## Authority and scope

Owner decision, 2026-11-16: align all Actions differences with the Stellar product reference in successive, independently reviewable slices. Baseline: Fresnica `main@2152ce858b54f9073e525814e1d92b41fedf280b`; behavioral reference: Stellar `stellar-migration@bd0f4540b2496a57314e4e29bc6fcf8ff691b60f`, HomeActions, ActionPanel, general Scan and dApp visit/catalog roles.

Phase 2b shell exists; this extends its presentation under §7.8 Overlay/HomeActions and §14 modal/safe-area roles. It does not claim the unfinished Phase 2c theme kit is complete. Trace: S05 shell, S09 scan, S10 Swap and S14–S17 dApps. Decision: Adopt interaction roles, Adapt to Fresnica Capability contracts. Provenance: behavior-informed clean-room implementation; no donor implementation, tests or artwork are transplanted. Independent implementation review remains required before merge.

## Delivery sequence and exit criteria

| Slice | Required behavior | Status |
| --- | --- | --- |
| A1 panel | Bottom slide presentation, handle/downward dismissal, backdrop/system-back/explicit close, scrollable bounded content, localized labels, quick-action section and existing account availability | Merged in PR #205; native product-flow acceptance not claimed |
| A2 general scan | Actions opens one shared scan flow; public address/SEP-7 → existing reviewed payment flow; HTTPS → existing dApp confirmation/browser; permission denial, cancel, invalid/sensitive input and network/account changes fail safely | Implementation candidate in `feat/actions-a2-general-scan-2026-11-18`; independent exact-HEAD review and native acceptance pending |
| A3 Recent | Persist public visit history, deduplicate and show latest four dApps with display identity; share it with the dApps page; record actual opens and support reopen/offline/restart without persisting full query strings or credentials | Queued |
| A4 suggestions | Preserve explicit featured catalog semantics, show cached suggestions immediately, refresh after opening, retain cache on failure, network partitioning and approved icon policy; display metadata never grants trust | Queued |
| A5 shortcuts | Align final fixed-action inventory, Swap preflight and one-asset/direct vs multi-asset selection, unavailable feedback and close-before-navigation behavior; reconcile conditional Activity shortcut with the frozen four-tab shell | Queued |

Each slice starts from then-current merged main. A1 deliberately retains Send/Swap/Request until A5 replaces the inventory as a complete routing change; no empty Recent/suggestion or non-working Scan controls are added. All rows require relevant automated checks and independent exact-HEAD Work review. Native visual, gesture, screen-reader and product-flow acceptance are recorded separately; no L3/L4 promotion follows from unit tests.

## A1 behavior contract

- Actions remains the center overlay trigger, never a fifth selectable tab. No selected account disables the trigger; loss of selection closes an open panel.
- Open as a bottom sheet with a visible drag handle. Fit short content; cap height so long content scrolls on short displays and with enlarged text. Respect bottom/side safe areas.
- Expose a localized header, Quick actions section, and close button/backdrop label. Downward handle drag dismisses after the existing shared deliberate-distance/flick threshold. Short/upward/horizontal gestures do not dismiss; canceled gestures rebound. Content scrolling does not acquire the handle responder.
- Backdrop, system back, accessibility escape and Close dismiss without navigation or any account, signer, transaction or persistence mutation. Reopening resets drag offset.
- Keep the current Send/Swap/Request routes and Capability-derived availability. Refresh an already open panel when account, balance availability, locale or theme changes; never retain the previous account's action callback.
- Existing consumers of the shared modal keep their presentation, size, drag thresholds and labels unless they opt into the new options. The Actions overlay retains its light status-bar override while visible.

## A2 general scan implementation candidate — 2026-11-18

- Baseline `main@faf298025d99bd0e9f8d147c7b70f56de301f44a` (includes merged #205 Actions panel, #207 asset drag and #210 header changes). Branch `feat/actions-a2-general-scan-2026-11-18`.
- Actions keeps the existing Send/Swap/Request shortcuts, adds a localized Scan QR button, closes the panel and routes to the existing Request scanner in general-scan mode. The existing camera/check/request permission, retry, torch, photo QR and payment parsing are reused. Existing Request paste/scan entry remains payment-specific.
- Public Classic addresses and supported SEP-7 payment intents continue through the existing Request-to-Send eligibility check and reviewed Send flow. HTTPS QR inputs go through Fresnica public URL validation, then enter the existing dApps **untrusted URL confirmation**. Scanning never launches a browser, grants wallet connection, mints curated trust, or signs; user must explicitly confirm opening. Non-HTTPS URL, private/IP literal host, URL credentials, sensitive payload and unsupported request formats never acquire dApp privileges.
- General camera and photo inputs share classification: apply the existing Request sensitive-input policy before HTTPS classification, including percent-decoded URL content. Rejected input is not retained in a website proposal, navigation parameters or confirmation.
- Camera and photo attempts capture the route-focus epoch and App-owned account/network selection revision at launch. Blur/refocus, account/network changes, cancel and stale callbacks cannot revive an old attempt. Camera frames are permanently retired by actual app backgrounding, blocked while inactive, and require explicit Retry on return; native permission-dialog inactivity alone does not retire the camera.
- Only an explicitly outstanding system photo pick may survive app suspension. Its screened website result waits for foreground, then rechecks the original route/account/network and ingress attempt before navigation; cancel, blur, unmount or context changes discard it. No new dependency, Realm schema, SDK/Crypto, authorization or transaction pipeline change.
- Follow-ups: A3 shared durable Recent, A4 featured data contract, A5 fixed action inventory and Swap selection. Device-level camera/QR, Android/iOS modal transitions, small-display/large-font and accessibility product acceptance remain separate; Stage 9 iOS System Auth cancellation/retry remains deferred.

## A2 review-fix validation — 2026-11-19

Latest follow-up to NEEDS_FIX at `946163c7561ec1b8b097383d20c606c7baf85bff`: normalize a missing query value to an empty string only for sensitive-input screening. Do not rewrite the public URL or stop checking later fields. Regression tests run camera and photo flows with both Node parsing and the installed React Native 0.87 `URL` plus `URLSearchParams` source implementations, not a hand-written parser mock. They reproduce the old RN-only failure, accept flag-only/mixed/repeated flags and explicit empty values, preserve the exact handoff URL, and still reject a following secret or mnemonic value. Local targeted validation: 3 suites / 36 tests, TypeScript, touched ESLint/Prettier, architecture, provenance and diff checks PASS. Remote CI and independent review must target the new HEAD; no device camera/photo acceptance is implied. The following paragraphs preserve evidence for the previous HEADs.

Follow-up to Work NEEDS_FIX at `c0dd02470a3e52e3578fb520fff8b03ad690d301`: HTTPS classification now applies the existing sensitive-input policy to each URLSearchParams-decoded query value, covering mnemonic words separated by percent-encoded spaces or `+`, including multiple/encoded parameter names. Both camera and photo regressions assert no website handoff and no raw sensitive value in the rejected result. Normal public HTTPS queries keep their existing meaning.

Public scan sessions now use account-selection identity/focus/revision binding without requiring Classic identity. Contract accounts retain camera/photo website preview; payment Continue explicitly rejects non-Classic identities with the existing ineligible feedback. Swap keeps its Classic-only wrapper around the same identity guard. Route-level contract tests exercise the actual Home Actions request-route composition and verify both scan sources can hand off public websites while Send remains blocked. Existing photo foreground-return and stale-session behavior is unchanged.

Current main `809f926d78a9c6b68b66c1816bf7d995f73b7ca9` (#211) is integrated into the same #212 branch. The two current P2 findings are developer-fixed, awaiting independent review of the resulting exact remote HEAD; the prior NEEDS_FIX remains historical evidence and no approval is inferred. Native camera/photo/gesture/accessibility acceptance remains unexecuted.

Current integrated developer validation: `npm run check -- -- --watchman=false` PASS, 297 suites / 2755 tests, lint 0 errors / 59 existing warnings; touched TypeScript formatting and `git diff --check` PASS. These are automated/helper checks, not native acceptance. The earlier 297-suite / 2750-test result belonged to `c0dd02470a3e52e3578fb520fff8b03ad690d301`. Existing background/blur/account-revision, queued-photo cancellation and foreground-return regressions continue to pass. No Android/iOS camera, photo-picker or native product-flow acceptance was executed. New exact-HEAD independent Work review remains required; Stage 9 iOS System Auth cancellation/retry stays deferred.

## Evidence boundaries

### Integration refresh — 2026-11-17

Work approved the isolated code at `dd23c510904d0baf9339c0f0cccf058a592bd092` with P1/P2/P3 all zero, but blocked merge because main had advanced. This approval remains historical and does not approve the new integration HEAD. Main `e2e3497caca5f08d1c8e116ac1189e66176c73f5` is merged into the same PR branch, preserving #203's `swipeHeader` API and shared header/handle responder region, #204's asset pickers and the later #206 market integration. Only the AppModal source and its presentation test required conflict resolution. The handle keeps the configurable localized label, while the existing header remains inside the drag responder and the scroll body stays outside it.

Targeted integration regression: 9 suites / 76 tests PASS, covering AppModal gesture/presentation, OverlayHost, Actions routing, asset details, shared asset selection, Send and Swap picker consumers. The header gesture test now checks both fixed-height and content-sized sheets with a localized handle label. Type/style/architecture/provenance/locale checks and current remote CI are recorded in the updated PR; no native device acceptance is inferred. The resulting exact remote HEAD requires a new independent Work review before the user decides merge.

Original A1 verification at `dd23c510904d0baf9339c0f0cccf058a592bd092` on 2026-11-17: `npm run check -- -- --watchman=false` PASS (287 suites / 2614 tests); SDK verifier, TypeScript, product-flow script syntax, lint (0 errors; 55 existing warnings), aliases, architecture, provenance (0 unapproved donor blobs), artwork and locales (3 dictionaries / 1236 keys) passed. Touched TypeScript Prettier and `git diff --check` passed. Tests cover retained native modal dismissal/reopen, default overlay compatibility, content height/scroll contract, dismissal/canceled gesture/reset, localized options, account replacement/removal and unchanged action availability/routes. These are automated/helper checks, not native layout, camera, device, TalkBack/VoiceOver or product-flow acceptance. Realm/native builds were not rerun for this presentation-only change.

A1 changes only shell/presentation composition and localized copy. No camera permission, Realm/schema, network fetch, dApp grant, signer/authentication, exact-XDR or submit/recovery changes. Later slices must preserve fresh App Passphrase authorization and all network/account/transaction identity checks. M-address support remains deferred under its existing owner decision. Stage 9 iOS real-device System Auth cancellation/retry remains deferred.
