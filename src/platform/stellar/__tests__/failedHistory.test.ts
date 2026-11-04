import { Horizon, Networks } from '@stellar/stellar-sdk/axios';
import { createHorizonPublicReadGateway } from '../HorizonPublicReadGateway';
import { StellarSdkGateway, mapHistoryOperationRecord } from '../StellarSdkGateway';
import { mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import type { HorizonOperationLike } from '../types';
const source = `G${'A'.repeat(55)}`;
const wire = {
  id: '1',
  paging_token: 'cursor',
  type: 'payment',
  type_i: 1,
  source_account: source,
  from: source,
  to: `G${'B'.repeat(55)}`,
  amount: '99',
  asset_type: 'native',
  created_at: '2026-11-04T00:00:00Z',
  transaction_hash: 'hash',
};
it('requests failed records and preserves opaque paging while projecting explicit false separately', async () => {
  const http = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ _embedded: { records: [{ ...wire, transaction_successful: false }] } }),
  });
  const page = await createHorizonPublicReadGateway(http).loadAccountOperations(
    'https://node.test',
    { address: source, limit: 1 },
    new AbortController().signal,
  );
  expect(http.mock.calls[0][0]).toContain('include_failed=true');
  if (page.status !== 'active') throw new Error('fixture');
  expect(page.nextCursor).toBe('cursor');
  expect(mapHistoryEntry(page.records[0], source)).toMatchObject({ kind: 'failed', successful: false });
});
it.each([undefined, null, 'false', 'true', 0, 1])(
  'keeps unknown raw outcome %j from becoming failed or completed money',
  transaction_successful => {
    const record = mapHistoryOperationRecord({ ...wire, transaction_successful } as unknown as HorizonOperationLike);
    expect(record.successful).toBeUndefined();
    expect(record.outcomeUnknown).toBe(true);
    expect(mapHistoryEntry(record, source)).toMatchObject({ kind: 'unsupported', reason: 'operation-shape' });
  },
);
it('enables failed records in the default SDK call builder as well as HTTP reads', async () => {
  const builder = {
    forAccount: jest.fn().mockReturnThis(),
    includeFailed: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    cursor: jest.fn().mockReturnThis(),
    call: jest.fn().mockResolvedValue({ records: [{ ...wire, transaction_successful: false }] }),
  };
  const spy = jest
    .spyOn(Horizon.Server.prototype, 'operations')
    .mockReturnValue(builder as unknown as ReturnType<InstanceType<typeof Horizon.Server>['operations']>);
  try {
    const gateway = new StellarSdkGateway({
      network: { id: 'stellar-testnet', networkPassphrase: Networks.TESTNET },
      horizonUrl: 'https://node.test',
    });
    const page = await gateway.loadAccountOperations({ address: source, limit: 1, cursor: 'opaque+cursor' });
    expect(builder.includeFailed).toHaveBeenCalledWith(true);
    expect(builder.cursor).toHaveBeenCalledWith('opaque+cursor');
    if (page.status !== 'active') throw new Error('fixture');
    expect(mapHistoryEntry(page.records[0], source)).toMatchObject({ kind: 'failed' });
  } finally {
    spy.mockRestore();
  }
});
it('projects a raw failed clawback holder into associated non-monetary history', () => {
  const holder = `G${'B'.repeat(55)}`;
  const entry = mapHistoryEntry(
    mapHistoryOperationRecord({
      ...wire,
      type: 'clawback',
      transaction_successful: false,
      from: holder,
      asset_type: 'credit_alphanum4',
      asset_code: 'USD',
      asset_issuer: source,
    }),
    holder,
  );
  expect(entry).toMatchObject({ kind: 'failed', relatedAccounts: [source, holder] });
  expect(entry).not.toHaveProperty('amount');
});
