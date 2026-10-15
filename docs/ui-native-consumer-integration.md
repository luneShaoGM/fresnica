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
- The App continues to own React Navigation, safe area, system bars, preference persistence, product error state, localization and security.

## Validation / deferred

- Required: exact-package archive checksum, generated lock, `npm ci`, `npm run check`, Android/Apple affected gates, plus focused theme-mapper tests.
- Native product-flow acceptance **not proven by CI**. First real Android/iOS inspection must check catalog empty/unavailable display, language switch (en/zh/zh-TW), long strings/font scaling, theme/status bar coherence, Back/navigation and screen reader.
- Upstream published limitations are retained: brand green/on-primary contrast needs design approval, reduced-motion and device TalkBack/VoiceOver depth are not certified. Do not relabel these as resolved.
- Follow-up UI slices may replace additional low-risk primitives; security-sensitive Fields require explicit `secureTextEntry`, `autoComplete` and related native input-prop verification first.
- S09 Photo QR and iOS/Android aggregate acceptance remain separate; local ignored native files and their verified backup were not touched by this PR.
