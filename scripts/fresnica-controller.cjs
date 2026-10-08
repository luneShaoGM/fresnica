'use strict';

const AI_STATES = Object.freeze(['ai:developing', 'ai:ready-review', 'ai:needs-fix', 'ai:approved', 'ai:ready-merge']);

const REQUIRED_CHECKS = Object.freeze(['test', 'realm', 'android', 'apple', 'development-handoff', 'review-gate']);

const DEV_HANDOFF_MARKER = '<!-- FRESNICA_DEV_HANDOFF -->';
const WORK_REVIEW_MARKER = '<!-- FRESNICA_WORK_REVIEW -->';

function currentAiState(labels) {
  const active = labels.filter(label => AI_STATES.includes(typeof label === 'string' ? label : label.name));
  if (active.length !== 1) {
    return { ok: false, active: active.map(label => (typeof label === 'string' ? label : label.name)) };
  }
  return { ok: true, state: typeof active[0] === 'string' ? active[0] : active[0].name };
}

function parseSha(body, field) {
  const match = body.match(new RegExp(field + ':\\s*`?([0-9a-f]{40})`?', 'i'));
  return match ? match[1].toLowerCase() : undefined;
}

function parseDevelopmentHandoff(body) {
  if (!body.includes(DEV_HANDOFF_MARKER)) return undefined;
  const head = parseSha(body, 'HEAD');
  if (!head || !/State:\s*READY_FOR_REVIEW/i.test(body)) return undefined;
  return { head };
}

function getSection(body, name, nextSections) {
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const next = nextSections.map(escape).join('|');
  const pattern = next
    ? new RegExp(`(?:^|\\n)${escape(name)}:\\s*\\n([\\s\\S]*?)(?=\\n(?:${next}):|$)`, 'i')
    : new RegExp(`(?:^|\\n)${escape(name)}:\\s*\\n([\\s\\S]*)$`, 'i');
  return body.match(pattern)?.[1].trim();
}

function hasFinding(section) {
  if (section === undefined) return undefined;
  const normalized = section
    .replace(/^[\s*-]+/gm, '')
    .trim()
    .toLowerCase();
  return !['', 'none', 'none.', '0'].includes(normalized);
}

function parseWorkReview(body) {
  if (!body.includes(WORK_REVIEW_MARKER)) return undefined;
  const reviewedHeadSha = parseSha(body, 'reviewed_head_sha');
  const statusMatch = body.match(/status:\s*`?(NEEDS_FIX|APPROVED)`?/i);
  const p1 = getSection(body, 'P1', [
    'P2',
    'P3',
    'VALIDATION_CHECKED',
    'EVIDENCE_BOUNDARIES',
    'DEFERRED',
    'NEXT_ACTION',
  ]);
  const p2 = getSection(body, 'P2', ['P3', 'VALIDATION_CHECKED', 'EVIDENCE_BOUNDARIES', 'DEFERRED', 'NEXT_ACTION']);
  if (!reviewedHeadSha || !statusMatch || p1 === undefined || p2 === undefined) return undefined;
  return {
    reviewedHeadSha,
    status: statusMatch[1].toUpperCase(),
    hasP1: hasFinding(p1),
    hasP2: hasFinding(p2),
  };
}

function targetForReview(review) {
  if (review.status === 'APPROVED' && (review.hasP1 || review.hasP2)) {
    return { ok: false, reason: 'APPROVED review contains blocking P1/P2 findings' };
  }
  if (review.status === 'NEEDS_FIX' || review.hasP1 || review.hasP2) {
    return { ok: true, state: 'ai:needs-fix', draft: true };
  }
  if (review.status === 'APPROVED') {
    return { ok: true, state: 'ai:approved', draft: false };
  }
  return { ok: false, reason: `Unsupported review status ${review.status}` };
}

function latestChecksByName(checkRuns) {
  const latest = new Map();
  for (const check of checkRuns) {
    if (!REQUIRED_CHECKS.includes(check.name)) continue;
    const timestamp = Date.parse(check.started_at || check.created_at || 0);
    const current = latest.get(check.name);
    if (!current || timestamp >= current.timestamp) latest.set(check.name, { check, timestamp });
  }
  return latest;
}

