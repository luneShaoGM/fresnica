import {createLedgerReadInvalidationStore} from '../LedgerReadInvalidationStore';

describe('LedgerReadInvalidationStore', () => {
  it('tracks revisions independently by network and account', () => {
    const store = createLedgerReadInvalidationStore();
    const listener = jest.fn();
    const stop = store.subscribe(listener);

    store.invalidate({
      networkId: 'stellar-testnet',
      accountId: 'account-1',
      transactionHash: 'hash-1',
    });

    expect(store.getRevision('stellar-testnet', 'account-1')).toBe(1);
    expect(store.getRevision('stellar-testnet', 'account-2')).toBe(0);
    expect(store.getRevision('stellar-mainnet', 'account-1')).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);

    stop();
    store.invalidate({
      networkId: 'stellar-testnet',
      accountId: 'account-1',
      transactionHash: 'hash-2',
    });
    expect(store.getRevision('stellar-testnet', 'account-1')).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

it('only notifies transaction observers for transaction invalidation and disposes them', () => {
  const store = createLedgerReadInvalidationStore();
  const listener = jest.fn();
  const stop = store.subscribeTransactions(listener);
  const input = { networkId: 'testnet', accountId: 'a', transactionHash: 'hash' };
  store.refresh({ networkId: 'testnet', accountId: 'a', reason: 'post-submit' });
  expect(listener).not.toHaveBeenCalled();
  store.invalidate(input);
  expect(listener).toHaveBeenCalledWith(input);
  stop();
  stop();
  store.invalidate(input);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(store.getRevision('testnet', 'a')).toBe(3);
});
