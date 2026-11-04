import type { HistoryOperationRecord } from '../HistoryGateway';
export const controlSource = `G${'A'.repeat(55)}`;
export const controlPeer = `G${'B'.repeat(55)}`;
export const controlForeign = `G${'C'.repeat(55)}`;
export const controlCases = [
  ['account_merge', { account: controlSource, into: controlPeer }],
  [
    'set_options',
    {
      home_domain: '',
      signer_key: controlPeer,
      signer_weight: 0,
      low_threshold: 255,
      set_flags: [8],
      clear_flags: [1],
    },
  ],
  ['revoke_sponsorship', { account_id: controlPeer }],
  ['revoke_sponsorship', { claimable_balance_id: `00000000${'a'.repeat(64)}` }],
  ['revoke_sponsorship', { data_account_id: controlPeer, data_name: '資料😀' }],
  ['revoke_sponsorship', { offer_id: '9223372036854775807' }],
  ['revoke_sponsorship', { trustline_account_id: controlPeer, trustline_asset: `USD:${controlForeign}` }],
  ['revoke_sponsorship', { trustline_account_id: controlPeer, trustline_liquidity_pool_id: 'b'.repeat(64) }],
  ['revoke_sponsorship', { signer_account_id: controlPeer, signer_key: `X${'A'.repeat(55)}` }],
  ['inflation', {}],
] as const;
export function controlRecord(
  type: string,
  controlParameters: unknown,
  overrides: Partial<HistoryOperationRecord> = {},
): HistoryOperationRecord {
  return {
    id: type,
    pagingToken: type,
    type,
    occurredAt: '2026-11-04T00:00:00Z',
    transactionHash: 'hash',
    sourceAccount: controlSource,
    successful: true,
    controlParameters,
    ...overrides,
  };
}
