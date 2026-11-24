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
its date and SHA. The route contract passed one targeted suite with six tests
before commit `ce9ba612e2f71cdabd30b24ededa5976fdd804ac`.
Execution log: `/tmp/fresnica-audit-stage7.log` on the Mac.

## Integrated candidate and independent review

Executed on the clean source commit
`ce9ba612e2f71cdabd30b24ededa5976fdd804ac`:

| Gate | Actual result |
| --- | --- |
| `npm run check` | Passed; all chained repository checks completed, including TypeScript, product-smoke script checks, format, lint, aliases, architecture, provenance, artwork, locales and native-patch consistency |
| Complete Jest suite within `check` | 312 suites / 3,074 tests passed |
| `npm run test:realm` | 18 actual Realm integration suites / 115 tests passed |
| Working tree after execution | Clean |

Execution log: `/tmp/fresnica-audit-integrated-check.log` on the Mac.
The first validation-record commit,
`796f1b2c7a595686506087b337ca10793f1cc151`, changed documentation only;
application and test source remained identical to that executed commit.
Its GitHub CI also executed `npm run check` successfully with 312 suites /
3,074 tests. Apple, Android and Realm heavy jobs were skipped; their successful
summary jobs are not native build or Realm execution evidence.

### First consolidated independent review and follow-up

