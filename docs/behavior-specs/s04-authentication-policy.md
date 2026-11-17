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
  Enabling Developer Mode is a separate warning/confirmation-only operation;
  no protected signer or passphrase is required, including watch-only wallets.
- Every Payment, Trustline, Swap, Claimable and dApp transaction signature requires
  a freshly supplied App Passphrase. Send/Swap request it in the shared password prompt after explicit Review confirmation; other consumers retain their existing entry surfaces;
  each explicit attempt consumes/clears the input. Retry requires new input.
  Send and Trustline reuse the existing Swap/dApp transient input implementation
  through a shared presentation primitive: no passphrase in React state or
  controlled render props, only a Boolean presence signal.
- Message signatures require App Passphrase too. The concrete Mobile SDK adapter
  rejects both legacy System Auth signing methods before invoking native code.
- HD derivation supplies fresh App Passphrase only to the canonical SDK/Core
  source-authentication/derivation operation. Do not separately verify all other
  wallet signers. Wrong passphrase or mismatched source yields no product writes.
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
Android cancellation settles the JS Promise with false immediately but retains
the native request ID/prompt as busy until AndroidX delivers its terminal
success/error callback. A retry during that drain is rejected before constructing
another prompt; a late cancelled success has no pending Promise to unlock.
Cancellation for a stale ID cannot cancel the next attempt. Request IDs alone
cannot isolate AndroidX's shared per-Activity client callback:
[official BiometricPrompt contract](https://developer.android.com/reference/androidx/biometric/BiometricPrompt).

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


## Android cancellation regression (PR #193 P2)

Run `bash scripts/run-session-auth-native-test.sh` with Java 17, the Android SDK
and an arm64 Android emulator (`FRESNICA_ANDROID_DEVICE` defaults to emulator-5554).
The script builds an isolated `com.fresnica.wallet.test.sessionauthtest` debug carrier;
the production application ID and default instrumentation runner are unchanged.
The empty, non-exported debug-only FragmentActivity never opens wallet UI.

The instrumented test uses the production module and actual AndroidX 1.1.0
BiometricPrompt with a deliberately delayed client executor. It verifies immediate
JS cancellation, rejected retry before the old AndroidX terminal is delivered,
single settlement after draining, accepted new attempt, stale-ID cancellation,
and background/cancel/retry. No hardware enrollment, secrets, funding or wallet
writes are needed. This is native mechanism regression, not successful biometric
or wallet product-flow acceptance; physical-device success/lockout/accessibility
and lifecycle acceptance remain separate.


## 2026-11-17 password policy and Send/Swap prompt

Owner-approved S04/S07/S10 slice, clean-room Adapt of Stellar's independent
password overlay behavior. Feature owners: accounts/onboarding/security,
send and swap. Existing Fresnica Capability/SDK/Core remains authorization
and encryption authority; no donor implementation, vault, dependency, native
bridge or envelope-format changes.

Latest upstream baseline `Fresnica/fresnica@85d6cdfd787d45b6ee35294e38379aa76d213e43`
recommends 15 Unicode scalars, permits shorter non-empty phrases only with
explicit offline-guessing risk acceptance, and preserves existing credentials.
Mobile adds product-level rejection for Unicode numeric-only, whitespace-only,
single-character passwords, exact repetition, common whole passwords (including
simple numeric/symbol affixes) and alphabet/keyboard sequences, with
bounded local screening and fixtures, not an entropy claim. These are additional
Mobile constraints; no upstream repository change or SDK release is required.
No forced character-type mixture, credential normalization or remote password
lookup. Existing unlock/verification/HD-source credentials are not re-screened.
New protection and rotation require a fresh acknowledgement for short phrases;
editing the new password clears it. Weak-password rejection cannot be overridden.

Send/Swap Review no longer embeds a password field or pre-announces a password
step. The slide opens the shared PassphrasePrompt with title, secure input,
Cancel and Confirm-and-sign only, without a duplicated transaction summary.
It never re-prepares/re-quotes a reviewed transaction. Password is consumed/cleared
before signing with the existing pipeline. Wrong password stays retryable inside
the prompt with new input; cancel signs/submits nothing. Double taps are gated.
Background, focus/account/network retirement and review expiry clear the field
and retire authorization; expiry requires rebuilding Review. App unlock never
becomes signing authority. Send now passes its UI generation guard to the common
submission pipeline, including after an asynchronous signature.

Automated policy, legacy verification, rotation, prompt lifecycle/expiry and
Send/Swap recovery checks are supplementary; Android/iOS native keyboard,
focus, cancellation/error retry and screen-reader product acceptance remain
pending. No L4 promotion or native acceptance claim.
