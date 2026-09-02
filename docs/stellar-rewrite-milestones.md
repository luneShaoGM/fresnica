# Stellar Source-Parity Rewrite Milestones

> Product/presentation reference: `luneShaoGM/Stellar@stellar-migration`.
>
> Runtime/security authority: current Fresnica Mobile source plus upstream Fresnica Application Capability contracts and Fresnica SDK/Core.
>
> Working branch: `rewrite/stellar-source-parity`.
>
> Tracking PR: #36 (`rewrite: port Stellar presentation and interaction source`).

## 1. Goal and authority boundary

The first rewrite pass has one goal: reproduce the Stellar application's user-visible page structure, component structure, interaction entry points, states and functional workflows without replacing the bottom-layer logic that Fresnica Mobile has already built.

The dependency direction is:

```text
Stellar-derived page / component / interaction
                    ↓
Fresnica feature state / adapter / view model
                    ↓
Application Capability
                    ↓
Fresnica SDK / platform / persistence / Horizon mechanisms
```

Rules that apply to every milestone:

1. Stellar source is the first-pass source of truth for presentation and the user-visible feature checklist. Screenshots are visual verification only.
2. Existing Fresnica capabilities, domain rules, persistence, network orchestration, signing, System Auth and SDK/Core security semantics remain authoritative.
3. Do not copy donor repositories, services, native modules, crypto, signing, secure storage or navigation infrastructure into Fresnica.
4. When the donor UI expects a different model/API, add the thinnest feature-local adapter/view model that maps the existing Fresnica contract to the donor presentation.
5. Missing Fresnica capabilities stay explicit as disabled/unsupported states. Do not invent product semantics to make a donor control appear functional.
6. Exact transaction identity, sensitive material and security boundaries must never be weakened for UI parity.
7. A milestone is handed to local verification only after its complete acceptance checklist is satisfied. Do not mix the next milestone into an unfinished one.

## 2. Milestone status vocabulary

| Status | Meaning |
| --- | --- |
| `DONE` | Completed and already absorbed into the rewrite baseline. |
| `IN_PROGRESS` | Current implementation milestone. |
| `READY_FOR_LOCAL_CHECK` | Implementation/diff review is complete and the automated gate either passed or has a concrete external blocker recorded; milestone is paused for local/device verification. |
| `QUEUED` | Planned after the current milestone. |
| `BLOCKED` | Presentation may progress, but required semantics depend on a missing/shared capability contract. |

## 3. Milestone overview

| Milestone | Scope | Status | Local checkpoint |
| --- | --- | --- | --- |
| M0 | Rewrite authority, architecture boundary, parity inventory and migration ledger | `DONE` | Documentation/guardrails form a coherent baseline. |
| M1 | Stellar presentation foundation and five-position Product Shell | `READY_FOR_LOCAL_CHECK` | App shell can be inspected independently before Home is rewritten. |
| M2 | Home vertical slice: account/header/actions/assets/states | `QUEUED` | Home is independently usable with existing Fresnica read capabilities. |
| M3 | Onboarding and account lifecycle | `QUEUED` | Create/import/watch-only/account switch flows can be checked end-to-end. |
| M4 | Send, Review, Auth, Submit and Result | `QUEUED` | A payment can be checked from entry through exact review and submission result. |
| M5 | Events/history and transaction/operation details | `QUEUED` | Read-side history flow can be checked independently. |
| M6 | Assets, trustlines, Request/share and common pickers/overlays | `QUEUED` | Asset management and account sharing interaction vocabulary is coherent. |
| M7 | Exchange/Swap presentation and capability adapter boundary | `BLOCKED` semantics | UI can be checked; execution remains disabled where the shared swap contract is not normative. |
| M8 | Settings, Security and Network information architecture | `QUEUED` | Settings hierarchy and supported security/network actions are locally checkable. |
| M9 | XApps/dApp surfaces and Actions-overlay completion | `QUEUED` | Product entry points exist; unavailable authorization/browser semantics stay explicit. |
| M10 | Full parity audit, cross-flow consistency and platform hardening | `QUEUED` | Android/iOS critical flows are compared against the Stellar reference. |

## 4. M0 — Rewrite baseline and migration control

### Objective

Prevent screenshot-driven drift and establish a repeatable donor-source-to-Fresnica mapping before broad implementation.

### Delivered baseline

- Stellar source-parity rules in `docs/stellar-source-parity.md`.
- Product roadmap and parity matrix.
- Architecture/style guardrails in `AGENTS.md` and the mobile architecture guide.
- Typed product navigation inventory and strict architecture checks.
- Dedicated rewrite branch and Draft PR.

