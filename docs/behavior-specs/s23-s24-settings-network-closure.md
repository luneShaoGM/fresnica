# S23/S24 设置入口与网络收口

Decision: Adapt, clean-room. Base main `651bf7b9eceff4f004bcebbba9de6e7e224c383e` includes #123/#124/#125/#126. Phase 0 passed; F3 light semantic theme exists, complete themes remain partial. Owner: features/settings; app owns navigation/session composition, Network/Application Security retain existing policy, Native SDK/Core retain credentials/crypto. IDs S04/S23/S24/S25/S26; this slice closes reachable settings/navigation behavior, not all settings product maturity.

## Reference behavior audit before implementation

Reference: Stellar `bd0f4540b2496a57314e4e29bc6fcf8ff691b60f`, Settings/General/GeneralSettingsView, Settings/Advanced/AdvancedSettingsView, Settings/Advanced/Network/NetworkSettingView and Add/AddNetworkView. Read only for the roles below; no source/tests/resources used as implementation templates. Fresnica code is written from this contract using existing components/capabilities.

| Surface/element | Reference action/logic | Fresnica delivery/adaptation |
| --- | --- | --- |
| Settings General row | Opens general preferences, not network settings | Dedicated General route; Language moved into it |
| General language | Select, reflect selection, persist/reopen | Reuse existing locale route/store |
| General appearance/system theme/currency/haptic/system separators/reserve display | Explicit settings/selection and retained values | Preserve named roles with honest unavailable presentation; theme/currency/haptic preference mechanisms remain separate planned work. Do not render fake enabled switches |
| General XRPL advisory/Events-as-dApp controls | Source-specific filtering/legacy tab switch | Exclude XRPL-specific behavior and old tab substitution under existing guide |
| Settings Advanced row/back | Opens advanced settings; push/pop preserves history | Dedicated Advanced route, localized Back |
| Advanced network row | Network list is visible without enabling developer mode | Always reachable child Network route; controller filters network/node eligibility |
| Advanced Developer Mode switch | Warning then non-biometric authentication; persisted mode updates only after success | Controlled switch, warning/continue then fresh App Passphrase through existing controller/Native verification; no optimistic mode or reusable credential |
| Disable mode | Mainnet fallback before commit; non-Main network warns | Retain stricter existing verified built-in Mainnet + explicit confirmation even when already Mainnet; probe/write/busy/pending failure preserves prior state |
| Advanced release/device/log/tool roles | Release information, change log, device ID, session logs; tools require mode | Show roles and unavailable notices where no truthful native metadata/content/export/provider exists; no invented UUID/version; developer-tools role visible only in mode; Realm Viewer remains Exclude |
| Network identity/current node/default status | Current profile, visible networks, endpoints and node state | Runtime profile + current health, built-in/custom list, selected/default marks; never helper Testnet fixture |
| Node test | Public endpoint validation with result/error | Existing expected-passphrase probe, deadline/cancel/Retry-After and localized result |
| Add node | Input/network validation, duplicate/wrong-network handling; optional default choice | Existing add persists without selection; new node exposes separate explicit Use action rather than auto-switch, preserving cancellation/atomicity |
| Select/remove node | Explicit selection/removal, preserve at least one built-in, active fallback | Reuse existing verified select and atomic remove/fallback controller; no new gateway path |
| Network page back / initial legacy setup | Return to Advanced; initial setup must not deadlock | Settings Network shows node controls only and tells user mode belongs to Advanced. Bootstrap Network keeps combined mode/node controls because Advanced is unavailable before initial selection |
| About network information | Runtime identity must be truthful | Show selected production network rather than fixed Testnet text; root footer uses network-neutral branding |

## State and lifecycle

- Advanced and Network consume one NetworkSettings controller; no separate preference/auth state. Snapshot is authoritative across navigation/restart.
- Warning cancel/back/blur and authentication cancel/background clear transient credential, invalidate callbacks and do not persist. Secure uncontrolled input remains ref-only; no credential in React state, navigation, Realm or logs.
- Busy disables duplicate actions; cancellation remains available. Wrong credential/error allows explicit fresh-input retry. Old generation rejects calls/results after committed transition.
- Native setting absence is honest unavailable, never mode on by default. Built-in retained Testnet partition exception and last-account revocation unchanged.
- No wallet/Realm schema, transaction authority, crypto, dApp permissions or Swap economics changes.

## Verification and evidence boundary

Final `npm run check`: 168 suites / 1348 tests passed; lint 0 errors / 31 existing warnings; type, architecture, aliases, provenance and 3×754-key locale checks passed.

Automated coverage: root→General→Language; root→Advanced→Network/back; mode-only/node-only/bootstrap-combined presentation; controlled switch never authenticates on toggle alone; warning/credential cancel and explicit confirmation; disabled/mode-enabled/retained Testnet visibility; node actions use existing controller; localized copy; truthful runtime About network; route inventories. Reuse direct controller/security/retirement regressions from #124.

### Executed Android product paths

