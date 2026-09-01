# Fresnica Mobile Product Parity Roadmap

> Product reference: `luneShaoGM/Stellar` branch `stellar-migration`.
>
> Architecture/style authority: `docs/mobile-architecture-style-guide.md`.
>
> Runtime/security authority: current Fresnica source plus upstream Fresnica Application Capability contracts.

## Product target

The rewrite should reproduce the Stellar application's user-visible product structure while preserving the current Fresnica runtime/security architecture.

The intended top-level product shape is:

```text
Home | Events | Actions | XApps | Settings
```

The central Actions entry is an action surface, not an ordinary destination tab.

Core product families to preserve from the Stellar reference include:

- Onboarding and setup;
- account create/import/list/edit/switch;
- Home/account/assets;
- Send;
- Request/share/QR;
- Exchange/Swap;
- Events/transaction details;
- asset/trustline management;
- XApps/dApp entry points;
- Settings, Security, Network and Advanced screens;
- Review/Submit/Picker/Modal/Overlay interaction patterns.

## Theme scope decision

Theme customization is intentionally deferred. The rewrite establishes a semantic `AppTheme` contract and one canonical `defaultTheme`, but it does not add user-selectable themes, theme persistence, a theme settings UI or arbitrary custom-theme input yet.

The design must nevertheless preserve the future extension seam:

```text
feature/screen -> semantic theme contract -> active AppTheme
```

Feature code must not depend on raw colors or on a specific future theme source. A later theme-selection/customization stage should be able to change how the active `AppTheme` is resolved without rewriting product features.

## P0 — Architecture, style and parity baseline

**Goal:** stop product drift before more UI is added.

Deliverables:

- architecture/style guide committed and treated as rewrite baseline;
- screen/feature parity matrix: Stellar screen -> Fresnica feature -> required Capability -> status;
- typed route inventory for Home / Events / Actions / XApps / Settings and modal/overlay routes;
- identify reusable Stellar/Xaman visual primitives without importing old business/security implementation;
- incremental zero-dependency architecture/style guard wired into `npm run check`;
- add ESLint/Prettier/import-alias enforcement in a follow-up tooling commit only when npm can generate the lockfile normally; do not hand-author dependency lock data;
- establish migration rule: touched/new files follow the new standard; unrelated legacy files are not mass-reformatted;
- record current boundary debt explicitly instead of pretending target architecture is already globally true.

Acceptance:

- every next product PR can identify its reference screen, feature boundary and Capability dependencies before code is changed;
- new/reworked product scopes cannot silently import `platform` from a feature or SDK/Realm/native code from a Screen;
- existing validated Capability code is not destabilized solely to satisfy a new directory rule; boundary debt is reduced deliberately when the owning capability is touched.

## P1 — Design system and Product Shell

**Goal:** replace the temporary Fresnica product shell with the Stellar product information architecture.

Deliverables:

- semantic theme contract (`AppTheme`) and canonical `defaultTheme`;
- split theme implementation as real product needs appear (`colors`, `spacing`, `typography`, `radii`, later `shadows` when needed);
- compatibility facade for existing `palette / spacing / radius / typography` consumers while new/reworked UI moves to semantic theme fields;
- reusable Screen/Header/Button/ListRow/Modal/Overlay/BottomTab primitives as actually needed;
- five-entry bottom product navigation: Home / Events / Actions / XApps / Settings;
- central Actions interaction surface;
- typed navigation state that carries public/product-safe values only;
- preserve an explicit theme-resolution seam so alternate themes can be added later without coupling product features to theme storage/configuration.

Deferred from P1:

- user-selectable themes;
- theme customization settings;
- theme persistence/synchronization;
- arbitrary user-authored theme definitions;
- light/dark switching unless it becomes a separate explicitly prioritized product requirement.

Acceptance:

- first launch after onboarding presents the expected Stellar-like product shell;
- navigation state contains no mnemonic, passphrase, decrypted key material or transaction secret state;
- visual primitives use semantic theme tokens instead of raw colors/duplicated dimensions;
- product features do not need code changes when the active `AppTheme` source is extended later.

## P2 — Home and account/assets presentation

**Goal:** make the first visible wallet screen match the Stellar product structure.

Deliverables:

- Home header and network indicator/switch entry;
- current account display and account switch entry;
- Send / Swap / Request actions;
- assets/balance list;
- no-account state;
- inactive-account state;
- loading/error/refresh behavior;
- Add/Create/Import account entry points;
- existing Balance/Account/Trustline capabilities wired through feature controllers/view models.

Acceptance:

