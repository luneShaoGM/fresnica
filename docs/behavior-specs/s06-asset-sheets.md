# S05/S06/S30 asset sheets on the current read lifecycle

- Decision: Adapt the existing Fresnica asset-sheet branch. Product owners: `features/home` and `features/trustlines`; shared presentation: `ui/components/BottomSheet`. Phase 0 / Stage 0A and the existing light-theme foundation apply; S06 remains L1 partial and this change does not claim L4 acceptance.
- Home opens Add Asset and Asset Details as dismissible sheets. Account/network changes and navigation away discard sheet selection. Closing, Android back, backgrounding and reopening must not apply obsolete asynchronous results.
- Details and held-asset detection use the current `BalanceProductDependencies` / `useBalanceDisplay` path: partitioned cached balance, honest stale/last-updated notice, live refresh, foreground/focus gating and invalidation. Cache is display-only. Cached/stale balances never enable financial actions.
- The current cache has no spendable/reserve authority. Native details show unavailable for those values; do not resurrect `CachedSpendableAsset`, fee fields, old repositories or Realm schemas.
- Issued asset identity is exact, including code case and issuer. Send may preselect that exact asset; a missing preselection must block rather than silently choose another asset. Remove requires an exact zero displayed balance and still revalidates liabilities/LP use through the existing Trustline capability.
- Add selects from the branch's public catalog sources or manual exact code/issuer input. Metadata is untrusted display input, never a ledger authority. HTTP belongs to an injected platform adapter; requests are bounded and cancelled on dismissal/lifecycle changes. Catalog errors allow retry/manual entry. Public-mainnet catalog entries are not offered on Testnet; manual entry remains available.
- Add/Remove continue into the existing exact-XDR review, authorization, signing, submit and recovery flow. No sheet signs or submits, stores secrets, or bypasses pre-sign revalidation. Failures and cancellation allow dismissal/retry without reviving a cancelled preparation.
- Swap UI redesign, spendable caching and result-card changes from the branch's parent are excluded. The current main Swap flow remains intact.
- Validation: affected automated component/lifecycle tests, typecheck, architecture/provenance/localization checks and repository checks. Simulator, real-device, dynamic font and TalkBack/VoiceOver sheet acceptance remain unperformed until explicitly recorded. Stage 9 real-iPhone System Auth cancel/retry remains deferred.

Provenance: reuse is limited to Fresnica commits `7e708b4623388fdbcaef409d70eef2b5bab1984a` (sheet implementation) and current main. No Stellar/Xaman source was consulted or copied during this adaptation. The automated donor-collision gate is evidence of zero exact collisions, not proof of historical authorship.

## Native asset-details sheet (2026-11-18)

- Decision: Adapt the Stellar panel's native drag, settle and dismiss behavior using the already installed React Navigation native-stack `formSheet`. Android uses Material BottomSheetBehavior; iOS uses the native form-sheet controller. No Stellar/Xaman implementation is copied and no new dependency is introduced.
- Home XLM and issued assets open the same asset-details native route at an 88% detent. The platform owns drag recognition, scroll handoff, distance/velocity decisions, settling and dismissal. Remove the asset-only custom Pan/Native coordination from AppModal; Actions and other existing modal consumers keep their behavior.
- A single, always-mounted first-descendant ScrollView uses Android nested scrolling for loading/error/ready states. Its sticky title retains Close; the Android handle is only a visual cue, with no custom touch handlers. Body content scrolls normally; at the top, a continued downward pull can dismiss. Short/cancelled pulls rebound to the same 88% height; upward/horizontal scrolling must not accidentally close the sheet. Android react-native-screens 4.27.0 is patched at install time: enable Material's hide-distance test, align the internal collapsed height with the single expanded height (including metric updates), and map both native resting states to detent 0. This adds no second visible height and leaves iOS unchanged. Android content has a minimum height of the measured viewport plus 1 dp so nested-scroll handoff also starts when the details otherwise fit without overflow.
- Navigation contains public accountId/networkId and exact asset identity only. The native route refuses a hidden, missing, different-network or no-longer-selected account. Backgrounding or leaving the route discards it; returning must not reopen old selection. Send/Remove replace the sheet route with the existing transaction destination, preserving watch-only/stale gates and preventing Back from reviving the sheet.
- Acceptance covers Home -> XLM/Token -> normal scrolling -> scroll-to-top pull -> close -> reopen, title drag, short/cancelled pull, horizontal/upward movement, Close/backdrop/Android Back, Send/Remove back history and account/network/background invalidation. Automated navigation/content tests do not constitute native touch acceptance.
- Reference audit only: Stellar `bd0f4540b2496a57314e4e29bc6fcf8ff691b60f`, ActionPanel and ExplainBalance overlay behavior. Implementation is based on Fresnica and the installed navigation library's documented public API. S05/S06 maturity is unchanged; iOS/real-device/accessibility acceptance and Stage 9 System Auth cancellation/retry remain deferred until actual evidence is recorded.

## Issued-asset issuer layout containment — 2026-11-19

The issued-asset detail sheet keeps the complete issuer address visible and
selectable in a width-bounded, multiline field underneath its Issuer label.
Its existing confirmation-based Copy issuer action remains in the same bounded
field and copies the original exact address, not a shortened display value.
Long numeric limits, balances, trustline issuers and scaled text must also stay
within the sheet's horizontal content bounds. No account, asset, network,
cache, send, remove or copy-authority semantics change. This is a clean-room
S06 presentation repair; repository/UI-tree tests do not prove Android/iOS
native pixel, selection, accessibility or dynamic-font acceptance.
