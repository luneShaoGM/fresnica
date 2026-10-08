# Fresnica Automation V2 — Controller-owned PR state machine

Status: FROZEN for Automation V2 v1 implementation.

Baseline: `main@c9a801478552954e69a876ac980b2dd7d5e5ab69`.

## Goal

Make GitHub PR state authoritative without making Review/Fix agents coordinate labels, draft state, gates, or merging. A single repository-owned **Fresnica Controller** owns state transitions. Review and Fix tasks become narrow workers. V2 v1 stops at `ai:ready-merge`; it does not auto-merge.

## Non-goals

- No product behavior or mobile feature changes.
- No automatic merge in V2 v1.
- No change to product validation semantics or evidence boundaries.
- No weakening of exact-HEAD handoff/review requirements.
- No replacement of independent Work review with developer-provided evidence.

## Authority and invariants

GitHub PR state is authoritative: PR number, current remote HEAD, draft/ready state, labels, persisted comments, and exact-HEAD checks.

The Controller is the only V2 component allowed to advance `ai:*` state labels or change Draft/Ready state. Review and Fix tasks do not advance labels and do not merge.

Exactly one current state label is allowed:

```text
ai:developing
ai:ready-review
ai:needs-fix
ai:approved
ai:ready-merge
```

Every state decision is recomputed from current GitHub state. Events are hints to reconcile, not proof that a transition is valid.

Privileged HEAD-change reconciliation uses `pull_request_target`, and Controller execution loads its module and contract tests only from the repository's trusted default branch. It never executes workflow or Controller code from a pull-request checkout.

A persisted artifact applies only when its embedded 40-character SHA equals current remote PR HEAD.

## State machine

```text
new tracked PR / HEAD changed
        |
        v
 ai:developing
        |
        | exact-HEAD FRESNICA_DEV_HANDOFF
        | State: READY_FOR_REVIEW
        v
 ai:ready-review  -- Controller marks Ready for review
        |
        | exact-HEAD trusted FRESNICA_WORK_REVIEW
        |
        +---- NEEDS_FIX or P1/P2 present ----> ai:needs-fix -- Controller marks Draft
        |                                         |
        |                                         | Fix task pushes new HEAD
        |                                         v
        |                                    ai:developing
        |
        +---- APPROVED and no P1/P2 --------> ai:approved
                                                   |
                                                   | all required exact-HEAD gates successful
                                                   v
                                            ai:ready-merge
                                                   |
                                                   X  V2 v1 stops here
```

## Reconciliation rules

### 1. HEAD changed

On `pull_request.synchronize`, any tracked PR is reconciled to `ai:developing` and Draft unless it is already in that state. Old handoffs/reviews remain historical but are stale for the new HEAD.

This is also the recovery path after a Fix task pushes a repair commit.

### 2. Development handoff

On a PR issue comment containing `<!-- FRESNICA_DEV_HANDOFF -->`, the Controller may advance only when all are true:

- comment is on an open PR;
- current state is `ai:developing` or `ai:needs-fix`;
- comment is trusted for development handoff;
- comment contains `HEAD: <current 40-char remote HEAD>`;
- comment contains `State: READY_FOR_REVIEW`.

Then Controller sets the unique state to `ai:ready-review` and marks the PR Ready for review. This Ready event is the Review task trigger.

### 3. Independent Work review

On a PR issue comment containing `<!-- FRESNICA_WORK_REVIEW -->`, the Controller accepts only a trusted reviewer comment whose `reviewed_head_sha` equals current remote HEAD and whose P1/P2 sections are parseable.

- `NEEDS_FIX`, or any P1/P2 finding, reconciles to `ai:needs-fix` and Draft.
- `APPROVED` with no P1/P2 reconciles to `ai:approved`.
- Contradictory review content fails closed and does not advance state.

The developer handoff is never treated as review proof.

### 4. Gate completion

For `ai:approved`, Controller checks the current HEAD's required checks:

- `test` (CI)
- `realm` (Realm Integration)
- `android` (Native Android Gate)
- `apple` (Native Apple Gate)
- `development-handoff` (AI Handoff Gate)
- `review-gate` (AI Review Gate)

Only when every required check has a successful conclusion for current HEAD may Controller advance to `ai:ready-merge`.

A failed, missing, queued, in-progress, cancelled, skipped, neutral, stale-HEAD, or ambiguous required check does not advance the PR.

