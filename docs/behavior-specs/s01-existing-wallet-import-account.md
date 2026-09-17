# S01 Existing-wallet Import behavior

Status: frozen for Stage 4 implementation on 2026-09-17.

This specification narrows `s01-existing-wallet-add-account.md` to the Existing-wallet Import slice. It covers only:

- Import recovery phrase;
- Import Stellar `S...` secret.

Create, HD additional-account, Reveal/Export, passphrase rotation, generic session unlock, hardware wallets and S05 aggregation are out of scope.

## Shared App Passphrase policy

If any protected-software signer already exists, Import must verify every unique `(signerPublicKey, envelopeJson)` target through canonical `verifyProtectedSignerPassphrase` before protecting imported material or performing any product write.

Any false result, missing usable envelope or Native verification error fails the whole operation. Account, Signer, reference, default preference and System Auth enrollment must remain unchanged.

If no protected-software signer exists, the Import establishes the first App Passphrase using the existing new-protection strength and confirmation policy.

The App Passphrase is never persisted or logged by Mobile.
## Imported recovery semantics

Mnemonic Import forwards the entered mnemonic, mnemonic passphrase, derivation index and optional language to canonical `protectMnemonic`. Those recovery attributes remain Fresnica envelope-owned; Mobile must not duplicate plaintext mnemonic/passphrase metadata in Realm.

Secret Import forwards the Stellar secret only to canonical `protectSecret`.

Imported recovery material is already user-held, so imported signers use `backupState=not-required`. Import never enters generated-mnemonic pending-backup recovery.

Mnemonic, Stellar secret, App Passphrase and protected envelope JSON must not be placed in navigation params, diagnostics, analytics, user-facing errors or default-account metadata.

Cancellation before submission performs no Native protection and no product writes.

## Same-network identity policy

Account identity remains `(networkId, address)`.

After canonical protection returns the signer public key, Import resolves an existing Account with that identity before persistence.

- No existing Account: atomically create Account + protected Signer + reference.
- Existing visible watch-only Account: atomically create the protected Signer + reference against that existing Account. Preserve the Account id, label, sort order, hidden flag, timestamps and other Account metadata; do not create a duplicate Account.
- Existing Account with any signer reference: fail with stable `account-already-exists`; do not create or attach another signer in this slice.
- Existing hidden watch-only Account: fail with stable `account-not-selectable`; the user must restore it through the existing S02 flow before importing signing authority. Import must not implicitly unhide an Account.

A same public key on another network is an independent Account identity. Signer record reuse is not introduced by this slice; existing repository reference rules remain authoritative.
## Atomic persistence and selection

The repository must expose one atomic operation for the watch-only upgrade: create the Signer and Account-Signer reference in one transaction. A failure must leave neither record/reference partially persisted.

New-account Import continues to use the existing atomic Account + Signer + reference operation.

After durable persistence, Import attempts existing-domain System Auth registration. Missing System Auth does not initialize a domain. Registration/status failure preserves the imported account/signer and returns `repair-required`.

Only after persistence and System Auth handling does the product persist the imported Account as the network default and update current selection.

Default preference failure must not switch the in-memory current account. The durable import/upgrade may remain, but the product reports failure and leaves the previous current/default authoritative so selection can be retried explicitly.

Realm persistence failure, duplicate rejection, invalid recovery material, wrong App Passphrase or cancellation must not change current/default.

## Product flow

`Existing wallet -> Add Account -> Import recovery phrase | Import Stellar secret -> verify/establish App Passphrase -> canonical protect -> resolve duplicate/watch-only upgrade -> atomic persistence -> optional existing-domain System Auth registration -> persist network default -> imported Account current`

Import mnemonic fields are mnemonic, optional mnemonic passphrase, derivation index and optional language. Import secret accepts only Stellar `S...` material.

No imported path displays a backup phrase after success and no imported path creates pending-backup state.
## Acceptance requirements

- wrong current App Passphrase: all unique protected verification targets are attempted; zero Import writes;
- new App Passphrase confirmation mismatch/weak passphrase: no protection and zero writes;
- invalid mnemonic/secret: zero Account/Signer/reference/default/System Auth writes;
- watch-only upgrade preserves the original Account record and creates exactly one Signer/reference atomically;
- same-network non-watch-only duplicate returns `account-already-exists` with no duplicate Signer/reference;
- hidden watch-only duplicate returns `account-not-selectable` with no implicit visibility change;
- mnemonic protection receives language, mnemonic passphrase and derivation index unchanged;
- imported signers persist `backupState=not-required`;
- Realm write failure leaves no partial Signer/reference and does not change current/default;
- System Auth status/registration occurs only after durable persistence; failure returns `repair-required` without rollback;
- successful Import persists network default before changing in-memory current selection;
- default persistence failure leaves the previous current/default selected;
- restart after success restores the imported Account from the network default;
- navigation state, logs and projected errors contain no mnemonic, secret, App Passphrase or envelope JSON.

S01 remains `L3 partial` after this slice. HD additional-account and Android+iOS aggregate S01 acceptance remain separate work.