function requiredChecksSatisfied(checkRuns, approvedAt) {
  const latest = latestChecksByName(checkRuns);
  const missing = [];
  const notSuccessful = [];
  for (const name of REQUIRED_CHECKS) {
    const entry = latest.get(name);
    if (!entry) {
      missing.push(name);
      continue;
    }
    if ((entry.check.conclusion || '').toLowerCase() !== 'success') {
      notSuccessful.push(`${name}:${entry.check.conclusion || entry.check.status || 'unknown'}`);
    }
  }

  const reviewGate = latest.get('review-gate');
  if (reviewGate && approvedAt !== undefined && reviewGate.timestamp < approvedAt) {
    notSuccessful.push('review-gate:predates-ai-approved');
  }

  return {
    ok: missing.length === 0 && notSuccessful.length === 0,
    missing,
    notSuccessful,
  };
}

function reviewGateDecision(aiState, review, headSha) {
  if (['ai:developing', 'ai:ready-review', 'ai:needs-fix'].includes(aiState)) {
    return { ok: true, requiresReview: false };
  }
  if (!['ai:approved', 'ai:ready-merge'].includes(aiState)) {
    return { ok: false, reason: `Unsupported ai state ${aiState}` };
  }
  if (!review) {
    return { ok: false, reason: 'No trusted FRESNICA_WORK_REVIEW is available.' };
  }
  if (review.reviewedHeadSha !== headSha.toLowerCase()) {
    return {
      ok: false,
      reason: `Work review is stale: reviewed_head_sha=${review.reviewedHeadSha}, current HEAD=${headSha}.`,
    };
  }
  if (review.status !== 'APPROVED') {
    return { ok: false, reason: `${aiState} requires review status APPROVED.` };
  }
  if (review.hasP1 || review.hasP2) {
    return { ok: false, reason: `${aiState} is invalid while P1 or P2 findings remain.` };
  }
  return { ok: true, requiresReview: true };
}

function trustedOwnerComment(comment, owner) {
  return (comment.user?.login || '').toLowerCase() === owner.toLowerCase() && comment.author_association === 'OWNER';
}

async function setAiState(github, owner, repo, pr, target, core) {
  const labels = (await github.rest.issues.listLabelsOnIssue({ owner, repo, issue_number: pr.number, per_page: 100 }))
    .data;
  const active = labels.map(label => label.name).filter(name => AI_STATES.includes(name));
  if (active.length === 1 && active[0] === target) {
    core.info(`PR #${pr.number} already ${target}.`);
    return;
  }
  for (const label of active) {
    if (label === target) continue;
    try {
      await github.rest.issues.removeLabel({ owner, repo, issue_number: pr.number, name: label });
    } catch (error) {
      if (error.status !== 404) throw error;
    }
  }
  if (!active.includes(target)) {
    await github.rest.issues.addLabels({ owner, repo, issue_number: pr.number, labels: [target] });
  }
  core.info(`PR #${pr.number}: ${active.join(', ') || 'no ai state'} -> ${target}.`);
}

async function setDraftState(github, pr, draft, core) {
  if (pr.draft === draft) return;
  const mutation = draft
    ? `mutation($id:ID!){convertPullRequestToDraft(input:{pullRequestId:$id}){pullRequest{isDraft}}}`
    : `mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){pullRequest{isDraft}}}`;
  await github.graphql(mutation, { id: pr.node_id });
  core.info(`PR #${pr.number}: draft=${draft}.`);
}

async function getPr(github, owner, repo, number) {
  return (await github.rest.pulls.get({ owner, repo, pull_number: number })).data;
}

async function approvedLabelTime(github, owner, repo, prNumber) {
  const events = await github.paginate(github.rest.issues.listEventsForTimeline, {
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });
  const approvedEvents = events.filter(event => event.event === 'labeled' && event.label?.name === 'ai:approved');
  const latest = approvedEvents[approvedEvents.length - 1];
  return latest?.created_at ? Date.parse(latest.created_at) : undefined;
}

async function reconcileApproved(github, owner, repo, pr, core) {
  const state = currentAiState(pr.labels || []);
  if (!state.ok || state.state !== 'ai:approved') return;

  const checksResponse = await github.rest.checks.listForRef({
    owner,
    repo,
    ref: pr.head.sha,
    per_page: 100,
    filter: 'latest',
  });
  const checks = checksResponse.data.check_runs;
  const approvedAt = await approvedLabelTime(github, owner, repo, pr.number);
  const gates = requiredChecksSatisfied(checks, approvedAt);
  if (!gates.ok) {
    core.info(
      `PR #${pr.number} remains ai:approved; missing=[${gates.missing.join(', ')}], ` +
        `notSuccessful=[${gates.notSuccessful.join(', ')}].`,
    );
    return;
  }
  await setAiState(github, owner, repo, pr, 'ai:ready-merge', core);
  core.notice(`PR #${pr.number} is ai:ready-merge. Automation V2 v1 does not merge.`);
}

