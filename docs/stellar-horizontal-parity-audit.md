# Stellar horizontal source-parity audit

## 1. Purpose

This document is the authoritative horizontal capability audit for the Fresnica Mobile rewrite against `luneShaoGM/Stellar@stellar-migration`.

The rewrite is no longer accepted as complete by checking one screen at a time. A product function is aligned only when its complete user flow, visible states, shared interaction infrastructure and Fresnica capability boundary are accounted for.

Current execution priority is **functional and interaction parity first**. Final visual design parity is intentionally deferred because Fresnica will maintain its own UI specification and design system.

The reference relationship is:

```text
Stellar product function / visible workflow
                  ↓
Fresnica feature presentation + product flow
                  ↓
Application Capability
                  ↓
Fresnica Core / SDK / platform runtime
```

Stellar is a product/function reference. Fresnica remains authoritative for secrets, accounts, persistence, network/runtime access, signing, transaction identity, biometrics and application security.

## 2. Audit rules

### 2.1 Status vocabulary

| Status | Meaning |
| --- | --- |
| `COMPLETE` | Function and required interaction states are mapped to a working Fresnica implementation. |
| `PARTIAL` | Some implementation exists, but the full reference flow or states are not yet aligned. |
| `BEHAVIOR_MISMATCH` | An entry exists but the interaction differs materially from the reference behavior. |
| `MISSING` | No equivalent product/function infrastructure is currently present. |
| `BLOCKED_BY_CAPABILITY` | Presentation can be mapped, but normative Fresnica capability semantics are not yet sufficient for execution. |
| `NOT_APPLICABLE` | Reference-specific behavior is intentionally excluded; the reason must be recorded. |
| `DEFER_UI_SPEC` | Functional semantics can be aligned now; final visual treatment waits for the Fresnica UI specification. |

### 2.2 Parity acceptance

A function is not source-parity complete merely because a route, button or directory exists.

```text
function entry exists
AND complete user flow exists
AND loading / empty / error / disabled / success states are handled
AND required picker / modal / overlay / scanner / share interactions exist
AND app-wide cross-cutting systems are integrated
AND the implementation uses Fresnica capability/security boundaries
AND intentional omissions are documented
```

Final Fresnica colors, typography, icons, illustrations, spacing and motion are not acceptance gates during this horizontal-alignment phase unless they affect usability or the semantics of an interaction.

## 3. P0 cross-cutting foundations

These items apply to multiple product domains. They must be aligned before later milestones can be considered functionally complete.

