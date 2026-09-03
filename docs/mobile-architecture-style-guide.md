# Fresnica Mobile Architecture and Style Guide

> Status: architecture baseline for the ongoing Fresnica Mobile rewrite.
>
> Product shell, naming, foundation order, and rewrite-not-copy rules: `docs/stellar-product-information-architecture.md`.
>
> This document defines layer boundaries and code style. Git/source/tests/CI and upstream Fresnica Application Capability contracts remain the implementation facts.

## 1. Source responsibilities

Fresnica Mobile deliberately uses three references with different authority:

| Source | Authority | What to reuse | What not to inherit automatically |
| --- | --- | --- | --- |
| `origin/fresnica` (current Mobile + Core contracts) | Runtime architecture and current implementation | Application Capability boundaries, platform adapters, Realm persistence, exact-XDR review/sign/submit pipeline, Fresnica Native SDK integration | Current temporary product shell or placeholder visual design |
| `origin/Stellar` (`stellar-migration`) | Product-idea reference only | Screen hierarchy, navigation roles, layout, user-visible states, feature entry points, transaction flow rhythm | Source files, services, vault/security, RNN boot. Visible names are Home / Activity / Actions / dApps / Settings |
| `origin/Xaman-App` | Engineering-idea reference | Component packaging, co-located styles, theme tokens, test organization, import aliases, style/lint discipline | XRPL-specific behavior, large global `services/`, singleton `StyleService`/`Navigator`, PIN/Secret Number |

The rule is:

```text
Stellar product behavior and appearance
              ↓
Fresnica feature/presentation layer
              ↓
Fresnica Application Capabilities
              ↓
Platform adapters
              ↓
Fresnica Native SDK / Stellar SDK / Realm / OS
```

A donor implementation can explain intent but never overrides a Fresnica Normative Application Capability or security boundary.

## 2. Architectural goals

The structure must make these properties obvious in code:

1. Product screens can be replaced or restyled without rewriting ledger/security logic.
2. Application Capabilities do not depend on React Native, Realm, NativeModules, Horizon client classes or concrete Fresnica SDK bindings.
3. Feature UI does not call Stellar SDK, Realm, NativeModules or generated Fresnica bindings directly.
4. Platform adapters implement the mechanisms required by Capabilities; they do not invent product policy.
5. Review, authorization, signing and submission remain bound to the exact transaction/XDR identity.
6. Shared UI is visual and reusable; feature-specific product components stay with their feature.
7. Cross-feature reuse is promoted only after the abstraction is stable. `common`/`shared` must not become a dumping ground.
8. New code follows one enforced project style. Existing code migrates when touched instead of being reformatted in one unrelated change.

## 3. Target source tree

The existing top-level Fresnica split is retained because it already expresses the important runtime boundaries. Xaman conventions are applied inside those boundaries rather than replacing them with a flat `services/` architecture.

```text
src/
├── app/
│   ├── App.tsx
│   ├── bootstrap/
│   │   ├── installRuntimePolyfills.ts
│   │   └── createAppRuntime.ts
│   ├── config/
│   ├── navigation/        # React Navigation; OverlayHost lives here / in App composition
│   │   ├── routes.ts
│   │   └── components/
│   └── providers/
│
├── capabilities/
│   ├── account/
│   ├── application-security/
│   ├── balance/
│   ├── history/
│   ├── ledger-authorization/
│   ├── payment/
│   ├── signer/
│   ├── signing/
│   ├── transaction/
│   └── trustline/
│
├── features/
│   ├── onboarding/
│   ├── accounts/
│   ├── home/
│   ├── send/
│   ├── request/
│   ├── exchange/
│   ├── activity/          # currently src/features/history
│   ├── assets/            # currently src/features/trustlines
│   ├── dapps/             # currently src/features/xapps
│   └── settings/
│
├── platform/
│   ├── fresnica/
│   ├── persistence/
│   ├── stellar/
│   └── system/
│
├── ui/
│   ├── components/
│   │   ├── Button/
│   │   ├── Header/
│   │   ├── Screen/
│   │   ├── ListRow/
│   │   ├── Modal/
│   │   └── ...
│   ├── icons/
│   └── theme/
│       ├── colors.ts
│       ├── spacing.ts
│       ├── typography.ts
│       ├── radii.ts
│       ├── shadows.ts
│       └── index.ts
│
└── lib/
    ├── errors/
    ├── formatting/
    ├── result/
    └── validation/
```

Directories are created only when there is real content for them. The target tree is a boundary map, not a requirement to add empty folders.