### Acceptance

- Every migrated surface can name its donor source, target source, capability/runtime dependency, adaptation and known gap.
- New/reworked `features/**` do not import concrete platform/Realm/NativeModules/Stellar SDK.
- New/reworked `ui/**` remains presentation-only.
- Donor security/runtime implementation is not treated as authority.

## 5. M1 — Presentation foundation and Product Shell

### Objective

Create a stable Stellar-derived presentation base and top-level shell that later page migrations can reuse without duplicating donor styling or changing Fresnica bottom-layer logic.

### Tasks

- [x] Port donor color, metric and typography semantics into the isolated Stellar presentation theme.
- [x] Port `Spacer`.
- [x] Port `RaisedButton` with a narrow icon-registry adaptation.
- [x] Port the donor `LoadingIndicator` presentation primitive.
- [x] Port the donor `TouchableDebounce` interaction primitive without adding lodash only for this helper.
- [x] Reuse the shared loading primitive from `StellarRaisedButton` instead of duplicating spinner behavior.
- [x] Source-align top-level product vocabulary to `Home | Events | Actions | XApps | Settings`.
- [x] Preserve Actions as a trigger rather than a selected tab; opening/closing it must not mutate the active tab.
- [x] Keep unavailable action semantics disabled/explicit rather than faking execution.
- [x] Update the source-parity ledger with all M1 donor/target paths and adaptations.
- [x] Inspect automated gates and record the concrete pre-execution blocker; local `npm run check` remains required before M1 is marked `DONE`.

### Automated verification record — 2026-09-02

Implementation head inspected before this status-only documentation update: `ac8d8f40ea81fced0f7cc224382763aa7e7fd449`.

- Final M1 implementation diff was reviewed. `ProductShell.tsx` is intentionally limited to the two source-vocabulary changes `Activity -> Events` and `dApps -> XApps`; the rest of the shell behavior is unchanged.
- New M1 presentation files stay under `src/ui/**` and import only React/React Native plus UI theme dependencies. No M1 implementation change touches `features/**`, `capabilities/**` or `platform/**`.
- The first `TouchableDebounce` draft was corrected during diff review: donor lodash `debounce({leading: true, trailing: false})` uses a resettable quiet window, not a fixed throttle interval. The port now preserves that behavior without adding lodash.
- The execution container could not clone the private repository because outbound DNS/network access to `github.com` was unavailable, so `npm run check` could not be executed there.
- PR CI run `33606076766` for the implementation head failed before checkout/execution: job `test` reports `runner_id=0` and `steps=[]`. No typecheck, architecture check or Jest step actually ran.
- Native Android Gate run `33606076754` failed in the same pre-execution state: job `android` reports `runner_id=0` and `steps=[]`. No Gradle/native step actually ran.

These are external execution blockers, not a test pass and not evidence of a code failure. M1 is therefore `READY_FOR_LOCAL_CHECK`, not `DONE`.

### Not in M1

- Home screen business-state rewrite.
- Donor HomeActions recent/recommended dApp catalog behavior.
- Account/network data adapters.
- Send/Swap/Request screen rewrites.
- New dApp/browser, scan, contact or swap semantics.

Those belong to later vertical milestones.

### Local acceptance checklist

Run the local gate first:

```text
git checkout rewrite/stellar-source-parity
git pull
npm ci
npm run check
```

Then launch the platform you normally use for local validation and check:

1. The bottom product positions read/behave as Home, Events, Actions, XApps and Settings.
2. Home/Events/XApps/Settings selection changes the active destination normally.
3. Open Actions from each tab and close it; the previously selected tab must remain selected.
4. Disabled actions cannot start a fake workflow and remain visibly unavailable.
5. Existing Fresnica runtime/account/security behavior has not changed merely because of the shell rewrite.
6. Report any typecheck/test/native/runtime or visual issue against M1 before M2 starts.

## 6. M2 — Home vertical slice

### Objective

Rebuild the first visible wallet page from `Stellar/src/screens/Home/HomeView.tsx` and its directly used Modules while sourcing facts/actions from existing Fresnica capabilities.

### Tasks

