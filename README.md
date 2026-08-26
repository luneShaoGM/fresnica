# Fresnica

Stellar-native mobile wallet.

This repository is the new Fresnica application. It is being rebuilt from a clean architecture rather than continuing the previous `Stellar` codebase.

## Current development branch

`feat/fresnica-mobile-v1`

The first milestone is Testnet-first and Fresnica-SDK-first. Current verified foundation includes:

- React Native 0.87 project metadata;
- immutable Stellar Testnet configuration;
- separate Account / Signer domain records with derived watch-only semantics;
- shared-signer-safe account lifecycle rules;
- Fresnica Native SDK 0.2.1 compatibility pin with React Native adapter source 0.2.0;
- a narrow React Native bridge that exposes only Fresnica SDK high-level wallet/security operations;
- Stellar SDK 17.0.1 Testnet gateway for public chain state, unsigned payment construction and submission;
- on-chain signer/threshold resolution before signing;
- exact-XDR payment review derived from the transaction that will actually be signed;
- one shared transaction signing coordinator that automatically uses Native SDK System Auth when registered and otherwise requires the Fresnica app passcode;
- reviewed-payment execution that revalidates ledger authorization, signs through Fresnica Native SDK, then submits the resulting signed XDR.

## Security boundary

Fresnica Mobile does not implement wallet cryptography.

Fresnica Core / SDK owns secret and mnemonic validation, derivation, protected-envelope semantics, identity checks and transaction signing. Mobile owns React Native UI, Realm persistence, Horizon/network orchestration and product policy.

`WalletUnlockKey`, biometric cipher state, raw private keys and low-level signing APIs must not enter normal JavaScript application code. Routine software signing uses the Native SDK high-level `signWithSystemAuth` or `signWithPasscode` operations.

The upstream integration contract is `manran/fresnica/docs/mobile-sdk-usage.md`. Local project rules are summarized in `docs/fresnica-mobile-handoff.md`.

## Next integration gate

The next native milestone is to generate the full RN 0.87 Android/iOS consumer projects, link Native SDK 0.2.1, build the canonical RN adapter once in the real consumer toolchain, and prove `FresnicaCore.parseAccount` on both platforms before deeper Realm/onboarding UI integration.
