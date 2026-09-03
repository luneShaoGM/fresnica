# Stellar source-parity rewrite

## Purpose

`luneShaoGM/Stellar@stellar-migration` is the product/function reference for the current Fresnica Mobile alignment phase. Screenshots are verification evidence only; source behavior and interaction dependencies define functional parity.

The target architecture remains:

```text
Stellar-referenced product function / interaction
                    |
Fresnica feature adapter / application flow
                    |
Application Capability
                    |
Fresnica Core / SDK / platform runtime
```

Reference repository service/native/security implementations are not copied into Mobile. Existing Fresnica security and capability boundaries remain authoritative.

Two ledgers now define completion:

- `docs/stellar-horizontal-parity-audit.md` — authoritative cross-cutting/function-completeness matrix;
- this document — detailed source → target mappings and adaptations.

Execution/checkpoint order is tracked in `docs/stellar-rewrite-milestones.md`.

## Current phase rule

Fresnica will later maintain its own UI specification. Therefore the current phase prioritizes:

```text
function coverage
+ complete workflows
+ visible states
+ picker/modal/overlay behavior
+ locale/formatting
+ capability/security correctness
```

Final colors, typography, iconography, illustrations, spacing, radius, shadow and polished motion are deferred until the Fresnica UI specification is available.

A route, directory or visible button is not evidence of parity by itself.

## Migration rules

1. Read the reference product function and all shared behavior dependencies before changing the target flow.
2. Preserve the functional entry points, interaction semantics and visible states unless a documented Fresnica boundary requires adaptation.
3. Treat General/Module/Global/Modal/Overlay dependencies as first-class product infrastructure instead of rediscovering them separately from each page.
4. Replace reference navigation/repositories/services/native modules/signing/storage/network mechanisms at explicit Fresnica adapter/capability boundaries.
5. Replace reference branding with Fresnica branding; do not silently remove functions because product/backend dependencies differ.
6. If Fresnica has no normative capability semantics, keep the function explicit and mark it `BLOCKED_BY_CAPABILITY` rather than inventing behavior.
7. All reworked user-visible copy must converge on the app-wide locale boundary introduced by horizontal work.
8. Final visual-component decisions wait for the Fresnica UI specification unless required for usability/accessibility.
9. A function is complete only when source paths, target paths, states/interactions, capability adaptations and known gaps are recorded.

## Horizontal foundation

### Locale/i18n — H1 implemented, local gate pending

| Reference source / behavior | Fresnica target | Status | Adaptation / remaining work |
| --- | --- | --- | --- |
| `src/locale/meta.json` locale inventory | `src/locale/locales.ts` | H1 implemented | Retains 59 canonical locale entries. Source compatibility aliases resolve to canonical codes; alias rows are not duplicated in Settings. |
| `Localize.resolveLocale` exact/base/English fallback | `resolveLocale` | H1 implemented | Pure TypeScript implementation; device locale comes from `Intl`, not React Native `NativeModules`. |
| `src/locale/en.json` + `translations/**` | `src/locale/translations/*.json` + per-key fallback | H1 foundation implemented | Fresnica owns product dictionaries. English, Simplified Chinese and Traditional Chinese are the first migrated dictionaries; retained locales without Fresnica copy fall back to English instead of claiming translation completeness. |
| `Localize.t` | `createLocalization().t` + `LocalizationProvider` | H1 implemented | Controlled React locale state; no global service singleton. |
| pluralized visible copy | `tPlural` | H1 implemented | Uses `Intl.PluralRules`; missing locale-specific plural keys fall back to the English `other` key. |
| device locale initialization in source `src/app.tsx` | `src/app/App.tsx` | H1 implemented | Device locale is resolved before startup copy; saved canonical locale is restored after Realm opens. |
| persisted language setting | `RealmLocalePreferenceStore` + Realm schema v2 | H1 implemented | Dedicated `LocalePreferenceEntity`; Account/Signer schemas are not repurposed and no secret material is stored. |
| Settings language selection | `LanguageSettingsScreen` + `language-settings` ProductRoute | H1 implemented | Full canonical inventory is selectable; each row exposes migrated/fallback state and current selection. |
| runtime language change | controlled provider + App persistence callback | H1 implemented | Switching locale rerenders the current React tree and persists the canonical locale. |
| `Localize.formatNumber` | `LocalizationRuntime.formatNumber` | H1 implemented display boundary | Decimal strings are grouped/formatted without first converting wallet values through IEEE floating point. Input parsing remains a later interaction concern. |
| Moment locale/timezone display role | `LocalizationRuntime.formatDate` using `Intl.DateTimeFormat` | H1 implemented display boundary | Uses runtime/device timezone and selected locale; feature-specific date migration remains part of each domain closure. |
| translation maintenance/check tooling | `scripts/check-locales.mjs` + `npm run locale:check` | H1 implemented | Existing Fresnica dictionaries must match the English key baseline; `npm run check` now includes the locale check. |
| broad localized visible copy | App startup + ProductShell + touched Settings copy | H1 partial product coverage | The boundary exists. Product features not reworked in H1 may still contain English literals and must migrate when their domain is closed. |