| Capability | Stellar reference evidence | Fresnica current state | Audit status | Horizontal work required |
| --- | --- | --- | --- | --- |
| Locale runtime | `src/locale/index.ts`, `src/locale/en.json`, `src/locale/meta.json`, `src/locale/translations/**` | No `src/locale` or equivalent app-wide locale subsystem | `MISSING` | Add locale resolution, translation lookup, fallback and runtime language state behind a presentation-safe API. |
| Device locale bootstrap | `src/app.tsx` reads device locale during configure and persists initial language | `src/app/App.tsx` boots services/onboarding directly | `MISSING` | Initialize locale before user-visible app copy is rendered. |
| Runtime language selection | Settings + locale runtime | Settings has only current limited screens | `MISSING` | Add language setting and app-wide refresh/update behavior. Exact supported-language set must not be silently reduced; confirm product scope before pruning source locales. |
| Localized number separators | Locale runtime receives device separators / system-separator preference | No common localized number-format boundary | `MISSING` | Centralize amount/number formatting rather than formatting independently in screens. |
| Date/time locale + timezone | `src/app.tsx` configures timezone; locale layer controls localized date formatting | No equivalent app-level locale/time initialization audited | `MISSING` | Define display-format boundary for event/history timestamps and other user-visible dates. |
| Translation completeness tooling | `scripts/locales.js` and source locale metadata/translation bundles | No locale check in `npm run check` | `MISSING` | Add a deterministic translation-key integrity check once locale files land. |
| No hardcoded visible copy | Reference screens use locale lookups broadly | Current App and feature surfaces contain hardcoded English strings | `PARTIAL` | New/reworked user-visible strings must route through the locale layer as horizontal work proceeds. |
| Navigation state | Reference uses global navigator + registered screens | `src/app/navigation/*` has typed ProductRuntime/ProductShell state | `PARTIAL` | Keep Fresnica navigation authority, but map all required destination, modal and overlay transitions. |
| Global picker pattern | `src/screens/Global/Picker`, Module pickers | No common full picker flow identified | `MISSING` | Establish reusable functional picker contract; final appearance is `DEFER_UI_SPEC`. |
| Modal flow infrastructure | `src/screens/Modal/**` | Product screens currently own limited flows | `PARTIAL` | Cover picker, review, submit, scan, browser and other modal roles without copying reference navigation framework. |
| Overlay flow infrastructure | `src/screens/Overlay/**` | Some current dialogs/screens exist, but no complete source-role mapping | `PARTIAL` | Cover auth, alert, action sheet, warning, permission, connection and product-specific overlays. |
| Global alert / confirmation | Reference helpers + `Overlay/Alert` | Error/copy is handled ad hoc in several target screens | `PARTIAL` | One predictable functional alert/confirm contract; final visuals deferred. |
| Global loading / progress | Shared General components + transaction modal flows | Loading exists in individual surfaces and one shared indicator | `PARTIAL` | Normalize blocking/non-blocking loading semantics and transaction progress states. |
| Connectivity / offline state | App/service + `Overlay/ConnectionIssue` | No complete product-level offline/connection flow audited | `MISSING` | Surface recoverable network state consistently without moving network policy into UI. |
| App lifecycle | `AppService`, app-state handlers in reference app | Fresnica runtime bootstrap exists, but full foreground/background behavior is not parity-audited | `PARTIAL` | Audit lock/re-auth, refresh and stale-request invalidation across lifecycle transitions. |
| Deep links / external intents | `LinkingService` | No complete horizontal deep-link mapping audited | `MISSING` | Inventory supported public link intents; route through explicit product/capability boundaries. |
| In-app / external browser | `Modal/InAppBrowser`, dApp browser flow | dApp/browser surface is incomplete | `PARTIAL` | Establish safe browser/open-link rules; dApp authorization remains explicit. |
| QR generation / public share | Request/account surfaces and shared QR interactions | Request/share currently deferred | `MISSING` | Add public-address QR/share flow; never expose secret material. |
| QR / barcode scanning | `Modal/Scan`, Actions entry | No complete shared scanner flow | `MISSING` | Add permission + scan + parse + cancel/error flow and explicit supported payload types. |
| Clipboard / OS share | Reused by account/request/product flows | No complete horizontal mapping audited | `PARTIAL` | Centralize public-data copy/share interactions and feedback. |
| Permission handling | Scanner/browser/notification-like flows in reference | No complete permission UX audit | `MISSING` | Add product-level permission states around platform mechanisms. |
| Keyboard / input ergonomics | General inputs and reference screen patterns | Current screens implement inputs locally | `PARTIAL` | Align keyboard avoidance, focus, submit, numeric input and validation behavior. |
| Safe area / screen container | Reference theme/device/navigation sizing | Fresnica has `Screen` and RN layout infrastructure | `PARTIAL` | Validate all product flows, sheets and modals on Android/iOS; final layout tokens defer to Fresnica UI spec. |
| Haptic / press feedback | Reference interaction helpers/components | No complete app-wide behavior audit | `MISSING` | Decide functional feedback points during implementation; final motion/haptic polish can follow UI spec. |
| Accessibility semantics | Critical controls require labels/roles/state | Existing coverage is not complete | `PARTIAL` | Add labels, roles, disabled/selected state and critical test IDs while each horizontal flow is aligned. |
| Theme runtime | Reference `src/theme/**`, StyleService and app Appearance handling | Current rewrite has a canonical theme plus source-derived temporary tokens | `PARTIAL` | Preserve a functional theme boundary only; final Fresnica design tokens, dark-mode visuals and component styling are `DEFER_UI_SPEC`. |
| Icon/image registry | Reference uses centralized reusable assets | Current target assets are limited | `PARTIAL` | Do not expand ad-hoc per-screen asset usage. Final Fresnica icon/illustration system is `DEFER_UI_SPEC`. |

