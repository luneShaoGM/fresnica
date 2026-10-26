import type { AccountRecord } from '@capabilities/account/types';
import { loadBalanceSnapshot } from '@capabilities/balance/loadBalanceSnapshot';
import {
  cacheBalanceSnapshotBestEffort,
  type BalanceProductDependencies,
} from '@capabilities/balance/BalanceCacheHydration';
import { loadHistoryPage } from '@capabilities/history/loadHistoryPage';
import {
  cacheHistoryOnlineEntriesBestEffort,
  type HistoryProductDependencies,
} from '@capabilities/history/HistoryCacheHydration';
import type { LedgerReadInvalidation } from '@capabilities/transaction/LedgerReadInvalidation';
import type { PendingSubmissionRepository } from '@capabilities/transaction/pendingSubmission';
import type { LedgerReadInvalidationStore } from './LedgerReadInvalidationStore';
import type { LedgerReadRuntime } from './LedgerReadRuntime';
import type { NodeReadSession } from './createNodeReadSession';
import type { TransactionReconciliationCoordinator } from '../transaction/TransactionReconciliationCoordinator';

export const POST_SUBMIT_READ_TIMING = Object.freeze({
  budget: 60000,
  delays: [1000, 2000, 4000, 8000, 16000] as readonly number[],
  maxJobs: 16,
});
export function startPostSubmitReadConvergence(
  deps: Readonly<{
    networkId: string;
    runtime: LedgerReadRuntime;
    node: NodeReadSession;
    invalidation: LedgerReadInvalidationStore;
    pending: Pick<PendingSubmissionRepository, 'get'>;
    coordinator: TransactionReconciliationCoordinator;
    balance: BalanceProductDependencies;
    history: HistoryProductDependencies;
    getAccount: (id: string) => AccountRecord | undefined;
    onComplete: (result: 'converged' | 'exhausted' | 'rejected') => void;
  }>,
) {
  type Job = {
    input: LedgerReadInvalidation;
    expires: number;
    attempt: number;
    timer?: ReturnType<typeof setTimeout>;
    busy: boolean;
  };
  const jobs = new Map<string, Job>();
  const seen = new Set<string>();
  let stopped = false;
  const eligible = () => {
    const state = deps.runtime.getSnapshot();
    return state.foreground && state.connectivity !== 'offline' && deps.node.getSnapshot().phase === 'healthy';
  };
  const finish = (key: string, job: Job, result?: 'converged' | 'exhausted' | 'rejected') => {
    if (job.timer !== undefined) clearTimeout(job.timer);
    if (jobs.get(key) === job) jobs.delete(key);
    if (result) deps.onComplete(result);
  };
  const schedule = (key: string, job: Job) => {
    if (stopped || jobs.get(key) !== job || job.busy || job.timer !== undefined) return;
    if (performance.now() >= job.expires || job.attempt >= POST_SUBMIT_READ_TIMING.delays.length) {
      finish(key, job, 'exhausted');
      return;
    }
    if (!eligible()) return;
    const delay = Math.min(POST_SUBMIT_READ_TIMING.delays[job.attempt], job.expires - performance.now());
    job.timer = setTimeout(() => {
      job.timer = undefined;
      run(key, job).catch(() => {
        finish(key, job, 'exhausted');
      });
    }, delay);
  };
  const run = async (key: string, job: Job) => {
    if (stopped || jobs.get(key) !== job || !eligible()) return;
    if (performance.now() >= job.expires) {
      finish(key, job, 'exhausted');
      return;
    }
    const account = deps.getAccount(job.input.accountId);
    if (!account || account.hidden || account.networkId !== deps.networkId || account.identityKind !== 'classic') {
      finish(key, job);
      return;
    }
    job.busy = true;
    job.attempt += 1;
    const runtime = deps.runtime.getSnapshot();
    const generation = deps.node.getSnapshot().generation;
    const current = () =>
      !stopped &&
      jobs.get(key) === job &&
      performance.now() < job.expires &&
      runtime === deps.runtime.getSnapshot() &&
      generation === deps.node.getSnapshot().generation &&
      eligible() &&
      deps.getAccount(account.id)?.address === account.address &&
      deps.getAccount(account.id)?.networkId === deps.networkId &&
      deps.getAccount(account.id)?.identityKind === 'classic' &&
      !deps.getAccount(account.id)?.hidden;
    try {
      // Reuse the existing hash-bound recovery pipeline; this owner cannot broadcast.
      const pending = deps.pending.get(deps.networkId, job.input.transactionHash);
      if (!pending || pending.accountId !== account.id || pending.sourceAddress !== account.address) {
        finish(key, job);
        return;
      }
      if (pending?.state === 'submitting' || pending?.state === 'uncertain')
        await deps.coordinator.reconcile('post-submit');
      if (!current()) return;
      if (deps.pending.get(deps.networkId, job.input.transactionHash)?.state === 'rejected') {
        finish(key, job, 'rejected');
        return;
      }
      const revision = deps.invalidation.getRevision(deps.networkId, account.id);
      const [balances, history] = await Promise.all([
        deps.balance.gateway.loadAccountBalances(account.address),
        loadHistoryPage(deps.history, account),
      ]);
      if (!current() || revision !== deps.invalidation.getRevision(deps.networkId, account.id)) return;
      const snapshot = await loadBalanceSnapshot(
        { ...deps.balance, gateway: { loadAccountBalances: async () => balances } },
        account,
      );
      if (!current() || revision !== deps.invalidation.getRevision(deps.networkId, account.id)) return;
      cacheBalanceSnapshotBestEffort(deps.balance, account, snapshot, deps.balance.now());
      if (history.status === 'active') cacheHistoryOnlineEntriesBestEffort(deps.history, account, history.entries);
      deps.invalidation.refresh({ networkId: deps.networkId, accountId: account.id, reason: 'post-submit' });
      const record = deps.pending.get(deps.networkId, job.input.transactionHash);
      const observed =
        history.status === 'active' &&
        history.entries.some(entry => entry.transactionHash === job.input.transactionHash);
      if (record?.state === 'rejected') finish(key, job, 'rejected');
      else if (
        record?.state === 'confirmed' &&
        observed &&
        (balances.status === 'inactive' ||
          (record.ledger !== undefined &&
            balances.lastModifiedLedger !== undefined &&
            balances.lastModifiedLedger >= record.ledger))
      )
        finish(key, job, 'converged');
    } catch {
      /* Public read failures retain caches; remaining attempts obey node availability. */
    } finally {
      job.busy = false;
      schedule(key, job);
    }
  };
  const wake = () => {
    for (const [key, job] of jobs) {
      if (!eligible() && job.timer !== undefined) {
        clearTimeout(job.timer);
        job.timer = undefined;
      }
      schedule(key, job);
    }
  };
  const stopInvalidation = deps.invalidation.subscribeTransactions(input => {
    if (stopped || input.networkId !== deps.networkId) return;
    const key = JSON.stringify([input.networkId, input.accountId, input.transactionHash]);
    if (seen.has(key) || jobs.has(key)) return;
    seen.add(key);
    if (seen.size > 256) seen.delete(seen.values().next().value!);
    if (jobs.size >= POST_SUBMIT_READ_TIMING.maxJobs) return;
    const job: Job = { input, expires: performance.now() + POST_SUBMIT_READ_TIMING.budget, attempt: 0, busy: false };
    jobs.set(key, job);
    schedule(key, job);
  });
  const stopRuntime = deps.runtime.subscribe(wake);
  const stopNode = deps.node.subscribe(wake);
  return () => {
    if (stopped) return;
    stopped = true;
    stopInvalidation();
    stopRuntime();
    stopNode();
    for (const [key, job] of jobs) finish(key, job);
  };
}
