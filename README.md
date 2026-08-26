# Fresnica

Stellar-native mobile wallet.

This repository is the new Fresnica application. It is being rebuilt from a clean architecture rather than continuing the previous `Stellar` codebase.

## Current development branch

`feat/fresnica-mobile-v1`

The first milestone is Testnet-first and Core-first. Current foundation work defines:

- React Native 0.87 project metadata;
- immutable Stellar Testnet configuration;
- separate Account / Signer domain records;
- derived watch-only semantics;
- shared-signer-safe account lifecycle rules;
- a narrow TypeScript boundary for the Fresnica Native SDK / Rust Core.

Native SDK integration, Realm persistence, onboarding UI and transaction flows follow after the pure TypeScript foundation is verified in a runnable React Native workspace.
