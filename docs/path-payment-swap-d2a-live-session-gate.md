# Stage 6 / S10 Swap-D2a — live account-selection and route-focus gate

Status: **small App-boundary safety prerequisite, awaiting independent Work exact-HEAD review.** No user-facing Swap Flow is enabled by this slice.

## Problem being closed

PR #106 / Swap-D1 already binds a _captured_ mutable AccountRecord and complete network identity through ledger authorization, native signing and broadcast. It cannot know whether the **App's separately stored selected account** changed during an await. An async attempt can therefore remain valid when its original AccountRecord object is unchanged but the user has switched accounts, blurred the route, or returned to the prior account.

The first cut of Swap-D2 makes the external-session observation **mandatory**, without introducing a second transaction state machine or bypassing D1's existing fail-closed checks.

## Contract

- The D1 PathPaymentSubmissionDependencies now requires isCurrentSession: () => boolean. The supplied function is **captured once** when a D1 submission starts and called at **all existing synchronous identity checkpoints**: before XDR inspection and account authorization; before/after awaited ledger authorization, System Auth availability, System Auth/passphrase signing; at hashing; before and after broadcast. An absent, throwing or false selector fails path_payment_review_mismatch.
- When a durable submitting record already exists, a late change before broadcast or after attempted broadcast follows the existing uncertain reconciliation path, **not a false success, rejection or automatic retry**. The persisted hash/network/account ownership remains the one from the reviewed original intent.
- New captureSwapCurrentSession is an App-navigation, read-only helper that takes (1) expected Classic source-account fields, (2) full expected network ID and passphrase, (3) a live getter for the selected account ID, **monotonically incrementing selection revision**, current account inventory and network, and (4) a **captured route focus epoch callback** compatible with existing createRequestRouteFocusLifetime().capture().
- Capture is only valid while the intended route is focused with a matching visible Classic account. Each subsequent check validates the original revision, exact selected account, visibility, account address/ID/network/identity kind, complete network passphrase and unchanged focus epoch. Both callback references are **captured independently of the caller-owned input object**; replacing either callback after capture cannot revive or invalidate the guard, while the original getter still reads live App state. A→B→A is **not** permitted to revive an old attempt; blur→focus is also invalid. Deleted/hidden/contract/network-changed or duplicate entries are rejected. Missing or throwing getters fail closed.
- This check does not infer a selection revision from an account ID; the **App selection owner must actually increment its revision on every transition**. It must be wired to the same MainTabs selection source used for route navigation, not to a stale render snapshot.

## Evidence and remaining work

Tests first reproduced six failing D1 account-selection races against merged PR #106 and one missing App-navigation guard module; both suites then passed after implementation. Additional tests cover callback substitution, missing revision, account removal/hidden, Classic identity changes, passphrase/network mismatch and route focus epoch ABA. Original D1 quote/exact-XDR/signer/pending/uncertain logic is unchanged other than requiring and checking a live session.

**Not delivered here:** MainTabs currently has no Swap route and does not yet produce the captured generation/revision callback for this new port. **Swap-D2b must compose** current selected-account state/revision and route focus into D1, bind quote/prepare/review/form/result lifecycle, explicitly invalidate stale UI attempts, and present pending/uncertain results through the _existing_ TransactionReconciliationCoordinator on cold start, foreground and reconnect. Until then, the Swap action stays disabled, and this helper is not evidence of an end-to-end product Flow.

Real Horizon Path Payment, live Testnet execution, native heavy/device authorization tests and hardware/multisig remain deferred. **S10 main stays L2 partial**; the review of this isolated gate cannot upgrade it to L3/L4. Do not conflate a JS Bundle, mocked signing, or skipped CI native jobs with native acceptance.
