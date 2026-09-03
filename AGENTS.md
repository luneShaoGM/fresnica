# Fresnica Mobile Development Guardrails

All new or materially rewritten Mobile code must follow:

- `docs/stellar-product-information-architecture.md` — rewrite guide (product shell, naming, foundation order, definition of done)
- `docs/mobile-architecture-style-guide.md` — layer, style, and packaging rules
- `docs/mobile-capability-status.md` and `docs/fresnica-mobile-stage-plan.md` — Capability/security evidence and upstream gates

Historical inventories (ignore tab names, shell diagrams, and rewrite order when they conflict): `docs/product-parity-roadmap.md`, `docs/product-parity-matrix.md`, `docs/product-structure.md`, `docs/fresnica-mobile-handoff.md`, `docs/stellar-rewrite-milestones.md`, `docs/stellar-source-parity.md`, `docs/stellar-horizontal-parity-audit.md`, `docs/product-donor-map.md`.

## Authority order

- Product ideas (shell, flows, interaction roles): `origin/Stellar@stellar-migration`, recorded in `docs/stellar-product-information-architecture.md`. User-visible names are `Home | Activity | Actions | dApps | Settings`. Stellar was forked from Xaman; do not copy Stellar or Xaman source **except Stellar-owned dApp** (catalog, browser, Freighter bridge, permission), which is ported into Fresnica layers. Vault/encryption may be referenced. Older product-structure/parity/handoff tab claims are historical where they conflict.
- Engineering packaging ideas: `origin/Xaman-App` (component directories, theme tokens, lint/aliases), adapted rather than copied. Do not copy `Navigator` / `NavigationService` / `StyleService` / global `services/`. Navigation library is React Navigation (`docs/stellar-product-information-architecture.md` §5–§6 F0). Do not add Wix RNN. Developer Mode from Xaman/Stellar is in scope.
- Ledger/security/business authority: `origin/fresnica` Application Capability/SDK/Core contracts plus current Mobile source. Hardware signers are a rewrite requirement, not residue. Current Mobile screens are scaffolding, not product-complete.

Application semantics live in `capabilities/`. Do not add a global `src/services` layer.

## Product migration rule

Before materially rewriting a product surface, identify its row in `docs/stellar-product-information-architecture.md` §7 and state:

- Stellar reference surface;
- Fresnica feature owner;
- required Capability/runtime boundary;
- decision (`Adopt`, `Adapt`, `Exclude`);
- foundation stage (`F0`–`F4`) or F4 surface from that guide;
- strict architecture scope added or extended by the PR.

A donor screen is not automatically a Fresnica requirement. `Exclude` surfaces must not be implemented unless a current product/capability requirement explicitly promotes them.

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

- `npm run check` includes the incremental architecture/style guard.
- ESLint/Prettier/import-alias tooling should be added only with a normally generated npm lockfile; never hand-author dependency lock data.
- A product rewrite is not complete until relevant typecheck/lint/tests execute successfully, or an external CI/runtime blocker is recorded explicitly.
- `steps:null` or other pre-execution CI failures are not a pass.
