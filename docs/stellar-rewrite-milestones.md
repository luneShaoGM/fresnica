# Stellar source-parity rewrite milestones

## 1. Purpose

This document is the execution plan and local-checkpoint ledger for rebuilding Fresnica Mobile from the presentation and user-visible behavior of `luneShaoGM/Stellar@stellar-migration` while retaining the existing Fresnica Mobile capability/runtime/security implementation.

Architecture rule:

```text
Stellar page / component / visible behavior
                ↓
Fresnica feature-local presentation adapter / view model
                ↓
Application Capability
                ↓
existing Fresnica SDK / platform / Horizon runtime
```

The donor repository is authoritative for first-pass page structure, interaction vocabulary and visible states. Current Fresnica Mobile is authoritative for accounts, storage, network access, secrets, signing, transactions, biometrics and security. Screenshots are visual evidence only.

## 2. Milestone status

| Milestone | Scope | Status |
| --- | --- | --- |
| M0 | Authority, architecture boundary, parity inventory and migration control | `DONE` |
| M1 | Stellar presentation foundation and five-position Product Shell | `DONE` |
| M2 | Home vertical slice | `READY_FOR_LOCAL_CHECK` |
| M3 | Onboarding and account lifecycle | `QUEUED` |
| M4 | Send → Review → Authorize → Submit → Result | `QUEUED` |
| M5 | Events/history and event details | `QUEUED` |
| M6 | Assets/trustlines, Request/share and shared pickers/overlays | `QUEUED` |
| M7 | Exchange/Swap presentation and execution contract | `BLOCKED` where shared semantics are not normative |
| M8 | Settings, Security and Network | `QUEUED` |
| M9 | XApps/dApp and full Actions overlay | `QUEUED` |
| M10 | Full source-parity audit and Android/iOS hardening | `QUEUED` |

Do not start the next milestone while the current local checkpoint has unresolved parity, runtime or test failures.

## 3. M0 — Rewrite authority and migration control

### Objective

Lock down the two sources of truth and prevent a page rewrite from becoming a second wallet implementation.

### Completed controls

- Donor presentation authority: `luneShaoGM/Stellar@stellar-migration`.
- Fresnica capability/runtime/security authority: current Mobile repository plus normative Fresnica Core/capability contracts.
- `docs/stellar-source-parity.md` records donor → target mappings and intentional adaptations.
- New source-parity surfaces are strict architecture-guard scopes.
- Unsupported donor behavior must remain explicit/disabled rather than receive substitute semantics.
- React Native URL/Horizon compatibility baseline `a6dd7eaaa4745d5a0cde2b3b329d9d54e51b6224` must not be regressed.

Status: `DONE`.

## 4. M1 — Presentation foundation and Product Shell

### Objective

Create the donor-derived presentation primitives required by later screens and establish the five-position product shell without replacing Fresnica navigation/runtime.

### Completed scope

- Stellar colors/sizes/fonts presentation tokens.
- `Spacer`, `LoadingIndicator`, `TouchableDebounce`, `RaisedButton` source-derived primitives.
- Product vocabulary and shell roles: `Home | Events | Actions | XApps | Settings`.
- `Actions` remains a center trigger, not a selected tab; closing it preserves the previously selected tab.
- Unsupported actions use explicit availability rather than fake flows.
- Full donor HomeActions dApp/catalog/scan behavior remains owned by M9.

### Local finding absorbed into M1

The first owner-side `npm run check` found that `src/ui/theme/stellar/fonts.ts` imported `NativeModules`, violating the `ui/**` boundary. The owner corrected that implementation to use `Intl`, pushed commit `65aefc9ba1ac21d40df39f1c8272ef580a5fde64`, and explicitly authorized continuation. M1 is therefore part of the accepted rewrite baseline.

Status: `DONE`.

## 5. M2 — Home vertical slice

### Objective

Rebuild the Home product surface from donor `HomeView` and its directly-used Module components while making every fact/action come from the current Fresnica account, balance, trustline and runtime contracts.

### Implemented source scope

- New strict `src/features/home/HomeScreen.tsx` replaces the temporary portfolio Home.
- Source-derived/adapted module components:
  - `AccountSwitchElement`
  - `NetworkSwitchButton`
  - `InactiveAccount`
  - `AssetsList`
- Thin `homeViewModel.ts` converts `AccountRecord`, balance state, signability and explicit action availability into presentation state.
- Existing Balance capability remains the token data boundary.
- Existing ProductRuntime owns account selection/add-account navigation.
- Existing Send flow remains the Send destination.
- Existing Trustline flow remains the Manage Assets destination.
- Previous `src/features/portfolio/WalletHomeScreen.tsx` was removed so the rewrite has one Home implementation.

