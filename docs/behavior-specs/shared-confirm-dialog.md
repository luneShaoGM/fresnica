# Shared confirmation dialog — Stellar visual parity (S02 first consumer)

## Product role and provenance

- Shared **Alert / confirmation** presentation role from `docs/stellar-product-information-architecture.md` §7.4; target owner `src/ui/components/ConfirmDialog`.
- Visual/interaction references only: Stellar `Overlay/Alert` (centered status-led alert) and `Overlay/ConfirmDestinationTag` (stacked action treatment). Decision: **Adapt** to Fresnica's existing `AppModal`, `AppTheme`, and presentation-layer actions. Implemented clean-room: no donor code, styles, icons, or resources are imported or migrated.
- First consumer: S02 Settings → Account details → Delete local account; existing Account Capability lifecycle policy is authoritative. This slice must not change deletion, signer garbage collection, account/network selection, or transaction recovery.

## User-visible contract

- Centered modal on a theme-owned dimmed backdrop; rounded surface with subtle border, large warning/critical status symbol, centered emphasized heading, centered main message, and optionally quieter supporting text.
- Short action labels render side by side with Cancel on the left and Confirm on the right. Longer labels stack vertically with Confirm first and Cancel beneath. Both remain full-width, easy to tap, and use semantic theme colors rather than donor palette literals.
- Standard confirmation uses the shared primary action tone. A destructive confirmation uses the shared negative tone for the icon, heading, and confirmation action, while Cancel remains neutral.
- The component receives localized strings; no English product copy is embedded in it. The dialog surface is constrained to 90% of its available viewport height; its child ScrollView shrinks and scrolls rather than overflowing the surface. Error/description text and both actions stay in the same scrollable region, so users can reach each action even with enlarged text, long translations or short landscape viewports. Text remains font-scalable and is not line-clamped.
- Closing via Cancel, backdrop tap, or Android hardware back invokes the same cancel handler while idle; none may execute the confirmation action. During `busy`, both actions and dismiss routes are disabled. `busyLabel` and optional error text are visible; error text is announced as an alert. Failure leaves the dialog open for an explicit retry.
- The caller remains responsible for the business action and its single-flight guard. The shared component must not perform wallet, signer, navigation, or storage operations.

## Acceptance boundaries

- Verify shared component action order, disabled/dismiss behavior, destructive tone, localized long-label layout, and error accessibility by focused automated tests. Layout-structure regression asserts viewport-relative maxHeight, shrinkable ScrollView, full untruncated long error and reachable cancel/retry actions inside it for short and long labels; this does not substitute for a native layout test.
- Verify Account Details delete remains a deliberate two-step interaction and preserves its existing busy and failure paths. Existing S02 Capability/Realm evidence is not reset by UI-only changes.
- Typecheck, architectural checks, formatting, locale, provenance and focused Jest are required. Pixel-level Stellar comparison, VoiceOver/TalkBack, simulator and real-device acceptance remain **not performed** unless separately executed.