## 4. Shared interaction primitives

This matrix tracks **behavioral roles**, not final Fresnica visual components.

| Interaction role | Stellar reference | Fresnica state | Audit status | Requirement for functional parity |
| --- | --- | --- | --- | --- |
| Debounced press | `General/TouchableDebounce` | Shared migrated component | `COMPLETE` | Keep behavior; visuals may later change. |
| Loading indicator | `General/LoadingIndicator` | Shared migrated component | `COMPLETE` for primitive | Use consistently where source flow blocks/waits. |
| Primary/loading button | `General/RaisedButton`, `General/Button` | Basic/shared buttons exist | `PARTIAL` | Normalize disabled/loading/submit semantics; final styling deferred. |
| Text / validation input | General input components | Current `Field` plus feature-local inputs | `PARTIAL` | Centralize validation semantics sufficiently for Send/Request/Exchange/Onboarding. |
| Amount input | `General/AmountInput`, `AmountText` | Feature-local amount entry | `PARTIAL` | Locale-aware decimal input, max/balance behavior and validation. |
| Header/back/close | `General/Header` | Navigation/screen-local controls | `PARTIAL` | Consistent destination/back/dismiss semantics. |
| Search | General/module search usage | Limited/ad hoc | `PARTIAL` | Needed by Events, Assets and dApp/catalog flows where present in reference. |
| Filter / chips | Modules such as `EventsFilterChip` | Not source-aligned | `MISSING` | Preserve filter entry, selected state, clear/apply behavior. |
| Segment control | General reusable control | No source-aligned shared behavior audited | `MISSING` | Implement where reference function depends on segmented state. |
| Checkbox/radio | `General/CheckBox` and related controls | Feature-local/ad hoc | `PARTIAL` | Shared functional selected/disabled/accessibility behavior. |
| Dialog/animated dialog | `General/AnimatedDialog` + overlay roles | Ad hoc | `PARTIAL` | Dismiss/cancel/confirm semantics must be predictable. |
| Swipe/slide confirm | Reference transaction confirmation pattern | `src/ui/SlideToConfirm.tsx` exists | `PARTIAL` | Reuse one confirmation behavior across transaction flows; auth behavior must be consistent. |
| Account picker | `Modules/AccountPicker` + account switcher | Current Home switch action does not reproduce picker behavior | `BEHAVIOR_MISMATCH` | Open selectable account list, preserve selected state, explicit add/manage entry as appropriate. |
| Asset/currency picker | `Modules/CurrencyPicker`, `Modal/CurrencyPicker` | Existing trustline/balance data but no full shared picker parity | `PARTIAL` | Stable public asset identifiers, search/filter if reference requires it, cancel/select states. |
| Destination picker | `Modal/DestinationPicker` | Current Send uses form-local destination entry | `MISSING` | Align destination selection/history/contact-like behavior only where applicable to Stellar product semantics. |
| Fee picker | `Modules/FeePicker`, `FeeList` | No complete source-parity flow audited | `MISSING` or `NOT_APPLICABLE` pending transaction-policy audit | Do not invent fee policy; map only if supported by Fresnica transaction capability. |
| Home Actions overlay | `Overlay/HomeActions` | Current center action is simplified | `BEHAVIOR_MISMATCH` | Restore functional overlay entries/state; unsupported actions explicit. |
| Authenticate overlay | `Overlay/Authenticate` | Fresnica Application Security exists; per-flow UI behavior differs | `PARTIAL` | One auth orchestration contract for send/swap/etc.; preserve biometrics/passphrase policy centrally. |
| Review transaction | `Modal/ReviewTransaction` | Current Send has review screen | `PARTIAL` | Exact transaction reviewed must be the transaction authorized/signed/submitted. |
| Submit/progress/result | `Modal/Submit`, transaction loader/result flows | Current Send has result flow | `PARTIAL` | Normalize pending/success/definite failure/uncertain submission states. |
| Scanner | `Modal/Scan` | No complete shared flow | `MISSING` | Permission, scan, parse, error, cancel and caller result contract. |
| Browser | `Modal/InAppBrowser`, dApp browser | Incomplete dApp surface | `PARTIAL` | Safe URL handling and explicit dApp permissions. |