H1 implementation commit: `ccfa9eb3bd2f5b8d3021ef513bcf83cae51750c5`.

H1 is `READY_FOR_LOCAL_CHECK`, not complete: GitHub CI/Realm/Android jobs for this head failed before executing any steps, and the assistant environment cannot clone GitHub. A standalone strict TypeScript/behavior check of the locale core passed; owner-side `npm run check` plus Android/Realm migration verification remains the executable gate.

### Modal/overlay/picker infrastructure

Reference source contains first-class:

- `src/screens/Global/Picker`
- `src/screens/Modal/**`
- `src/screens/Overlay/**`
- Module-level account/currency/fee and other pickers

Important roles include CurrencyPicker, DestinationPicker, FilterEvents, ReviewTransaction, Scan, Submit, transaction loading, browser, Authenticate, Alert, AddToken, ConnectionIssue, HomeActions and dApp disclaimer/permission surfaces.

Current target has navigation/runtime primitives and individual screens, but no complete source-role mapping. Status: `PARTIAL` with several `MISSING`/`BEHAVIOR_MISMATCH` rows in the horizontal audit. H2 remains queued until the H1 local checkpoint is resolved.

## Existing presentation baseline

| Reference source | Fresnica target | Status | Adaptation |
| --- | --- | --- | --- |
| `src/theme/colors.ts` | `src/ui/theme/stellar/colors.ts` | baseline only | Temporary/source-derived palette; final Fresnica tokens are deferred. |
| `src/theme/sizes.ts` | `src/ui/theme/stellar/sizes.ts` | baseline only | Reference native inset mechanism is not copied; final sizing tokens are deferred. |
| `src/theme/fonts.ts` | `src/ui/theme/stellar/fonts.ts` | baseline only | Locale-aware family/sizing logic was adapted without React Native `NativeModules`; final type system is deferred. |
| `src/components/General/Spacer` | `src/ui/components/stellar/Spacer` | baseline complete | Structural primitive. |
| `src/components/General/LoadingIndicator` | `src/ui/components/stellar/LoadingIndicator` | primitive complete | Must still be integrated consistently across horizontal loading states. |
| `src/components/General/TouchableDebounce` | `src/ui/components/stellar/TouchableDebounce` | behavior complete | Preserves leading-only debounce without adding lodash. |
| `src/components/General/RaisedButton` | `src/ui/components/stellar/RaisedButton` | partial system role | Loading/disabled/press behavior exists; final component skin is deferred. |

These components do not define the future Fresnica Design System.

## Product shell

