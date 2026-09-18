# S01 Existing-wallet Add Account behavior

Status: frozen for Stage 4 implementation on 2026-09-16.

This is a clean-room product behavior specification. It is derived from Fresnica Account/Signer/Application Security contracts and the approved Mobile product policy; donor implementation is not an authority.

## Scope

This specification applies only after the wallet already contains at least one Account record. It governs:

- Create new wallet;
- Import recovery phrase;
- Import Stellar `S...` secret;
- derive another HD account from an existing mnemonic-backed signer;
- existing watch-only Add Account remains available.

Create, Import and HD derivation are separate implementation/acceptance slices. This document freezes their shared policy before product code is added.

Reveal/Export, passphrase rotation, generic app-session unlock, hardware wallets, S05 Home aggregation and unrelated security work are out of scope.

## App Passphrase authority

The App Passphrase is never stored as a separate verifier in JavaScript or Realm. Fresnica protected signer envelopes remain the verification authority.
If there are no protected software signers, Create/Import establishes the first App Passphrase. The existing new-passphrase policy applies and confirmation must match before Native generation/protection is called.

If protected software signers already exist, Create/Import requires the current App Passphrase. Before any account/signer/default write, Mobile must verify every unique protected signer verification target through canonical `verifyProtectedSignerPassphrase`.

A verification target is unique by the pair `(signerPublicKey, envelopeJson)`. This deliberately does not deduplicate by envelope alone: an envelope bound to two different expected signer identities must still expose an identity mismatch and fail closed.

A protected-software signer without a usable envelope is invalid local security state. Existing-wallet Create/Import must fail before generation/protection or persistence.

Any false verification result or Native verification error fails the operation with zero product writes. No signer is generated/protected, no Account/Signer/default state changes, and System Auth enrollment is not modified.

## Duplicate account policy

Account identity remains `(networkId, address)`.

- Same network + same watch-only account + imported matching signer: upgrade that Account in place by attaching the signer; do not create a duplicate Account.
- Same network + same account that already has protected signing authority: report already present and create no duplicate record.
- Same public address on a different network: an independent Account record is allowed. Existing signer sharing may follow the repository's reference rules when the signer material is genuinely the same.
- Create normally produces a new identity. If generated identity nevertheless collides on the same network, repository atomic duplicate protection wins and no orphan signer/default mutation is allowed.

Import-specific duplicate upgrade behavior is implemented in the Import slice, not the Create slice.
## Current/default selection policy

A successful new protected account must become both the current account and the network-scoped default account.

Create has an additional backup gate: Account + Signer persistence occurs first with mnemonic backup `pending`; current/default does not change until the user successfully verifies the generated recovery phrase backup. The verification behavior is frozen separately in `s01-mnemonic-backup-verification.md`. After verified completion, persist the new account as the default and then refresh runtime account state so the same account becomes current.

If passphrase verification, generation, persistence, mnemonic backup verification/completion, or default persistence fails, Mobile must not switch the current account and must not replace the previous default preference. A created account may remain only in the explicitly allowed partial-success states described below.

A process death before Create backup verification/completion must recover through the existing pending-mnemonic bootstrap using the persisted protected signer envelope. The pre-existing current/default remains unchanged until the recovered phrase is verified and backup completion succeeds.

## System Auth ordering and repair

System Auth is optional signing convenience, not the source of Account/Signer durability.

When a System Auth domain already exists:

1. verify/establish App Passphrase policy first;
2. atomically persist Account + protected Signer + reference;
3. only then register the new signer into the existing System Auth domain;
4. registration failure must not roll back the durable Account/Signer;
5. the product must expose the resulting unenrolled signer as an explicit, retryable Security repair state.

When no System Auth domain exists, Existing-wallet Create/Import must not initialize one implicitly. The user can enable it later from Security settings.
Security repair is derived from real Native enrollment status (`domainInitialized` with fewer enrolled protected signers than protected signers). Do not add a second JavaScript/Realm security truth solely for this flow.

## Create vertical slice

Required production flow:

`Existing wallet → Add Account → Create new wallet → verify/establish App Passphrase → generate mnemonic → atomic Account+Signer(pending backup) → optional existing-domain signer registration → verify mnemonic backup → complete backup → persist network default → refresh → new account current`

Create must reuse Fresnica Core mnemonic generation and the existing atomic Account+Signer repository write. Plaintext mnemonic exists only in the one-time backup presentation or an explicit Fresnica `reveal` recovery of a persisted pending backup.

Acceptance requirements:

- wrong current App Passphrase: zero writes;
- user cancel before generation: zero writes;
- all existing unique protected verification targets are checked before `generateMnemonic`;
- generated Account + Signer are one atomic persistence operation and signer backup state is `pending`;
- persistence failure does not change current/default and leaves no orphan signer;
- process death before backup verification resumes the pending backup without changing the previous default;
- successful mnemonic backup verification and completion precede default/current switch;
- default write failure leaves the previous current/default unchanged and remains retryable without fabricating success;
- existing System Auth domain registers the new signer only after persistence;
- System Auth registration failure preserves the account and leaves an observable Security repair/retry state;
- restart after successful completion restores the new account from the network default.

## Import and HD follow-up boundaries

Import mnemonic / `S...` secret reuses the same passphrase verification policy and duplicate policy, but imported recovery material does not create a new pending-backup requirement because the user already possesses it.

HD additional-account must use canonical `deriveMnemonicSigner`; it must not reveal mnemonic material to JavaScript and must not present a newly generated mnemonic as derivation from an existing source. Source-signer selection, derivation index/path policy and duplicate-index handling are frozen in the dedicated HD slice.

S01 remains `L3 partial` until Create, Import, HD and dual-platform aggregate acceptance are separately completed. This specification alone does not promote maturity.