- Port Home page structure and styles rather than tuning the old screen from screenshots.
- Port/adapt `NetworkSwitchButton`, `AccountSwitchElement`, `InactiveAccount` and `AssetsList` in dependency order.
- Map existing Account/Balance/Trustline/network facts into a Home view model.
- Preserve donor states: no account, initial/loading data, inactive account, active account, read-only/non-signable, refresh/error.
- Preserve visible action entry points: Send, Swap, Request and Manage Assets.
- Route supported actions into existing Fresnica flows.
- Keep unavailable Swap/Request behavior explicit where capability/product semantics are not ready.
- Record every donor dependency that is intentionally omitted, deferred or adapted.

### Local acceptance checklist

- No-account state exposes the expected create/import entry points.
- Active account shows the selected account/network and current assets from Fresnica data.
- Inactive/unfunded account renders its dedicated state instead of an empty balance list.
- Account/network switching refreshes the visible data without stale-account leakage.
- Send/Swap/Request entries obey actual Fresnica capability availability.
- `npm run check` is green.

## 7. M3 — Onboarding and account lifecycle

### Objective

Preserve Stellar onboarding/account UX while keeping Fresnica SDK/Core as the authority for signer and secret lifecycle.

### Tasks

- Rebuild onboarding landing and setup rhythm from donor source.
- Rebuild account add/list/switch/edit presentation.
- Connect create account, import mnemonic, import secret and watch-only flows to existing Account/Application Security capabilities.
- Keep mnemonic/secret generation, validation, identity checks and protection inside Fresnica SDK/Core.
- Rebuild backup confirmation/recovery presentation only around existing safe contracts.
- Preserve explicit loading/error/retry/cancel states.

### Local acceptance checklist

- Create, import mnemonic, import secret and watch-only flows behave according to supported Fresnica contracts.
- Account switching survives app state refresh/restart where persistence currently supports it.
- No plaintext secret/mnemonic is introduced into ordinary navigation/persistence.
- Existing security error categories remain distinguishable.
- `npm run check` is green.

## 8. M4 — Send / Review / Auth / Submit

### Objective

Rebuild the donor multi-step payment product experience on top of the current normative Fresnica Payment/Transaction/Security behavior.

### Expected flow

```text
asset → amount → destination → memo/options → review → authorize → submit → result
```

### Tasks

- Port donor Send page/component hierarchy and field interaction.
- Use feature-local state/controller/view models, not direct platform calls from Screens.
- Preserve exact amount handling from the existing Payment capability.
- Bind the displayed review to the exact transaction that is authorized/signed/submitted.
- Reuse shared Fresnica authentication/signing orchestration; do not recreate donor signing/auth internals.
- Distinguish submitted, rejected, uncertain, auth-blocked, watch-only and unsupported-signer results where existing contracts expose them.
- Ensure biometric/passphrase presentation is consistent with the shared security flow.

### Local acceptance checklist

- A supported payment can run end-to-end on the configured test environment.
- The reviewed transaction is the submitted transaction.
- Cancel/retry/error paths do not silently rebuild a different transaction.
- Watch-only/non-signable accounts cannot bypass authorization rules.
- `npm run check` is green.

## 9. M5 — Events and details

### Objective

Replace the temporary Activity presentation with the Stellar Events product flow while keeping History as the read boundary.

### Tasks

- Port events list/search/filter/pagination presentation that the current read model can support.
- Port loading, refresh, empty and network-error states.
- Port transaction/operation detail navigation and presentation.
- Adapt existing History DTOs to presentation models; raw Horizon response/cursors stay below the feature boundary.

### Local acceptance checklist

- Events load for the selected account/network.
- Refresh/pagination do not mix account/network data.
- Details open from an event and display the correct operation/transaction facts.
- Empty/error states are distinguishable.
- `npm run check` is green.

## 10. M6 — Assets, trustlines, Request and common overlays

### Objective

Complete the wallet interaction vocabulary required by Home/Send/asset management without prematurely creating a giant global component library.

### Tasks

- Rebuild Add Token/manage trustline and token settings/details around existing Trustline capability semantics.
- Build Request/share-account/QR presentation from Stellar source using public account identity only.
- Port account/asset/currency picker patterns as feature components first; promote to shared UI only after real reuse.
- Add generic alert/loading/modal/overlay primitives only where at least two migrated flows require them.
- Keep camera scan/contact/address-book work deferred unless an explicit current requirement needs it.

### Local acceptance checklist

- Add/remove/manage trustline operations use current Fresnica capability behavior.
- Request/share exposes only public account information.
- Pickers return stable public identifiers rather than leaking domain objects into navigation.
- `npm run check` is green.

## 11. M7 — Exchange / Swap

### Objective

Restore Stellar Exchange presentation without inventing Mobile-only Path Payment/Swap rules.

