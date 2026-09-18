# S01 mnemonic backup verification hardening

Status: frozen for the Stage 4 S01 hardening slice on 2026-09-18.

## Scope

This slice strengthens only generated-mnemonic backup completion. It applies to:

- first-run Create new wallet;
- Existing-wallet → Add Account → Create new wallet;
- cold-start/process-death recovery of a persisted pending generated-mnemonic backup.

Mnemonic/secret import, HD derivation, Reveal/Export, passphrase rotation, generic app-session unlock and unrelated account lifecycle semantics remain unchanged.

## Security and lifetime boundary

A generated mnemonic remains plaintext only in the current in-memory backup/recovery UI state. It must not be written to Realm, navigation params, preferences, diagnostics, callback payloads or logs.

A process restart must continue to persist only the protected signer envelope plus public backup metadata. The existing fresh-App-Passphrase Fresnica Core `reveal` path is the only way to recover plaintext for an interrupted pending backup.

Verification challenge indices, entered word answers and mismatch state are ephemeral UI state and are not persisted. A further process death discards them and requires reveal again.

## Verification behavior

Showing the phrase is not proof of backup. The product must not mark `backupState=confirmed` from a one-tap acknowledgement.
After phrase presentation, the user explicitly starts verification. The phrase is then hidden and the UI requests three distinct mnemonic word positions selected from the current phrase. If the phrase contains fewer than three words, every position is requested.

Requested positions may be displayed in ascending order for usability, but the subset must be newly selected when verification starts or is restarted. Challenge selection is product UX state, not cryptographic entropy.

Each answer is compared with the mnemonic word at that exact position after trimming surrounding whitespace and normalizing case. The UI must not expose the expected word in labels, hints, accessibility metadata or error text.

All requested answers must match in the same verification attempt before completion is allowed.

A failed attempt keeps the same requested positions so the user can correct only the wrong input. Editing any answer clears the stale mismatch message. A subsequent correct attempt must succeed; a prior mismatch must never permanently poison verification state.

The user may return to the phrase presentation to re-check the backup. Doing so clears challenge answers and mismatch state. Starting verification again creates a fresh challenge.

## Completion ordering

Only a successful mnemonic verification may invoke the existing backup completion operation.

For first-run Create:
`phrase → verification success → confirm backup → complete onboarding`.

For Existing-wallet Add Account → Create:
`phrase → verification success → complete backup → persist network default → refresh/current selection`.

For process-death recovery:
`fresh App Passphrase → Core reveal → phrase → verification success → complete backup → resume product shell`.

If final completion/default persistence fails after verification, the existing rollback semantics remain authoritative: backup returns/stays `pending` and the operation remains retryable.
## Accessibility and failure behavior

Verification inputs have explicit labels that identify only the requested word position. Autofill/autocorrect must not change mnemonic answers. Busy state prevents duplicate completion calls.

Product errors from reveal or final completion remain separate from mnemonic mismatch feedback. A wrong mnemonic answer must not be projected as a Core/passphrase failure.

## Required acceptance

Tests must prove:

- three unique positions are selected for a normal generated phrase;
- answers are checked against the exact requested positions;
- surrounding whitespace/case normalization works as specified;
- wrong answer → correction → successful re-submit works;
- returning to phrase clears prior challenge answers/error;
- all three product entry points route through the verifier before backup completion;
- pending-backup process recovery still obtains mnemonic only through fresh-passphrase `reveal`;
- no Realm/navigation/log schema is added for plaintext mnemonic, challenge or answers;
- Existing-wallet default/current changes remain after verified backup completion only.

This hardening corrects the prior S01 acceptance assumption that explicit acknowledgement alone was sufficient proof of backup. It does not by itself promote S01 to L4.