### State/behavior mapping

- **No account:** remains the App onboarding/bootstrap boundary; it is not duplicated inside Home. M3 will source-rewrite onboarding.
- **Loading:** donor-style Home loading state while the Balance capability resolves.
- **Error:** explicit message and retry.
- **Inactive/unfunded:** activation explanation, public address and refresh action. Donor Friendbot/QR services are not copied.
- **Active:** native and credit balances render from the Balance capability.
- **Liquidity-pool shares:** current Balance contract exposes only a hidden count, so Home reports that positions are omitted rather than inventing LP presentation/state.
- **Watch-only:** balances remain readable; signing/trustline actions are disabled and the Home shows a read-only notice.
- **Contract account:** classic Horizon balance/action semantics remain explicitly unavailable.
- **Account switching:** prior asynchronous balance responses are invalidated with a request version so old-account data cannot paint the newly selected Home.
- **Network:** current product is fixed to Stellar Testnet. The donor network control remains visible as a status control but is intentionally disabled; M2 does not invent network switching.

### Action mapping

- **Send:** enabled from Home only for an active, classic, signable account and routed to the existing Fresnica Send flow.
- **Swap:** visible but disabled; normative quote/path-payment/slippage/review semantics belong to M7.
- **Request:** visible but disabled; public-address share/request flow belongs to M6.
- **Add asset / Manage Assets:** enabled only for an active, classic, signable account and routed to the existing Trustline product flow.
- ProductShell Send is also disabled for a watch-only selected account so the shell cannot bypass the Home read-only boundary.

### Tests added

Pure Home view-model tests cover:

- active signable classic account;
- watch-only classic account;
- inactive account;
- contract account;
- supported/unsupported action availability.

### Automated validation state

The latest inspected GitHub CI run for the M2 implementation/parity head (`3b53659640c49b9a1242ff530e281384cf85029e`, run `33608975802`) ended before executing repository steps: `runner_id=0` and `steps=[]`. Therefore GitHub CI is **not a pass and not evidence of a code failure**. The execution environment used by the assistant also cannot clone GitHub, so the owner-side `npm run check` is the authoritative executable gate for this checkpoint.

### M2 local acceptance checklist

After pulling the branch, run:

```bash
npm run check
npm run android
```

Verify on the local app:

1. A funded, managed classic account shows the account header, `Testnet`, balances, enabled Send, and enabled Add asset.
2. Swap and Request remain visibly unavailable; neither can start a fake flow.
3. Add asset opens the existing Manage Assets/Trustline flow and returning brings the user back to Home.
4. With two or more visible accounts, tapping the account switch control changes the selected account; a late response from the prior account must not flash its balances into the new account.
5. A funded watch-only account can display balances but Home Send/Add asset and ProductShell Actions→Send are disabled, with a read-only notice.
6. An inactive account shows activation guidance, its public address and Refresh rather than an empty active-token list.
7. A contract account shows explicit unsupported classic-balance/action semantics.
8. The network control reads `Testnet` and is disabled. That is intentional for the current fixed-network product boundary.
9. With no configured account, the app continues into onboarding rather than a synthetic Home no-account state.
10. Report typecheck, architecture, Jest, Android runtime or visual/parity findings against M2; M3 must not begin until those findings are resolved.

Status: `READY_FOR_LOCAL_CHECK`.

## 6. M3 — Onboarding and account lifecycle

### Objective

Rebuild donor onboarding/account lifecycle presentation while retaining Fresnica secret-management and account-provisioning authority.

### Planned scope

- onboarding landing/setup;
- create account;
- import mnemonic;
- import secret;
- watch-only account;
- backup/verification/completion;
- add/list/switch/edit account presentation;
- existing Native SDK/Core remains responsible for mnemonic/secret generation, validation and protection;
- no plaintext secret material in navigation or ordinary persistence.

### Regression cases

- Corrected mnemonic verification must recover after an initial wrong attempt; a stale error must not permanently poison subsequent validation.
- Account add/remove/switch must produce coherent Home state without stale reads.

Status: `QUEUED` until M2 local acceptance.

## 7. M4 — Send, review, authorization, submission and result

### Objective

Rebuild the donor Send experience while preserving exact Fresnica transaction identity and Application Security orchestration.

### Planned flow

```text
asset → amount → destination → memo/options → review → authorize → submit → result
```

### Non-negotiable invariants

