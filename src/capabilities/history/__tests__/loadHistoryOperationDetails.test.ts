import type {AccountRecord} from '../../account/types';
import type {HistoryGatewayPort, HistoryOperationRecord} from '../HistoryGateway';
import {loadHistoryOperationDetails} from '../loadHistoryOperationDetails';

const accountAddress = 'GACCOUNT';
const otherAddress = 'GOTHER';

function account(overrides?: Partial<AccountRecord>): AccountRecord {
  const now = new Date('2026-09-09T00:00:00.000Z');
  return {
    id: 'account-history-detail',
    address: accountAddress,
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: 'History detail',
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
    occurredAt: '2026-09-09T00:00:00Z',
    transactionHash: 'tx-900',
    sourceAccount: accountAddress,
    from: accountAddress,
    to: otherAddress,
    amount: '1.2500000',
    asset: {kind: 'native'},
    ...overrides,
  };
}

function dependencies(result: unknown) {
  const loadOperation = jest.fn().mockResolvedValue(result);
  return {
    dependencies: {
      gateway: {
        loadOperation,
        loadAccountOperations: jest.fn(),
      } as HistoryGatewayPort,
      networkId: 'stellar-testnet',
    },
    loadOperation,
  };
}

describe('loadHistoryOperationDetails', () => {
  it('loads and maps one account-associated operation', async () => {
    const gateway = dependencies({status: 'found', record: operation()});

    await expect(loadHistoryOperationDetails(gateway.dependencies, account(), '900')).resolves.toMatchObject({
      status: 'ready',
      entry: {id: '900', kind: 'payment', direction: 'outgoing'},
    });
    expect(gateway.loadOperation).toHaveBeenCalledWith({operationId: '900'});
  });

  it('keeps Horizon not-found explicit', async () => {
    const gateway = dependencies({status: 'not-found'});
    await expect(loadHistoryOperationDetails(gateway.dependencies, account(), '404')).resolves.toEqual({
      status: 'not-found',
    });
  });

  it('fails closed when the operation is unrelated to the requested account', async () => {
    const gateway = dependencies({
      status: 'found',
      record: operation({
        sourceAccount: otherAddress,
        from: otherAddress,
        to: 'GTHIRD',
      }),
    });

    await expect(loadHistoryOperationDetails(gateway.dependencies, account(), '900')).resolves.toEqual({
      status: 'not-associated',
    });
  });

  it('allows an unsupported operation only when the stable record still binds it to the account', async () => {
    const gateway = dependencies({
      status: 'found',
      record: operation({type: 'future_operation', sourceAccount: accountAddress, from: undefined, to: undefined}),
    });

    await expect(loadHistoryOperationDetails(gateway.dependencies, account(), '900')).resolves.toMatchObject({
      status: 'ready',
      entry: {kind: 'unsupported', operationType: 'future_operation'},
    });
  });

  it('rejects network mismatch, empty ids and mismatched Horizon identities', async () => {
    const gateway = dependencies({status: 'found', record: operation({id: '901'})});

    await expect(
      loadHistoryOperationDetails(gateway.dependencies, account({networkId: 'stellar-mainnet'}), '900'),
    ).rejects.toThrow('history-network-mismatch');
    await expect(loadHistoryOperationDetails(gateway.dependencies, account(), '   ')).rejects.toThrow(
      'invalid-history-operation-id',
    );
    await expect(loadHistoryOperationDetails(gateway.dependencies, account(), '900')).rejects.toThrow(
      'history-operation-id-mismatch',
    );
  });

  it('does not query Horizon for unsupported account identities', async () => {
    const gateway = dependencies({status: 'not-found'});

    await expect(
      loadHistoryOperationDetails(gateway.dependencies, account({identityKind: 'contract'}), '900'),
    ).resolves.toEqual({status: 'unsupported-account'});
    expect(gateway.loadOperation).not.toHaveBeenCalled();
  });
});