## 5. Product-domain horizontal matrix

Existing directories are evidence of prior implementation, not proof of parity.

| Product domain | Stellar reference | Fresnica current evidence | Audit status | Next parity target |
| --- | --- | --- | --- | --- |
| App startup/bootstrap | `src/app.tsx`, Setup/Onboarding roots | `src/app/App.tsx`, onboarding bootstrap | `PARTIAL` | Add locale/time initialization and parity-audit startup error/restore/lock behavior. |
| Setup/onboarding | `src/screens/Setup`, `src/screens/Onboarding` | `OnboardingScreen`, mnemonic backup/provisioning state | `PARTIAL` | Inventory every source path and state; preserve Fresnica secret generation/protection. Fix stale mnemonic-verification error regression. |
| Account lifecycle | `src/screens/Account`, Module account components | `features/accounts`, account capability | `PARTIAL` | Add/list/switch/edit/remove/details/recovery-related flows as applicable; account picker is P0 behavior gap. |
| Home | `src/screens/Home` + account/assets modules | `features/home` | `BEHAVIOR_MISMATCH` | Keep current data adapters, reopen interaction parity: account picker, actions, asset interactions and states. Final visual restyling deferred. |
| Assets / balances | Home assets + asset modules/overlays | balance capability + Home assets | `PARTIAL` | Align asset categories/details/empty/error states supported by Fresnica contracts. Explicitly record unsupported LP/claimable behavior. |
| Trustlines / add asset | AddToken and asset management flows | `features/trustlines`, trustline capability | `PARTIAL` | Align search/select/add/remove/review/result states without bypassing transaction/security boundaries. |
| Send/payment | `src/screens/Send`, destination/fee/review/auth/submit flows | Form/Flow/Review/Result screens + payment/transaction/signing capabilities | `PARTIAL` | Compare each step and shared modal/overlay dependency; fill destination picker, auth consistency and result-state gaps. |
| Request/share | `src/screens/Request`, QR/share interactions | No complete product flow | `MISSING` | Amount/public-address request, QR/copy/share and cancel/result behavior as applicable. |
| Exchange/Swap | `src/screens/Exchange` | No equivalent complete feature domain in current feature root | `BLOCKED_BY_CAPABILITY` for normative execution; presentation/function inventory still required | Align selectors, amount/quote/loading/error/review structure first; execute only through normative shared swap/path-payment semantics. |
| Events/history | `src/screens/Events`, filters/details | `ActivityHomeScreen`, `OperationDetailsScreen`, history capability | `PARTIAL` | Compare source list/filter/search/pagination/details states and fill gaps. |
| Settings | `src/screens/Settings` | Settings home, Network, About only | `PARTIAL` | Inventory full settings IA including language, general, security, network, about and applicable product settings. |
| Application Security | auth/security settings + `Overlay/Authenticate` | `features/security`, application-security capability | `PARTIAL` | Align lock/passphrase/biometric/reveal/export user flows; central policy remains Fresnica. |
| Network | source network/settings controls | fixed-Testnet target presentation | `PARTIAL` / product boundary | Record every source network function. Do not invent switching while target product remains fixed-network. |
| Actions | `Overlay/HomeActions` + shared entries | center trigger + simplified actions | `BEHAVIOR_MISMATCH` | Align overlay behavior, entry availability, scan and public product actions. |
| dApp catalog/browser | source `xApps` path now uses dApp-oriented catalog/services plus dApp overlays/browser | current `features/xapps/screens/XAppsScreen` only | `PARTIAL` | Inventory catalog/search/recent/browser/disclaimer/permission/shared-data flows. Product naming/legacy path rename remains a separate confirmed-change decision. |
| Transaction review/auth/submit/result | Shared modal/overlay infrastructure used by mutating flows | Send has one implementation; other flows incomplete | `PARTIAL` | Create one cross-product invariant and interaction contract before Send/Trustline/Swap diverge. |
| QR/scan/share | Modal/Request/Actions/account interactions | incomplete | `MISSING` | Implement once as shared product functionality, then consume from Request/Actions/account flows. |