### Why this differs from Xaman

Xaman's top-level `screens / components / services / store / theme` structure is effective for discovering a mature UI, but its large global services allow many unrelated screens to reach the same mutable singletons. Fresnica already has a stronger `capabilities / platform` separation. We therefore reuse Xaman's packaging discipline without introducing a new flat global `services/` layer.

Stellar is an Xaman fork. It is a product-idea reference only. Do not copy Stellar screens, services, or navigation boot. Product shell names are recorded in `docs/stellar-product-information-architecture.md`.

### Why this differs from the current Fresnica product shell

The current `features/*` and `ui/*` split is directionally correct, but many feature screens are still flat files and the UI kit is intentionally minimal. Product parity requires richer feature-local components and a real theme/component system, not direct growth of large Screen files.

## 4. Dependency direction

Allowed dependencies are intentionally one-way:

```text
app ───────────────► features
 │                    │
 │                    ├────────► capabilities
 │                    ├────────► ui
 │                    └────────► lib
 │
 ├─────────────────► platform ─────────► capabilities
 ├─────────────────► capabilities ─────► lib
 └─────────────────► ui ───────────────► lib
```

Forbidden examples:

- `features/**` importing `@stellar/stellar-sdk`, `realm`, `NativeModules` or `platform/**`;
- `capabilities/**` importing React, React Native, Realm, a concrete Horizon server or generated Fresnica bindings;
- `ui/**` importing feature, capability or platform code;
- `platform/**` importing Screen/components or product navigation state;
- a feature reaching another feature's internal file instead of an explicit public export.

`app` is the composition root and may wire concrete platform implementations to capability/feature dependencies.

These boundaries should ultimately be enforced through ESLint `no-restricted-imports` overrides rather than relying only on review discipline.

## 5. Feature package convention

Stellar decides which product features/screens exist. Each Fresnica feature owns its presentation and flow orchestration.

A substantial feature uses this shape:

```text
features/send/
├── screens/
│   ├── SendScreen/
│   │   ├── SendScreen.tsx
│   │   ├── styles.ts
│   │   └── index.ts
│   ├── SendReviewScreen/
│   └── SendResultScreen/
├── components/
│   ├── AssetPicker/
│   ├── PaymentDetailsForm/
│   └── ReviewSummary/
├── state/
│   ├── sendFlow.ts
│   ├── sendState.ts
│   └── useSendController.ts
├── model/
│   ├── types.ts
│   └── paymentReviewViewModel.ts
├── __tests__/
└── index.ts
```

Small features start smaller. Do not create every subdirectory until there is more than one meaningful concern.

### Screen responsibilities

A Screen may:

- render layout;
- bind a controller/view model to visual components;
- translate user gestures into explicit feature actions;
- choose loading/empty/error/success views.

A Screen must not:

- construct Stellar SDK transactions;
- evaluate reserve/liability/auth policy;
- read/write Realm directly;
- call native SDK bindings directly;
- parse raw Horizon responses;
- contain signing/security policy.

### State/controller responsibilities

Feature state is explicit product flow state, not a loose collection of booleans.

Prefer discriminated unions:

```ts
type SendState =
  | {status: 'editing'; draft: SendDraft}
  | {status: 'preparing'; draft: SendDraft}
  | {status: 'reviewing'; review: PaymentReviewViewModel}
  | {status: 'authorizing'; review: PaymentReviewViewModel}
  | {status: 'submitting'; review: PaymentReviewViewModel}
  | {status: 'succeeded'; result: PaymentResultViewModel}
  | {status: 'failed'; error: SendPresentationError};
```

Do not model mutually exclusive states with independent `isLoading`, `isReviewing`, `isSubmitting`, `isSuccess` flags.

## 6. Capability convention

The existing capability-oriented design remains the application/business boundary.

Capability folders should favor small intention-revealing functions and explicit contracts over large stateful service classes. Current patterns such as `preparePayment`, `buildPaymentReview` and `submitReviewedPayment` are preferable to recreating an Xaman-style `PaymentService` singleton.

Rules:

- amounts remain exact strings/integers according to the shared contract; no JavaScript floating-point business arithmetic;
- input/output types are stable application types, not third-party SDK objects;
- platform errors are translated before they reach presentation code;
- security-sensitive operations fail closed;
- review data is derived from or validated against exact transaction identity where required by the shared capability;
- capability tests cover normative and failure semantics independently of React Native.

## 7. Platform convention

`platform/` owns concrete mechanisms:

- `platform/stellar`: Horizon/Stellar SDK transport, XDR construction/decoding mechanisms and network-specific adapters;
- `platform/fresnica`: generated/native Fresnica SDK boundary and adapter-facing code;
- `platform/persistence`: Realm schema, migrations and repository implementations;
- `platform/system`: OS mechanisms such as lifecycle, clipboard, secure-screen primitives or device capabilities when needed.

Platform code may expose interfaces required by capabilities but must not decide product workflow, UX, slippage policy, authorization policy or review wording.

## 8. UI system convention

Xaman's `General` component packaging is retained in spirit: a reusable visual component is a directory with its implementation, styles and public export.

```text
ui/components/Button/
├── Button.tsx
├── styles.ts
├── types.ts       # only when types are non-trivial/reused
├── Button.test.tsx
└── index.ts
```

### Shared UI versus feature component

Place a component in `ui/components` only when all are true:

1. it is product-domain agnostic;
2. it can render without a Capability or feature controller;
3. its props describe presentation, not wallet business operations;
4. at least two product contexts can reasonably reuse it, or it is an intentional design-system primitive.

Otherwise keep it under `features/<feature>/components`.

Do not create a global `Modules` bucket that accumulates feature-specific business components.

## 9. Theme and styling

The current one-file theme will be split into explicit semantic tokens as the Stellar UI is rebuilt.

### Theme tokens

Use semantic names:

```ts
colors.background
colors.surface
colors.surfaceElevated
colors.textPrimary
colors.textSecondary
colors.border
colors.actionPrimary
colors.actionPrimaryPressed
colors.positive
colors.negative
```

Avoid visual implementation names such as `blue`, `darkGreyButton` or `redText` in component APIs/styles.

### Style rules

- Static React Native styles live in `styles.ts` next to the Screen/component.
- No raw color literals outside `ui/theme/colors.ts`.
- No repeated arbitrary spacing values when an existing spacing token expresses the intent.
- Dynamic values may be passed through style arrays/helpers, but colors/spacing/typography still come from theme tokens.
- Prefer semantic style names (`header`, `accountName`, `selectedTab`) over visual names (`blueText`, `leftBox`).
- Keep style construction out of render loops.
- Screen layout should reuse standard `Screen`, header, section, list-row, modal/overlay and bottom-action primitives where appropriate.
- Light/dark mode should use an explicit Theme/provider model rather than a mutable global StyleService singleton.

The Stellar/Xaman visual values are a donor reference. Fresnica theme tokens become the canonical implementation source once parity is established.

## 10. TypeScript and declaration style

### Formatting baseline

To avoid a repository-wide formatting-only migration while still establishing one standard:

- indentation: 2 spaces;
- print width: 120;
- quotes: single;
- semicolons: required;
- trailing commas: all supported multiline positions;
- bracket spacing: enabled;
- one final newline;
- formatting handled by Prettier, not hand-aligned whitespace.

Xaman uses strong formatting/lint enforcement but a 4-space historical style. Fresnica keeps its current 2-space direction and adopts the enforcement, not the historical indentation.

### Variables

- `const` by default;
- `let` only when reassignment is required;
- never `var`;
- avoid mutable module-level state;
- prefer early returns to deeply nested control flow;
- do not reuse one variable for multiple semantic meanings;
- do not use `any`; accept `unknown` at untrusted boundaries and narrow it;
- avoid non-null assertions unless the invariant is proven immediately and documented by code structure.

### Naming

| Element | Convention | Example |
| --- | --- | --- |
| React component / Screen | PascalCase | `HomeScreen`, `AccountSwitcher` |
| Component directory | PascalCase | `components/AccountSwitcher/` |
| Feature/capability directory | lower kebab-case | `application-security/` |
| Functions/variables | camelCase | `preparePayment`, `selectedAsset` |
| Hook | `use` + PascalCase subject | `useSendController` |
| Boolean | `is/has/can/should` prefix | `isSubmitting`, `hasTrustline`, `canSend` |
| Event prop | `on` prefix | `onSelectAsset` |
| Internal event handler | `handle` prefix | `handleSelectAsset` |
| Type/interface | PascalCase, no `I` prefix | `PaymentReview`, `StellarGateway` |
| True module constant | UPPER_SNAKE_CASE | `MAX_MEMO_BYTES` |
| Route ID | typed PascalCase member | `AppRoute.Home` |
| Error code | stable UPPER_SNAKE_CASE string | `INSUFFICIENT_BALANCE` |

Avoid abbreviations unless they are established protocol/project vocabulary (`id`, `url`, `xdr`, `sdk`, `api`, `ui`).

### `type` versus `interface`