Environment: `emulator-5554`, Android arm64 emulator, isolated application ID `com.fresnica.settingsacceptance`. A fresh disposable protected Mainnet signer was imported through the native SDK, with no funding or ledger writes. Existing development application, Metro service and its wallet data were not changed.

| Actual UI path | Observed result |
| --- | --- |
| Home → Settings → General → Language → Back → General → Back → Settings → Advanced | Correct dedicated pages and navigation history; General no longer opens Network |
| Advanced → Developer Mode switch → Cancel | Warning shown; switch remains off, no mode persisted |
| Switch → Continue → wrong App Passphrase → Confirm | Failure shown; switch remains off; secure input cleared and retry available |
| Fresh correct fixture App Passphrase → Confirm | Native verification succeeds; mode enabled and developer-tools unavailable role becomes visible |
| Restart → Settings → Advanced | Enabled mode retained |
| Advanced → Network → Mainnet Test node | Current production Mainnet/endpoint shown; live Connected and explicit Last test: reachable |
| Use Testnet built-in → Confirm → Settings → Advanced → Network | Immutable session rebuild reaches empty Testnet account partition; Testnet identity/endpoint and Connected shown; Mainnet signer not reused |
| Back to Advanced → mode off → Confirm | Verified built-in Mainnet fallback succeeds; original Mainnet account returns |
| Restart after final bundle update → Settings → Advanced | Mainnet retained, mode off; footer reads Fresnica · Stellar instead of a fixed Testnet claim |

Final layout APK SHA-256: `76966bee368b0f6d0be46ad438f5d1e368ddf1509f55de435a2d9718cf57e100`. The native authentication/network paths were run on the preceding same-branch bundle (`7b0320089d63d61a3c4498a5baa4f6b7353628e810a126161c96e62ed42d095b`); final bundle adds only network-neutral footer and layout padding.

Build/evidence limits: this is an isolated debug acceptance variant with bundled JS and dev support disabled to avoid connecting to the concurrently running dApp Metro server. Temporary Gradle init changes application ID/bundling; temporary `MainApplication.kt` change is restored exactly to HEAD after building. Android source has no tracked diff. Dependencies are shared with the existing local install; fixed ignored SDK artifacts are verified against their manifest. This establishes actual native paths in that acceptance configuration, not an unmodified production/release build or real-device acceptance. The final layout-only padding adjustment is separately rebuilt and visually checked; the authentication/switch paths above were exercised in the same branch before that layout adjustment.

Custom-node add/remove/current-node-delete fallback, language selection/persistence (the native path opened and returned from Language only), legacy Testnet variants, negative fallback probe, background/blur/dynamic-font/TalkBack, iOS/simulator/real-device/VoiceOver are NOT accepted by this run. Relevant automated regressions remain evidence only for their own scope. Realm integration was not rerun because storage code/schema were unchanged. General preferences, release/device metadata, logs/tools and generic app-session auth remain incomplete. Stage 9 iOS System Auth cancel/retry remains deferred. No S24 L4 upgrade.

## 2026-10-29 correction contract (before implementation)

User acceptance found an intermittent blank Android surface after Use Testnet; the earlier one-pass native evidence does not close this failure. The emulator retained an empty Fabric tree and MissingViewState/addViewAt errors during network transition. Correct the AppNavigator generation remount and synchronous Realm disposal before old screens unmount; preserve service retirement, partition isolation, loading/error and retry behavior.

Fixed Stellar Network/NodeList/NodeListItem behavior audit: one neutral information banner above grouped network sections, tinted section headers with a color marker and add action, endpoint rows with default radio/selection, status, test and custom-only removal actions. Active connection status belongs beside its node; remove duplicate identity/connection diagnostic blocks from the managed list. Keep Fresnica explicit verified network activation and authenticated mode policy; no donor source/resources copied. Use/select/remove/add and mode warning/auth/disable use an accessible dialog with confirm/cancel and failure inside the dialog, never a form appended below the list. Busy blocks duplicate confirmation; cancel/back/background/blur invalidates work and clears secrets. Full original queue and outstanding native gates remain.

### Correction implementation and verification

The App keeps its React owner identity but removes the native NavigationContainer/stack entirely during loading/error. The next network mounts a new native navigation tree after this loading commit. Services retire SDK/gateway authority, catalog and reads immediately; the App effect keeps an owned-service reference and closes Realm after the old screen tree has unmounted. Headless owners still close immediately. No wallet schema or persisted data migration. Exact-transaction/network partition/recovery policies are unchanged.

Network UI now uses a neutral information banner, tinted network section headers with an add glyph, endpoint/status on the left, test/custom-only-remove/default-radio controls on the right, and current-node read health beside the active endpoint. Public tests remain explicit. Confirmation and credential/error content use AppModal with confirm/cancel; all secret values stay ref-only. Built-in endpoints have no remove action. Fresnica adaptation: explicit network activation is verified before service retirement; an unused network's default node remains distinguishable from the current active network.

