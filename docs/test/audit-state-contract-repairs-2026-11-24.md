# Ordered state-contract repairs — validation record

Date: 2026-11-24 (Asia/Shanghai).

This record covers the owner-requested repair candidate on
`fix/audit-state-contracts-2026-11-24`, based on merged main
`a670b04f0851a41e80a9d4b6b12403f977d6f6d0`.
It does not authorize merge and is not an independent approval.
The final consolidated review must identify the actual remote PR HEAD.

## Execution environment and boundaries

The implementation was applied in the isolated Mac Git worktree
`/Users/lune/Documents/work/2012/fresnica-audit-repairs-2026-11-24`.
The original main working tree was clean and was not modified.
The text preparation copy is not used as evidence of a native run or of
the authoritative Git history. Commands below ran on the Mac with Node
22.23.3 and the existing repository dependencies.

Jest component tests exercise the production callbacks using the repository's
hook harness patterns. Realm integration tests open actual Realm files and
verify persistence after close/reopen. Neither establishes native product-flow
acceptance. This repair has no new native platform, SDK, schema or dependency
implementation. Existing native evidence retains its original revision and
does not automatically extend to these changes.

## Ordered targeted checks

### 2. Trustline review lifetime

Implementation commit: `165de5aa047169239beb1384c139c988e9055fea`.

- Six targeted Jest suites, 79 tests: passed.
- `tsc --noEmit`: passed.
- Changed behavior: route B remains legitimate while Home selects A; removed
  or hidden route accounts cannot fall back; A→B→A and focus/background
  retirement invalidate old review callbacks; preparation and submission are
  single-flight; checks before/after authorization and signing stop obsolete
  operations before pending; existing durable pending/recovery semantics are
  retained after that boundary.
- Scope: HomeSwapEntry, swapCurrentSession, ManageAssetsScreen, assetSheets,
  trustlineProductFlow and submitReviewedTrustline tests.
- Execution log: `/tmp/fresnica-audit-stage2-final.log` on the Mac.

### 3. Claimable invalidation and discovery

Implementation commit: `1513246e9c22198f3698f9aadf558b51343bea4d`.

- Five targeted Jest suites, 46 tests: passed.
- `tsc --noEmit`: passed.
- Changed behavior: an account-ledger invalidation supersedes a fresh TTL;
  Home discovers the first Claimable category; ordinary repeated reads reuse
  the same revision; a pending old revision cannot acknowledge a later event;
  cooldown, stale fallback, queued-read coalescing and close retirement remain
  explicit.
- Scope: claimableInvalidation, claimableProduct, HomeClaimableDiscovery,
  ClaimableScreenLifetime and createAppServices.network tests.
- Execution log: `/tmp/fresnica-audit-stage3.log` on the Mac.

### 4. Account-associated cleanup and session retirement

Implementation commit: `faefab910ba0e52ca0b2b44506dae222b782e9e1`.

- Initial nine targeted Jest suites, 118 tests: passed.
- Three additional affected fixture suites, 15 tests: passed.
- Seven actual Realm integration suites, 28 tests: passed.
- `tsc --noEmit` and architecture guard: passed after adapting all affected
  test fixtures to the required cleanup interfaces.
- Changed behavior: pending guards precede cleanup; cleanup failures preserve
  the account and permit retry; Claimable snapshots, discovery flags and risk
  marks are removed across supported networks; deleted-account grants and
  active allow-once sessions are revoked; shared address caches and shared
  signers survive until their final owner; unrelated accounts, pending records
  and global Contacts survive; late Claimable detail/list responses cannot
  restore removed data.
- Realm scope: AccountDeletion, AccountLifecycle, BalanceCacheRepository,
  Lc6AggregateCacheRecovery, NetworkAccountContext, DappPermissionStore and
  ClaimableCacheStore integration suites.
- Execution logs: `/tmp/fresnica-audit-stage4.log` and
  `/tmp/fresnica-audit-stage4-final.log` on the Mac.

### 5. Sensitive input and mnemonic backup lifecycle

Implementation commit: `6f3a38f8e98b700f6809d4363ed4609282b7b699`.

- Six targeted Jest suites, 44 tests: passed.
- `tsc --noEmit` and the changed-file ESLint gate: passed; ESLint reported
  three nonblocking warnings and zero errors.
- Changed behavior: local uncontrolled native inputs are consumed before
  provisioning/reveal; React state and rendered props/children contain no
  secret text; three-word mismatch remains correctable; successful verification
  consumes answers and the complete phrase before completion; a failed
  completion preserves pending backup and requires fresh reveal.
- Lifecycle regressions cover background, focus, mode and signer/dependency
  replacement; a retired Create retains its duplicate gate until settlement;
  late persisted results reconcile only current public identity; an old
  rendered button cannot obtain a new lifetime or consume fresh input.
- Scope: SensitiveTextInput, mnemonicBackupVerificationState,
  mnemonicBackupVerificationUi, mnemonicBackupEntryPoints, onboardingBootstrap
  and AddAccountScreen tests. Hook/native-field ports are automated evidence.
- Execution log: `/tmp/fresnica-audit-stage5-final.log` on the Mac.

### 6. Classic credit-asset availability

Implementation commit: `a9738c7ca98d78e49ebab2d102045aca45eb8cea`.

- Thirteen targeted Jest suites, 184 tests: passed.
- Actual Realm Balance cache integration suite, 26 tests: passed, including
  write/close/reopen of authorization flags and exact liability strings.
- `tsc --noEmit` and the changed-file ESLint gate: passed; ESLint reported
  five nonblocking warnings and zero errors.
- Changed behavior: Horizon-to-cache field round-trip retains explicit false
  values; legacy missing facts remain unknown; one-stroop and near-limit
  amounts use exact arithmetic; authorization and clawback have independent
  meanings; Home and Send share availability and disabled reasons; stale or
  restricted explicit presets cannot silently select another asset; direct
  callback invocation cannot bypass the same display gates.
- Scope: credit projection, balance loader/gateway, cache contract, asset
  selection/picker/details, Send form/flow/Request prefill and the directly
  affected asset-sheet lifecycle fixture.
- Execution log: `/tmp/fresnica-audit-stage6.log` on the Mac.

### 7. Current functional index

Route readiness, the capability matrix, current progress, information
architecture and product traceability have been synchronized to the current
merged baseline and this repair candidate. Historical platform evidence keeps
its date and SHA. The final route-contract and integrated check results are
recorded below after execution.

## Integrated candidate and independent review

Pending actual `npm run check`, the relevant actual Realm integration checks,
push, remote HEAD verification and consolidated independent review.
Phase test totals overlap and must not be added into a unique coverage total.
The independent report belongs to the reviewed remote SHA, not to this
developer-maintained execution record.

## Explicitly deferred or outside this repair

- Stage 9 iOS real-device System Auth cancel/retry remains deferred.
- These changes have not established native gesture, keyboard, secret-field
  clearing, mnemonic-grid or clipboard product-flow acceptance on either
  platform. Any future native observations must record platform, source SHA
  and actual scope separately.
- PR #230 SEP-53 native reply fixes and PR #231 UI changes are already part of
  the baseline. The earlier native/helper record remains
  `sep53-native-reply-fix-2026-11-23.md`; it is not relabelled as evidence for
  this candidate.
- PR #228 notification work remains a separate candidate; hardware, advanced
  Soroban/dApp capabilities and full release readiness are later feature work.
- WalletConnect exclusion, deferred M addresses and paused Automation V2.2 /
  PR #78 retain their existing decisions.
