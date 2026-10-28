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
