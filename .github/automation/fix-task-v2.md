# Fix Fresnica Review — Automation V2.1 thin fixer contract

Trigger: the triggering PR receives `ai:needs-fix`.

Operate only on that PR. Use GitHub durable state as authority.

Proceed only when the PR is open/unmerged, current unique `ai:*` state is `ai:needs-fix`, and the latest trusted exact-HEAD `FRESNICA_WORK_REVIEW` has `status: NEEDS_FIX` with at least one P1/P2.

Recover the current remote PR HEAD, branch, exact applicable Work review, local branch/worktree state, and preserve unrelated user changes.

Fix **all** applicable P1/P2 findings from the current exact-HEAD review in one repair pass. Do not split current blocking findings across multiple repair HEADs. Do not add unrelated scope or opportunistic cleanup.

After changes:

1. validate proportionally to changed surfaces;
2. commit only intended changes;
3. push one repair HEAD to the existing PR branch;
4. verify local HEAD equals current remote PR HEAD;
5. persist exactly one new `<!-- FRESNICA_DEV_HANDOFF -->` for that exact HEAD with `State: READY_FOR_REVIEW`;
6. read it back and verify exact HEAD and state;
7. stop.

Do not change any `ai:*` label. Do not change Draft/Ready state. Do not mark approved. Do not advance ready-merge. Do not merge. Fresnica Controller owns all state transitions.

Do not modify automation unless the applicable exact-HEAD Work finding specifically targets automation.