- reviewed transaction == authorized transaction == signed transaction == submitted transaction;
- no rebuild after authorization;
- System Auth/biometric/passphrase policy remains centralized;
- result states distinguish success, definite failure and uncertain submission where the existing runtime does so;
- watch-only/unsupported signer accounts cannot enter a signing path that pretends success.

Status: `QUEUED`.

## 8. M5 — Events/history and details

### Objective

Rebuild donor Events presentation over the existing History capability.

### Planned scope

- event list;
- loading/empty/error/refresh states;
- search/filter presentation where supported by the current read contract;
- pagination;
- event detail;
- account changes invalidate prior event reads.

Status: `QUEUED`.

## 9. M6 — Assets/trustlines, Request/share and shared pickers/overlays

### Objective

Complete the asset-management and public account-sharing surfaces that Home intentionally leaves explicit but incomplete.

### Planned scope

- donor trustline/asset management presentation over the existing Trustline capability;
- Request/share presentation using public account identifiers only;
- QR/share only after the public-data contract is explicit;
- asset/account pickers return stable public identifiers rather than leaking repository/domain objects through navigation;
- shared overlay/UI primitives are promoted only when demonstrated reuse exists.

Status: `QUEUED`.

## 10. M7 — Exchange / Swap

### Objective

Restore donor Exchange presentation without inventing Mobile-only Path Payment/Swap rules.

### Work allowed before normative capability completion

- source/destination asset selectors;
- amount editors;
- quote/loading/error states;
- review presentation structure;
- adapter contract that consumes the normative shared capability.

### Blocked execution semantics

Execution remains blocked wherever the shared Fresnica Path Payment/Swap contract does not define:

- quote identity/freshness;
- strict-send/strict-receive behavior;
- slippage protection;
- destination trustline/capacity rules;
- exact review/sign/submit identity.

Status: `BLOCKED` for those execution semantics.

## 11. M8 — Settings, Security and Network

### Objective

Rebuild donor settings information architecture while routing supported actions through existing Fresnica security/network boundaries.

### Planned scope

- Settings home, General, Security, Network and About hierarchy;
- Application Security passphrase/biometric/lock operations;
- network presentation around actual supported product mechanisms;
- explicit treatment of developer-only, diagnostics, donor Realm-viewer and vendor residue;
- Reveal/Export continues to require the current fresh-authorization contract.

Status: `QUEUED`.

## 12. M9 — XApps/dApp and Actions-overlay completion

### Objective

Restore XApps as a first-class presentation surface and complete donor Actions-overlay vocabulary without bypassing Fresnica authorization boundaries.

### Planned scope

- catalog/list/search/recent presentation as supported;
- recent/featured/quick-action/scan entries from donor Actions overlay;
- browser/connection/permission adapters only behind explicit Fresnica contracts;
- explicit account exposure, permission, disclaimer and signing boundaries;
- unavailable catalog/browser/auth behavior remains disabled until its capability exists.

Status: `QUEUED`.

## 13. M10 — Full parity audit and hardening

### Objective

Verify product coherence after source-equivalent migration is complete.

### Audit matrix

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
- labels/action placement;
- shared component/state reuse;
- loading/empty/error/retry behavior;
- account/network switching;
- exact review/auth/sign/submit identity;
- biometric/passphrase consistency;
- accessibility/test IDs on critical actions;
- typecheck, architecture guard, tests and native gates;
- parity ledger has no unexplained gaps.

Status: `QUEUED`.

## 14. Per-milestone development loop

```text
Read donor source + direct dependencies
        ↓
Read current Fresnica feature/capability/runtime implementation
        ↓
Update source-parity map + define smallest adapter boundary
        ↓
Port presentation/interaction in dependency order
        ↓
Run typecheck + architecture guard + tests when executable
        ↓
Inspect diff + capability/security impact
        ↓
Update milestone/ledger status
        ↓
Hand off exactly one milestone for local/device verification
```

## 15. Definition of done for a local checkpoint

A milestone is not marked `READY_FOR_LOCAL_CHECK` until:

```text
planned donor source scope implemented
AND donor → target mapping recorded
AND capability/runtime adaptations recorded
AND no unexplained functional omissions
AND relevant tests updated where behavior changed
AND npm run check passes OR a concrete external execution blocker is recorded
AND PR/CI state inspected
AND final milestone diff reviewed
AND no superseded temporary migration implementation remains
```

Owner-side local/device findings feed back into the same milestone. The next milestone starts only after those findings are resolved or the owner explicitly accepts the checkpoint.
