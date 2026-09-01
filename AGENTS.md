# Fresnica Mobile Development Guardrails

All new or materially rewritten Mobile code must follow:

- `docs/mobile-architecture-style-guide.md`
- `docs/product-parity-roadmap.md`
- `docs/fresnica-mobile-stage-plan.md` for existing Capability/security execution history and gates

## Authority order

- Product layout, navigation, screen hierarchy and user-visible interaction reference: `luneShaoGM/Stellar` branch `stellar-migration`.
- Engineering/package/style reference: `XRPL-Labs/Xaman-App`, adapted rather than copied.
- Ledger/security/business authority: current Fresnica source plus upstream Fresnica Application Capability contracts and SDK/Core.

## Non-negotiable boundaries

- `features/**` must not import concrete platform adapters, Realm, NativeModules or Stellar SDK.
- `capabilities/**` must not depend on React/React Native, Realm, NativeModules or concrete platform implementations.
- `ui/**` is presentation-only and must not depend on features/capabilities/platform.
- `platform/**` owns external/native/persistence mechanisms and must not own product workflow policy.
- `app/**` is the composition/navigation/bootstrap layer that wires dependencies.
- Exact transaction/XDR identity must remain bound across review, authorization, signing and submission where required.
- Sensitive material must not be placed in navigation state or ordinary persistence for UI convenience.

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

A product rewrite is not complete until relevant typecheck/lint/tests execute successfully, or an external CI/runtime blocker is recorded explicitly. `steps:null` or other pre-execution CI failures are not a pass.