- use `interface` primarily for injectable behavior contracts/gateways that implementations satisfy;
- use `type` for props, data records, unions, mapped types and flow state;
- do not prefix interfaces with `I`.

### Functions and classes

- React presentation code uses functional components/hooks for new code;
- pure capability/application functions are preferred when state is not required;
- classes are appropriate for stateful adapters/repositories when lifecycle or dependency ownership makes that clearer;
- do not recreate large singleton service classes solely to mirror Xaman.

## 11. Imports and exports

Use project aliases once the tooling foundation is added:

```text
@app/*
@capabilities/*
@features/*
@platform/*
@ui/*
@lib/*
```

Import order:

1. React / React Native;
2. third-party packages;
3. project aliases;
4. same-module relative imports.

Separate groups with one blank line. Use `import type` for type-only dependencies.

Prefer named exports for application code. A local `index.ts` may expose a component/feature's public surface, but avoid giant root barrel files that create hidden cycles.

## 12. Errors and boundary translation

Raw third-party errors must not leak directly into user-facing state.

```text
Horizon / Stellar SDK / Native / Realm error
                    ↓
          platform/capability mapping
                    ↓
         stable application error
                    ↓
        feature presentation error
                    ↓
                    UI
```

Stable application errors should use typed codes/data, not SDK message substring matching in Screens.

Security/transaction flows remain fail-closed. Unknown or malformed ledger/security state blocks the sensitive action instead of guessing a safe continuation.

## 13. Persistence convention

Xaman's `models / repositories / storage` separation is useful and should be retained conceptually under `platform/persistence`.

- Realm schemas/models describe persistence representation;
- repositories expose explicit persistence operations;
- feature Screens do not query Realm;
- capability/application types do not become Realm objects by accident;
- migrations are explicit and tested;
- sensitive material follows Fresnica security constraints and is never persisted merely for UI convenience.

## 14. Testing convention

Tests stay close to the layer they validate:

- `capabilities/**/__tests__`: normative semantics, exact amounts, failure behavior;
- `platform/**/__tests__`: adapter normalization, malformed external data, XDR/transport mechanics;
- `features/**/__tests__`: state transitions, view-model mapping and navigation decisions;
- UI component tests: visual behavior/interaction contracts where valuable;
- native integration gates: Fresnica adapter/SDK compatibility and real runtime integration.

Do not replace executable validation with documentation assertions.

## 15. Automated style and architecture enforcement

Before substantial P1/P2 UI migration, the repository should add a tooling-foundation change that introduces compatible versions of Prettier, ESLint, React/React Native lint plugins and import resolution.

Required checks should include at least:

- formatting check;
- TypeScript typecheck;
- ESLint;
- Jest;
- existing Realm/native gates where applicable.

Target rules include:

- unused variables/imports are errors;
- `prefer-const` / no `var`;
- type-only import consistency;
- no focused tests;
- no unused React Native styles;
- no raw color literals in Screen/component styles;
- static inline styles rejected or narrowly excepted for genuine dynamic values;
- project import ordering;
- folder-specific restricted imports to enforce the dependency graph.

Do not run a whole-repository auto-format in an unrelated feature PR. Add enforcement, then migrate existing files as they are touched or in a dedicated formatting-only change with no behavior changes.

## 16. Migration strategy

This architecture is adopted incrementally:

1. record product parity and architecture mapping;
2. add lint/format/import-boundary tooling without changing product behavior;
3. establish the theme and reusable UI primitives while rebuilding Product Shell/Home;
4. migrate each Stellar-referenced feature into the new feature package convention;
5. move repeated feature-local visual patterns into `ui/components` only after proven reuse;
6. leave stable Capability/platform implementation in place unless the feature work exposes a real boundary problem;
7. do not mix broad legacy cleanup into product-parity PRs.

The desired end state is architectural consistency, not a big-bang directory rename.

## 17. Definition of done for rewritten product work

A rewritten feature is complete only when all applicable items are true:

- user-visible structure/behavior matches the intended Stellar product reference;
- ledger/security semantics follow current Fresnica Application Capability contracts;
- Screen code does not cross platform/security boundaries;
- feature state is explicit and invalid transitions fail closed;
- reusable presentation is correctly encapsulated;
- naming/types/styles follow this guide;
- new static styling contains no raw color literals/duplicated design constants;
- relevant unit/state/navigation tests exist;
- typecheck/lint/tests execute successfully, or an external gate is explicitly recorded as externally blocked;
- Android/iOS runtime behavior is validated when the change affects native/runtime integration.
