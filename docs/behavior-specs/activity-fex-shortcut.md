# Activity / FEX shortcut (2026-11-26)

Owner decision: adapt the audited Stellar behavior at bd0f4540b2496a57314e4e29bc6fcf8ff691b60f, superseding the A5 exclusion. Phase 2b shell is complete; trace S05/S13/S15/S23. Clean-room Adapt; existing strict navigation, settings and preferences boundaries apply. No maturity promotion.

- The second bottom slot defaults to fex in Simplified and Traditional Chinese; General settings exposes a persistent switch only in those locales. Off restores Activity. Other application languages always show Activity, without erasing the Chinese preference.
- Keep the four existing destination route IDs and Actions overlay. The fex slot is an action, not a new tab or a selected Activity tab. Route the fixed public HTTPS URL https://fex.fresnica.com through the existing untrusted website confirmation in dApps. Unlike the reference modal, the existing Fresnica confirmation/system browser flow is authoritative; no embedded-browser or catalog-trust bypass, automatic grant, wallet identity disclosure or signing.
- When the shortcut is visible, add Activity to Quick Actions alongside Swap and Scan. It navigates to the existing Activity stack without depending on signer eligibility. Retired overlays, changed account/mode and background presses cannot navigate.
- In a network with no selectable account, keep Activity in the bottom bar because Actions is disabled. Do not change the stored preference. Restore the shortcut when a selectable account exists.
- Preserve Activity history/cache/partition and dApp permission semantics; no new SDK, schema, dependency or donor resources.
- Acceptance: verify locale matrix, preference reload and failed-save behavior, switch visibility, shortcut routing and ordinary Activity, conditional read-only Activity access, retired/background callbacks and empty-network fallback. Native visual/gesture, browser and restart acceptance remain separately pending.
