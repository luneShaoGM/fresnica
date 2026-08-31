import {StrKey} from '@stellar/stellar-sdk';

import type {AccountRecord} from '../../account/types';
import type {StellarGateway} from '../../../platform/stellar/StellarGateway';
import type {HorizonOperationLike} from '../../../platform/stellar/types';
import {loadHistoryPage, mapHistoryEntry} from '../loadHistoryPage';

const accountAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(21));
const otherAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(22));
const issuerAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(23));

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

function operation(overrides?: Partial<HorizonOperationLike>): HorizonOperationLike {
  return {
    id: '900',
    paging_token: '900',
    type: 'payment',
    type_i: 1,
    created_at: '2026-08-31T00:00:00Z',
    transaction_hash: 'tx-900',
    transaction_successful: true,
    source_account: accountAddress,
    from: accountAddress,
    to: otherAddress,
    amount: '1.2500000',
    asset_type: 'native',
    ...overrides,
  };
}

function dependencies(result: unknown) {
  const loadAccountOperations = jest.fn().mockResolvedValue(result);
  return {
    dependencies: {
      gateway: {loadAccountOperations} as unknown as StellarGateway,
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
      asset: {kind: 'native', code: 'XLM'},
      counterparty: otherAddress,
    });
  });

  it('maps incoming issued payments with full asset identity', () => {
    expect(
      mapHistoryEntry(
        operation({
          source_account: otherAddress,
          from: otherAddress,
          to: accountAddress,
          amount: '7.0000001',
          asset_type: 'credit_alphanum4',
          asset_code: 'USD',
          asset_issuer: issuerAddress,
        }),
        accountAddress,
      ),
    ).toMatchObject({
      kind: 'payment',
      direction: 'incoming',
      amount: '7.0000001',
      asset: {kind: 'credit', code: 'USD', issuer: issuerAddress},
      counterparty: otherAddress,
    });
  });

  it('keeps muxed payment identity for display while using base destination for direction', () => {
    const muxed = StrKey.encodeMed25519PublicKey(new Uint8Array(40).fill(24));
    expect(
      mapHistoryEntry(
        operation({
          source_account: otherAddress,
          from: otherAddress,
          to: accountAddress,
          to_muxed: muxed,
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
          type_i: 0,
          funder: accountAddress,
          account: otherAddress,
          starting_balance: '3.5000000',
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
    expect(
      mapHistoryEntry(operation({type: 'future_operation'}), accountAddress),
    ).toMatchObject({
      id: '900',
      operationType: 'future_operation',
      kind: 'unsupported',
      reason: 'operation-type',
    });
  });

  it('preserves malformed known operation shapes as unsupported instead of dropping them', () => {
    expect(
      mapHistoryEntry(operation({amount: undefined}), accountAddress),
    ).toMatchObject({
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
      entries: [{id: '900', kind: 'payment'}],
      nextCursor: '900',
    });
    expect(gateway.loadAccountOperations).toHaveBeenCalledWith({
      address: accountAddress,
      cursor: '1000',
      limit: 1,
    });
  });

  it('keeps inactive and contract-account states explicit', async () => {
    const inactive = dependencies({status: 'inactive', address: accountAddress});
    await expect(loadHistoryPage(inactive.dependencies, account())).resolves.toEqual({
      status: 'inactive',
    });

    const contract = account({identityKind: 'contract'});
    const untouched = dependencies({status: 'active', records: []});
    await expect(loadHistoryPage(untouched.dependencies, contract)).resolves.toEqual({
      status: 'unsupported-account',
    });
    expect(untouched.loadAccountOperations).not.toHaveBeenCalled();
  });

  it('fails closed on a network mismatch before Horizon access', async () => {
    const gateway = dependencies({status: 'active', records: []});

    await expect(
      loadHistoryPage(
        gateway.dependencies,
        account({networkId: 'stellar-mainnet'}),
      ),
    ).rejects.toThrow('history-network-mismatch');
    expect(gateway.loadAccountOperations).not.toHaveBeenCalled();
  });
});
