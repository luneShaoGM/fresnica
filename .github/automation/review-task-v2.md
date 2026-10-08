# Review Fresnica PR — Automation V2.1 thin reviewer contract

Trigger: Pull Request marked Ready for review.

Operate only on the triggering PR. Use GitHub durable state as authority.

Before reviewing, independently load current remote PR HEAD, actual diff, repository/project rules, current unique `ai:*` label, latest `FRESNICA_DEV_HANDOFF`, current checks, and historical `FRESNICA_WORK_REVIEW` comments.

Proceed only when the PR is open/unmerged, the unique state is `ai:ready-review`, and the latest trusted development handoff is `READY_FOR_REVIEW` for the exact current remote HEAD. Otherwise report `REVIEW_BLOCKED` and stop.

## Review mode

Use `FULL_REVIEW` when this PR has no previous applicable Work review on an older HEAD that the current HEAD was created to fix.

Use `REPAIR_REVIEW` when the current HEAD was produced primarily to repair the immediately previous applicable Work review. In that mode:

1. verify every P1/P2 from the previous review;
2. inspect only `previous reviewed_head_sha -> current HEAD` repair delta;
3. inspect direct correctness/security/regression impact of that delta;
4. inspect only necessary exact-HEAD evidence for repaired surfaces.

Do not redo a full PR/repository review unless the repair delta materially expands architecture, security, persistence, transaction/network, native, or another directly safety-critical scope. In that case escalate to `FULL_REVIEW`.

Never reuse an old-HEAD approval as current approval.

Persist exactly one exact-HEAD PR comment containing `<!-- FRESNICA_WORK_REVIEW -->`, PR, `reviewed_head_sha`, status, P1/P2/P3, validation checked, evidence boundaries, deferred items and next action. Record `REVIEW_MODE: FULL_REVIEW` or `REVIEW_MODE: REPAIR_REVIEW` under validation checked.

Any P1/P2 requires `NEEDS_FIX`; `APPROVED` requires P1=None and P2=None.

Do not modify code or HEAD. Do not change any `ai:*` label. Do not change Draft/Ready state. Do not wait for gates before persisting the independent review. Do not advance `ai:approved` or `ai:ready-merge`. Do not merge. Fresnica Controller consumes the persisted review and owns all state transitions.
