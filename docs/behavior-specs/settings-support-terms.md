# Settings — Questions & Support and Terms & Conditions

## User-visible contract

- Settings → Questions & Support opens the Fresnica official website `https://fchain.io/` in the system browser. If opening fails, a locally rendered error route is available with a Back action. The wallet does not trust unsolicited social-media support accounts.
- Settings → Terms & Conditions opens an in-app, scrollable, readable service agreement and displays version `20260713` from the approved Stellar reference agreement dated 2026-07-13.
- Reading the agreement never implies acceptance and does not write wallet, profile, or signing state. Closing and reopening does not mutate it.
- Settings has no acceptance-onboarding gate or signed-TOS persistence contract today. Any future accept/confirm flow needs an independently reviewed durable profile contract, version migration behavior and a clear user gesture; this slice does not falsely claim agreement acceptance.

## Source and rights boundary

- Behavior reference: `origin/Stellar/src/screens/Settings/SettingsView.tsx` and `origin/Stellar/src/screens/Settings/TermOfUse/TermOfUseView.tsx`.
- The legal text is sourced from the Stellar reference's `serviceAgreement` legal document, not its program code. The product owner explicitly selected its 2026-07-13 agreement on 2026-11-03. Before merge, the independent reviewer must verify rights to redistribute the legal content: product selection alone is not file-level provenance proof.
- UI, styling, navigation, and tests are independently implemented with Fresnica components, not ported donor implementation code.

## Verification

- Focus tests: Settings home actions, settings navigation, terms read-only presentation and support error.
- Manual acceptance deferred: iOS/Android real-device system-browser handoff, accessible text scrolling and back navigation.