[PR #232 review 6033519037](https://github.com/luneShaoGM/fresnica/pull/232#pullrequestreview-6033519037)
reviewed exact HEAD `796f1b2c7a595686506087b337ca10793f1cc151` and returned
**NEEDS_FIX: P1 0, P2 1, P3 1**. The reviewers independently checked GitHub
diff/source identity and actual CI logs, executed 18 Realm suites / 115 tests,
and reproduced the P2 using real provisioning/session/repository code with a
controlled native SDK boundary. That helper demonstrated two pending signers
after actual screen-instance replacement; it was not native gesture acceptance.

The P2 was the component-local Create gate disappearing on actual unmount:
a new screen could start another generation before the old one settled.
The follow-up moves operation ownership into the repository-scoped Capability,
guards the single pending-backup invariant before generation and persistence,
and notifies current screens of settlement without sharing secrets/results.
The P3 corrects the current S06 row to default-ON icons with persistent opt-out;
dated historical opt-in evidence is retained.

The review report on PR #232 records its exact 40-character
`reviewed_head_sha`, findings, checks, deferred items and next action. A new
HEAD requires a new independent review; the first NEEDS_FIX report is preserved
as historical evidence and cannot approve the follow-up.

### First follow-up targeted execution

The follow-up was prepared against the reviewed `796f1b2c7a595686506087b337ca10793f1cc151`
and executed in the same isolated Mac worktree. Seven directly affected suites /
75 tests passed, followed by a passing `tsc --noEmit`. The changed source files
were fingerprinted before the integrated check and are checked again before
commit. Execution log: `/tmp/fresnica-audit-p2-targeted.log`.

The follow-up integrated `npm run check` also passed: **312 suites / 3,088 tests**,
with all chained repository gates completed. ESLint reported zero errors and
74 warnings. Source fingerprints were unchanged after execution. Execution log:
`/tmp/fresnica-audit-p2-check.log`. The subsequent execution-record edit is
documentation only; the final committed source and remote HEAD still require
independent verification and review in PR #232.

The 14 added regressions include real first-run/existing-wallet feature and
Capability calls with separate unmounted A and fresh B component instances,
both with and without another Create click. They cover single generation and
pending signer, public-only settlement notification, fresh-passphrase recovery,
failure with explicit retry, delayed parse, pending-before-write checks,
independent repository isolation, and observer removal/error isolation.
These are automated/host tests with controlled native ports, not device
navigation or backup-flow acceptance. No persistence adapter/schema or Realm
integration test changed in this follow-up; the independent 18-suite / 115-test
Realm record above keeps its original exact SHA and is not relabelled as a new run.

### Second independent review: Create/Import authorization ownership

The first follow-up was committed and pushed as
`4171f22e9a0c54c1b545a0c8241a621727027c77`. Independent
[review 6033619731](https://github.com/luneShaoGM/fresnica/pull/232#pullrequestreview-6033619731)
closed the original duplicate-Create P2 and icon-policy P3, but returned
**NEEDS_FIX: P1 0, P2 1, P3 0** for the same owner's cross-method boundary.

Starting from a watch-only wallet, a retired first protected Create and a new
instance's Import could establish different passphrases before either observed
the other's protected signer. The generation-only gate did not cover Import.
Independent real-wrapper/session/repository helper execution produced two
protected signers, one pending, and neither candidate passphrase could verify
the complete inventory. This was a controlled native-port helper, not real
cryptography or native product acceptance.

That review independently verified the new CI's actual npm/check steps and
312-suite / 3,088-test logs, reran five targeted suites / 65 tests, and confirmed
unchanged persistence adapters and other repair modules. The next correction
shares provisioning ownership before authorization across protected entry
methods and checks current credential inventory before persistence. The new
remote HEAD will require a fresh independent review; neither NEEDS_FIX report
confers approval.

### Shared provisioning-owner follow-up execution

Prepared against `4171f22e9a0c54c1b545a0c8241a621727027c77` and executed in the
isolated Mac worktree: **11 targeted suites / 140 tests passed**, followed by
passing TypeScript. Execution log: `/tmp/fresnica-audit-crossmode-targeted.log`.

The integrated `npm run check` passed all chained gates and **313 suites /
3,125 tests**. ESLint reported zero errors / 82 warnings. All 13 changed source
file fingerprints matched before and after execution. Execution log:
`/tmp/fresnica-audit-crossmode-check.log`. The final execution-record update is
documentation only; commit/push and independent review must verify the actual
new remote HEAD rather than treating this record as approval.

The change reuses one protected-provisioning owner for generation, Secret/
Mnemonic Import and HD derivation. Create/Import policy callbacks execute only
after ownership is acquired; first-run entry points use the same current
inventory policy. The existing unique verification-target identity is captured
before authorization and checked after authorization and before the synchronous
write. It includes protected identity/envelope changes and excludes unrelated
account presentation metadata. No extra authentication prompt is introduced.

New regressions exercise actual feature, account/network repository, service/
application session and credential-verification code with controlled SDK ports.
They cover different proposed first passphrases, both Create/Import orders,
Secret/Mnemonic Import, failure then explicit retry, changed protected targets,
and current-inventory verification. True component unmount/remount cases also
prove public account/recovery reconciliation, no old-instance completion, and
exactly one current import completion. Existing Create-only regressions remain.
No source, SDK result or secret is carried by the settlement signal. These tests
are automated/helper evidence, not native navigation or real cryptographic
acceptance. Unchanged Realm adapter evidence retains its earlier revision.

Phase test totals overlap and must not be added into a unique coverage total.
The independent report belongs to the reviewed remote SHA, not to this
developer-maintained execution record.

### Claimable initial-revision P3 follow-up

Independent [review 6034444724](https://github.com/luneShaoGM/fresnica/pull/232#pullrequestreview-6034444724)
approved exact HEAD `815d19667b116f2c8d9f831edf94e04ef5bdf2f1` with no P1/P2
and one P3: the production Claimable revision callback returned a JSON token
containing zero-valued account revisions, while a new product instance uses
numeric zero as the persisted-cache baseline. Without a ledger invalidation,
this incorrectly marked a one-second-old snapshot stale after recreation.

The narrow correction canonicalizes only Claimable's all-zero account revisions
to numeric zero. Any nonzero revision retains the complete account/revision
tuples, including same-address aliases. Balance/history display reads continue
receiving their existing full JSON token. No cache schema, TTL, retry duration,
Claimable request-retirement logic or transaction behavior changed.

Actual execution in the isolated Mac worktree, prepared against that exact HEAD:

- Before the production fix, the three new composition regressions returned
  **two expected failures / one pass**. The failures directly observed
  `stale: true` for zero-revision snapshots. Log:
  `/tmp/fresnica-claimable-p3-red.log`.
- After the fix, **five targeted suites / 55 tests passed**, followed by
  `tsc --noEmit`. Scope: createAppServices.network, claimableProduct,
  claimableInvalidation, createDisplayReadGateway and
  LedgerReadInvalidationStore. Log: `/tmp/fresnica-claimable-p3-targeted.log`.
- ESLint on both changed TypeScript files passed with no warnings or errors.
  Log: `/tmp/fresnica-claimable-p3-lint.log`.

The composition regressions use actual AppServices, Claimable, invalidation
and node-session implementations with controlled persistence/Horizon ports.
An initially offline real runtime avoids legitimate startup node-recovery
invalidations in the zero-event case. The tests cover service recreation,
invalidation before the first cache read, same-version failure cooldown,
new-revision retry, same-address aliases and unrelated account/network isolation.
The retry test returns the runtime online and waits for actual node health before
refreshing. These are automated tests, not native or actual Realm execution.

Unchanged Realm and native evidence retains its prior revision. The new remote
HEAD must receive its own CI and independent exact-HEAD review; the earlier
approval does not automatically apply to this follow-up.

### Main synchronization after PR #228 merged

While preparing the P3 follow-up, main advanced to
`6ed7b7c9d4c1ccf93e19dfc4265ec37d8a8b3f7d` by merging PR #228. The Claimable
fix is preserved separately as `ea2f1194b831325ac98beebc1e77acfdc6bb6341`.
The repair branch then incorporated that main revision. This synchronizes the
feature branch; PR #232 remains subject to owner-controlled merge.

Two content conflicts required resolution: the product traceability index and
DappBrowserScreen tests. The merged index retains the current #232 implementation
inventory and the S21 notification spec. The browser tests retain main's complete
notification/SEP-53 regressions and #232's account-deletion cases. One additional
notification case verifies that account revocation retires an outstanding
approval before delivery. Current status documents now mark #228's Android-only
foreground notification subset merged, while preserving iOS unsupported, native
acceptance pending and full notification/backend scope. Historical SHAs remain.

Actual targeted execution on this merged working tree: **four suites / 125 tests
passed**, with **10 external Demo linkage cases skipped** under their existing
explicit-local-verification policy. Scope: DappBrowserScreen, freighterSession,
freighterInjection and DAppsStackNavigator. TypeScript, locale consistency
(three dictionaries / 1,397 keys), WebView patch consistency and changed-browser
ESLint all passed. Log: `/tmp/fresnica-main-228-integration-targeted.log`.
The repository's existing patch script was applied to this isolated dependency
copy to incorporate main's read-only native notification clock. No dependency or
lockfile update was introduced. The Claimable implementation and its passing
regressions are unchanged by this main synchronization. No native acceptance,
external Demo linkage or repeated Realm execution is claimed.

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
- PR #228 Android foreground dApp local notifications is now part of main;
  its existing automated/emulator mechanism evidence retains its original
  revisions. Physical-device notification product acceptance, full notifications/
  backend, hardware, advanced Soroban/dApp capabilities and release remain later work.
- WalletConnect exclusion, deferred M addresses and paused Automation V2.2 /
  PR #78 retain their existing decisions.
