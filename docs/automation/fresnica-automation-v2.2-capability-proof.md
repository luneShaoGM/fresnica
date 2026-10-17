# Fresnica Automation V2.2 — Capability Proof

Status: CAPABILITY PROOF ONLY. No new Controller implementation is authorized until the required producer/trigger capability is proven.

Baseline: `main@7fcc695189c6bcfd57eff9e291cb1cf1eae61c35`.

## Capability Matrix

| Capability                                                                         | Status                    | Evidence / rule                                                                                                        |
| ---------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Actions `GITHUB_TOKEN` -> convert PR to Draft                                      | `UNSUPPORTED`             | Live Controller runs returned GraphQL `Resource not accessible by integration`. Do not use as a design prerequisite.   |
| Actions `GITHUB_TOKEN` -> mark PR Ready for review                                 | `UNSUPPORTED`             | Same GitHub GraphQL permission boundary. Do not use as a design prerequisite.                                          |
| Actions `GITHUB_TOKEN` writes a `labeled` event -> another GitHub Actions workflow | `UNSUPPORTED BY DESIGN`   | GitHub Actions-generated events are not a reliable workflow chaining mechanism. V2.2 must not depend on it.            |
| `ai:needs-fix` -> `Fix Fresnica Review` ChatGPT Task                               | `PROVEN`                  | Existing real Fresnica repair runs have been triggered by the label and produced new repair HEADs/handoffs.            |
| Ready-for-review -> `Review Fresnica PR` ChatGPT Task                              | `UNRELIABLE / NOT_PROVEN` | Multiple real recovery attempts failed to reliably create a durable Review run/comment. Do not depend on it.           |
| Controller writes `ai:ready-review` -> ChatGPT Review Task                         | `UNKNOWN`                 | This V2.2 proof exists solely to test this path using a Controller-produced label and a temporary low-cost probe Task. |

A capability may move from `UNKNOWN` only after durable end-to-end evidence exists. Do not infer support from UI configuration, prompt text, or a manually produced label.

## Proof protocol: Controller `ai:ready-review` -> Review Task

The proof PR is automation/docs-only, remains Ready, and starts with unique state `ai:developing`.

Before the trusted DEV_HANDOFF is created, a temporary `Review Label Probe` Task must exist with exactly this trigger:

- repository: `luneShaoGM/fresnica`;
- pull request: this capability-proof PR only;
- event/condition: `ai:ready-review` label is added;
- no Ready-for-review event trigger;
- no review, diff scan, tests, labels, Draft/Ready, HEAD, or merge mutation.

When triggered, the probe persists exactly one PR comment containing a unique marker and:

- PR number;
- exact current remote HEAD;
- trigger label (`ai:ready-review`);
- trigger actor/source if exposed by the task event;
- trigger timestamp.

Then execute the one-shot proof chain:

```text
trusted exact-HEAD FRESNICA_DEV_HANDOFF
-> Fresnica Controller
-> Controller uses Actions GITHUB_TOKEN to add ai:ready-review
-> Review Label Probe Task
-> durable probe marker on the same PR/exact HEAD
```

Ordinary Chat must not manually add `ai:ready-review` during this proof.

Outcome:

- durable probe marker caused by the Controller-produced label -> `PROVEN`;
- no durable probe marker after the configured task's normal execution window -> `UNSUPPORTED / NOT_PROVEN`.

If not proven, stop the direct label-to-Review-Task Controller design. Evaluate a different authorized trigger mechanism before changing Controller code.

## Work Evidence Budget

The evidence budget reduces review token/work cost without weakening exact-HEAD or fail-closed rules.

### FULL_REVIEW default budget

Load by default:

1. current PR and exact remote HEAD;
2. current PR diff / changed files;
3. applicable repository/project rules;
4. exact-HEAD check summary;
5. only code/context selected by risk signals from the current diff.

Expand evidence only when the current diff indicates architecture, security, persistence, transaction/network, native, data-integrity, failure/retry, or similar risk.

### REPAIR_REVIEW default budget

Load by default:

1. immediately previous applicable `FRESNICA_WORK_REVIEW` only;
2. previous `reviewed_head_sha -> current HEAD` repair diff;
3. directly affected code and tests;
4. exact-HEAD check summary.

Verify all previous applicable P1/P2 and direct repair regressions. Escalate to FULL_REVIEW only when the repair delta materially expands a safety-critical scope.

### Check evidence budget

For a successful check, read only by default:

- check name;
- exact HEAD association;
- conclusion;
- relevant timestamp.

Do not fetch complete successful job logs by default.

Expand a job/log only when:

- conclusion is failure/cancelled/abnormal/pending unexpectedly;
- check identity/freshness is ambiguous;
- a review finding depends on the detailed execution evidence;
- a security/data-integrity/native evidence concern requires it.

### Default prohibited evidence expansion

Do not by default:

- reread all historical reviews or handoffs;
- reread complete old PR diffs;
- scan unrelated modules;
- fetch full logs for SUCCESS checks;
- repeat unaffected validation already proven for unchanged code/environment.

## Safety boundaries unchanged

V2.2 capability proof and evidence budgeting do not weaken:

- exact-HEAD DEV_HANDOFF validity;
- exact-HEAD independent WORK_REVIEW validity;
- P1/P2 blocking;
- trusted reviewer boundary;
- fail-closed state semantics;
- mergeability/conflict checks;
- transaction/network/account integrity;
- persistence/data-integrity evidence requirements;
- native evidence requirements.

No new product slice or product behavior is part of this proof.
