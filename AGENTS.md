# Fresnica Mobile Development Guardrails

All new or materially rewritten Mobile code must follow:

- `docs/mobile-architecture-style-guide.md`
- `docs/product-parity-roadmap.md`
- `docs/fresnica-mobile-stage-plan.md` for existing Capability/security execution history and gates

## Authority order

- Product layout, navigation, screen hierarchy and user-visible interaction reference: `luneShaoGM/Stellar` branch `stellar-migration`.
- Engineering/package/style reference: `XRPL-Labs/Xaman-App`, adapted rather than copied.
- Ledger/security/business authority: current Fresnica source plus upstream Fresnica Application Capability contracts and SDK/Core.

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

- The current rewrite ships one canonical `defaultTheme` behind a semantic `AppTheme` contract.
- User-selectable/custom themes, theme persistence and theme settings are deferred.
- New/reworked product UI must depend on semantic theme values, not raw color literals or assumptions about where the active theme will eventually be stored/resolved.
- Do not add theme configurability until it is an explicit product stage; preserve the seam without speculative settings/state infrastructure.

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
