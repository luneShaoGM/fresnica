# Stellar source-parity rewrite milestones

## 1. Purpose

This document is the execution plan and checkpoint ledger for aligning Fresnica Mobile with the product functions and user-visible workflows of `luneShaoGM/Stellar@stellar-migration` while retaining the existing Fresnica Mobile capability/runtime/security implementation.

Architecture rule:

```text
Stellar product function / visible workflow
                ↓
Fresnica feature presentation / product-flow adapter
                ↓
Application Capability
                ↓
existing Fresnica Core / SDK / platform runtime
```

Stellar is the product/function reference. Current Fresnica Mobile is authoritative for accounts, storage, network access, secrets, signing, transactions, biometrics and security.

The current phase prioritizes **horizontal functional alignment**. Fresnica will maintain its own UI specification later, so final visual design-system work is not a gate for the present parity phase.

The authoritative horizontal audit is `docs/stellar-horizontal-parity-audit.md`. The detailed source-to-target ledger remains `docs/stellar-source-parity.md`.

## 2. Why the execution model changed

The earlier plan migrated page slices in sequence. That produced working pieces, but it failed to guarantee app-wide systems such as locale/i18n, shared pickers, modal/overlay behavior, QR/scan/share and common interaction states.

A directory or button is therefore no longer evidence of parity. A function is complete only when its full flow, states, shared interactions and Fresnica capability boundary are accounted for.

The execution model is now:

```text
horizontal foundation
        ↓
shared interaction contracts
        ↓
product-domain closure
        ↓
full Android/iOS functional audit
        ↓
future Fresnica UI-spec re-skin
```

## 3. Current milestone status

| Milestone / lane | Scope | Status |
| --- | --- | --- |
| M0 | Authority, architecture boundary and migration control | `DONE` |
| M0.5 | Full horizontal product/cross-cutting audit | `AUDIT_BASELINE_ESTABLISHED` |
| H1 | Locale/i18n, localized formatting and visible-copy boundary | `QUEUED_NEXT` |
| H2 | Navigation/modal/overlay/picker/alert/loading shared interaction foundation | `QUEUED` |
| M1 | Temporary/source-derived presentation foundation + Product Shell | `DONE_AS_BASELINE`; final UI deferred |
| M2 | Home vertical slice | `REOPENED_BY_HORIZONTAL_AUDIT` |
| M3 | Onboarding and account lifecycle | `QUEUED`; closure depends on H1/H2 |
| M4 | Send → Review → Authorize → Submit → Result | `QUEUED`; closure depends on H1/H2 and shared transaction interaction audit |
| M5 | Events/history and event details | `QUEUED`; closure depends on H1/H2 |
| M6 | Assets/trustlines, Request/share, QR/scan and shared pickers | `QUEUED`; cross-cutting pieces move earlier where reusable |
| M7 | Exchange/Swap | `BLOCKED` where shared semantics are not normative; safe presentation inventory still allowed |
| M8 | Settings, Security and Network | `QUEUED`; language setting is pulled forward into H1 |
| M9 | Actions + dApp catalog/browser/permission flows | `QUEUED`; shared scanner/browser/overlay pieces may land earlier |
| M10 | Full functional parity and Android/iOS hardening | `QUEUED` |
| UI-F | Fresnica-owned final UI specification/design-system adoption | `FUTURE`; not part of current functional gate |

Product milestones remain useful as domain ledgers, but they are no longer executed as a strict page-by-page chain. Reusable horizontal functionality is implemented once at the earliest dependency point and then consumed by each product domain.

## 4. M0 — Rewrite authority and migration control

### Objective

Lock down the sources of truth and prevent a product rewrite from becoming a second wallet implementation.

### Completed controls

- Product/function reference: `luneShaoGM/Stellar@stellar-migration`.
- Fresnica capability/runtime/security authority: current Mobile repository plus normative Fresnica Core/Application Capability contracts.
- `docs/stellar-source-parity.md` records source → target mappings and intentional adaptations.
- New source-parity surfaces are strict architecture-guard scopes.
- Unsupported source behavior remains explicit/disabled rather than receiving invented semantics.
- React Native URL/Horizon compatibility baseline `a6dd7eaaa4745d5a0cde2b3b329d9d54e51b6224` must not be regressed.

Status: `DONE`.

## 5. M0.5 — Horizontal parity audit

### Objective

Inventory product-wide functions that cannot safely be discovered one screen at a time.

### P0 audit categories

