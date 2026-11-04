import { StrKey } from '@stellar/stellar-sdk/axios';
import { mapHistoryOperationRecord } from '../StellarSdkGateway';
import { createHorizonPublicReadGateway } from '../HorizonPublicReadGateway';
import { controlCases, controlSource } from '../../../capabilities/history/__tests__/classicControlHistory.fixtures';
import { mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import type { HorizonOperationLike } from '../types';
it.each(controlCases)('reads canonical raw %s %j through both public adapters', async (type, parameters) => {
  if ('signer_key' in parameters && parameters.signer_key.startsWith('P'))
    expect(StrKey.isValidSignedPayload(parameters.signer_key)).toBe(true);
  const wire = {
    id: type,
    paging_token: type,
    type,
    type_i: 8,
    source_account: controlSource,
    transaction_successful: true,
    created_at: '2026-11-04T00:00:00Z',
    transaction_hash: 'hash',
    ...parameters,
  } as HorizonOperationLike;
  const http = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ _embedded: { records: [wire] } }),
  });
  const page = await createHorizonPublicReadGateway(http).loadAccountOperations(
    'https://example.test',
    { address: controlSource, limit: 20 },
    new AbortController().signal,
  );
  if (page.status !== 'active') throw new Error('fixture');
  expect(page.records[0]).toEqual(mapHistoryOperationRecord(wire));
  expect(mapHistoryEntry(page.records[0], controlSource)).toMatchObject({ kind: 'account-control', parameters });
  expect(
    mapHistoryEntry(mapHistoryOperationRecord({ ...wire, transaction_successful: false }), controlSource),
  ).toMatchObject({ kind: 'unsupported' });
});
it.each([1, 64])('preserves SDK-valid %s-byte signed payload through raw projection', length => {
  const bytes = new Uint8Array(36 + Math.ceil(length / 4) * 4);
  bytes.fill(1, 0, 32);
  new DataView(bytes.buffer).setUint32(32, length, false);
  bytes.fill(42, 36, 36 + length);
  const signer_key = StrKey.encodeSignedPayload(bytes);
  expect(StrKey.isValidSignedPayload(signer_key)).toBe(true);
  const record = mapHistoryOperationRecord({
    id: 'P',
    paging_token: 'P',
    type: 'set_options',
    type_i: 5,
    source_account: controlSource,
    transaction_successful: true,
    created_at: '2026-11-04T00:00:00Z',
    transaction_hash: 'hash',
    signer_key,
    signer_weight: 0,
  });
  expect(mapHistoryEntry(record, controlSource)).toMatchObject({
    kind: 'account-control',
    parameters: { signer_key, signer_weight: 0 },
  });
});