Final automated check: 168 suites / 1351 tests passed; lint 0 errors / 31 existing warnings, architecture/provenance/type/locale gates passed. New regressions cover dialog cancel without selecting, immediate gateway retirement with deferred one-time Realm disposal, clearing old deep links while loading, and absence of a native navigator during loading/error.

Android arm64 isolated acceptance configuration is the same as above. After the full loading-tree correction, six consecutive confirmed Mainnet/Testnet transitions passed, with active identity and usable Settings→Advanced→Network navigation verified after every switch. The earlier attempt that only kept the navigation host stable reached four cycles but froze navigation on the fifth; it is NOT a passing run and motivated the full loading-tree correction. Earlier MissingViewState soft warnings and the user's white-screen report remain recorded; these runs do not prove all Fabric warnings or all intermittent device failures impossible. iOS/device/readers and custom-node add/remove/fallback native matrices remain pending.

Final layout-only follow-up APK SHA-256: `bd5274b4ad4d80680f37f067a15197a4bdf76d301fcb709483f992528491c5e4`. On that final layout, two additional confirmed network round trips, cancel preserving the active network, mode disable to Mainnet, warning cancel, fresh correct App Passphrase reauthentication in the modal and restart to Mainnet passed. Node list and selection-dialog screenshots were visually checked. The six-cycle navigation run used `0f8d21e71078ea0580ef863a4bdb4232d560aa84047e38686080560d10dd88f3`; final changes only arrange node actions as glyph/radio controls in the same row. Native source is restored with no tracked Android diff. All results use the isolated test ID/shared dependency setup described above; no production/release, iOS, real-device, readers or complete custom-node matrix acceptance is claimed.

## 2026-10-29 empty-network bottom-tab correction contract (S04/S05/S13/S24)

User acceptance found the bottom bar missing after switching to a network without selectable accounts. MainTabsNavigator returned a bare SettingsStackNavigator for empty/all-hidden partitions. Preserve the normal Home/Activity/Actions/dApps/Settings shell on tab roots, with explicit current-network empty Home/Activity states and a route to that network's account settings. Retain normal nested-page tab hiding. Read-only dApp catalog and settings remain available; Actions cannot dispatch or fabricate an account identity. Adding/unhiding an eligible account returns to the existing selected-account shell. Do not borrow accounts from another partition or loosen signing/selection rules. Reuse StateView, MainTabBar and existing account creation/default selection; no new capability or persistence model.

Empty-network implementation: preserve the four tab roots plus central Actions when no eligible account exists; Settings remains the initial recovery tab. Home/Activity reuse Screen/StateView and identify the current network. Their Accounts action targets existing account settings; dApps keeps its existing read-only catalog. MainTabBar accepts an absent account identity, disables Actions and rejects stale action callbacks rather than passing an empty/fabricated ID. Existing account provisioning/default selection and the selected-account shell are reused when a visible account appears. Nested settings pages still hide the bar normally.

Verification: final `npm run check` 168 suites / 1354 tests passed, lint 0 errors / 31 existing warnings; 3 locale dictionaries share 756 keys. Unit cases cover empty and all-hidden partitions with a visible foreign-network account, all tab roots, current-network empty labels/account-settings actions, return to the normal selected-account shell, and no Actions dispatch despite stale availability flags. Android isolated acceptance passed: switch into an empty Testnet partition, toolbar on Home/Activity/dApps/Settings, disabled Actions, Accounts child hides toolbar and Back restores it, return to Mainnet with its original account, Testnet restart, and return to Mainnet again. Screenshot visually checked. A transient UIAutomator null-tree warning occurred during a transition; subsequent distinct empty-state/disabled-control assertions, fresh screen captures and navigation checks completed. This is not a native app exception or a standalone pass signal.

The native path run used APK `e42c14bfc31f9b19d98e2547e067ffdbd59d70c1c84a8a15f3e6ee6db0727c79`; final follow-up only hoists the empty-tab-bar render callback to a stable function and is checked separately on restart. Existing isolated-build/shared-dependency limits apply. All-hidden partitions and the transition to a visible-account shell have unit coverage; native account creation/unhide was not exercised; iOS, real-device and readers remain unaccepted. No schema, ledger or signing change; no S24 L4 upgrade.

Final stable-callback APK SHA-256 `4a66f5a5126a4824c91e25da0a2036b63169cf1b28a52ca7633799cc5d46c097`: restart confirmed all bottom navigation labels present. Temporary Android entry restored exactly; no tracked native source diff.

## Product closure correction after wallet/network parity feedback

The blank-screen/tab fixes and their passing tests do not settle the Classic wallet continuity model. The user's expected Stellar flow retains a G-address wallet and changes current-network ledger details/activation; Home's switch entry also remains unwired. The implemented empty-target-partition behavior is not final parity acceptance. See the cross-cutting account/network re-audit at the end of `shared-auth-network-session.md` for pinned source evidence, consumer/lifecycle risks and the original task 3 exit matrix. No runtime or storage policy is changed by this documentation audit.