async function handleSynchronize(github, owner, repo, prNumber, core) {
  const pr = await getPr(github, owner, repo, prNumber);
  const state = currentAiState(pr.labels || []);
  if (!state.ok) {
    if (state.active.length === 0) {
      core.info(`PR #${pr.number} is not enrolled in Fresnica AI state; ignoring synchronize.`);
      return;
    }
    core.setFailed(`PR #${pr.number} has invalid ai:* labels: ${state.active.join(', ')}.`);
    return;
  }
  await setAiState(github, owner, repo, pr, 'ai:developing', core);
  await setDraftState(github, pr, true, core);
}

async function handleIssueComment(github, owner, repo, issue, comment, core) {
  if (!issue.pull_request) return;
  if (!trustedOwnerComment(comment, owner)) {
    if ((comment.body || '').includes(DEV_HANDOFF_MARKER) || (comment.body || '').includes(WORK_REVIEW_MARKER)) {
      core.info(`Ignoring untrusted Fresnica artifact comment ${comment.id}.`);
    }
    return;
  }

  const pr = await getPr(github, owner, repo, issue.number);
  if (pr.state !== 'open') return;
  const state = currentAiState(pr.labels || []);
  if (!state.ok) {
    core.setFailed(
      `PR #${pr.number} must have exactly one known ai:* state; found ${state.active.join(', ') || 'none'}.`,
    );
    return;
  }

  const body = comment.body || '';
  const handoff = parseDevelopmentHandoff(body);
  if (handoff) {
    if (handoff.head !== pr.head.sha.toLowerCase()) {
      core.info(`Ignoring stale development handoff ${handoff.head}; current HEAD=${pr.head.sha}.`);
      return;
    }
    if (!['ai:developing', 'ai:needs-fix'].includes(state.state)) {
      core.info(`Ignoring development handoff while state=${state.state}.`);
      return;
    }
    await setAiState(github, owner, repo, pr, 'ai:ready-review', core);
    const refreshed = await getPr(github, owner, repo, pr.number);
    await setDraftState(github, refreshed, false, core);
    return;
  }

  const review = parseWorkReview(body);
  if (!review) return;
  if (review.reviewedHeadSha !== pr.head.sha.toLowerCase()) {
    core.info(`Ignoring stale Work review ${review.reviewedHeadSha}; current HEAD=${pr.head.sha}.`);
    return;
  }
  if (state.state !== 'ai:ready-review') {
    core.info(`Ignoring exact-HEAD Work review while state=${state.state}.`);
    return;
  }

  const target = targetForReview(review);
  if (!target.ok) {
    core.setFailed(target.reason);
    return;
  }
  await setAiState(github, owner, repo, pr, target.state, core);
  const refreshed = await getPr(github, owner, repo, pr.number);
  await setDraftState(github, refreshed, target.draft, core);
}

async function handleWorkflowRun(github, owner, repo, workflowRun, core) {
  if (workflowRun.conclusion !== 'success') return;
  const prs = workflowRun.pull_requests || [];
  for (const ref of prs) {
    const pr = await getPr(github, owner, repo, ref.number);
    if (pr.head.sha.toLowerCase() !== workflowRun.head_sha.toLowerCase()) continue;
    await reconcileApproved(github, owner, repo, pr, core);
  }
}

async function run({ github, context, core }) {
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const event = context.eventName;

  if (event === 'pull_request' && context.payload.action === 'synchronize') {
    await handleSynchronize(github, owner, repo, context.payload.pull_request.number, core);
    return;
  }
  if (event === 'issue_comment' && ['created', 'edited'].includes(context.payload.action)) {
    await handleIssueComment(github, owner, repo, context.payload.issue, context.payload.comment, core);
    return;
  }
  if (event === 'workflow_run' && context.payload.action === 'completed') {
    await handleWorkflowRun(github, owner, repo, context.payload.workflow_run, core);
  }
}

module.exports = {
  AI_STATES,
  REQUIRED_CHECKS,
  currentAiState,
  parseDevelopmentHandoff,
  parseWorkReview,
  targetForReview,
  requiredChecksSatisfied,
  reviewGateDecision,
  trustedOwnerComment,
  run,
};
