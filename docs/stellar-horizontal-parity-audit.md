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
| Locale runtime | `src/locale/index.ts`, `src/locale/en.json`, `src/locale/meta.json`, `src/locale/translations/**` | H1 `src/locale/**` retains 59 canonical locales, source-compatible aliases, per-key English fallback and controlled runtime locale state | `PARTIAL` pending owner local/device gate | Verify runtime on target RN/Hermes, then migrate each product domain's visible copy through the established locale boundary. |
| Device locale bootstrap | `src/app.tsx` reads device locale during configure and persists initial language | `src/app/App.tsx` resolves the device locale before startup copy, then restores/persists the canonical selection through `RealmLocalePreferenceStore` | `PARTIAL` pending owner local/device gate | Verify first-launch resolution, v1→v2 Realm open and persisted restart behavior on device. |
| Runtime language selection | Settings + locale runtime | H1 adds `language-settings`, full canonical locale list, controlled provider update and dedicated persisted preference | `PARTIAL` pending owner local/device gate | Verify immediate rerender and restart persistence. Retained locales without migrated Fresnica dictionaries intentionally use English fallback. |
| Localized number separators | Locale runtime receives device separators / system-separator preference | H1 provides exact decimal-string display formatting using selected-locale separators without first converting wallet values through floating point | `PARTIAL` | Migrate feature amount displays and separately close locale-aware amount-input/edit semantics in Send/Request/Exchange. |
| Date/time locale + timezone | `src/app.tsx` configures timezone; locale layer controls localized date formatting | H1 provides `formatDate` through `Intl.DateTimeFormat` using selected locale/runtime timezone | `PARTIAL` | Route Events/history and other user-visible dates through this boundary as each domain closes. |
| Translation completeness tooling | `scripts/locales.js` and source locale metadata/translation bundles | H1 adds `scripts/check-locales.mjs`, `npm run locale:check`, and includes it in `npm run check` | `PARTIAL` pending executable repo gate | Owner `npm run check` must execute successfully; future migrated dictionaries must keep exact key parity with English. |
| No hardcoded visible copy | Reference screens use locale lookups broadly | App startup, ProductShell and touched Settings copy are migrated; untouched product features still contain hardcoded English | `PARTIAL` | Every reworked product domain must migrate user-visible copy through H1 before its parity row can close. |
| Navigation state | Reference uses global navigator + registered screens | `src/app/navigation/*` has typed ProductRuntime/ProductShell state and H1 adds the Language destination | `PARTIAL` | Keep Fresnica navigation authority, but map all required destination, modal and overlay transitions. |
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
| Accessibility semantics | Critical controls require labels/roles/state | Existing coverage is not complete; H1 Language/ProductShell adds selected/disabled/expanded semantics where touched | `PARTIAL` | Add labels, roles, disabled/selected state and critical test IDs while each horizontal flow is aligned. |
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
| Amount input | `General/AmountInput`, `AmountText` | Feature-local amount entry plus H1 locale-aware exact-string display formatter | `PARTIAL` | Close locale-aware decimal **input/edit** semantics, max/balance behavior and validation; reuse H1 for display. |
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
| App startup/bootstrap | `src/app.tsx`, Setup/Onboarding roots | `src/app/App.tsx`, onboarding bootstrap, H1 device-locale resolution and persisted locale preference | `PARTIAL` | Verify H1 bootstrap locally, then parity-audit startup error/restore/lock/lifecycle behavior. |
| Setup/onboarding | `src/screens/Setup`, `src/screens/Onboarding` | `OnboardingScreen`, mnemonic backup/provisioning state | `PARTIAL` | Inventory every source path and state; preserve Fresnica secret generation/protection. Fix stale mnemonic-verification error regression and route reworked copy through H1. |
| Account lifecycle | `src/screens/Account`, Module account components | `features/accounts`, account capability | `PARTIAL` | Add/list/switch/edit/remove/details/recovery-related flows as applicable; account picker is P0 behavior gap. |
| Home | `src/screens/Home` + account/assets modules | `features/home` | `BEHAVIOR_MISMATCH` | Keep current data adapters, reopen interaction parity: account picker, actions, asset interactions, states and H1 copy/format integration. Final visual restyling deferred. |
| Assets / balances | Home assets + asset modules/overlays | balance capability + Home assets | `PARTIAL` | Align asset categories/details/empty/error states supported by Fresnica contracts and route amounts/copy through H1. Explicitly record unsupported LP/claimable behavior. |
| Trustlines / add asset | AddToken and asset management flows | `features/trustlines`, trustline capability | `PARTIAL` | Align search/select/add/remove/review/result states without bypassing transaction/security boundaries; integrate H1 display/copy. |
| Send/payment | `src/screens/Send`, destination/fee/review/auth/submit flows | Form/Flow/Review/Result screens + payment/transaction/signing capabilities | `PARTIAL` | Compare each step and shared modal/overlay dependency; fill destination picker, auth consistency, locale-aware input/copy and result-state gaps. |
| Request/share | `src/screens/Request`, QR/share interactions | No complete product flow | `MISSING` | Amount/public-address request, QR/copy/share and cancel/result behavior as applicable, using H1 formatting/copy. |
| Exchange/Swap | `src/screens/Exchange` | No equivalent complete feature domain in current feature root | `BLOCKED_BY_CAPABILITY` for normative execution; presentation/function inventory still required | Align selectors, amount/quote/loading/error/review structure first; execute only through normative shared swap/path-payment semantics. |
| Events/history | `src/screens/Events`, filters/details | `ActivityHomeScreen`, `OperationDetailsScreen`, history capability | `PARTIAL` | Compare source list/filter/search/pagination/details states; route dates, amounts and copy through H1. |
| Settings | `src/screens/Settings` | Settings Home/Network/About, Security feature and H1 Language destination/runtime | `PARTIAL` | Verify H1 Language locally, then inventory/close remaining settings IA and migrate remaining visible copy. |
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
- public account/asset identifiers may cross presentation/navigation boundaries; repository/domain objects and secret material should not;
- locale preference persistence remains separate from account/signer secret-bearing persistence semantics.

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

### 9.1 Current H1 checkpoint

H1 implementation is present in commit `ccfa9eb3bd2f5b8d3021ef513bcf83cae51750c5` and is currently `READY_FOR_LOCAL_CHECK`, not `COMPLETE`.

The retained locale inventory, alias resolution, locale runtime, Realm preference, Language route, initial Fresnica dictionaries, ProductShell/Settings/startup integration and locale-key check are implemented. Standalone locale-core type/behavior checks passed, but full repository CI did not execute: inspected GitHub CI/Realm/Android jobs have no executed steps. The assistant environment also cannot clone GitHub because DNS resolution fails.

Therefore **H2 must not start until the owner local/device H1 checkpoint is resolved or explicitly accepted**.

## 10. Exit criteria for M0.5

M0.5 is complete when:

- every reference top-level product surface is represented in this audit or a linked detailed ledger;
- cross-cutting locale, navigation, modal, overlay, picker, scanner/share, formatting and lifecycle roles are explicitly tracked;
- existing Fresnica directories are classified by flow completeness rather than existence;
- no later milestone may declare parity without checking this horizontal audit;
- final Fresnica UI design work is clearly separated from current functional parity work;
- unresolved product/capability decisions are explicit rather than silently chosen during implementation.

M0.5 status after this document: `AUDIT_BASELINE_ESTABLISHED`. Detailed statuses remain live and are updated as functions close.