'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const {
  currentAiState,
  parseDevelopmentHandoff,
  parseWorkReview,
  targetForReview,
  requiredChecksSatisfied,
  reviewGateDecision,
  trustedOwnerComment,
  validateTransitionSnapshot,
  run,
} = require('./fresnica-controller.cjs');

const HEAD = 'a'.repeat(40);

function pullRequest(overrides = {}) {
  return {
    number: 76,
    state: 'open',
    merged: false,
    merged_at: null,
    mergeable: true,
    head: { sha: HEAD },
    labels: [{ name: 'ai:approved' }],
    ...overrides,
  };
}

function review(status, p1 = 'None', p2 = 'None', head = HEAD) {
  return `<!-- FRESNICA_WORK_REVIEW -->\nreviewed_head_sha: ${head}\nstatus: ${status}\n\nP1:\n- ${p1}\n\nP2:\n- ${p2}\n\nP3:\n- None\n\nVALIDATION_CHECKED:\n- checked`;
}

test('requires exactly one known ai state', () => {
  assert.deepEqual(currentAiState(['bug']), { ok: false, active: [] });
  assert.deepEqual(currentAiState(['ai:developing', 'ai:ready-review']), {
    ok: false,
    active: ['ai:developing', 'ai:ready-review'],
  });
  assert.deepEqual(currentAiState(['bug', 'ai:approved']), { ok: true, state: 'ai:approved' });
});

test('accepts only READY_FOR_REVIEW handoff with a 40-char HEAD', () => {
  assert.deepEqual(parseDevelopmentHandoff(`<!-- FRESNICA_DEV_HANDOFF -->\nHEAD: ${HEAD}\nState: READY_FOR_REVIEW`), {
    head: HEAD,
  });
  assert.equal(parseDevelopmentHandoff('<!-- FRESNICA_DEV_HANDOFF -->\nHEAD: abc\nState: READY_FOR_REVIEW'), undefined);
});

test('maps blocking review to needs-fix and clean approval to approved', () => {
  const needsFix = parseWorkReview(review('NEEDS_FIX', 'None', 'missing exact check'));
  assert.deepEqual(targetForReview(needsFix), { ok: true, state: 'ai:needs-fix', draft: true });
  const approved = parseWorkReview(review('APPROVED'));
  assert.deepEqual(targetForReview(approved), { ok: true, state: 'ai:approved', draft: false });
});

test('rejects contradictory APPROVED review containing P1/P2', () => {
  const parsed = parseWorkReview(review('APPROVED', 'critical finding', 'None'));
  assert.deepEqual(targetForReview(parsed), {
    ok: false,
    reason: 'APPROVED review contains blocking P1/P2 findings',
  });
});

test('requires all exact-head gate names successful and review-gate after approval', () => {
  const approvedAt = Date.parse('2026-10-08T01:00:00Z');
  const checks = ['test', 'realm', 'android', 'apple', 'development-handoff', 'review-gate'].map((name, index) => ({
    name,
    conclusion: 'success',
    started_at: index === 5 ? '2026-10-08T01:00:01Z' : '2026-10-08T00:59:00Z',
  }));
  assert.deepEqual(requiredChecksSatisfied(checks, approvedAt), { ok: true, missing: [], notSuccessful: [] });

  const staleReviewGate = checks.map(check =>
    check.name === 'review-gate' ? { ...check, started_at: '2026-10-08T00:59:59Z' } : check,
  );
  assert.equal(requiredChecksSatisfied(staleReviewGate, approvedAt).ok, false);
  assert.deepEqual(
    requiredChecksSatisfied(
      checks.filter(check => check.name !== 'apple'),
      approvedAt,
    ).missing,
    ['apple'],
  );
});

test('review gate stays green before approval and fails closed after approval', () => {
  assert.deepEqual(reviewGateDecision('ai:ready-review', undefined, HEAD), { ok: true, requiresReview: false });
  assert.equal(reviewGateDecision('ai:approved', undefined, HEAD).ok, false);
  assert.deepEqual(reviewGateDecision('ai:approved', parseWorkReview(review('APPROVED')), HEAD), {
    ok: true,
    requiresReview: true,
  });
  assert.equal(reviewGateDecision('ai:ready-merge', parseWorkReview(review('NEEDS_FIX')), HEAD).ok, false);
});

test('trusts only repository owner OWNER comments', () => {
  assert.equal(trustedOwnerComment({ user: { login: 'luneShaoGM' }, author_association: 'OWNER' }, 'luneShaoGM'), true);
  assert.equal(trustedOwnerComment({ user: { login: 'bot' }, author_association: 'MEMBER' }, 'luneShaoGM'), false);
});

