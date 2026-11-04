import { Address, xdr } from '@stellar/stellar-sdk/axios';
import { mapHistoryOperationRecord } from '../StellarSdkGateway';
import { createHorizonPublicReadGateway } from '../HorizonPublicReadGateway';
import type { HorizonOperationLike } from '../types';
import { mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import { normalizeHistoryCacheSnapshot } from '../../../capabilities/history/HistoryCacheRepository';
import { activityRowPresentation } from '../../../features/activity/activityRowPresentation';
import { createLocalization } from '../../../locale/localization';
const contract = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
const source = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const recipient = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const parameters = [
  { type: 'Address', value: new Address(contract).toScVal().toXDR('base64') },
  { type: 'Sym', value: xdr.ScVal.scvSymbol('transfer').toXDR('base64') },
];
const raw: HorizonOperationLike = {
  id: '1',
  paging_token: '1',
  type: 'invoke_host_function',
  type_i: 24,
  created_at: '2026-11-03T00:00:00Z',
  transaction_hash: 'hash',
  transaction_successful: true,
  source_account: source,
  function: 'HostFunctionTypeHostFunctionTypeInvokeContract',
  parameters,
};
it('decodes real SDK canonical Address/Sym only and strips extra arguments', () => {
  const record = mapHistoryOperationRecord({
    ...raw,
    parameters: [...parameters, { type: 'bad', value: 'not decoded' }],
  });
  expect(record).toMatchObject({ contractId: contract, functionName: 'transfer' });
  expect(record).not.toHaveProperty('parameters');
  expect(mapHistoryEntry(record, source)).toMatchObject({ kind: 'contract' });
});
it.each(
  [
    [],
    [parameters[0]],
    Array(129).fill(parameters[0]),
    [{ ...parameters[0], type: 'Bytes' }, parameters[1]],
    [{ ...parameters[0], value: xdr.ScVal.scvSymbol('bad').toXDR('base64') }, parameters[1]],
    [{ ...parameters[0], value: new Address(source).toScVal().toXDR('base64') }, parameters[1]],
    [parameters[0], { ...parameters[1], value: xdr.ScVal.scvString('transfer').toXDR('base64') }],
    [{ ...parameters[0], value: parameters[0].value + 'AAAA' }, parameters[1]],
    [{ ...parameters[0], value: ' ' + parameters[0].value }, parameters[1]],
    [{ ...parameters[0], value: 'A'.repeat(513) }, parameters[1]],
    [parameters[0], { ...parameters[1], value: 'bad' }],
  ].map(bad => [bad]),
)('fails closed on malformed identity parameters %j', bad =>
  expect(mapHistoryEntry(mapHistoryOperationRecord({ ...raw, parameters: bad }), source)).toMatchObject({
    kind: 'unsupported',
    reason: 'operation-shape',
  }),
);
it('requires checksum on explicit deployer and never mistakes it for created identity', () => {
  expect(
    mapHistoryEntry(
      mapHistoryOperationRecord({
        ...raw,
        function: 'HostFunctionTypeHostFunctionTypeCreateContract',
        from: 'address',
        address: contract,
      }),
      source,
    ),
  ).toMatchObject({ kind: 'contract', deployer: contract });
  expect(
    mapHistoryEntry(
      mapHistoryOperationRecord({
        ...raw,
        function: 'HostFunctionTypeHostFunctionTypeCreateContract',
        from: 'address',
        address: contract.slice(0, -1) + 'A',
      }),
      source,
    ),
  ).toMatchObject({ kind: 'unsupported' });
  expect(
    mapHistoryEntry(
      mapHistoryOperationRecord({
        ...raw,
        function: 'HostFunctionTypeHostFunctionTypeUploadContractWasm',
        address: contract,
      }),
      source,
    ),
  ).not.toHaveProperty('contractId');
});
it('projects raw PublicRead events through History, normalized cache and presentation without exposing arguments', async () => {
  const wire = {
    ...raw,
    asset_balance_changes: [
      {
        type: 'transfer',
        asset_type: 'native',
        amount: '17014118346046923173168730371588.4105727',
        from: source,
        to: recipient,
        destination_muxed_id: '18446744073709551615',
        ignored: 'discard',
      },
    ],
  };
  const http = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ _embedded: { records: [wire] } }),
    headers: { get: () => null },
  });
  const result = await createHorizonPublicReadGateway(http).loadAccountOperations(
    'https://example.test',
    { address: source, limit: 20 },
    new AbortController().signal,
  );
  if (result.status !== 'active') throw new Error('fixture');
  const entry = mapHistoryEntry(result.records[0], source);
  const snapshot = normalizeHistoryCacheSnapshot(
    {
      schemaVersion: 1,
      lastSuccessfulHorizonUpdateAt: new Date(),
      entries: [entry],
      details: [{ operationId: entry.id, entry }],
    },
    { networkId: 'test', accountAddress: source },
  );
  expect(snapshot.entries[0]).toEqual(entry);
  expect(JSON.stringify(snapshot)).not.toContain('ignored');
  const { t, formatNumber } = createLocalization('en');
  expect(activityRowPresentation(entry, t, formatNumber).reserveMoney?.[0]).toMatchObject({ tone: 'negative' });
  expect(JSON.stringify(entry)).not.toContain('parameters');
});

it.each(['HostFunctionTypeHostFunctionTypeCreateContract', 'HostFunctionTypeHostFunctionTypeCreateContractV2'])(
  'projects %s deployer without decoding constructor arguments as identity', host => {
    for (const address of [source, contract]) {
      const record = mapHistoryOperationRecord({ ...raw, function: host, from: 'address', address, parameters: [{ type: 'Bool', value: 'ignored' }] });
      const entry = mapHistoryEntry(record, source);
      expect(entry).toMatchObject({ kind: 'contract', deployer: address, creationOrigin: 'address' });
      expect(entry).not.toHaveProperty('contractId');
      expect(entry).not.toHaveProperty('functionName');
      expect(entry).not.toHaveProperty('parameters');
    }
    const entry = mapHistoryEntry(mapHistoryOperationRecord({ ...raw, function: host, from: 'asset', asset: 'native' }), source);
    expect(entry).toMatchObject({ kind: 'contract', creationAsset: { kind: 'native', code: 'XLM' } });
  },
);
it('retains V2 reported asset events without interpreting deployment address as new contract', () => {
  const record = mapHistoryOperationRecord({ ...raw, function: 'HostFunctionTypeHostFunctionTypeCreateContractV2', from: 'address', address: source,
    asset_balance_changes: [{ type: 'transfer', asset_type: 'native', amount: '1', from: source, to: recipient }] });
  const entry = mapHistoryEntry(record, recipient);
  expect(entry).toMatchObject({ kind: 'contract', hostFunction: 'create-v2', events: [{ direction: 'incoming' }] });
  expect(entry).not.toHaveProperty('contractId');
});
