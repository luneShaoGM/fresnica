# Review Fresnica PR — Automation V2 worker contract

Trigger: Pull Request marked Ready for review.

Operate only on the triggering PR.

Before reviewing, independently load current remote PR HEAD, actual diff, repository/project rules, current unique `ai:*` label, latest `FRESNICA_DEV_HANDOFF`, current checks, and any historical Work review.

Proceed only when the PR is open, unique state is `ai:ready-review`, and the latest development handoff is `READY_FOR_REVIEW` for the exact current remote HEAD. Otherwise report blocked and stop.

Perform an independent review of correctness, regression risk, persistence/state integrity, failure/cancel/retry/uncertain paths, transaction/network identity where relevant, fail-closed security behavior, scope, tests and evidence boundaries. Never treat the developer handoff as proof.

Persist exactly one comment containing:

```text
<!-- FRESNICA_WORK_REVIEW -->
PR: #<number>
reviewed_head_sha: <40-char current remote HEAD>
status: NEEDS_FIX | APPROVED
P1:
P2:
P3:
VALIDATION_CHECKED:
EVIDENCE_BOUNDARIES:
DEFERRED:
NEXT_ACTION:
```

`APPROVED` requires no P1/P2.

Do not modify code. Do not change `ai:*` labels. Do not change Draft/Ready state. Do not merge. Fresnica Controller consumes the persisted review and owns all state transitions.