## 6. Source surface inventory that must not be lost

The reference `src/screens` root includes at least:

- `Account`
- `Events`
- `Exchange`
- `Global`
- `Home`
- `Modal`
- `Onboarding`
- `Overlay`
- `Request`
- `Send`
- `Settings`
- `Setup`
- legacy `xApps` path containing current dApp-oriented behavior

The `Global` surface includes `Picker` and `Placeholder`. The `Modal` surface includes CurrencyPicker, DestinationPicker, FilterEvents, Help, InAppBrowser, ReviewTransaction, Scan, Submit, TransactionLoader and browser-related screens. The `Overlay` surface includes authentication, alert, token, connection, HomeActions and dApp permission/disclaimer roles among others.

These are first-class audit surfaces. They must not be treated as incidental dependencies owned only by whichever page happens to be migrated first.

## 7. What is explicitly deferred to Fresnica UI specification

The following work must not block horizontal functional alignment unless it affects usability/accessibility:

- final brand color palette;
- final typography/family choices;
- final icon and illustration set;
- final spacing/radius/elevation tokens;
- pixel-level page layout parity;
- final light/dark visual treatment;
- final component skin;
- polished motion and micro-animation values.

Temporary/current components may be used to complete product flows, but feature code should avoid baking new hardcoded visual decisions into domain logic. When Fresnica UI specifications arrive, presentation can be re-skinned without replacing product/capability flows.

## 8. Architecture and security invariants during horizontal alignment

These remain non-negotiable:

- presentation does not import concrete Realm/platform/native adapters or Stellar SDK in strict rewritten scopes;
- Application Capabilities remain the product-domain boundary;
- secret/mnemonic generation, validation and protection remain Fresnica SDK/Core responsibility;
- plaintext secrets do not travel through ordinary navigation or persistence;
- reviewed transaction identity equals authorized, signed and submitted transaction identity;
- no transaction rebuild after authorization;
- biometric/passphrase policy remains centralized in Application Security;
- unsupported reference behavior remains explicit instead of receiving invented substitute semantics;
- public account/asset identifiers may cross presentation/navigation boundaries; repository/domain objects and secret material should not.

## 9. Revised execution order

Horizontal work should proceed in dependency order rather than the old page-only milestone order:

```text
H0  audit + ledger
 ↓
H1  locale/i18n + shared formatting + visible-copy boundary
 ↓
H2  modal/overlay/picker/alert/loading/navigation interaction foundation
 ↓
H3  account/onboarding/home interaction closure
 ↓
H4  transaction interaction foundation + Send closure
 ↓
H5  Request + QR/share/scan + Assets/Trustlines
 ↓
H6  Events/history closure
 ↓
H7  Settings/Security/Network closure
 ↓
H8  Exchange/Swap as shared capability semantics permit
 ↓
H9  Actions + dApp catalog/browser/permission closure
 ↓
H10 full functional parity + Android/iOS hardening
 ↓
future Fresnica UI-spec visual/system re-skin
```

This sequence does not authorize new capability semantics. If a step exposes a missing normative capability, mark the affected function `BLOCKED_BY_CAPABILITY`, complete the safe presentation/flow inventory around it, and raise the capability decision separately.

## 10. Exit criteria for M0.5

M0.5 is complete when:

- every reference top-level product surface is represented in this audit or a linked detailed ledger;
- cross-cutting locale, navigation, modal, overlay, picker, scanner/share, formatting and lifecycle roles are explicitly tracked;
- existing Fresnica directories are classified by flow completeness rather than existence;
- no later milestone may declare parity without checking this horizontal audit;
- final Fresnica UI design work is clearly separated from current functional parity work;
- unresolved product/capability decisions are explicit rather than silently chosen during implementation.

M0.5 status after this document: `AUDIT_BASELINE_ESTABLISHED`. Detailed statuses remain live and are updated as functions close.