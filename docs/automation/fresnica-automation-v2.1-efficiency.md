# Fresnica Automation V2.1 — Review and Gate Efficiency

Status: FROZEN for Automation V2.1 implementation.

Baseline: `main@d1363e5505ede697dc50bb487c16eaa4097cf179`.

## Scope

V2.1 optimizes automation/review/gate execution only. It does not change product behavior, product acceptance semantics, exact-HEAD validity, reviewer trust, blocking severity, mergeability, or fail-closed boundaries.

## Review modes

Every independent Work review declares exactly one mode.

### FULL_REVIEW

Use for the first independent review of a PR, or whenever a repair delta materially expands architecture, security, persistence, transaction/network, native, or other directly safety-critical scope.

Review the actual PR diff and relevant surrounding surfaces proportionally to the change.

### REPAIR_REVIEW

Use when the current HEAD was produced primarily to repair the immediately previous applicable Work review.

Review only:

1. every P1/P2 from that previous review;
2. the delta from previous `reviewed_head_sha` to current HEAD;
3. direct correctness/security/regression impact of that delta;
4. exact-HEAD evidence needed for the repaired surfaces.

Do not repeat unaffected validation already proven for unchanged code/environment. Escalate to FULL_REVIEW only when the repair delta materially broadens a safety-critical scope.

A review is valid only for its exact `reviewed_head_sha`. Old-HEAD approval is never reusable after HEAD changes.

## Fix contract

A Fix worker must repair all applicable P1/P2 from the current exact-HEAD NEEDS_FIX review in one repair pass. It must not create one repair HEAD per finding. New unrelated scope is forbidden.

## Gate Planner

Every exact HEAD is classified from its changed files. Categories are additive:

- `automation/docs/controller-only`
- `product-js/shared`
- `realm/persistence-impacting`
- `android-impacting`
- `apple-impacting`
- `native/shared-impacting`

The planner produces three Heavy Gate applicability decisions: Realm, Android, Apple.

Conservative rules:

- automation/docs/controller-only: no Heavy Gate is applicable;
- product JS/shared: Android + Apple are applicable;
- Realm/persistence: Realm is applicable and, because it is product JS, Android + Apple are also applicable;
- Android-specific: Android is applicable;
- Apple-specific: Apple is applicable;
- native/shared or dependency/toolchain changes that can affect both native platforms: Android + Apple are applicable; Realm is also applicable when persistence/dependency risk cannot be separated safely.
- unknown product/runtime paths fail closed into the product/native Heavy Gate set rather than silently becoming not-applicable.

## Fast vs Heavy Gates

Fast Gates remain exact-HEAD and run during development/repair loops:

- CI `test`;
- AI Handoff Gate when an exact-HEAD handoff is submitted;
- AI Review Gate according to the current V2 state.

Realm, Native Android, and Native Apple remain fixed required check names for every PR HEAD. Their workflows always produce a terminal check for the HEAD, but Heavy work is conditional:

- if planner says not applicable, the fixed gate succeeds with an explicit not-applicable disposition;
- if applicable but the durable PR state is not exactly `ai:approved`, the fixed gate succeeds as deferred and the heavy sub-check is skipped;
- when exact-HEAD Work review is APPROVED and Controller reaches `ai:approved`, label events rerun the workflow; applicable Heavy work executes then.

Heavy validation is never inferred from a pre-approval deferred success. For every applicable Heavy Gate, Controller requires a corresponding `*-heavy` success on the same HEAD with a start time at or after the latest `ai:approved` transition.

For a not-applicable Heavy Gate, Controller independently recomputes the trusted Gate Plan and accepts the fixed successful gate without requiring a heavy sub-check. Thus required checks never disappear and not-applicable is explicit and verifiable.

## Exact-HEAD and stale evidence

Gate applicability is recomputed for current PR files by Controller from trusted default-branch planner code. All check runs are queried by current HEAD. A HEAD change invalidates prior-HEAD review and prior-HEAD Heavy evidence automatically.

No applicable Heavy Gate may reuse a successful heavy check that predates the current HEAD's latest `ai:approved` transition.

During the target-first `ai:approved` to `ai:ready-merge` transition, later Heavy checks skipped because the PR is leaving `ai:approved` do not invalidate an earlier successful post-approval Heavy result for the same HEAD. Controller reads all current-HEAD check runs, ignores only skipped Heavy entries, and still lets any later failed, cancelled, queued, or in-progress Heavy result block progression. AI Review Gate accepts only the exact `ai:approved` plus `ai:ready-merge` pair as a recoverable transition snapshot, while continuing to fail closed for every other multiple-state combination.

## Safety invariants unchanged

V2.1 does not weaken:

- exact-HEAD `FRESNICA_DEV_HANDOFF`;
- exact-HEAD independent `FRESNICA_WORK_REVIEW`;
- P1/P2 blocking;
- trusted reviewer boundary;
- mergeability/conflict validation;
- fail-closed state transitions;
- network/account/transaction/native evidence requirements;
- Automation V2 v1 no-auto-merge boundary.
