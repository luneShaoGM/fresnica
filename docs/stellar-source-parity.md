# Stellar source-parity rewrite

## Purpose

`luneShaoGM/Stellar@stellar-migration` is the source of truth for the first-pass Fresnica presentation and interaction rewrite. Screenshots are verification evidence only; they are not the specification.

The target architecture remains:

```text
Stellar-derived presentation / interaction
            |
Fresnica screen adapter / application flow
            |
Application Capability
            |
Fresnica SDK / platform / Horizon mechanisms
```

Donor repository/service/native security code is not copied into Mobile. Existing Fresnica security and capability boundaries remain authoritative.

Milestone execution and local acceptance criteria are tracked in `docs/stellar-rewrite-milestones.md`.

## Migration rules

1. Read the donor screen and every directly-used shared component/style before changing the target screen.
2. Preserve donor component structure, layout rules, interaction entry points, and empty/disabled states unless a documented Fresnica boundary requires adaptation.
3. Reuse/port donor General and Module components instead of recreating their appearance inside a screen.
4. Replace `react-native-navigation`, donor repositories/services/native modules, signing, storage, and network access at adapter boundaries.
5. Replace donor branding with Fresnica branding; do not silently remove donor functions because branding/business dependencies differ.
6. If Fresnica has no corresponding capability, keep the entry explicit but disabled/unsupported rather than inventing behavior.
7. A surface is source-parity complete only when donor source paths, target source paths, adaptations, and known gaps are recorded below.

## Foundation

| Donor source | Fresnica target | Status | Adaptation |
| --- | --- | --- | --- |
| `src/theme/colors.ts` | `src/ui/theme/stellar/colors.ts` | M1 ported | Color utility functions are colocated under theme so architecture guard keeps raw colors centralized. |
| `src/theme/sizes.ts` | `src/ui/theme/stellar/sizes.ts` | M1 ported with boundary | Donor `DeviceUtilsModule.layoutInsets` is not copied; Fresnica SafeArea containers own insets. Donor scaling/padding metrics remain source-compatible. |
| `src/theme/fonts.ts` | `src/ui/theme/stellar/fonts.ts` | M1 ported with native-module boundary | Family names, locale selection and sizing are ported. Device locale is read through `Intl` rather than `NativeModules`, keeping `ui/**` presentation-only. Font binary/native-project registration remains a later visual-hardening concern. |
| `src/components/General/Spacer` | `src/ui/components/stellar/Spacer` | M1 ported | Direct structural/style port. |
| `src/components/General/LoadingIndicator` | `src/ui/components/stellar/LoadingIndicator` | M1 ported with theme boundary | Donor `StyleService` is not imported. The current canonical light theme maps donor default contrast to black. |
| `src/components/General/TouchableDebounce` | `src/ui/components/stellar/TouchableDebounce` | M1 ported with dependency simplification | Preserves donor 500 ms leading-only debounce and resettable quiet window without adding lodash only for this helper. |
| `src/components/General/RaisedButton` | `src/ui/components/stellar/RaisedButton` | M1 ported with dependency adapter | Donor sizing, loading, disabled and press behavior are preserved. Donor global image/icon registry remains an explicit image-source adaptation until Icon itself is migrated where needed. |

## Product shell

| Donor source / behavior | Fresnica target | Status | Adaptation |
| --- | --- | --- | --- |
| tab mapping in donor navigator plus tab assets | `src/app/navigation/ProductShell.tsx` | M1 ported | User-visible vocabulary is `Home | Events | Actions | XApps | Settings`. Fresnica typed navigation replaces donor navigation infrastructure. |
| `Actions` trigger / donor `HomeActions` interaction role | `ProductShell` center action trigger | M1 partial by design | Actions opens a surface without becoming the selected tab, so the prior tab remains active. Full recent/featured dApp, scan and catalog behavior is deferred to M9. |
| unavailable donor actions | `ProductShell.actionAvailability` | M1/M2 capability boundary | Unsupported actions remain visibly disabled. M2 additionally makes shell Send unavailable for a watch-only selected account rather than entering a signing flow that cannot complete. |

## M2 Home vertical slice