### Work allowed before normative capability completion

- source/destination asset selectors;
- amount editors;
- quote/loading/error states;
- review presentation structure;
- adapter contract that consumes the future/current shared capability.

### Blocked semantics

Execution remains blocked wherever the shared Fresnica Path Payment/Swap contract does not yet define:

- quote identity/freshness;
- strict-send/strict-receive behavior;
- slippage protection;
- destination trustline/capacity rules;
- exact review/sign/submit identity.

### Local acceptance checklist

- UI interactions match the donor flow for available states.
- Missing execution semantics are visibly unavailable rather than mocked as success.
- No local TypeScript implementation invents quote/signing policy.
- `npm run check` is green.

## 12. M8 — Settings, Security and Network

### Objective

Rebuild Stellar settings information architecture while routing every supported action through current Fresnica application/security/network boundaries.

### Tasks

- Rebuild Settings home, General, Security, Network and About hierarchy.
- Map supported passphrase, biometric, lock and account-security operations to current Application Security flows.
- Rebuild network selection/configuration presentation around existing network mechanisms.
- Keep developer-only, diagnostics, donor Realm viewer and unsupported vendor entries deferred or explicit.
- Reveal/Export must continue to require the current Fresnica authorization contract.

### Local acceptance checklist

- Supported settings persist and refresh correctly.
- Security operations preserve fresh-auth/reveal boundaries.
- Network switching produces coherent account/read state.
- Unsupported donor settings do not silently execute substitute behavior.
- `npm run check` is green.

## 13. M9 — XApps/dApp and Actions-overlay completion

### Objective

Restore the first-class XApps product surface and complete donor Actions-overlay presentation without bypassing Fresnica authorization boundaries.

### Tasks

- Port XApps catalog/list/search/recent presentation as applicable.
- Complete Actions overlay vocabulary from donor source: recent/featured/quick actions/scan entry where supported.
- Introduce browser/connection/permission adapters only behind explicit Fresnica contracts.
- Preserve explicit permission/disclaimer/account exposure/signing request boundaries.
- Keep unavailable backend/catalog/browser/auth behavior disabled/explicit until its capability exists.

### Local acceptance checklist

- XApps/Actions UI can be navigated without affecting wallet signing/security state.
- Unsupported dApp/browser actions cannot bypass permission/signing boundaries.
- Connected-account exposure is explicit and revocable when the corresponding contract exists.
- `npm run check` is green.

## 14. M10 — Full parity audit and hardening

### Objective

Verify product coherence across flows and platforms after source-equivalent migration is complete.

### Audit

For each critical flow compare:

```text
Stellar source/reference
        ↕
Fresnica Android
        ↕
Fresnica iOS
```

Check:

- page/navigation hierarchy;
- modal/overlay transitions;
- labels and action placement;
- component/state reuse;
- loading/empty/error/retry behavior;
- account/network switching;
- exact review/auth/sign/submit identity;
- biometrics/passphrase consistency;
- accessibility/test IDs for critical actions;
- architecture guard/typecheck/tests/native gates;
- source-parity ledger has no unexplained gaps.

### Exit criteria

- Critical donor-visible functions are either implemented on Fresnica capabilities or explicitly documented as blocked/deferred/donor residue.
- No donor repository/service/native/crypto implementation has become a hidden runtime dependency.
- Android and iOS platform-specific checks are recorded truthfully; unrun real-device gates are not called passed.
- Rewrite PR final diff and migration ledger have been reviewed.

## 15. Per-milestone development loop

Each milestone follows the same loop:

```text
Read donor source and direct dependencies
        ↓
Read current Fresnica feature/capability/runtime implementation
        ↓
Update source-parity map and define the smallest adapter boundary
        ↓
Port presentation/interaction in dependency order
        ↓
Run typecheck + architecture guard + tests
        ↓
Inspect diff and capability/security impact
        ↓
Update milestone/ledger status
        ↓
Hand off exactly one completed milestone for local/device verification
```

## 16. Definition of done for a local checkpoint

A milestone is not marked `READY_FOR_LOCAL_CHECK` until all of the following are true:

```text
planned source scope implemented
AND donor -> target mapping recorded
AND capability/runtime adaptations recorded
AND no unexplained functional omissions
AND relevant tests updated where behavior changed
AND npm run check passes (or a concrete external blocker is recorded)
AND PR/CI state inspected
AND final milestone diff reviewed
AND no temporary migration residue remains
```

Local/device validation findings are fed back into that same milestone before the next milestone begins if they reveal a parity or regression issue.
