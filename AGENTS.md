# Fresnica Mobile Development Guardrails

All new or materially rewritten Mobile code must follow:

- `docs/stellar-product-information-architecture.md` — rewrite guide (maturity table is the start gate; product tables and §8/§9 are definition of done)
- `docs/mobile-architecture-style-guide.md` — layer, style, and packaging rules
- `docs/fresnica-mobile-rewrite-execution-plan.md` — current construction order, status ledger, provenance and release sequencing
- `docs/product-traceability-ledger.md` and `docs/provenance/README.md` — stable product IDs, stage/acceptance mapping and clean-room source gate
- `docs/mobile-capability-status.md` and `docs/fresnica-mobile-stage-plan.md` — Capability/security evidence and historical upstream gates

Historical inventories (ignore tab names, shell diagrams, and rewrite order when they conflict): `docs/product-parity-roadmap.md`, `docs/product-parity-matrix.md`, `docs/product-structure.md`, `docs/fresnica-mobile-handoff.md`, `docs/stellar-rewrite-milestones.md`, `docs/stellar-source-parity.md`, `docs/stellar-horizontal-parity-audit.md`, `docs/product-donor-map.md`.

## Authority order

- Product ideas (shell, flows, interaction roles): `origin/Stellar@stellar-migration`, recorded in `docs/stellar-product-information-architecture.md`. User-visible names are `Home | Activity | Actions | dApps | Settings`. Stellar was forked from Xaman and its later dApp work was built inside that derivative tree; do not copy Stellar or Xaman source. Preserve behavior through clean-room rewrite in Fresnica layers. A directly migrated file requires file-level provenance proving independent Fresnica ownership plus an explicit approval record. Vault/encryption may be referenced only as behavior/role input. Older product-structure/parity/handoff tab claims are historical where they conflict.
- Engineering packaging ideas: `origin/Xaman-App` (component directories, theme tokens, lint/aliases), adapted rather than copied. Do not copy `Navigator` / `NavigationService` / `StyleService` / global `services/`. Navigation library is React Navigation (`docs/stellar-product-information-architecture.md` maturity table 2b / §5). Do not add Wix RNN. Developer Mode from Xaman/Stellar is in scope.
- Ledger/security/business authority: `origin/fresnica` Application Capability/SDK/Core contracts plus current Mobile source. Hardware signers are a rewrite requirement, not residue. Current Mobile screens are scaffolding, not product-complete.

Application semantics live in `capabilities/`. Do not add a global `src/services` layer.

## Product migration rule

Before materially rewriting a product surface, first check the maturity table at the top of `docs/stellar-product-information-architecture.md`. Phase 0 is passed. Do not treat F4 rebuilds as consuming the theme shell until table row 2c (F3) is done. Then identify the row in §7 (including §7.8). Cross-cutting chrome/runtime uses §14; data kinds use §2.1. State:

- maturity Phase and status;
- Stellar reference surface or engineering role;
- Fresnica feature owner;
- required Capability/runtime boundary;
- decision (`Adopt`, `Adapt`, `Exclude`);
- F-alias only as a nickname (F0–F4), not as a separate queue;
- strict architecture scope added or extended by the PR.
- product traceability ID, delivery/acceptance mapping and clean-room/provenance classification from `docs/product-traceability-ledger.md` and `docs/provenance/README.md`.

PRs must satisfy the guide's three gates: vertical slice, one transaction pipeline, closed-loop progress (not page count). Completeness outranks construction speed.

A donor screen is not automatically a Fresnica requirement. `Exclude` surfaces must not be implemented unless a current product/capability requirement explicitly promotes them. A concern missing from §7 / §14 / §2.1 must be added to the guide before it is implemented.

Stage 0A also applies to the **current target tree**, not only to new diffs. `npm run provenance:check` compares every tracked or non-ignored target file against the fixed Stellar/Xaman donor blob index and fails on exact matches by default. Any exception must be bound to one path, one content hash, a named third-party source/version and its license. Passing the automatic collision gate does not prove clean-room authorship; materially rewritten donor-informed surfaces still require behavior-spec and human implementation-structure review.

## Architecture migration rule

The dependency model below is the target for all new and materially rewritten code. Some already validated Capability code still imports concrete Stellar/platform mechanisms; that is explicit migration debt, not permission to add more coupling.

- Do not mass-refactor validated capability/security code only to make the directory graph look cleaner.
- Reduce an existing boundary exception when the owning capability is deliberately touched and can be revalidated.
- New product scopes are added to `scripts/check-architecture.mjs` strict enforcement as they are introduced or materially rewritten.
- Never weaken a Fresnica security or exact-transaction invariant merely to satisfy a presentation-layer refactor.

## Non-negotiable boundaries for new/reworked code

- `features/**` must not import concrete platform adapters, Realm, NativeModules or Stellar SDK.
- `capabilities/**` must not depend on React/React Native, Realm, NativeModules or presentation code. Existing concrete platform/SDK dependencies are transitional debt to remove deliberately, not extend.
- `ui/**` is presentation-only and must not depend on features/capabilities/platform.
- `platform/**` owns external/native/persistence mechanisms and must not own product workflow policy.
- `app/**` is the composition/navigation/bootstrap layer that wires dependencies.
- Exact transaction/XDR identity must remain bound across review, authorization, signing and submission where required.
- Sensitive material must not be placed in navigation state or ordinary persistence for UI convenience.

## Theme scope

- Product UI depends on semantic `AppTheme` tokens, not raw color literals.
- The visual kit and component list are not frozen; do not treat current `defaultTheme` as the finished kit.
- Custom themes are in scope: a user may upload an image; the app extracts primary, secondary, and related colors and applies them app-wide through `AppTheme`.
- Preserve the seam so a generated palette can replace the active theme without rewriting feature screens.
- Theme persistence belongs with Settings when that surface is built; do not invent a second theme system inside a feature.

## Development style

- Keep changes surgical and tied to one product goal.
- Use 2-space Prettier-style TypeScript formatting, single quotes, semicolons and trailing commas.
- `const` by default; no `var`; no `any` in new code.
- New React code uses functional components/hooks.
- Static React Native styles are co-located in `styles.ts`; raw colors belong only in theme tokens.
- Prefer named exports and type-only imports.
- Use typed/discriminated flow state instead of mutually exclusive boolean flags.
- Reusable visual primitives belong in `ui/components`; wallet-specific components remain inside their feature until reuse is proven.
- Do not introduce a flat global singleton `services/` layer to mirror Xaman.
- Do not mass-format unrelated existing code inside a feature PR. Migrate touched files or use a dedicated formatting-only PR.

## Validation

- `npm run check` includes the incremental architecture/style guard and the fixed-snapshot Stage 0A target-tree donor collision/marker gate.
- ESLint/Prettier/import-alias tooling should be added only with a normally generated npm lockfile; never hand-author dependency lock data.
- A product rewrite is not complete until relevant typecheck/lint/tests execute successfully, or an external CI/runtime blocker is recorded explicitly.
- `steps:null` or other pre-execution CI failures are not a pass.
