# Actions alignment

## Authority and scope

Owner decision, 2026-11-16: align all Actions differences with the Stellar product reference in successive, independently reviewable slices. Baseline: Fresnica `main@2152ce858b54f9073e525814e1d92b41fedf280b`; behavioral reference: Stellar `stellar-migration@bd0f4540b2496a57314e4e29bc6fcf8ff691b60f`, HomeActions, ActionPanel, general Scan and dApp visit/catalog roles.

Phase 2b shell exists; this extends its presentation under §7.8 Overlay/HomeActions and §14 modal/safe-area roles. It does not claim the unfinished Phase 2c theme kit is complete. Trace: S05 shell, S09 scan, S10 Swap and S14–S17 dApps. Decision: Adopt interaction roles, Adapt to Fresnica Capability contracts. Provenance: behavior-informed clean-room implementation; no donor implementation, tests or artwork are transplanted. Independent implementation review remains required before merge.

## Delivery sequence and exit criteria

| Slice | Required behavior | Status |
| --- | --- | --- |
| A1 panel | Bottom slide presentation, handle/downward dismissal, backdrop/system-back/explicit close, scrollable bounded content, localized labels, quick-action section and existing account availability | Implemented candidate; automated checks passed; independent review/native acceptance pending |
| A2 general scan | Actions opens one shared scan flow; public address/SEP-7 → existing reviewed payment flow; HTTPS → existing dApp confirmation/browser; permission denial, cancel, invalid/sensitive input and network/account changes fail safely | Queued |
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

## Evidence boundaries

Local verification on 2026-11-17: `npm run check -- -- --watchman=false` PASS (287 suites / 2614 tests); SDK verifier, TypeScript, product-flow script syntax, lint (0 errors; 55 existing warnings), aliases, architecture, provenance (0 unapproved donor blobs), artwork and locales (3 dictionaries / 1236 keys) passed. Touched TypeScript Prettier and `git diff --check` passed. Tests cover retained native modal dismissal/reopen, default overlay compatibility, content height/scroll contract, dismissal/canceled gesture/reset, localized options, account replacement/removal and unchanged action availability/routes. These are automated/helper checks, not native layout, camera, device, TalkBack/VoiceOver or product-flow acceptance. Realm/native builds were not rerun for this presentation-only change.

A1 changes only shell/presentation composition and localized copy. No camera permission, Realm/schema, network fetch, dApp grant, signer/authentication, exact-XDR or submit/recovery changes. Later slices must preserve fresh App Passphrase authorization and all network/account/transaction identity checks. M-address support remains deferred under its existing owner decision. Stage 9 iOS real-device System Auth cancellation/retry remains deferred.