| Donor source / behavior | Fresnica target | Status | Adaptation / boundary |
| --- | --- | --- | --- |
| `src/screens/Home/HomeView.tsx` | `src/features/home/HomeScreen.tsx` | M2 implemented | Home is rebuilt as a strict presentation feature. Loading, refresh, error, inactive, active, unsupported-contract and read-only states are explicit. |
| donor Home account/network/repository reads | `src/features/home/homeViewModel.ts` + `ProductRuntime` composition | M2 implemented | The view model receives public `AccountRecord`, Balance state and signability; donor repositories/services are not imported. |
| `src/components/Modules/AccountSwitchElement` | `src/features/home/components/AccountSwitchElement.tsx` | M2 adapted | Donor switcher-overlay responsibility is replaced by typed ProductRuntime account-selection intent. Add-account stays a separate existing Fresnica route. |
| `src/components/Modules/NetworkSwitchButton` | `src/features/home/components/NetworkSwitchButton.tsx` | M2 adapted / fixed-network boundary | The donor network indicator vocabulary is preserved. Fresnica currently supports only configured Stellar Testnet, so the switch interaction is visible but intentionally disabled instead of inventing a network switcher. |
| `src/components/Modules/InactiveAccount` | `src/features/home/components/InactiveAccount.tsx` | M2 adapted | Activation explanation and refresh are preserved. Donor Friendbot and QR/share service actions are not copied; Request/share belongs to M6. |
| `src/components/Modules/AssetsList` | `src/features/home/components/AssetsList.tsx` | M2 adapted | Native/credit token rows come from the existing Balance capability. Donor LP/claimable/category repository state is not invented; unsupported liquidity-pool positions are reported explicitly. |
| donor Send entry | Home action + existing `SendFlowScreen` | M2 connected | Enabled only for an active classic account with an attached supported Fresnica signer. Watch-only/contract/inactive accounts remain disabled. |
| donor Swap entry | Home action | M2 visible / disabled | Shared swap/path-payment semantics are deferred to M7; no local quote or execution policy is invented. |
| donor Request/share entry | Home action | M2 visible / disabled | Request/share implementation is owned by M6. Public-address sharing semantics are not silently substituted before that surface is migrated. |
| donor Manage Assets entry | Home `Add asset` + existing `ManageAssetsScreen` | M2 connected | Enabled only for an active signable classic account and routed to the existing Trustline product flow. |
| donor no-account Home state | `App` onboarding bootstrap boundary | M2 mapped at product boundary | ProductRuntime is only entered when the bootstrap has visible accounts. Create/import onboarding remains the authoritative no-account experience and will be source-rewritten in M3 rather than duplicated inside Home. |
| account change refresh | request-version guarded Home balance loader | M2 implemented | Every account change invalidates prior balance requests, preventing a late response from painting the previous account into the newly selected Home. |

The superseded `src/features/portfolio/WalletHomeScreen.tsx` was removed once ProductRuntime switched to `src/features/home/HomeScreen.tsx`, leaving one Home implementation for the rewrite baseline.

## Primary product surfaces after M2

| Donor surface | Important donor dependencies / functions | Fresnica target | Status / adaptation |
| --- | --- | --- | --- |
| `src/screens/Home/HomeView.tsx` | account/network header, account switch/add, actions, assets, inactive state | `src/features/home` | M2 `READY_FOR_LOCAL_CHECK`; detailed mapping above. |
| `src/screens/Events` | event list/search/filter/pagination/detail navigation | `src/features/history` | queued for M5. Keep History capability as data source. |
| `src/screens/Settings` | full settings row hierarchy and destination screens | `src/features/settings` | queued for M8. Preserve entries; unsupported destinations explicit. |
| `src/screens/XApps` | catalog/search/recent/actions/browser entry | `src/features/xapps` | queued for M9. Browser/authorization stays disabled until capability exists. |
| `src/screens/Send` | form/review/confirmation/auth/result flow | `src/features/send` | queued for M4. Signing and System Auth remain Fresnica-controlled. |
| `src/screens/Exchange` | swap input/quote/review flow | future/current shared swap capability adapter | M7 presentation queued; semantics blocked where shared Fresnica swap semantics are unavailable. |
| `src/screens/Onboarding` + account-add surfaces | start/generate/import/recovery/completion paths | `src/features/onboarding` | queued for M3. Secret lifecycle stays inside Fresnica SDK/application flow. |
| donor account management surfaces | switch/add/details/trustline/recovery-related surfaces | current account/settings features | queued for M3/M6. Account model becomes a presentation view model over Fresnica account records. |
| donor overlays/modals | QR/share/selectors/actions/alerts | product-owned overlays | queued by owning milestone. Port structure only where mapped to an existing/explicit capability. |

## Known cross-cutting adaptations

- Donor navigation infrastructure is replaced by Fresnica ProductRuntime/navigation state.
- Donor repositories and services are not presentation dependencies in the target; screens receive capability DTOs, view models and callbacks from Fresnica flows.
- Donor native modules are not imported into migrated presentation code.
- Fresnica Native SDK remains the authority for secrets, recovery material, signing and System Auth.
- Fixed Stellar Testnet is the current network product boundary; M2 does not fake donor network switching.
- The React Native URL/Horizon compatibility fix at `a6dd7eaaa4745d5a0cde2b3b329d9d54e51b6224` is the rewrite baseline and must not be reverted by source ports.
