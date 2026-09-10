import type { AccountRecord } from '../../account/types';
import type { HistoryGatewayPort, HistoryOperationRecord } from '../HistoryGateway';
import { loadHistoryPage, mapHistoryEntry } from '../loadHistoryPage';

const accountAddress = 'GACCOUNT';
const otherAddress = 'GOTHER';
const issuerAddress = 'GISSUER';

function account(overrides?: Partial<AccountRecord>): AccountRecord {
  const now = new Date('2026-08-31T00:00:00.000Z');
  return {
    id: 'account-history',
    address: accountAddress,
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: 'History',
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function operation(overrides?: Partial<HistoryOperationRecord>): HistoryOperationRecord {
  return {
    id: '900',
    pagingToken: '900',
    type: 'payment',
        occurredAt: '2026-08-31T00:00:00Z',
    transactionHash: 'tx-900',
        sourceAccount: accountAddress,
    from: accountAddress,
    to: otherAddress,
    amount: '1.2500000',
    asset: { kind: 'native' },
    ...overrides,
  };
}

function dependencies(result: unknown) {
  const loadAccountOperations = jest.fn().mockResolvedValue(result);
  return {
    dependencies: {
      gateway: {
        loadAccountOperations,
        loadOperation: jest.fn(),
      } as HistoryGatewayPort,
      networkId: 'stellar-testnet',
    },
    loadAccountOperations,
  };
}

describe('History capability', () => {
  it('maps outgoing native payments without numeric conversion', () => {
    expect(mapHistoryEntry(operation(), accountAddress)).toEqual({
      id: '900',
      pagingToken: '900',
      operationType: 'payment',
      occurredAt: '2026-08-31T00:00:00Z',
      transactionHash: 'tx-900',
      sourceAccount: accountAddress,
      kind: 'payment',
      direction: 'outgoing',
      amount: '1.2500000',
      asset: { kind: 'native', code: 'XLM' },
      counterparty: otherAddress,
    });
  });

  it('maps incoming issued payments with full asset identity', () => {
    expect(
      mapHistoryEntry(
        operation({
          sourceAccount: otherAddress,
          from: otherAddress,
          to: accountAddress,
          amount: '7.0000001',
          asset: { kind: 'credit', code: 'USD', issuer: issuerAddress },
        }),
        accountAddress,
      ),
    ).toMatchObject({
      kind: 'payment',
      direction: 'incoming',
      amount: '7.0000001',
      asset: { kind: 'credit', code: 'USD', issuer: issuerAddress },
      counterparty: otherAddress,
    });
  });

  it('keeps muxed payment identity for display while using base destination for direction', () => {
    const muxed = 'MACCOUNT';
    expect(
      mapHistoryEntry(
        operation({
          sourceAccount: otherAddress,
          from: otherAddress,
          to: accountAddress,
          toMuxed: muxed,
        }),
        accountAddress,
      ),
    ).toMatchObject({
      kind: 'payment',
      direction: 'incoming',
      counterparty: otherAddress,
    });
  });

  it('maps create-account funding direction and exact starting balance', () => {
    expect(
      mapHistoryEntry(
        operation({
          type: 'create_account',
          funder: accountAddress,
          account: otherAddress,
          startingBalance: '3.5000000',
        }),
        accountAddress,
      ),
    ).toMatchObject({
      kind: 'create-account',
      direction: 'outgoing',
      startingBalance: '3.5000000',
      counterparty: otherAddress,
    });
  });

  it('preserves unknown operation types as explicit unsupported entries', () => {
    expect(mapHistoryEntry(operation({ type: 'future_operation' }), accountAddress)).toMatchObject({
      id: '900',
      operationType: 'future_operation',
      kind: 'unsupported',
      reason: 'operation-type',
    });
  });

  it('preserves malformed known operation shapes as unsupported instead of dropping them', () => {
    expect(mapHistoryEntry(operation({ amount: undefined }), accountAddress)).toMatchObject({
      id: '900',
      kind: 'unsupported',
      reason: 'operation-shape',
    });
  });

  it('loads a normalized page and forwards paging cursor', async () => {
    const gateway = dependencies({
      status: 'active',
      address: accountAddress,
      records: [operation()],
      nextCursor: '900',
    });

    await expect(
      loadHistoryPage(gateway.dependencies, account(), {
        cursor: '1000',
        limit: 1,
      }),
    ).resolves.toMatchObject({
      status: 'active',
      entries: [{ id: '900', kind: 'payment' }],
      nextCursor: '900',
    });
    expect(gateway.loadAccountOperations).toHaveBeenCalledWith({
      address: accountAddress,
      cursor: '1000',
      limit: 1,
    });
  });

  it('keeps inactive and contract-account states explicit', async () => {
    const inactive = dependencies({ status: 'inactive', address: accountAddress });
    await expect(loadHistoryPage(inactive.dependencies, account())).resolves.toEqual({
      status: 'inactive',
    });

    const contract = account({ identityKind: 'contract' });
    const untouched = dependencies({ status: 'active', records: [] });
    await expect(loadHistoryPage(untouched.dependencies, contract)).resolves.toEqual({
      status: 'unsupported-account',
    });
    expect(untouched.loadAccountOperations).not.toHaveBeenCalled();
  });

  it('fails closed on a network mismatch before Horizon access', async () => {
    const gateway = dependencies({ status: 'active', records: [] });

    await expect(loadHistoryPage(gateway.dependencies, account({ networkId: 'stellar-mainnet' }))).rejects.toThrow(
      'history-network-mismatch',
    );
    expect(gateway.loadAccountOperations).not.toHaveBeenCalled();
  });
});
