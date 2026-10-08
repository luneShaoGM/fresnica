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
} = require('./fresnica-controller.cjs');

const HEAD = 'a'.repeat(40);

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

test('controller v1 contains no merge API call', () => {
  const source = fs.readFileSync(require.resolve('./fresnica-controller.cjs'), 'utf8');
  assert.equal(source.includes('.merge('), false);
  assert.equal(source.includes('mergePullRequest'), false);
});
