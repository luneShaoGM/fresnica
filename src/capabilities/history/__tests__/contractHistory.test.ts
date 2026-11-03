import { CONTRACT_HOST_FUNCTIONS, contractAmount } from '../contractHistory';
import { mapHistoryEntry } from '../loadHistoryPage';
import { loadHistoryOperationDetails } from '../loadHistoryOperationDetails';
import type { HistoryOperationRecord } from '../HistoryGateway';
import type { AccountRecord } from '../../account/types';
import type { HistoryEntry } from '../types';

import { source, recipient, foreign, contractId, contractRecord, transfer, cache } from './contractHistory.fixtures';
it.each(['invoke', 'create', 'upload'] as const)('maps exact %s variant', host => {
  const entry = mapHistoryEntry(contractRecord({ hostFunction: CONTRACT_HOST_FUNCTIONS[host] }), source);
  expect(entry).toMatchObject({ kind: 'contract', hostFunction: host, successful: true });
  expect(entry).toEqual(cache(entry).entries[0]);
  expect('contractId' in entry).toBe(host !== 'upload');
  expect('functionName' in entry).toBe(host === 'invoke');
});
it.each([
  { successful: false },
  { successful: undefined },
  { hostFunction: 'invoke' },
  { hostFunction: 'HostFunctionTypeHostFunctionTypeCreateContractV2' },
  { contractId: source },
  { contractId: ` ${contractId}` },
  { functionName: '' },
  { functionName: 'a'.repeat(33) },
  { functionName: 'bad-name' },
  { sourceAccount: ` ${source}` },
])('fails closed on invalid identity %j', change => {
  expect(mapHistoryEntry(contractRecord(change), source)).toMatchObject({
    kind: 'unsupported',
    reason: 'operation-shape',
  });
});
it('preserves unavailable versus empty event evidence', () => {
  const absent = mapHistoryEntry(contractRecord(), source);
  const empty = mapHistoryEntry(contractRecord({ assetBalanceChanges: [] }), source);
  expect(absent).not.toHaveProperty('events');
  expect(empty).toHaveProperty('events', []);
  expect(mapHistoryEntry(contractRecord({ assetBalanceChanges: null }), source)).toEqual(absent);
});
it.each(['transfer', 'mint', 'burn', 'clawback'])('derives %s from explicit parties', type => {
  const event = {
    ...transfer,
    type,
    ...(type === 'mint' ? { from: '' } : {}),
    ...(type === 'burn' || type === 'clawback' ? { to: '' } : {}),
  };
  const entry = mapHistoryEntry(contractRecord({ assetBalanceChanges: [event] }), source);
  expect(entry).toMatchObject({
    kind: 'contract',
    events: [{ type, direction: type === 'mint' ? 'neutral' : 'outgoing' }],
  });
  expect(cache(entry).entries[0]).toEqual(entry);
});
it('keeps self, unrelated, zero and i128 values separate and ordered', () => {
  const events = [
    { ...transfer, to: source },
    { ...transfer, from: foreign },
    { ...transfer, amount: '0' },
    { ...transfer, amount: '17014118346046923173168730371588.4105727' },
  ];
  expect(mapHistoryEntry(contractRecord({ assetBalanceChanges: events }), source)).toMatchObject({
    kind: 'contract',
    events: [
      { direction: 'self' },
      { direction: 'neutral' },
      { amount: '0', direction: 'outgoing' },
      { amount: events[3].amount },
    ],
  });
});
it.each(['-1', '1.00000001', '1e7', ' 1', '17014118346046923173168730371588.4105728', '9'.repeat(40)])(
  'rejects invalid amount %s',
  amount => expect(contractAmount(amount)).toBe(false),
);
it.each(
  [
    {},
    'x',
    Array(129).fill(transfer),
    [null],
    [{ ...transfer, type: Object('transfer') }],
    [{ ...transfer, amount: 'bad' }],
    [{ ...transfer, asset: { kind: 'unsupported' } }],
    [{ ...transfer, to: 'bad' }],
    [{ ...transfer, type: 'mint', from: source }],
    [{ ...transfer, type: 'burn', to: recipient }],
    [{ ...transfer, destinationMuxedId: '01' }],
    [{ ...transfer, destinationMuxedId: '18446744073709551616' }],
    [{ ...transfer, to: contractId, destinationMuxedId: '1' }],
  ].map(assetBalanceChanges => [assetBalanceChanges]),
)('rejects malformed events %j', assetBalanceChanges => {
  expect(mapHistoryEntry(contractRecord({ assetBalanceChanges }), source)).toMatchObject({
    kind: 'unsupported',
    reason: 'operation-shape',
  });
});
it.each(['create', 'upload'] as const)('rejects contradictory %s events', host =>
  expect(
    mapHistoryEntry(
      contractRecord({ hostFunction: CONTRACT_HOST_FUNCTIONS[host], assetBalanceChanges: [transfer] }),
      source,
    ),
  ).toMatchObject({ kind: 'unsupported' }),
);
it('preserves routing ID including zero and maximum without Memo or M address', () => {
  for (const destinationMuxedId of ['0', '18446744073709551615'])
    expect(
      mapHistoryEntry(contractRecord({ assetBalanceChanges: [{ ...transfer, destinationMuxedId }] }), recipient),
    ).toMatchObject({ kind: 'contract', events: [{ to: recipient, destinationMuxedId, direction: 'incoming' }] });
});
it('revalidates partition directions and strips all raw/nested unknown metadata', () => {
  const entry = mapHistoryEntry(contractRecord({ assetBalanceChanges: [{ ...transfer, secret: 'discard' }] }), source);
  expect(() => cache(entry, recipient)).toThrow();
  const dirty = {
    ...entry,
    parameters: ['discard'],
    salt: 'discard',
    events: 'events' in entry ? entry.events?.map(e => ({ ...e, secret: 'discard' })) : [],
  } as unknown as HistoryEntry;
  const normalized = cache(dirty).entries[0];
  expect(normalized).toEqual(entry);
  expect(Object.isFrozen(normalized)).toBe(true);
  if (normalized.kind === 'contract') {
    expect(Object.isFrozen(normalized.events)).toBe(true);
    expect(Object.isFrozen(normalized.events?.[0].asset)).toBe(true);
  }
});
it('rejects corrupted native code and keeps legacy unsupported rows readable', () => {
  const entry = mapHistoryEntry(contractRecord({ assetBalanceChanges: [transfer] }), source);
  if (entry.kind !== 'contract') throw new Error('fixture');
  expect(() =>
    cache({
      ...entry,
      events: [{ ...entry.events![0], asset: { kind: 'native', code: 'USD' } }],
    } as unknown as HistoryEntry),
  ).toThrow();
  const unsupported = { ...entry, kind: 'unsupported', reason: 'operation-type' } as unknown as HistoryEntry;
  expect(cache(unsupported).entries[0]).toMatchObject({ kind: 'unsupported' });
});
it('associates explicit bounded event parties independently from malformed amounts, never generic participants', async () => {
  const account = (address: string) => ({ address, networkId: 'test', identityKind: 'classic' }) as AccountRecord;
  const detail = (record: HistoryOperationRecord, address: string) =>
    loadHistoryOperationDetails(
      {
        networkId: 'test',
        gateway: { loadOperation: async () => ({ status: 'found', record }), loadAccountOperations: jest.fn() },
      },
      account(address),
      '123',
    );
  expect(
    await detail(contractRecord({ assetBalanceChanges: [{ ...transfer, amount: 'bad' }] }), recipient),
  ).toMatchObject({ status: 'ready', entry: { kind: 'unsupported' } });
  expect(await detail(contractRecord({ to: foreign, assetBalanceChanges: [transfer] }), foreign)).toEqual({
    status: 'not-associated',
  });
  expect(
    await detail(contractRecord({ assetBalanceChanges: Array(129).fill({ ...transfer, to: foreign }) }), foreign),
  ).toEqual({ status: 'not-associated' });
  for (const host of ['create', 'upload'] as const) {
    const record = contractRecord({ hostFunction: CONTRACT_HOST_FUNCTIONS[host], assetBalanceChanges: [transfer] });
    expect(await detail(record, recipient)).toEqual({ status: 'not-associated' });
    expect(await detail(record, source)).toMatchObject({ status: 'ready', entry: { kind: 'unsupported' } });
  }
});
