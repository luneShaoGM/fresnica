# S04 / signing authentication policy — 2026-11-11

Owner decision: all wallet-key operations are important, including ordinary
transaction and message signatures. This supersedes earlier routine-signing
System Auth preference and the earlier passphrase-only App-lock limitation.

## Product policy

- App access: prefer the OS biometric button when strong biometrics are available
  and enrolled; preserve independently verified App Passphrase fallback. Existing
  protected-wallet cold/manual/30-second-background locking remains unchanged.
- Confirmed network/node switching within the unlocked foreground App requires
  confirmation only. Rebuilding immutable network services carries browsing access
  once to the same signer inventory for at most 30 seconds; background during
  rebuilding cancels it, including a return to foreground before completion.
  Cold launch, manual lock and existing background locking still require unlock.
  No passphrase, biometric proof or signing/export authority transfers. Old
  network services and pending results remain retired; network identity checks,
  endpoint probing, backup/busy/unresolved-submission guards remain authoritative.
  Enabling Developer Mode is a separate existing warning/passphrase operation.
- Every Payment, Trustline, Swap, Claimable and dApp transaction signature requires
  a freshly supplied App Passphrase. Review forms request it from the start;
  each explicit attempt consumes/clears the input. Retry requires new input.
  Send and Trustline reuse the existing Swap/dApp transient input implementation
  through a shared presentation primitive: no passphrase in React state or
  controlled render props, only a Boolean presence signal.
- Message signatures require App Passphrase too. The concrete Mobile SDK adapter
  rejects both legacy System Auth signing methods before invoking native code.
- Reveal/export, signer derivation/import and protection changes retain their
  existing passphrase verification and SDK/Core cryptographic boundaries.
- App unlock never creates a signing credential, grants signing/export authority,
  derives an unlock key, signs a dummy challenge, or reveals recovery material.
- No device-PIN substitution is added: OS biometrics use Android strong biometric
  or iOS biometric-only policy. Unavailable/not-enrolled/lockout/cancel/error leaves
  the App locked with the passphrase fallback accessible.

## Ownership and lifecycle

Clean-room Adapt; S04 with S07/S10/S11/S18/S19/S30 authorization consumers.
Application session owns access policy; platform owns the independent
SessionAuthentication port and native OS prompt. Core/SDK retains all key and
cryptographic authority. No dependency, Realm schema or stored credential added.
No donor implementation copied. Existing native System Auth key-domain records
are neither used for App unlock nor deleted by this change. New account create,
import and HD derivation no longer enroll signer unlock keys for biometric signing;
the legacy result field remains `not-configured` for compatibility.

Android uses AndroidX BiometricPrompt without a CryptoObject. iOS uses a fresh
LAContext for each biometric attempt, without authentication reuse. Requests
have distinct IDs so cancellation/old callbacks cannot affect a newer prompt.
Native real-background/destruction cancellation plus App generation and signer
inventory fences discard late success. iOS inactive during its system prompt is
not itself a real-background transition. Raw native failure details stay out of
product copy. The existing privacy cover and secure-window protections remain.

## Verification requirements

Automated: enrolled signer still requires passphrase; exact-XDR signed only with
passphrase; wrong/cancelled credentials do not trigger OS fallback or broadcast;
retry has no cached authorization; existing uncertain/original-hash recovery and
account/network/route fences remain. App tests cover biometric success, failure,
fallback, cancel/background/close/inventory mutation, old completion versus a
new attempt, unavailable bridge and strict native true validation.

Native builds and emulator startup are supplementary. Real Android and iPhone
biometric success/cancel/retry/lockout/background, privacy cover, dynamic text and
screen-reader acceptance remain separate. Prior iOS System Auth signing-cancel
coverage is historical under this new policy; genuine iPhone App-unlock biometric
acceptance is still required. No L4 or public-release approval is implied.