- locale/i18n and runtime language selection;
- device locale/timezone and localized number/date formatting;
- translation-key integrity tooling;
- navigation destinations and dismissal/back semantics;
- modal and overlay roles;
- account/asset/currency/destination/fee/global picker roles;
- alert/loading/error/connection states;
- QR generation, public share, scanner and permission flows;
- clipboard/external intent/deep-link/browser behavior;
- keyboard/input/safe-area behavior;
- app lifecycle and security re-auth interactions;
- accessibility semantics;
- cross-product transaction review/auth/submit/result behavior;
- dApp catalog/browser/disclaimer/permission roles.

Detailed matrix: `docs/stellar-horizontal-parity-audit.md`.

### Exit state

The audit baseline is established. Individual matrix rows remain live until closed by implementation and verification.

Status: `AUDIT_BASELINE_ESTABLISHED`.

## 6. H1 — Locale/i18n and formatting foundation

### Objective

Restore multilingual behavior as an app-wide product capability before more visible copy is added.

### Required functional scope

- locale resolver and fallback;
- translation lookup API usable by presentation without violating architecture boundaries;
- startup device-locale initialization;
- persisted user language selection;
- Settings language entry and runtime update behavior;
- locale-aware decimal/grouping formatting;
- locale/timezone-aware display dates;
- translation-key completeness/integrity check integrated into the development gate;
- migrate reworked user-visible hardcoded strings behind translation keys.

### Scope decision that remains explicit

The exact retained language set must not be silently reduced during implementation. Source locale inventory is the reference; any product decision to ship a smaller set requires explicit confirmation.

Status: `QUEUED_NEXT`.

## 7. H2 — Shared interaction foundation

### Objective

Provide the reusable behavior required for full workflows without committing Fresnica to a final visual design system.

### Required functional roles

- generic picker contract and selection state;
- account picker;
- asset/currency picker;
- modal presentation/dismissal semantics;
- overlay/action-panel semantics;
- alert/confirm/warning behavior;
- loading/progress/error behavior;
- authentication overlay adapter to Application Security;
- transaction review/submit/result interaction contract;
- QR/public share/scanner contracts where shared use is demonstrated;
- safe browser/open-link contract;
- permission-state handling;
- accessibility roles/labels/disabled/selected state.

Final colors, typography, iconography, illustrations, spacing, radius, shadow and polished motion are deferred to the Fresnica UI specification.

Status: `QUEUED`.

## 8. M1 — Presentation baseline and Product Shell

M1 remains part of the accepted rewrite baseline because it established source-derived primitives and the five-position shell without replacing Fresnica runtime/navigation authority.

Completed baseline includes:

- temporary/source-derived colors/sizes/fonts tokens;
- `Spacer`, `LoadingIndicator`, `TouchableDebounce`, `RaisedButton`;
- five-position shell roles;
- Actions as a center trigger rather than selected tab;
- architecture-boundary correction for the initial `NativeModules` font-locale access.

This does **not** define the final Fresnica UI design system. UI-F will later replace/rework visual tokens and component skins according to Fresnica-owned specifications.

Status: `DONE_AS_BASELINE`.

## 9. M2 — Home interaction closure

### Previous implementation

The rewrite already has `src/features/home/HomeScreen.tsx`, source-adapted account/network/inactive/assets pieces and a capability-backed Home view model.

### Why M2 is reopened

Local product review found that visible entries were sometimes treated as equivalent to source interaction. The clearest example is account switching: the source interaction is a selectable account surface, while the current implementation can reduce the action to selecting the next account.

Therefore Home must be rechecked against the horizontal audit for:

- account picker behavior;
- Actions overlay behavior;
- asset interaction states;
- Request/share dependencies;
- localized copy/amounts;
- loading/error/disabled/accessibility states;
- stale-request protection when accounts change.

Existing capability adapters should be preserved where correct. This is interaction closure, not a rewrite of Fresnica account/balance logic.

Status: `REOPENED_BY_HORIZONTAL_AUDIT`.

## 10. M3 — Onboarding and account lifecycle

### Functional closure scope

- onboarding landing/setup;
- create account;
- import mnemonic;
- import secret where supported;
- watch-only account;
- backup/verification/completion;
- add/list/switch/edit/remove/detail flows as applicable;
- account picker integration;
- all visible copy through H1 locale boundary;
- all secret generation, validation and protection remain Fresnica SDK/Core responsibility;
- no plaintext secret material in ordinary navigation/persistence.

### Required regression

Correcting mnemonic verification after an initial wrong attempt must succeed; stale error state must not poison later valid verification.

Status: `QUEUED`.

## 11. M4 — Send and shared transaction interaction

### Target flow

```text
asset → amount → destination → options → review → authorize → submit → result
```

Current Fresnica already contains Send form/flow/review/result screens, so M4 is a **parity closure**, not greenfield work.

Required closure includes:

- source step/state inventory;
- asset/destination picker dependencies as applicable;
- localized amount entry and validation;
- consistent slide/confirm semantics;
- Application Security biometric/passphrase behavior shared with other mutating flows;
- pending/success/definite-failure/uncertain-submission states.

