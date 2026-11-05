import type { HistoryOperationEffects, HistoryOperationRecord } from '../HistoryGateway';
import { controlSource, controlPeer, controlRecord } from './classicControlHistory.fixtures';
export const effectsSource = controlSource;
export const effectsPeer = controlPeer;
export const effectsBalance = `00000000${'a'.repeat(64)}`;
export function effectsRecord(type = 'claim_claimable_balance', proof = true): HistoryOperationRecord {
  return controlRecord(
    type,
    {},
    { balanceId: effectsBalance, claimant: effectsSource, ...(proof ? { claimableEffects: effectsProof(type) } : {}) },
  );
}
export function effectsProof(type = 'claim_claimable_balance'): HistoryOperationEffects {
  const asset =
    type === 'claim_claimable_balance'
      ? { kind: 'native' as const }
      : { kind: 'credit' as const, code: 'USD', issuer: effectsSource };
  return {
    operationId: type,
    complete: true,
    records: [
      {
        type: type === 'claim_claimable_balance' ? 'claimable_balance_claimed' : 'claimable_balance_clawed_back',
        account: effectsSource,
        balanceId: effectsBalance,
        ...(type === 'claim_claimable_balance' ? { asset, amount: '922337203685.4775807' } : {}),
      },
      { type: 'account_credited', account: effectsSource, asset, amount: '922337203685.4775807' },
    ],
  };
}