`ai:ready-merge` is terminal for V2 v1. No merge API is called.

## Review task contract (thin worker)

Trigger: Pull Request marked Ready for review.

Preflight only:

- operate only on the triggering PR;
- require current unique state `ai:ready-review`;
- require latest exact-HEAD `FRESNICA_DEV_HANDOFF` with `READY_FOR_REVIEW`;
- independently inspect current remote HEAD, actual diff, checks and repository rules.

Output only:

- persist exactly one `<!-- FRESNICA_WORK_REVIEW -->` for the reviewed HEAD;
- include `reviewed_head_sha`, `status`, P1/P2/P3, validation checked, evidence boundaries, deferred items and next action.

The Review task must not change `ai:*` labels, Draft/Ready state, or merge the PR. Controller consumes the persisted review and owns the transition.

## Fix task contract (thin worker)

Trigger: PR receives `ai:needs-fix`.

The task:

- operates only on that PR;
- recovers the exact applicable Work review for current HEAD;
- fixes only applicable P1/P2 findings;
- does not add unrelated scope or edit automation unless the finding itself is about automation;
- validates proportionally;
- commits and pushes a new HEAD;
- persists a new exact-HEAD `FRESNICA_DEV_HANDOFF` with `State: READY_FOR_REVIEW`.

The Fix task must not change `ai:*` labels, Draft/Ready state, or merge. The push causes Controller to reconcile to `ai:developing`; the new handoff causes Controller to advance to `ai:ready-review` and mark Ready.

## AI Handoff Gate contract

The existing handoff gate remains a fail-closed exact-HEAD validator. It does not own state.

## AI Review Gate contract

V2 review gate is a validator, not an orchestrator.

- For `ai:developing`, `ai:ready-review`, and `ai:needs-fix`, the gate reports success after validating that exactly one known `ai:*` state exists. It does not require an APPROVED review yet.
- For `ai:approved` and `ai:ready-merge`, it requires a trusted exact-HEAD `APPROVED` Work review with no P1/P2 findings.
- It never mutates labels, Draft/Ready state, or merge state.

This removes expected/red gate noise before approval while preserving fail-closed merge readiness.

## Trust boundary

Trusted persisted comments are repository-owner comments with `author_association=OWNER` in V2 v1, matching the current repository ownership model. The Controller and gates must independently enforce this instead of trusting worker claims.

## Idempotency and recovery

Every transition is idempotent. Replayed events must converge to the same state without duplicate semantic work.

Controller never advances based on event order alone. It reloads the PR, current HEAD, labels, comments, and checks before deciding.

Immediately before every label or Draft/Ready mutation, Controller re-reads the PR and requires the expected exact HEAD, an allowed source-or-target state, OPEN/unmerged state, and—when creating `ai:ready-merge`—current conflict-free mergeability. It re-reads again after mutation and verifies the exact HEAD, unique target state, and intended Draft/Ready result.

AI state changes add the target AI label first and then remove only the previous AI label. These targeted label operations never replace the full label set, so concurrent non-AI label additions or removals are preserved. If target addition fails, the source label remains available for replay. If source removal fails, replay accepts only the exact source-plus-target pair for that transition and finishes the removal.

If the current state already equals the target, Controller performs no label churn and continues any unfinished Draft/Ready reconciliation. A trusted exact-HEAD handoff or Work review may also recover a missing AI state left by an interrupted earlier transition. Synchronize recovery from a missing state additionally requires the exact event snapshot to prove that the same HEAD was already enrolled with one known AI state.

Unknown/malformed artifacts, stale snapshots, closed/merged PRs, merge conflicts, unrelated or larger multiple-AI-state sets, or an unproven missing state fail closed. Retryable source, target, exact source-plus-target, and proven missing-state snapshots converge when the same valid event is replayed.

## V2 v1 acceptance

Automation V2 v1 is complete when repository tests demonstrate:

- exact-HEAD handoff -> `ai:ready-review`;
- exact-HEAD NEEDS_FIX/P1/P2 -> `ai:needs-fix`;
- repair HEAD change -> `ai:developing`;
- exact-HEAD APPROVED/no P1/P2 -> `ai:approved`;
- all required exact-HEAD gates success -> `ai:ready-merge`;
- stale/malformed/untrusted artifacts do not advance state;
- missing/failing/in-progress gates do not advance state;
- controller never calls merge;
- Review/Fix task contracts contain no label/Draft/Ready/merge ownership.