| Reference behavior | Fresnica target | Status | Adaptation |
| --- | --- | --- | --- |
| five-position product shell | `src/app/navigation/ProductShell.tsx` | baseline implemented | Fresnica typed navigation replaces the reference navigation framework; H1 routes tab/action/accessibility labels through locale keys. |
| Actions center trigger | ProductShell action trigger | `BEHAVIOR_MISMATCH` at full-flow level | Trigger role exists, but complete HomeActions overlay/recent/scan/catalog behavior is not aligned. |
| unavailable actions | route/action availability | partial | Unsupported actions remain explicit rather than entering fake flows. |

Visible dApp/product naming and legacy `xApps` path cleanup are separate product decisions; no terminology migration is performed implicitly during horizontal function alignment. The H1 English locale intentionally retains the current visible `XApps` label until that decision is confirmed separately.

## Home mapping — reopened

| Reference source / behavior | Fresnica target | Current audit status | Adaptation / remaining gap |
| --- | --- | --- | --- |
| `src/screens/Home/HomeView.tsx` | `src/features/home/HomeScreen.tsx` | `PARTIAL` | Loading/error/inactive/active/read-only states exist; horizontal interaction audit is still open. |
| Home account/network/data reads | `homeViewModel.ts` + ProductRuntime | `PARTIAL` | Public account/balance/signability mapping correctly avoids reference repositories/services. |
| `Modules/AccountSwitchElement` + AccountPicker role | Home account switch action | `BEHAVIOR_MISMATCH` | Current interaction can reduce switching to next-account behavior; source requires an explicit selectable account surface. |
| Network indicator/switch role | `NetworkSwitchButton.tsx` | product-boundary partial | Current Fresnica product is fixed to Testnet; do not invent network switching. |
| `Modules/InactiveAccount` | `InactiveAccount.tsx` | partial | Activation/refresh exists; QR/share is owned by horizontal Request/share work. |
| `Modules/AssetsList` | `AssetsList.tsx` | partial | Balance capability is correct data boundary; asset interaction/category/detail parity is incomplete. |
| Send entry | existing Send flow | connected but not fully parity-audited | Requires shared picker/auth/review/result and locale closure. |
| Swap entry | disabled | `BLOCKED_BY_CAPABILITY` for execution | No local swap semantics may be invented. |
| Request/share entry | disabled | `MISSING` flow | Horizontal QR/share work must close this. |
| Manage Assets | existing trustline flow | connected but partial | Full source search/select/add/remove/review/result behavior remains to audit. |
| account change refresh | request-version guarded balance load | behavior retained | Continue preventing stale prior-account responses. |

Previous `READY_FOR_LOCAL_CHECK` wording is superseded by the horizontal audit. M2 is `REOPENED_BY_HORIZONTAL_AUDIT`.

## Product-domain ledger

| Reference surface | Important functions | Fresnica evidence | Current status |
| --- | --- | --- | --- |
| `src/screens/Setup` + `Onboarding` | start/create/import/backup/verify/complete | `src/features/onboarding` | `PARTIAL` |
| `src/screens/Account` | account list/switch/details/lifecycle | `src/features/accounts` + Account capability | `PARTIAL` |
| `src/screens/Home` | account/assets/actions/inactive states | `src/features/home` | `BEHAVIOR_MISMATCH` / `PARTIAL` |
| `src/screens/Events` | list/search/filter/pagination/details | `src/features/history` + History capability | `PARTIAL` |
| `src/screens/Send` | amount/destination/options/review/auth/submit/result | `src/features/send` + payment/transaction/signing capabilities | `PARTIAL` |
| `src/screens/Request` | public request/QR/copy/share | no complete target domain | `MISSING` |
| `src/screens/Exchange` | selectors/amount/quote/review/execute | no complete equivalent feature root | `BLOCKED_BY_CAPABILITY` for normative execution; inventory still required |
| asset/trustline/AddToken flows | search/select/add/remove/review/result | `src/features/trustlines` + Trustline capability | `PARTIAL` |
| `src/screens/Settings` | general/language/security/network/about/etc. | Settings Home/Network/About + Security + H1 Language route | `PARTIAL`; language foundation implemented |
| Application Security / Authenticate | lock/passphrase/biometric/fresh auth | security feature + Application Security capability | `PARTIAL` |
| Actions/HomeActions | action overlay, scan and product entries | ProductShell center action | `BEHAVIOR_MISMATCH` |
| legacy `src/screens/xApps` with dApp-oriented behavior | catalog/search/recent/browser/disclaimer/permission | `src/features/xapps/screens/XAppsScreen` | `PARTIAL` |
| `src/screens/Global` | global picker/placeholder roles | no equivalent complete shared surface | `MISSING` / `PARTIAL` |
| `src/screens/Modal` | picker/review/submit/scan/browser/etc. | distributed current screens | `PARTIAL` |
| `src/screens/Overlay` | alert/auth/action/warning/permission/etc. | distributed/ad hoc current flows | `PARTIAL` |

