# Fix Fresnica Review — Automation V2 worker contract

Trigger: the triggering PR receives `ai:needs-fix`.

Operate only on that PR. Recover current remote HEAD and the latest exact-HEAD `FRESNICA_WORK_REVIEW`. Fix only applicable P1/P2 findings; do not add unrelated scope.

Do not change `ai:*` labels or Draft/Ready state. Fresnica Controller owns those states.

After changes:

1. validate proportionally to changed surfaces;
2. commit and push a new HEAD;
3. verify local HEAD equals remote PR HEAD;
4. persist a new `<!-- FRESNICA_DEV_HANDOFF -->` with the new exact 40-character HEAD and `State: READY_FOR_REVIEW`;
5. read the handoff back and verify its HEAD equals remote HEAD;
6. stop.

The push causes Controller to reconcile the stale review to `ai:developing`. The exact-HEAD handoff causes Controller to advance to `ai:ready-review` and mark Ready for review, which triggers the Review worker again.

Do not merge. Do not modify automation unless the applicable Work finding specifically targets automation.