- no Screen reads Horizon/Realm/Native SDK directly;
- account switching invalidates stale reads;
- product state matches the selected account and network.

## P3 — Onboarding and account lifecycle parity

**Goal:** preserve Stellar onboarding/account UX while keeping Fresnica security authority.

Deliverables:

- onboarding landing/setup sequence;
- create account;
- import mnemonic/secret/watch-only flows as supported by current contracts;
- account list/switch/add/edit;
- protected reveal/export only through current Fresnica authorization boundaries;
- consistent empty/error/retry behavior.

Non-goal:

- do not reintroduce the donor Vault/crypto implementation as authority.

## P4 — Send / Review / Submit parity

**Goal:** rebuild Send as the Stellar-style multi-step product flow on top of the current normative Payment implementation.

Expected flow:

```text
asset -> amount -> destination -> memo/options -> review -> authorize -> submit -> result
```

Deliverables:

- feature-local state/controller rather than one large Screen;
- Stellar-like asset/destination/amount interactions;
- exact-XDR review presentation;
- shared auth/submission behavior;
- result states that distinguish submitted/rejected/uncertain/authorization-blocked/watch-only/unsupported signer cases.

Acceptance:

- displayed review is bound to the exact transaction being authorized and submitted;
- no floating-point amount policy is introduced in UI code.

## P5 — Events and transaction details

**Goal:** replace the temporary Activity UI with the Stellar Events product experience.

Deliverables:

- events list;
- loading/refresh/pagination/empty/error states;
- filtering when supported by the product reference and data layer;
- transaction/operation detail screen;
- existing History capability remains the data boundary.

## P6 — Assets and trustlines

**Goal:** align Home assets and asset-management interactions.

Deliverables:

- shared asset row/picker presentation where reuse is proven;
- Add Token / manage trustline product surface;
- token settings/details as applicable;
- exact existing Trustline capability semantics retained.

## P7 — Exchange / Swap presentation

**Goal:** restore the Stellar Exchange product experience without inventing Mobile-only swap semantics.

Can proceed before the shared Path Payment capability is normative:

- layout and interaction structure;
- source/destination asset selectors;
- amount editors;
- quote/loading/error presentation;
- review presentation skeleton;
- platform mechanism adapters already justified by current work.

Blocked semantic work remains blocked until the shared Fresnica Path Payment/Swap Application Capability defines quote identity/freshness, strict-send/receive semantics, slippage protection, trustline/capacity rules and exact review requirements.

## P8 — Request, share, pickers, modals and overlays

**Goal:** restore the interaction vocabulary that makes the Stellar product feel coherent.

Deliverables as required by migrated features:

- share account / QR;
- account picker;
- asset/currency picker;
- network switch;
- fee selector where supported;
- authentication presentation;
- alerts;
- transaction loader;
- common modal/overlay shell.

Reusable visual behavior belongs in `ui`; wallet/product-specific content remains feature-local.

## P9 — XApps / dApp

**Goal:** restore the first-class XApps product entry while preserving Fresnica authorization/security boundaries.

Deliverables:

- XApps tab/product shell;
- browser/connection surface as required;
- permission/disclaimer flows;
- explicit account exposure and signing request boundaries;
- disconnect/revoke behavior;
- compatibility bridge work only where it satisfies explicit product/security requirements.

## P10 — Settings, Security and Network

**Goal:** align the Stellar settings information architecture.

Deliverables:

- General;
- Security;
- Network;
- Advanced/developer-only surfaces where appropriate;
- account/security actions routed through current Fresnica Application Security and Native SDK boundaries.

## P11 — Product parity and hardening pass

**Goal:** verify product coherence rather than only feature existence.

For each critical flow compare:

```text
Stellar reference
      ↕
Fresnica Android
      ↕
Fresnica iOS
```

Verify:

- navigation hierarchy;
- screen/overlay/modal transitions;
- labels and action placement;
- spacing/theme/state consistency;
- loading/empty/error behavior;
- account/network switching behavior;
- exact review/auth/sign/submit identity;
- accessibility/test IDs where critical;
- typecheck/lint/tests/native gates.

## Parallel capability/security work

Product parity order does not delete the existing Capability roadmap. Independent normative/security/platform work may continue in parallel when it does not force product-specific semantics ahead of a shared contract.

In particular:

- Payment, History and Trustline capability work remains reusable under the new product UI;
- Path Payment/Swap semantics remain gated by the shared upstream contract;
- SDEX Offer Management remains a separate product/capability surface and is not automatically the next visible feature merely because a normative contract exists;
- production/release hardening remains independent of product parity when it is genuinely orthogonal.