Non-negotiable invariant:

```text
reviewed transaction
== authorized transaction
== signed transaction
== submitted transaction
```

No rebuild after authorization.

Status: `QUEUED`.

## 12. M5 — Events/history and details

Current Fresnica already has activity-list/detail surfaces and the History capability. Closure must compare them with reference Events behavior rather than assuming the existing screens are complete.

Required scope:

- list loading/empty/error/refresh;
- search/filter behavior;
- pagination;
- details;
- localized dates/amounts;
- account change invalidation;
- reusable filter/picker interactions from H2.

Status: `QUEUED`.

## 13. M6 — Assets/trustlines, Request/share, QR and scanner

Required scope:

- asset/trustline search/select/add/remove/review/result behavior over the Trustline capability;
- Request flow using public account identifiers only;
- QR generation/copy/share;
- scanner permission/scan/parse/error/cancel contract;
- stable public identifiers across picker/navigation boundaries;
- shared asset/account pickers;
- explicit unsupported states where current Balance/Trustline contracts do not expose reference data.

Secret material must never enter QR/share/public-copy flows.

Status: `QUEUED`.

## 14. M7 — Exchange / Swap

Presentation/function inventory is allowed before normative execution semantics are complete:

- source/destination asset selectors;
- amount editors;
- quote/loading/error states;
- review presentation structure;
- adapter boundary that consumes a normative shared capability.

Execution remains `BLOCKED_BY_CAPABILITY` wherever shared Fresnica semantics do not define quote identity/freshness, strict-send/strict-receive behavior, slippage protection, destination trustline/capacity rules and exact review/sign/submit identity.

No Mobile-only swap policy may be invented to make the screen appear complete.

## 15. M8 — Settings, Security and Network

Required closure:

- full settings information architecture inventory;
- language setting is implemented earlier through H1 and then integrated here;
- Application Security passphrase/biometric/lock operations;
- Reveal/Export fresh authorization contract;
- network presentation around actual supported product mechanisms;
- About/general/applicable developer/diagnostic entries explicitly classified;
- vendor/reference-specific residue marked `NOT_APPLICABLE` instead of silently omitted.

Status: `QUEUED`.

## 16. M9 — Actions and dApp flows

The reference contains legacy `xApps` paths but current dApp-oriented catalog/service/overlay behavior. Functional parity work must inventory:

- catalog/list/search/recent;
- Actions overlay entries;
- scan entry;
- browser navigation;
- disclaimer;
- permission/account-data exposure;
- safe shared-data/signing boundaries;
- unsupported backend/catalog/auth states.

Product naming and legacy source-path cleanup are not changed implicitly during this functional phase; any naming migration is a separate confirmed product decision.

Status: `QUEUED`.

## 17. M10 — Full functional parity and hardening

Audit matrix:

```text
Stellar source/reference
        ↕
Fresnica Android
        ↕
Fresnica iOS
```

Verify:

- every top-level product surface accounted for;
- full workflows rather than entry-only implementations;
- navigation/modal/overlay/picker behavior;
- locale/language switching and localized formatting;
- loading/empty/error/retry/disabled/success states;
- QR/scan/share/browser/permission flows;
- account/network switching boundaries;
- exact review/auth/sign/submit identity;
- biometric/passphrase consistency;
- accessibility/test IDs on critical actions;
- architecture/typecheck/tests/native gates;
- horizontal audit has no unexplained gaps.

Pixel-level visual matching is not a completion gate here; UI-F follows the Fresnica UI specification.

Status: `QUEUED`.

## 18. Development loop for each horizontal function

```text
Read reference function + all shared interaction dependencies
        ↓
Read current Fresnica feature + capability/runtime implementation
        ↓
Update horizontal audit / source-parity ledger
        ↓
Identify smallest reusable functional boundary
        ↓
Implement behavior through Fresnica capabilities
        ↓
Run typecheck + architecture guard + tests when executable
        ↓
Inspect cross-product impact
        ↓
Update audit status
        ↓
Local/device verification for the closed behavior
```

Do not create a second wallet implementation and do not expand a general abstraction without demonstrated reuse.

## 19. Definition of done during functional parity phase

A function may move to `COMPLETE` only when:

```text
reference source scope inventoried
AND target flow implemented
AND required states implemented
AND shared interactions integrated
AND locale/formatting integrated for visible copy/data
AND capability/security adaptations documented
AND no unexplained functional omissions
AND relevant tests updated
AND npm run check passes OR a concrete external execution blocker is recorded
AND local/device findings are resolved or explicitly accepted
```

Final Fresnica visual design-system adoption is intentionally outside this definition until UI-F begins.