## Shared interaction ledger

| Role | Reference source | Target status |
| --- | --- | --- |
| account picker | Module AccountPicker + switcher interaction | `BEHAVIOR_MISMATCH` |
| asset/currency picker | Module/Modal CurrencyPicker | `PARTIAL` |
| destination picker | Modal DestinationPicker | `MISSING` |
| fee picker/list | Module FeePicker/FeeList | pending transaction-policy classification |
| event filters | FilterEvents + EventsFilterChip | `MISSING`/`PARTIAL` |
| Home Actions overlay | Overlay/HomeActions | `BEHAVIOR_MISMATCH` |
| Authenticate | Overlay/Authenticate | `PARTIAL`; use Fresnica Application Security |
| Alert/confirm | Overlay/Alert + reference helpers | `PARTIAL` |
| Review transaction | Modal/ReviewTransaction | `PARTIAL` via Send; must become cross-product invariant |
| Submit/progress/result | Modal/Submit/TransactionLoader + results | `PARTIAL` |
| Scan | Modal/Scan | `MISSING` |
| browser | Modal/InAppBrowser + dApp browser | `PARTIAL` |
| QR/public share | Request/account interactions | `MISSING` |
| search/filter/segment | General/Module controls | `PARTIAL`/`MISSING` depending on domain |
| amount input | General/AmountInput | `PARTIAL`; H1 provides locale-aware display formatting, input semantics remain open |

## Architecture/security invariants

- Navigation infrastructure may differ; user-visible function/transition semantics still require mapping.
- Reference repositories/services are not presentation dependencies in the target.
- Reference native modules are not imported into migrated presentation code.
- Fresnica Native SDK/Core remains authoritative for secrets, recovery material and signing.
- Application Security remains authoritative for biometric/passphrase/lock policy.
- Locale preference persistence is isolated from Account/Signer secret-bearing boundaries.
- Fixed Testnet remains an explicit current product boundary unless separately changed.
- Reviewed transaction identity must equal authorized, signed and submitted transaction identity; no post-auth rebuild.
- QR/share/clipboard flows handle public data only.
- The React Native URL/Horizon compatibility fix at `a6dd7eaaa4745d5a0cde2b3b329d9d54e51b6224` remains the rewrite baseline.

## Functional parity completion rule

Before any product-domain row is marked complete, verify the corresponding rows in `docs/stellar-horizontal-parity-audit.md`.

```text
source function inventoried
AND target route/entry exists
AND full interaction flow exists
AND all visible states exist
AND shared picker/modal/overlay dependencies are integrated
AND locale/formatting is integrated
AND capability/security boundary is documented
AND intentional exclusions are explicit
AND tests/local verification support the result
```

The future Fresnica UI-spec phase may substantially change component implementation and visual appearance without reopening completed product/capability semantics.
