# S01 Existing-wallet HD additional-account behavior

Status: frozen for Stage 4 implementation on 2026-09-17.

This specification narrows `s01-existing-wallet-add-account.md` to deriving another Classic account from an existing mnemonic-backed protected signer. It does not generate, reveal, export or re-import recovery material.

Create, mnemonic/secret Import, passphrase rotation, generic session unlock, hardware wallets, S05 aggregation and aggregate S01 acceptance are out of scope.

## Canonical derivation authority

HD additional-account must call canonical `deriveMnemonicSigner(sourceEnvelopeJson, appPassphrase, expectedSourceSignerPublicKey, index)`.

Mobile must not Reveal the source mnemonic, parse the protected envelope, reconstruct BIP39 material in JavaScript, or derive Stellar keys itself. Fresnica Core authenticates the source protected signer, restores the source mnemonic internally, preserves its mnemonic language/BIP39 passphrase, and protects the newly derived signer before returning only `signerPublicKey + envelopeJson`.

Stellar derivation follows SEP-0005. For explicit account index `N`, the user-visible path is `m/44'/148'/N'`. The normal first mnemonic account uses index `0`.

## Eligible source signer

The user explicitly selects the recovery source before derivation. A source candidate must:

- be a `protected-software` Signer;
- have `recoveryKind=mnemonic`;
- contain a non-empty opaque protected envelope;
- have `backupState=confirmed` or `backupState=not-required`;
- be referenced by at least one visible Account on the active network.

Secret-backed, hardware, external, pending-backup, missing-backup-state and missing-envelope signers are not eligible HD sources.

If the same Signer is referenced by multiple visible accounts, show it only once. Source identity is the Signer record/public key, not an Account label. Account labels may be used only as non-authoritative display context.

A hidden Account does not make its signer eligible by itself. If the same signer is also referenced by another visible current-network Account, that visible reference is sufficient.

No eligible source means the HD action is unavailable; Mobile must not fall back to Reveal or ask the user to re-enter a mnemonic.

## App Passphrase ordering

HD derivation requires the existing App Passphrase. Before invoking `deriveMnemonicSigner`, Mobile verifies every unique existing protected-signer `(signerPublicKey, envelopeJson)` target through the already frozen Existing-wallet verification orchestration.

Any verification failure, missing protected envelope or cancellation fails before derivation and before Account/Signer/default/System Auth writes.

`deriveMnemonicSigner` then authenticates the selected source envelope again inside the canonical Native/Core operation. A secret-backed or identity-mismatched source must fail closed.

## Explicit index and path policy

This slice uses an explicit user-entered account index only. Mobile does not attempt automatic next-index discovery because existing envelopes are opaque and there is no canonical public index-introspection API.

Accepted index range is integer `0...2147483647`, matching the canonical Stellar account-index bound. The form may initially suggest index `1`, but `0` remains a valid explicit request because Mobile does not know the selected source's own index.

Before Native derivation, the UI must show the exact SEP-5 path `m/44'/148'/N'`. Pressing the derive action is the explicit confirmation of that displayed source and path.

Mobile must not persist a duplicate public derivation-index field or infer index by parsing an envelope. Existing-index handling is identity-based after canonical derivation:

- if the derived same-network address already has signing authority, return stable `account-already-exists`;
- if the derived same-network address is a visible watch-only Account, atomically attach the newly derived signer to that Account without creating a duplicate Account;
- if the matching watch-only Account is hidden, return `account-not-selectable` and do not change visibility;
- the same public address on another network remains a separate Account identity under existing reference rules.

Requesting the selected source's own index therefore naturally resolves to the existing signed-account duplicate rule rather than requiring envelope introspection.

## Recovery and backup semantics

The derived envelope remains mnemonic-backed and independently contains the canonical protected recovery material needed for that derived index. Mobile persists `recoveryKind=mnemonic`.

No new recovery phrase is created or displayed. The derived signer inherits the source's user-possession state:

- source `backupState=confirmed` -> derived `backupState=confirmed`;
- source `backupState=not-required` -> derived `backupState=not-required`.

A source with `backupState=pending` or no usable backup state is not eligible. HD derivation therefore never enters generated-mnemonic pending-backup recovery.

This slice does not add a new Recovery Source Realm entity or persist a source-signer id on the derived signer. The protected envelope remains the cryptographic recovery authority. A future grouping model may improve backup UX, but is not required to safely derive or restore this slice.

## Atomic persistence, System Auth and selection

After canonical derivation, persist the resulting Account + Signer + reference through the same atomic provisioning path used by Import. The watch-only upgrade uses the existing atomic Signer + reference repository operation.

Only after durable persistence may Mobile query/register the derived signer into an existing System Auth Domain. Missing domain must not initialize one. Registration/status failure preserves the durable account and is represented by the existing Native-derived Security repair state.

Only after persistence and System Auth handling does the product persist the new Account as the active network default. In-memory current selection changes only after that default write succeeds.

Default persistence failure must leave the previous current/default authoritative. The durable derived Account may remain and can be selected explicitly later.

## Sensitive-data boundary

The source envelope and App Passphrase may exist only in the local Capability/SDK call path. They must not enter navigation params, diagnostics, analytics, projected errors or default-account metadata.

No mnemonic, mnemonic passphrase, secret seed or unlock key may cross this HD product path into JavaScript. The only Native derivation result exposed to Mobile is the protected signer public identity plus opaque envelope already defined by `FresnicaSdkPort`.

## Acceptance requirements

- source list contains only unique eligible mnemonic-backed protected signers reachable from visible current-network Accounts;
- secret-backed, pending-backup, hidden-only and missing-envelope signers are not selectable;
- wrong current App Passphrase verifies all unique protected targets and performs zero derivation/product writes;
- invalid/non-integer/out-of-range index performs no Native derivation and zero writes;
- UI displays `m/44'/148'/N'` before the derive action;
- canonical `deriveMnemonicSigner` receives the exact selected source envelope/public key and explicit index;
- no Reveal call is made by the HD path;
- derived signer persists `recoveryKind=mnemonic` and inherits source `confirmed/not-required` backup state;
- derived identity duplicate follows existing signed / visible-watch-only / hidden-watch-only policy without parsing source/index metadata;
- Realm persistence failure leaves no partial Account/Signer/reference and does not change current/default;
- System Auth status/registration occurs only after durable persistence; failure preserves the account and remains repairable from Native-derived Security status;
- default persistence succeeds before current selection changes; default failure leaves the previous current/default selected;
- restart after success restores the derived Account from the network default;
- navigation/log/error/default metadata contains no source envelope, App Passphrase or recovery secret material.

S01 remains `L3 partial` after this slice until Android+iOS aggregate S01 acceptance is completed and maturity is reassessed.
