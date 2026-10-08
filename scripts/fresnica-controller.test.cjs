'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const { classifyGatePlan } = require('./fresnica-gate-planner.cjs');
const {
  currentAiState,
  parseDevelopmentHandoff,
  parseWorkReview,
  targetForReview,
  requiredChecksSatisfied,
  reviewGateDecision,
  trustedOwnerComment,
  runReviewGate,
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

test('not-applicable heavy gates keep fixed required checks without heavy evidence', () => {
  const approvedAt = Date.parse('2026-10-08T01:00:00Z');
  const checks = ['test', 'realm', 'android', 'apple', 'development-handoff', 'review-gate'].map((name, index) => ({
    name,
    conclusion: 'success',
    started_at: index === 5 ? '2026-10-08T01:00:01Z' : '2026-10-08T00:59:00Z',
  }));
  const plan = classifyGatePlan(['.github/workflows/fresnica-controller.yml']);
  assert.deepEqual(requiredChecksSatisfied(checks, approvedAt, plan), { ok: true, missing: [], notSuccessful: [] });
});

test('applicable heavy gates require fresh post-approval heavy and fixed successes', () => {
  const approvedAt = Date.parse('2026-10-08T01:00:00Z');
  const plan = classifyGatePlan(['src/features/send/SendScreen.tsx']);
  const base = ['test', 'realm', 'android', 'apple', 'development-handoff', 'review-gate'].map(name => ({
    name,
    conclusion: 'success',
    started_at: name === 'review-gate' ? '2026-10-08T01:00:01Z' : '2026-10-08T00:59:00Z',
  }));

  const missingHeavy = requiredChecksSatisfied(base, approvedAt, plan);
  assert.deepEqual(missingHeavy.missing.sort(), ['android-heavy', 'apple-heavy']);
  assert.ok(missingHeavy.notSuccessful.includes('android:predates-ai-approved'));
  assert.ok(missingHeavy.notSuccessful.includes('apple:predates-ai-approved'));

  const fresh = base.map(check =>
    ['android', 'apple'].includes(check.name) ? { ...check, started_at: '2026-10-08T01:02:00Z' } : check,
  );
  fresh.push(
    { name: 'android-heavy', conclusion: 'success', started_at: '2026-10-08T01:01:00Z' },
    { name: 'apple-heavy', conclusion: 'success', started_at: '2026-10-08T01:01:30Z' },
  );
  assert.deepEqual(requiredChecksSatisfied(fresh, approvedAt, plan), { ok: true, missing: [], notSuccessful: [] });

  fresh.push(
    { name: 'android-heavy', conclusion: 'skipped', started_at: '2026-10-08T01:03:00Z' },
    { name: 'apple-heavy', conclusion: 'skipped', started_at: '2026-10-08T01:03:30Z' },
  );
  assert.deepEqual(requiredChecksSatisfied(fresh, approvedAt, plan), { ok: true, missing: [], notSuccessful: [] });

  fresh[6] = { ...fresh[6], started_at: '2026-10-08T00:58:00Z' };
  assert.ok(
    requiredChecksSatisfied(fresh, approvedAt, plan).notSuccessful.includes('android-heavy:predates-ai-approved'),
  );

  const laterFailure = [
    ...fresh,
    { name: 'android-heavy', conclusion: 'failure', started_at: '2026-10-08T01:04:00Z' },
  ];
  assert.ok(requiredChecksSatisfied(laterFailure, approvedAt, plan).notSuccessful.includes('android-heavy:failure'));
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

test('review gate reloads durable labels and accepts the exact ready-merge recovery pair', async () => {
  const workflow = fs.readFileSync(require.resolve('../.github/workflows/ai-review-gate.yml'), 'utf8');
  assert.match(workflow, /- labeled\s+- unlabeled/);
  assert.match(workflow, /runReviewGate\(\{ github, context, core \}\)/);

  let pullsGet = 0;
  let durableLabels = ['ai:approved'];
  const github = {
    rest: {
      pulls: {
        get: async () => {
          pullsGet += 1;
          return { data: pullRequest({ labels: durableLabels.map(name => ({ name })) }) };
        },
      },
      issues: { listComments: async () => undefined },
    },
    paginate: async () => [
      {
        body: review('APPROVED'),
        user: { login: 'luneShaoGM' },
        author_association: 'OWNER',
        created_at: '2026-10-08T01:00:00Z',
      },
    ],
  };
  const context = {
    repo: { owner: 'luneShaoGM', repo: 'fresnica' },
    payload: {
      action: 'labeled',
      pull_request: pullRequest({
        labels: [{ name: 'ai:ready-review' }, { name: 'ai:approved' }],
      }),
    },
  };
  const failures = [];
  const info = [];
  const core = {
    setFailed: message => failures.push(message),
    info: message => info.push(message),
  };

  await runReviewGate({ github, context, core });

  assert.equal(pullsGet, 1);
  assert.deepEqual(failures, []);
  assert.deepEqual(info, ['Valid exact-HEAD APPROVED Work review for PR #76.']);

  durableLabels = ['ai:approved', 'ai:ready-merge'];
  await runReviewGate({ github, context, core });

  assert.equal(pullsGet, 2);
  assert.deepEqual(failures, []);
  assert.deepEqual(info, [
    'Valid exact-HEAD APPROVED Work review for PR #76.',
    'Valid exact-HEAD APPROVED Work review for PR #76.',
  ]);
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

function controllerHarness({
  labels,
  draft,
  body,
  failAddLabels = 0,
  failRemoveLabel = 0,
  failGraphql = 0,
  concurrentAddLabel,
  concurrentRemoveLabel,
}) {
  const pr = pullRequest({
    labels: labels.map(name => ({ name })),
    draft,
    node_id: 'PR_76',
  });
  const calls = { addLabels: 0, removeLabel: 0, graphql: 0 };
  const github = {
    rest: {
      pulls: {
        get: async () => ({ data: JSON.parse(JSON.stringify(pr)) }),
      },
      issues: {
        addLabels: async ({ labels: addedLabels }) => {
          calls.addLabels += 1;
          if (failAddLabels > 0) {
            failAddLabels -= 1;
            throw new Error('injected label add failure');
          }
          if (concurrentRemoveLabel) {
            pr.labels = pr.labels.filter(label => label.name !== concurrentRemoveLabel);
            concurrentRemoveLabel = undefined;
          }
          if (concurrentAddLabel && !pr.labels.some(label => label.name === concurrentAddLabel)) {
            pr.labels.push({ name: concurrentAddLabel });
            concurrentAddLabel = undefined;
          }
          for (const name of addedLabels) {
            if (!pr.labels.some(label => label.name === name)) pr.labels.push({ name });
          }
        },
        removeLabel: async ({ name }) => {
          calls.removeLabel += 1;
          if (failRemoveLabel > 0) {
            failRemoveLabel -= 1;
            throw new Error('injected label remove failure');
          }
          if (!pr.labels.some(label => label.name === name)) {
            const error = new Error('missing label');
            error.status = 404;
            throw error;
          }
          pr.labels = pr.labels.filter(label => label.name !== name);
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

test('retries a target-label add failure without losing the source state', async () => {
  const harness = controllerHarness({
    labels: ['documentation', 'ai:developing'],
    draft: true,
    body: handoff,
    failAddLabels: 1,
  });

  await assert.rejects(run(harness), /injected label add failure/);
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

test('replays a target-first transition after source-label removal failure', async () => {
  const harness = controllerHarness({
    labels: ['documentation', 'ai:developing'],
    draft: true,
    body: handoff,
    failRemoveLabel: 1,
  });

  await assert.rejects(run(harness), /injected label remove failure/);
  assert.deepEqual(
    harness.pr.labels.map(label => label.name),
    ['documentation', 'ai:developing', 'ai:ready-review'],
  );

  await run(harness);
  assert.equal(harness.calls.addLabels, 1);
  assert.equal(harness.calls.removeLabel, 2);
  assert.deepEqual(
    harness.pr.labels.map(label => label.name),
    ['documentation', 'ai:ready-review'],
  );
  assert.equal(harness.pr.draft, false);
});

test('replays ready-merge after source removal failure despite newer skipped Heavy runs', async () => {
  const harness = controllerHarness({
    labels: ['ai:approved'],
    draft: false,
    body: '',
    failRemoveLabel: 1,
  });
  const approvedAt = '2026-10-08T01:00:00Z';
  const checks = [
    { name: 'test', conclusion: 'success', started_at: '2026-10-08T00:59:00Z' },
    { name: 'realm', conclusion: 'success', started_at: '2026-10-08T00:59:00Z' },
    { name: 'android', conclusion: 'success', started_at: '2026-10-08T01:02:00Z' },
    { name: 'apple', conclusion: 'success', started_at: '2026-10-08T01:02:00Z' },
    { name: 'development-handoff', conclusion: 'success', started_at: '2026-10-08T00:59:00Z' },
    { name: 'review-gate', conclusion: 'success', started_at: '2026-10-08T01:01:00Z' },
    { name: 'android-heavy', conclusion: 'success', started_at: '2026-10-08T01:01:15Z' },
    { name: 'apple-heavy', conclusion: 'success', started_at: '2026-10-08T01:01:30Z' },
  ];
  const checkFilters = [];
  const listFiles = async () => undefined;
  const listEventsForTimeline = async () => undefined;
  harness.github.rest.pulls.listFiles = listFiles;
  harness.github.rest.issues.listEventsForTimeline = listEventsForTimeline;
  harness.github.rest.checks = {
    listForRef: async options => {
      checkFilters.push(options.filter);
      return { data: { check_runs: checks } };
    },
  };
  harness.github.paginate = async operation => {
    if (operation === listFiles) return [{ filename: 'src/features/send/SendScreen.tsx' }];
    if (operation === listEventsForTimeline) {
      return [{ event: 'labeled', label: { name: 'ai:approved' }, created_at: approvedAt }];
    }
    throw new Error('unexpected pagination target');
  };
  harness.context.eventName = 'workflow_run';
  harness.context.payload = {
    action: 'completed',
    workflow_run: {
      conclusion: 'success',
      pull_requests: [{ number: 76 }],
      head_sha: HEAD,
    },
  };

  await assert.rejects(run(harness), /injected label remove failure/);
  assert.deepEqual(
    harness.pr.labels.map(label => label.name),
    ['ai:approved', 'ai:ready-merge'],
  );

  checks.push(
    { name: 'android', conclusion: 'success', started_at: '2026-10-08T01:03:00Z' },
    { name: 'apple', conclusion: 'success', started_at: '2026-10-08T01:03:00Z' },
    { name: 'review-gate', conclusion: 'success', started_at: '2026-10-08T01:03:00Z' },
    { name: 'android-heavy', conclusion: 'skipped', started_at: '2026-10-08T01:03:15Z' },
    { name: 'apple-heavy', conclusion: 'skipped', started_at: '2026-10-08T01:03:30Z' },
  );

  await run(harness);

  assert.deepEqual(checkFilters, ['all', 'all']);
  assert.equal(harness.calls.addLabels, 1);
  assert.equal(harness.calls.removeLabel, 2);
  assert.deepEqual(harness.pr.labels, [{ name: 'ai:ready-merge' }]);
});

test('does not overwrite concurrent non-ai label additions or removals', async () => {
  const harness = controllerHarness({
    labels: ['documentation', 'ai:developing'],
    draft: true,
    body: handoff,
    concurrentAddLabel: 'priority',
    concurrentRemoveLabel: 'documentation',
  });

  await run(harness);
  assert.deepEqual(
    harness.pr.labels.map(label => label.name),
    ['priority', 'ai:ready-review'],
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
  assert.equal(harness.calls.addLabels, 1);
  assert.equal(harness.calls.removeLabel, 1);
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
  assert.equal(harness.calls.addLabels, 1);
  assert.equal(harness.calls.removeLabel, 1);
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