test('transition snapshots require exact HEAD, unique expected state and open unmerged PR', () => {
  assert.deepEqual(validateTransitionSnapshot(pullRequest(), HEAD, ['ai:approved'], true), {
    ok: true,
    state: 'ai:approved',
  });
  assert.equal(
    validateTransitionSnapshot(pullRequest({ head: { sha: 'b'.repeat(40) } }), HEAD, ['ai:approved']).ok,
    false,
  );
  assert.equal(validateTransitionSnapshot(pullRequest({ state: 'closed' }), HEAD, ['ai:approved']).ok, false);
  assert.equal(validateTransitionSnapshot(pullRequest({ merged: true }), HEAD, ['ai:approved']).ok, false);
  assert.equal(
    validateTransitionSnapshot(pullRequest({ labels: [{ name: 'ai:developing' }] }), HEAD, ['ai:approved']).ok,
    false,
  );
  assert.equal(validateTransitionSnapshot(pullRequest({ mergeable: false }), HEAD, ['ai:approved'], true).ok, false);
});

test('privileged controller loads code only from the trusted default branch', () => {
  const workflow = fs.readFileSync(require.resolve('../.github/workflows/fresnica-controller.yml'), 'utf8');
  assert.equal(workflow.includes('pull_request_target:'), true);
  assert.equal(workflow.includes('ref: ${{ github.event.repository.default_branch }}'), true);
  assert.equal(workflow.includes('persist-credentials: false'), true);
});

test('controller v1 contains no merge API call', () => {
  const source = fs.readFileSync(require.resolve('./fresnica-controller.cjs'), 'utf8');
  assert.equal(source.includes('.merge('), false);
  assert.equal(source.includes('mergePullRequest'), false);
});

function controllerHarness({ labels, draft, body, failSetLabels = 0, failGraphql = 0 }) {
  const pr = pullRequest({
    labels: labels.map(name => ({ name })),
    draft,
    node_id: 'PR_76',
  });
  const calls = { setLabels: 0, graphql: 0 };
  const github = {
    rest: {
      pulls: {
        get: async () => ({ data: JSON.parse(JSON.stringify(pr)) }),
      },
      issues: {
        setLabels: async ({ labels: nextLabels }) => {
          calls.setLabels += 1;
          if (failSetLabels > 0) {
            failSetLabels -= 1;
            throw new Error('injected label failure');
          }
          pr.labels = nextLabels.map(name => ({ name }));
        },
      },
    },
    graphql: async mutation => {
      calls.graphql += 1;
      if (failGraphql > 0) {
        failGraphql -= 1;
        throw new Error('injected GraphQL failure');
      }
      pr.draft = mutation.includes('convertPullRequestToDraft');
    },
  };
  const context = {
    repo: { owner: 'luneShaoGM', repo: 'fresnica' },
    eventName: 'issue_comment',
    payload: {
      action: 'created',
      issue: { number: 76, pull_request: {} },
      comment: {
        id: 1,
        body,
        user: { login: 'luneShaoGM' },
        author_association: 'OWNER',
      },
    },
  };
  const core = { info() {}, notice() {}, setFailed() {} };
  return { pr, calls, github, context, core };
}

const handoff = `<!-- FRESNICA_DEV_HANDOFF -->\nHEAD: ${HEAD}\nState: READY_FOR_REVIEW`;

test('retries an atomic label failure without losing the source state', async () => {
  const harness = controllerHarness({
    labels: ['documentation', 'ai:developing'],
    draft: true,
    body: handoff,
    failSetLabels: 1,
  });

  await assert.rejects(run(harness), /injected label failure/);
  assert.deepEqual(
    harness.pr.labels.map(label => label.name),
    ['documentation', 'ai:developing'],
  );

  await run(harness);
  assert.deepEqual(
    harness.pr.labels.map(label => label.name),
    ['documentation', 'ai:ready-review'],
  );
  assert.equal(harness.pr.draft, false);
});

test('replays a handoff from the target label after Ready mutation failure', async () => {
  const harness = controllerHarness({
    labels: ['ai:developing'],
    draft: true,
    body: handoff,
    failGraphql: 1,
  });

  await assert.rejects(run(harness), /injected GraphQL failure/);
  assert.deepEqual(harness.pr.labels, [{ name: 'ai:ready-review' }]);
  assert.equal(harness.pr.draft, true);

  await run(harness);
  assert.equal(harness.calls.setLabels, 1);
  assert.equal(harness.calls.graphql, 2);
  assert.equal(harness.pr.draft, false);
});

test('replays a NEEDS_FIX review from its target label after Draft mutation failure', async () => {
  const harness = controllerHarness({
    labels: ['ai:ready-review'],
    draft: false,
    body: review('NEEDS_FIX', 'None', 'blocking finding'),
    failGraphql: 1,
  });

  await assert.rejects(run(harness), /injected GraphQL failure/);
  assert.deepEqual(harness.pr.labels, [{ name: 'ai:needs-fix' }]);
  assert.equal(harness.pr.draft, false);

  await run(harness);
  assert.equal(harness.calls.setLabels, 1);
  assert.equal(harness.calls.graphql, 2);
  assert.equal(harness.pr.draft, true);
});

test('trusted exact-head handoff recovers a missing ai state without dropping other labels', async () => {
  const harness = controllerHarness({
    labels: ['documentation'],
    draft: true,
    body: handoff,
  });

  await run(harness);
  assert.deepEqual(
    harness.pr.labels.map(label => label.name),
    ['documentation', 'ai:ready-review'],
  );
  assert.equal(harness.pr.draft, false);
});
