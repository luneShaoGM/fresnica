# S04 application session and sensitive-surface privacy

## Authority and scope

Phase 0 passed, 2a/2b reused, 2e application lock advanced without claiming generic biometric unlock. S04 with S01 sensitive backup/import entrypoints; Adapt lifecycle/privacy product roles, clean-room Fresnica implementation with no donor implementation. Application composition owns session lifetime; Application Security and SDK/Core retain passphrase verification and cryptographic authority. No numeric passcode or JS password verifier is introduced. Strict presentation scope includes SessionUnlockScreen.

The user policy is strong App Passphrase protection, routine signing preferring enrolled System Auth, and important maintenance such as recovery export requiring fresh App Passphrase. App unlock never grants signing/export authorization. Generic System Auth session challenge remains unavailable upstream: this slice provides genuine App Passphrase verification only, not a private native auth bypass, dummy signature or reveal-as-auth. A later upstream-supported biometric unlock is a separate slice.

## Behavior

Protected-software wallets cold-start locked. New/observation-only wallets have no invented credential and remain accessible; manual lock is available only with protected software authority. Unlock verifies all unique current protected signer targets, rejects empty inventory/changed identity/envelope, never persists credentials or reusable authorization. Wrong/cancelled/retired/duplicate attempts do not unlock. Cold start always rechecks; no persisted unlocked flag.

Real background immediately retires the sensitive SDK result generation and unmounts the wallet navigation, discarding UI inputs, revealed backup and dApp sessions. Foreground before 30 seconds permits browsing after rebuilding fresh bootstrap/navigation; at/after 30 seconds requires unlock. Manual lock is immediate. A monotonic clock measures the in-process interval. iOS inactive during native authorization raises the privacy cover but does not itself retire signing; actual background does. Native signing success after real background/manual lock is discarded before the caller can broadcast. Existing pending/uncertain records and original-hash check-only recovery are retained.

Deep-link intake/resolution is disabled while locked and pre-lock continuation is dismissed. Sensitive material cannot be restored from navigation. Existing generated pending-backup metadata survives; foreground resolves bootstrap again so the user must re-enter App Passphrase for the genuine recovery reveal path. Dropping JS references reduces lifetime but is not a guarantee of physical string memory wiping.

Android wallet activity uses FLAG_SECURE (including ordinary wallet screens); iOS places a native opaque window above React/native modals before resignation and keeps it until JavaScript commits a foreground-safe loading/lock/wallet surface. No promise of universally preventing iOS screenshots. The minimal native bridge only acknowledges foreground visibility; authentication remains in SDK/Core.

## Validation and boundaries

Focused automated state/access tests cover cold/wrong/retry, exact timeout, manual lock, watch-only/zero targets, cancellation/background/closure late success, signer inventory changes and stale signed output. Existing deep-link/state tests are retained. Native Swift syntax/project syntax checks are supplementary only.

Required native acceptance remains pending: cold/short/long background, task-switch screenshots over mnemonic/native modal, Android screenshot protection, iOS authentication inactive versus real background, wrong/cancel/retry, generated pending-backup recovery, native in-flight signing and already-broadcast original-hash recovery, accessibility/dynamic text. Stage 9 real-iPhone System Auth cancel/retry remains deferred. No L4/release approval or independent Work APPROVED is implied.
