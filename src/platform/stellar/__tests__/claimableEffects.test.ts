import { createHorizonPublicReadGateway } from '../HorizonPublicReadGateway';
import { effectsSource, effectsBalance } from '../../../capabilities/history/__tests__/claimableEffects.fixtures';
import { mapHistoryOperationRecord } from '../StellarSdkGateway';
import { mapHistoryEntry, loadHistoryPage } from '../../../capabilities/history/loadHistoryPage';
import type { AccountRecord } from '../../../capabilities/account/types';
const endpoint = 'https://node.test';
const link = { operation: { href: `${endpoint}/operations/1` } };
const marker = {
  _links: link,
  type: 'claimable_balance_claimed',
  account: effectsSource,
  balance_id: effectsBalance,
  asset: 'native',
  amount: '1.0000001',
};
const credit = {
  _links: link,
  type: 'account_credited',
  account: effectsSource,
  asset_type: 'native',
  amount: '1.0000001',
};
const response = (records: readonly unknown[]) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => ({ _embedded: { records } }),
});
const raw = {
  id: '1',
  paging_token: '1',
  type: 'claim_claimable_balance',
  type_i: 15,
  source_account: effectsSource,
  claimant: effectsSource,
  balance_id: effectsBalance,
  created_at: '2026-11-04T00:00:00Z',
  transaction_hash: 'hash',
  transaction_successful: true,
};
it('binds HTTP operation effects through the optional port into the actual list mapper', async () => {
  const http = jest.fn().mockResolvedValue(response([marker, credit]));
  const reads = createHorizonPublicReadGateway(http);
  const gateway = {
    loadAccountOperations: async () => ({
      status: 'active' as const,
      address: effectsSource,
      records: [mapHistoryOperationRecord(raw)],
    }),
    loadOperation: jest.fn(),
    loadOperationEffects: (input: { operationId: string; accountAddress: string; signal?: AbortSignal }) =>
      reads.loadOperationEffects(endpoint, input, new AbortController().signal),
  };
  const page = await loadHistoryPage({ gateway, networkId: 'test' }, {
    networkId: 'test',
    address: effectsSource,
    identityKind: 'classic',
  } as AccountRecord);
  expect(page).toMatchObject({
    status: 'active',
    entries: [{ kind: 'claimable-reference', amount: '1.0000001', asset: { kind: 'native', code: 'XLM' } }],
  });
  expect(http.mock.calls[0][0]).toBe(`${endpoint}/operations/1/effects?order=asc&limit=200`);
});
it('does not follow effect links, caps complete paging and preserves opaque cursor', async () => {
  const filler = Array.from({ length: 200 }, (_, index) => ({
    _links: link,
    type: 'irrelevant',
    account: effectsSource,
    paging_token: `cursor+${index}`,
  }));
  const http = jest
    .fn()
    .mockResolvedValueOnce(response(filler))
    .mockResolvedValueOnce(response([marker, credit]));
  const proof = await createHorizonPublicReadGateway(http).loadOperationEffects(
    endpoint,
    { operationId: '1', accountAddress: effectsSource },
    new AbortController().signal,
  );
  expect(proof.complete).toBe(true);
  expect(http.mock.calls[1][0]).toContain('cursor=cursor%2B199');
  const capped = jest.fn().mockResolvedValueOnce(response(filler)).mockResolvedValueOnce(response(filler.map((item, index) => ({ ...item, paging_token: `second-${index}` }))));
  const incomplete = await createHorizonPublicReadGateway(capped).loadOperationEffects(
    endpoint,
    { operationId: '1', accountAddress: effectsSource },
    new AbortController().signal,
  );
  expect(incomplete).toMatchObject({ complete: false, records: [] });
  expect(capped).toHaveBeenCalledTimes(2);
});
it('rejects foreign operation links and never rescues malformed canonical assets with other wire fields', async () => {
  const foreign = jest
    .fn()
    .mockResolvedValue(response([{ ...marker, _links: { operation: { href: `${endpoint}/operations/2` } } }]));
  await expect(
    createHorizonPublicReadGateway(foreign).loadOperationEffects(
      endpoint,
      { operationId: '1', accountAddress: effectsSource },
      new AbortController().signal,
    ),
  ).rejects.toThrow();
  const http = jest.fn().mockResolvedValue(response([{ ...marker, asset: 'bad', asset_type: 'native' }, credit]));
  const proof = await createHorizonPublicReadGateway(http).loadOperationEffects(
    endpoint,
    { operationId: '1', accountAddress: effectsSource },
    new AbortController().signal,
  );
  expect(
    mapHistoryEntry({ ...mapHistoryOperationRecord(raw), claimableEffects: proof }, effectsSource),
  ).not.toHaveProperty('amount');
});
it('forwards both budget and node cancellation into the actual HTTP signal', async () => {
  for (const kind of ['budget', 'node']) {
    const budget = new AbortController();
    const node = new AbortController();
    const http = jest.fn(
      (_url: string, input?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          input?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const request = createHorizonPublicReadGateway(http as typeof fetch).loadOperationEffects(
      endpoint,
      { operationId: '1', accountAddress: effectsSource, signal: budget.signal },
      node.signal,
    );
    (kind === 'budget' ? budget : node).abort();
    await expect(request).rejects.toThrow();
  }
});
