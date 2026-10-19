# UI-01 — Fresnica Native UI component integration

Status: first app-shell integration candidate (not native product-flow acceptance).
Owner: Fresnica Mobile. This is a Stage 3/F3 presentation change, not a wallet Capability or Stage 7 dApp semantics change.

## Immutable package identity

- Upstream repository: `Pixman022/fresnica-ui-native` (MIT).
- Package version: `@fresnica/ui-native@1.1.0-rc.1`, private internal candidate.
- **Exact package-bearing source SHA:** `7182872be5c1557bc332d270bf3a5e7cec48c409`.
- **Source token lock SHA:** `15d49e0be28a232ae6de2a7285a3a77add8c87d4`.
- **Archive SHA-256:** `54913d4c4466d3cd5744b41d878a3af54344728bda30dc3592ccef2c07fd834f`.
- App-installed tarball: `vendor/ui-native/fresnica-ui-native-1.1.0-rc.1.tgz`, intentionally checked in as a verified internal artifact.
- App dependency: `file:vendor/ui-native/fresnica-ui-native-1.1.0-rc.1.tgz`; `package-lock.json` generated with `npm install --package-lock-only`, never manually edited.

Upstream authority: `docs/delivery-candidate-2026-10-12.md`, `docs/consumer-handoff.md`.
This is **not** an npm publication, an arbitrary Git `main` dependency or a production UI accessibility approval.

## Integration boundary

- Existing Fresnica `AppThemeProvider` remains the wallet App theme authority, including possible future complete image-derived custom themes. Do not create a competing global theme preference.
- App-shell `UiNativeProvider` maps current Fresnica semantic colors to a complete library `AppTheme`; unmapped package dimensions/accent roles retain the pinned library defaults. App locale drives generic close/loading labels; Simplified Chinese uses `zhCN`, Traditional Chinese uses a local `UiLocale` override and other languages currently use `enUS` generic copy. Wallet domain labels remain Fresnica's own `t(...)`.
- Feature code never imports the package directly. Its first consumer is the local `NativeStateView` facade inside the read-only dApps catalog empty/unavailable state. No catalog source, trust assertion, browsing, wallet permission, payment, signer or transaction change.
- UI-02 stays on that same read-only catalog screen. `NativeScreen` supplies the library scroll surface inside the existing app `Screen`, which still owns safe area. `NativeField` is the public catalog search. `NativeButton` is the catalog load retry. Search does not use `secureTextEntry`. Catalog source, trust, browsing, and signing stay unchanged. The production port still returns unavailable, so a debug-only static layout sample renders beneath that message; it is not a catalog provider.
- UI-03a incrementally uses the same pinned `NativeField` on Activity's public loaded-set search and `NativeButton` for Activity retry actions (inactive/offline and retained-cache refresh failure). Fixed header, app-owned safe area, History query/filter/load-more, account/network-scoped cache, Horizon refresh, and navigation remain unchanged; the library `Screen` is deliberately not nested around Activity's existing fixed-header scroller.
- UI-03b extends the local `NativeStateView` facade to forward the package's description and action slots; Home uses it only for Balance load error and unsupported-account read-only states. Its failure Retry uses `NativeButton` with the existing same-account refresh callback. Home's active balances, pull-to-refresh, inactive/Friendbot funding, account selection, send/request/swap and network semantics remain owned by the existing Fresnica flow and are not migrated in this slice.
- UI-04a reuses the pinned `NativeScreen` scrolling/content surface on the Settings home directory, inside Fresnica's own safe-area `Screen`. The existing Fresnica `ListRow` components, account-count/locale presentation, five navigation callbacks and read-only unavailable placeholders remain untouched. Native UI does not manage settings persistence, account/signers, Developer Mode, network changes or security policy.
- UI-04b migrates only the localized back navigation control in Settings / Language to a small quiet `NativeButton` facade. Language list rows, selected announcements/state, scrolling, and the App-owned locale preference callback remain unchanged. The UI package does not gain locale persistence or navigation authority.
- UI-04c adopts the pinned `NativeButton` for the existing Accounts list **Add account** entry only. The app retains the exact `onAddAccount` navigation callback, plus icon and horizontal margins; list cards, hidden records, stable reorder, disabled-sort states and accessibility error announcements remain unchanged. The library's large primary button has a tokenized minimum height (56 in the pinned contract) rather than the previous 64dp custom control; actual touch target and visual fit require later device acceptance. It does not gain Account, Signer, sorting or persistence authority.
- UI-04d replaces only the About screen's Back navigation control with the pinned `NativeButton` quiet/small variant through the app facade. The original `onBack` callback, app-owned Safe Area and ScrollView (including the hidden vertical scrollbar), supplied app/project names, static information rows and compatibility note are unchanged; existing static semantic styles were moved into the Settings screen's co-located `AboutScreen.styles.ts`. Chevron-only Back becomes a labeled button, so device-level header fit and large-type acceptance remain open.
- The App continues to own React Navigation, safe area, system bars, preference persistence, product error state, localization and security.

## Validation / deferred

- Required: exact-package archive checksum, generated lock, `npm ci`, `npm run check`, Android/Apple affected gates, plus focused theme-mapper tests.
- Native product-flow acceptance **not proven by CI**. First real Android/iOS inspection must check catalog empty/unavailable display, language switch (en/zh/zh-TW), long strings/font scaling, theme/status bar coherence, Back/navigation and screen reader.
- Upstream published limitations are retained: brand green/on-primary contrast needs design approval, reduced-motion and device TalkBack/VoiceOver depth are not certified. Do not relabel these as resolved.
- Follow-up UI slices may replace additional low-risk primitives; security-sensitive Fields require explicit `secureTextEntry`, `autoComplete` and related native input-prop verification first.
- S09 Photo QR and iOS/Android aggregate acceptance remain separate; local ignored native files and their verified backup were not touched by this PR.
