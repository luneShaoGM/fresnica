# Fresnica Mobile Capability Status

This file records the current Mobile implementation evidence against the shared Fresnica Application Capability vocabulary. Maturity labels come from upstream `manran/fresnica/docs/application-capabilities.md`; they describe the shared specification, not Mobile implementation quality.

## Compatibility baseline

```text
Fresnica Native SDK       0.2.1
Native Binding API        2
Universal SDK API         3
Core Client API           3
RN adapter source         0.2.0
React Native              0.87.0
Network                   Stellar Testnet
```

## Capability matrix

| Application Capability | Upstream maturity | Mobile status | Current evidence / scope |
| --- | --- | --- | --- |
| Account | Normative | Foundation implemented | `src/capabilities/account`: account records, account-signer relation invariants, watch-only derived from signer applicability. |
| Signer | Normative | Foundation implemented | `src/capabilities/signer`: signer identity/kind/lifecycle types. Protected-envelope cryptography remains SDK/Core-owned. |
| Payment | Normative | Foundation implemented | `src/capabilities/payment`: exact-XDR single-payment review and reviewed-payment orchestration on Testnet. UI Flow is not implemented yet. |
| Transaction | Normative | Foundation implemented | `src/capabilities/transaction`: reviewed-transaction identity, freshness guard and normalized submission semantics. |
| Ledger Authorization | Defined | Classic foundation implemented | `src/capabilities/ledger-authorization`: typed Classic signer conditions and threshold resolution for locally available Ed25519 signers. Hash-X, signed-payload invocation, external-provider authorization and full multisig coordination are not implemented. |
| Signing Coordination | Normative | Foundation implemented | `src/capabilities/signing`: shared routine signing policy using Native SDK System Auth when registered, otherwise explicit app-passcode path. Exact reviewed XDR is preserved. |
| Application Security | Defined | Partial platform integration | Native SDK/System Auth operations are available through `src/platform/fresnica`; broader application lock/session/passcode-change product flows are not yet implemented. |
| Network / Gateway | Defined | Platform mechanism implemented | `src/platform/stellar`: Horizon account authorization loading, payment construction and transaction submission. This is platform mechanism, not a replacement for Capability semantics. |

Other upstream capabilities are not claimed as implemented by this rebaseline.

## Conformance / regression evidence

The current TypeScript/Jest suite verifies, among other cases:

- Account and Signer remain separate concepts;
- watch-only changes with applicable local signer relationships;
- shared signer lifecycle does not delete a signer still used by another account;
- non-Ed25519 ledger signer conditions are not treated as invokable local software signers;
- exact Payment review is derived from the exact unsigned XDR;
- unsupported/incomplete Payment reviews fail closed;
- explicit transaction max-time is checked immediately before execution;
- Signing Coordination preserves the exact reviewed XDR and centralizes System Auth/passcode policy;
- ledger authorization is refreshed before signing;
- expired reviewed transactions are blocked before authorization/signing work;
- submission distinguishes accepted, deterministic rejected and uncertain outcomes;
- Mobile-facing Fresnica adapter does not expose low-level unlock-key/raw-signing operations;
- the Native runtime module key remains `FresnicaCore`.

## Platform mechanisms

These are intentionally local implementation choices rather than cross-project Capability contracts:

```text
src/platform/fresnica
  React Native -> Fresnica Native SDK integration

src/platform/stellar
  @stellar/stellar-sdk / Horizon mechanisms

src/platform/persistence
  repository implementations; currently in-memory foundation only
```

Future Realm persistence belongs under the persistence platform boundary. It must preserve Account/Signer Capability invariants rather than redefining them.

## Not yet implemented by this rebaseline

- product screens/navigation/Application Flows;
- Realm production persistence/migrations;
- onboarding and signer provisioning screens;
- Portfolio/Balance product implementation;
- Trustline Flow;
- Swap/SDEX Flow;
- History/Activity UI;
- Reveal/Export UI;
- global app-passcode rotation orchestration;
- full multisig coordination;
- hardware/external signer provider integration;
- Mainnet enablement.

## Contribution rule

When Mobile behavior provides useful evidence for a `Defined` upstream Capability, contribute that evidence back to the shared capability documentation without promoting Mobile-specific directory structure, framework choices or platform mechanics into the shared contract.
