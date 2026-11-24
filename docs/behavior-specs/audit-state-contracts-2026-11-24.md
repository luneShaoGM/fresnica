# Existing wallet state contract repairs

Status: implemented repair candidate on the current main baseline
`a670b04f0851a41e80a9d4b6b12403f977d6f6d0`. The owner requested ordered
repairs followed by one consolidated independent review. No merge is
authorized by this document. Actual validation is recorded in
`../test/audit-state-contract-repairs-2026-11-24.md`; final approval belongs to
the consolidated review of the exact remote PR HEAD.

## Scope and ownership

The 2026-11-23 feature audit identified integration gaps in existing S30,
S11, S02, S01 and S05/S06 behavior. Phase 0 and the existing injection,
navigation and transaction foundations are reused. This is maintenance of
implemented wallet flows, not a new ledger-write capability or a maturity
promotion. Feature owners retain presentation, Capabilities retain wallet
semantics, App wires lifetimes, and platform adapters own persistence.

Decision: Adapt the existing Fresnica contracts. No Stellar/Xaman code,
tests, resources or implementation structure is migrated. Existing strict
architecture scopes apply to all changed consumers. No dependency, global
service, signing authority or second submission pipeline is introduced.

The first audit repair, Android SEP-53 replies and iOS native expiry, is
already merged in PR #230. PR #231 also supplies the current UI baseline.
Their actual execution evidence retains its recorded source revisions in
`../test/sep53-native-reply-fix-2026-11-23.md`.

## Ordered repair contracts

### S30 Trustline operation lifetime

Preparation, review and submission remain bound to the explicit route
account, network, account-selection revision and current focus epoch.
Leaving and returning, or switching A to B to A, cannot revive an old
confirmation. Settings may still explicitly manage account B while A is
the selected Home account. A removed or hidden route account cannot fall
back to another wallet.

Reuse `submitReviewedTransaction.isCurrent` through the Trustline wrappers
and check before and after asynchronous review revalidation. Retire input,
old callbacks and results when their owner ends. Synchronous duplicate
confirmation invokes at most one submission. Wrong-passphrase retry is a
fresh attempt. Once durable pending/broadcast starts, existing exact-hash
uncertain and recovery semantics remain authoritative.

### S11 Claimable invalidation and discovery

A known account/network ledger invalidation supersedes an otherwise fresh
one-hour cache. Home category discovery consumes the same invalidation
even when the initial list was empty and the category is not mounted.
Ordinary visits retain TTL reuse. A new invalidation during an existing
read cannot be consumed by that old response; consumers share current
work without creating an unbounded refresh loop.

After service recreation, a persisted snapshot within its TTL remains fresh
when no ledger invalidation has occurred. Claimable uses the same zero-version
baseline as its cache reader; a real invalidation before the first cache read
still makes the snapshot stale. All same-address account aliases participate
in invalidation, while other addresses and networks remain isolated.

Complete snapshots, stale-on-error fallback, retry cooldown, pagination
integrity and partition isolation remain in force. A stale or retired
response cannot replace the latest snapshot. Existing successful-claim,
result-return and manual force-refresh paths remain supported.

### S02 account-associated data deletion

Pending/uncertain and last-visible-account guards run before cleanup.
Deletion retires in-flight reads that could recreate removed data. Remove
the deleted account's grants across networks and, when no other account
owns the same Classic address, its Balance, History, Claimable snapshot,
category discovery flag and Claimable risk overrides in supported network
partitions. Preserve shared signers until their last reference, other
accounts, global Contacts, public asset/dApp metadata and Recent entries.

Failures before account deletion retain the account and permit idempotent
retry. Permission observers are notified only after successful persistent
revocation, including active allow-once sessions. Legacy same-address
account rows must not lose shared address-keyed display preferences when
only one row is removed.

### S01 sensitive input and backup lifetime

Private keys, mnemonic phrases, application passphrases, mnemonic
passphrases and challenge answers do not enter ordinary React state,
navigation, rendered props/children or Realm plaintext. Reuse local
transient input buffers and imperative native display/clear mechanisms;
React state contains only public identity, presence, validation outcomes
and flow status. SDK/Core remains the recovery/signing authority.

Consume and clear submitted input before awaiting SDK work. Clear owned
material on mode change, leaving, background/lock, unmount or replacement.
Late results do not redisplay secrets. Already-created accounts retain
pending-backup recovery; they are not silently deleted or marked backed
up. Existing three-word challenge, correction of a wrong word, returning
to the phrase, resampling and completion failure/retry remain unchanged.
No additional reading timeout is introduced.

Protected-account provisioning has a Capability-owned lifetime across actual
route unmount/remount. Create, Secret/Mnemonic Import and HD provisioning share
one owner beginning before the current-inventory protection policy decision,
continuing through native work and persistence. A protected target change during
an asynchronous operation invalidates its earlier authorization before write.
At most one pending generated backup remains allowed. A replacement screen
observes settlement and reconciles public account/recovery identity even without
another submit, without the retired screen's selection/navigation. Notification
carries no secret or prior result and does not duplicate the current owner's
completion. Failed/waiting operations require an explicit fresh retry.

### S05/S06 Classic credit-asset availability

Preserve authorization flags and buying/selling liabilities through the
gateway, Balance snapshot and replaceable display cache. A single pure
Capability projection uses existing exact decimal arithmetic to express
spendable balance, receive capacity and send/remove restrictions. Missing
legacy cache facts are unknown, never assumed authorized or debt-free.

`authorized-to-maintain-liabilities` does not authorize an ordinary
payment. Clawback eligibility does not mean an asset is currently frozen.
Home details and affected asset selectors consume the same read model.
Live transaction preparation remains authoritative; cached availability
does not grant signing/submission permission.

### Current functional index

Update the existing route status, progress and traceability summaries to
distinguish implementation, supported subsets, merged work, independent
review and actual platform acceptance. Historical evidence keeps its
original source and scope. Hardware, advanced Soroban/dApp capability and
full notification/release work remain separately scoped feature stages.
WalletConnect, M addresses, Automation V2.2 and the Stage 9 real-device
deferment retain their existing decisions.

## Verification and review

Each repair receives targeted automated regression coverage for its
changed behavior, cancellation/failure/retry and relevant isolation.
Persistence changes additionally use the real Realm integration suite.
The integrated candidate must pass the repository check before push and
the final exact remote HEAD receives consolidated independent review.

Tests, helpers, emulators/simulators and native product-flow observations
are recorded separately. Automated lifetime/input checks do not establish
native navigation, keyboard, clipboard or backup-grid acceptance. No
unaffected historical acceptance is repeated merely for a new PR.
