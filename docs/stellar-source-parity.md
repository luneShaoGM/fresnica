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
4. Replace `react-native-navigation`, Xaman repositories/services/native modules, signing, storage, and network access at adapter boundaries.
5. Replace Xaman branding with Fresnica branding; do not silently remove donor functions because branding/business dependencies differ.
6. If Fresnica has no corresponding capability, keep the entry explicit but disabled/unsupported rather than inventing behavior.
7. A surface is source-parity complete only when donor source paths, target source paths, adaptations, and known gaps are recorded below.

## Foundation

| Donor source | Fresnica target | Status | Adaptation |
| --- | --- | --- | --- |
| `src/theme/colors.ts` | `src/ui/theme/stellar/colors.ts` | ported | Color utility functions are colocated under theme so architecture guard keeps raw colors centralized. |
| `src/theme/sizes.ts` | `src/ui/theme/stellar/sizes.ts` | ported with boundary | Xaman `DeviceUtilsModule.layoutInsets` is not copied; Fresnica SafeArea containers own insets. Donor scaling/padding metrics remain source-compatible. |
| `src/theme/fonts.ts` | `src/ui/theme/stellar/fonts.ts` | ported with resource gap | Family names, locale selection and sizing are ported. Device locale is read through Intl rather than NativeModules so `ui/` stays presentation-only. Font binary/native-project registration is still pending review. |
| `src/components/General/Spacer` | `src/ui/components/stellar/Spacer` | ported | Direct structural/style port. |
| `src/components/General/LoadingIndicator` | `src/ui/components/stellar/LoadingIndicator` | ported with theme boundary | Donor `StyleService` is not imported. The current single canonical light theme maps donor default contrast to black; light/dark explicit variants remain white/black. |
| `src/components/General/TouchableDebounce` | `src/ui/components/stellar/TouchableDebounce` | ported with dependency simplification | Preserves donor 500ms leading-only press behavior without adding lodash only for this presentation helper. |
| `src/components/General/RaisedButton` | `src/ui/components/stellar/RaisedButton` | ported with dependency adapter | Donor sizing, shadow/press animation, 500ms leading debounce, loading and disabled behavior are preserved. Loading now reuses the shared ported indicator. Donor `Images`/`Icon` registry key is temporarily an explicit image source until Icon itself is ported. |

## Product shell

| Donor source / behavior | Fresnica target | Status | Adaptation |
| --- | --- | --- | --- |
| tab mapping in `src/common/helpers/navigator.ts` and donor tab assets | `src/app/navigation/ProductShell.tsx` | M1 ported with navigation boundary | User-visible vocabulary is `Home | Events | Actions | XApps | Settings`. Fresnica typed navigation replaces `react-native-navigation`. |
| `Actions` tab trigger / `src/screens/Overlay/HomeActions` interaction role | `ProductShell` center action trigger | M1 partial by design | Actions opens a surface without becoming the selected tab, so the prior tab remains active. Full donor HomeActions recent/featured dApp, scan and catalog behavior is deferred to M9 rather than importing donor services. |
| unavailable donor actions | `ProductShell.actionAvailability` | ported with capability boundary | Unsupported actions remain visibly disabled and cannot execute substitute semantics. |

## Primary product surfaces

| Donor surface | Important donor dependencies / functions | Fresnica target | Status / adaptation |
| --- | --- | --- | --- |
| `src/screens/Home/HomeView.tsx` | `NetworkSwitchButton`, `AccountSwitchElement`, `RaisedButton`, `AssetsList`, `InactiveAccount`; account switch/add, Send, Swap, Request, Manage Assets, network warning | `src/features/home` | queued for M2. Build from donor-derived Modules; replace account/network repositories with existing props/capabilities. |
| `src/screens/Events` | event list/search/filter/pagination/detail navigation | `src/features/history` | queued for M5. Keep History capability as data source. |
| `src/screens/Settings` | full settings row hierarchy and destination screens | `src/features/settings` | queued for M8. Preserve entries; unsupported destinations explicit. |
| `src/screens/XApps` | catalog/search/recent/actions/browser entry | `src/features/xapps` | queued for M9. Browser/authorization stays disabled until capability exists. |
| `src/screens/Send` | form/review/confirmation/auth/result flow | `src/features/send` | queued for M4. Signing and System Auth remain Fresnica-controlled. |
| `src/screens/Exchange` | swap input/quote/review flow | target application capability | M7 presentation queued; semantics blocked where upstream Fresnica swap semantics are unavailable. Presentation can be ported without inventing execution policy. |
| `src/screens/Onboarding` + `src/screens/Account/Add` | start/generate/import/recovery/completion paths | `src/features/onboarding` | queued for M3. Secret lifecycle stays inside Fresnica SDK/application flow. |
| `src/screens/Account` | switch/add/details/trustline/recovery-related surfaces | current account/settings features | queued for M3/M6. Account model becomes a presentation view model over Fresnica account records. |
| `src/screens/Overlay` / `src/screens/Modal` | QR/share/selectors/actions/alerts | product shell overlays | queued by owning milestone. Port structure only where mapped to an existing/explicit capability. |

## Known cross-cutting adaptations

- Donor `react-native-navigation` is replaced by Fresnica ProductRuntime/navigation state.
- Donor repositories and services are not presentation dependencies in the target; screens receive view models/callbacks from Fresnica flows.
- Donor Xaman native modules are not imported.
- Fresnica Native SDK remains the authority for secrets, recovery material, signing and System Auth.
- The React Native URL/Horizon compatibility fix at `a6dd7eaaa4745d5a0cde2b3b329d9d54e51b6224` is the rewrite baseline and must not be reverted by source ports.
