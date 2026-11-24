# S01 mnemonic backup verification hardening

Status: verification behavior frozen on 2026-09-18; sensitive-state and
lifetime boundary updated by the owner-requested audit repair on 2026-11-24.

## Scope

This slice strengthens only generated-mnemonic backup completion. It applies to:

- first-run Create new wallet;
- Existing-wallet → Add Account → Create new wallet;
- cold-start/process-death recovery of a persisted pending generated-mnemonic backup.

The 2026-11-24 repair also applies the existing transient-input boundary to
the first-run and Add Account secret/mnemonic import, mnemonic passphrase,
and HD/current-protection inputs. Their provisioning, derivation and
authorization contracts are unchanged. Reveal/Export, passphrase rotation,
generic app-session unlock and unrelated account lifecycle semantics remain unchanged.

## Security and lifetime boundary

The earlier permission to retain plaintext in ordinary backup/recovery React
state is superseded. Private keys, mnemonic phrases, application and mnemonic
passphrases, and verification answers remain only in locally owned transient
buffers and native fields. They do not enter ordinary React state, rendered
props/children, Realm, navigation params, preferences, diagnostics or logs.
Core operation arguments and imperative native load/clear calls are transient
delivery boundaries, not render data. React state carries public identity,
presence, policy results, challenge positions and flow status only.

A process restart must continue to persist only the protected signer envelope plus public backup metadata. The existing fresh-App-Passphrase Fresnica Core `reveal` path is the only way to recover plaintext for an interrupted pending backup.

Challenge indices, answer-presence flags and mismatch state are ephemeral
public UI state. Entered answers remain in native uncontrolled fields and
local transient buffers. A further process death discards the challenge and
requires reveal again.

Submitted inputs are consumed and cleared before awaiting SDK work. Mode
changes, Back/Cancel, route blur, background/lock, unmount and identity
replacement retire the presentation owner and clear its material. Late
results cannot display plaintext or revive an old challenge. No reading
timeout is added. The numbered word grid uses imperative native text fields;
the existing form, keyboard-inset and validation presentation is retained.

Retirement does not pretend to cancel an already-started native provisioning
operation. Its duplicate gate lasts until settlement. If an account has been
persisted with a pending backup, keep/reconcile only its public account and
signer identity and show the existing fresh-passphrase recovery flow. Reconcile
on re-entry and after a retired operation settles, because persistence may
occur after the initial clear. Do not start a replacement Create, delete the
account or silently confirm its backup. No persistence schema changes.

## Verification behavior

Showing the phrase is not proof of backup. The product must not mark `backupState=confirmed` from a one-tap acknowledgement.
After phrase presentation, the user explicitly starts verification. The phrase is then hidden and the UI requests three distinct mnemonic word positions selected from the current phrase. If the phrase contains fewer than three words, every position is requested.

Requested positions may be displayed in ascending order for usability, but the subset must be newly selected when verification starts or is restarted. Challenge selection is product UX state, not cryptographic entropy.

Each answer is compared with the mnemonic word at that exact position after trimming surrounding whitespace and normalizing case. The UI must not expose the expected word in labels, hints, accessibility metadata or error text.

All requested answers must match in the same verification attempt before completion is allowed.

A failed attempt keeps the same requested positions so the user can correct only the wrong input. Editing any answer clears the stale mismatch message. A subsequent correct attempt must succeed; a prior mismatch must never permanently poison verification state.

A mismatch keeps the local/native answers for correction. A successful
challenge clears all answers and the full phrase before asynchronous
completion. If final completion fails and rolls back to pending, show that
product error separately from mismatch and return to the existing
fresh-passphrase reveal flow. Retry requires a new reveal and challenge;
never restore the consumed phrase or answers from the prior completion.

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
- native inputs are already empty when provisioning/reveal is invoked;
- correct answers survive a synchronous mismatch, while successful answers
  and the complete phrase are cleared before asynchronous completion;
- duplicate submission, blur/re-entry, mode change, background, replacement
  and unmount cannot revive old plaintext or start a second unsettled Create;
- a retired Create which later persists a pending signer exposes only the
  public recovery identity and requires fresh-passphrase reveal;
- all three backup entry points preserve completion-failure rollback/retry.

Host component/native-port tests are automated behavior evidence, not native
keyboard, selection, accessibility or backup-grid product acceptance.

This hardening corrects the prior S01 acceptance assumption that explicit acknowledgement alone was sufficient proof of backup. It does not by itself promote S01 to L4.
