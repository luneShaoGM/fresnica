import { Transaction } from '@stellar/stellar-sdk/axios';
import { createMarkets } from '../../../capabilities/markets/createMarkets';
import { reconcilePendingSubmissions } from '../../../capabilities/transaction/reconcilePendingSubmissions';
import {
  account,
  address,
  createOffer,
  exit,
  fixture,
  network,
  poolId,
  rawOffer,
  rawPool,
  state,
} from './marketFixtures';

describe('S12 actual XDR prepare, shared authorization and durable recovery', () => {
  it('prepares the exact all-shares exit once and atomically appends optional pool cleanup', async () => {
    const f = fixture();
    const review = await f.product.prepare(account.id, { ...exit, close: true }, () => true);
    expect(review.fee).toBe('200');
    expect(review.operation).toMatchObject({
      type: 'exit',
      shares: '5.0000000',
      minA: '9.9500000',
      minB: '19.9000000',
      close: true,
    });
    const tx = new Transaction(review.transactionXdrBase64, network.networkPassphrase);
    expect(tx.operations.map(op => op.type)).toEqual(['liquidityPoolWithdraw', 'changeTrust']);
    expect(Object.isFrozen(review.operation)).toBe(true);
    // Snapshot expiry does not force a prepared transaction out of its longer TimeBounds.
    f.clock.now += 31000;
    f.clock.monotonic += 31000;
    const result = await f.product.submit(review, 'test-passphrase', () => true);
    expect(result.status).toBe('submitted');
    expect(f.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionXdrBase64: review.transactionXdrBase64,
        expectedSignerPublicKey: address,
        appPassphrase: 'test-passphrase',
      }),
    );
    expect(f.recovery.readInvalidation.invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: account.id, networkId: network.id }),
    );
  });
  it('fails closed on cached-only/missing live pool, wrong pool identity and wrong account source', async () => {
    const f = fixture();
    f.read.mockRejectedValueOnce(new Error('offline'));
    await expect(f.product.prepare(account.id, exit, () => true)).rejects.toThrow();
    expect(f.server.loadAccount).not.toHaveBeenCalled();
    f.read.mockResolvedValueOnce({ ...rawPool, id: 'a'.repeat(64) });
    await expect(f.product.prepare(account.id, exit, () => true)).rejects.toThrow();
    f.base.loadAccountState.mockResolvedValueOnce({ status: 'active', account: { ...state, address: 'other' } });
    await expect(f.product.prepare(account.id, exit, () => true)).rejects.toThrow('account_inactive');
  });
  it.each(['monotonic', 'wall'] as const)(
    'rejects %s preparation expiry / rollback without extending the window',
    async clock => {
      const f = fixture();
      const build = f.gateway.build.bind(f.gateway);
      jest.spyOn(f.gateway, 'build').mockImplementation(async (...args) => {
        const result = await build(...args);
        if (clock === 'monotonic') f.clock.monotonic += 30000;
        else f.clock.now -= 1;
        return result;
      });
      await expect(f.product.prepare(account.id, exit, () => true)).rejects.toThrow('pool_state_stale');
      expect(f.sign).not.toHaveBeenCalled();
    },
  );
  it('independently rejects builder changes to reviewed minimum amounts', async () => {
    const f = fixture();
    const build = f.gateway.build.bind(f.gateway);
    jest
      .spyOn(f.gateway, 'build')
      .mockImplementation((source, op, fee, expires) =>
        build(source, op.type === 'exit' ? { ...op, minB: '0' } : op, fee, expires),
      );
    await expect(f.product.prepare(account.id, exit, () => true)).rejects.toThrow('market_review_mismatch');
    expect(f.sign).not.toHaveBeenCalled();
  });
  it('requires a new preparation if an All position changes while XDR is being constructed', async () => {
    const f = fixture();
    f.base.loadAccountState
      .mockResolvedValueOnce({ status: 'active', account: state })
      .mockResolvedValueOnce({
        status: 'active',
        account: {
          ...state,
          balances: state.balances.map(line =>
            line.kind === 'liquidity-pool-share' ? { ...line, balance: '6' } : line,
          ),
        },
      });
    await expect(f.product.prepare(account.id, { ...exit, close: true }, () => true)).rejects.toThrow(
      'pool_state_stale',
    );
    expect(f.sign).not.toHaveBeenCalled();
  });
  it('new product instances and shallow copies cannot submit an unissued review', async () => {
    const f = fixture(),
      review = await f.product.prepare(account.id, exit, () => true);
    await expect(f.product.submit({ ...review }, 'test-passphrase', () => true)).rejects.toThrow(
      'market_review_mismatch',
    );
    await expect(createMarkets(f.dependencies).submit(review, 'test-passphrase', () => true)).rejects.toThrow(
      'market_review_mismatch',
    );
    expect(f.sign).not.toHaveBeenCalled();
  });
  it('read-only accounts may load positions but cannot sign', async () => {
    const f = fixture();
    f.repository.detachSigner(account.id, 'signer');
    expect((await f.product.list(account.id, 'pools')).positions[0]).toMatchObject({
      shares: '5',
      underlyingA: '10.0000000',
      underlyingB: '20.0000000',
    });
    const review = await f.product.prepare(account.id, exit, () => true);
    await expect(f.product.submit(review, 'test-passphrase', () => true)).rejects.toThrow('watch_only');
    expect(f.sign).not.toHaveBeenCalled();
  });
  it('keeps a pool share row visible when its pool detail lookup fails, and does not load orders for pools', async () => {
    const f = fixture();
    f.read.mockRejectedValue(new Error('offline'));
    const data = await f.product.list(account.id, 'pools');
    expect(data.positions).toEqual([{ id: poolId, shares: '5' }]);
    expect(f.read).toHaveBeenCalledTimes(1);
  });
  it('stops stale preparation and late native signing before any broadcast or pending write', async () => {
    const f = fixture();
    let live = true;
    const review = await f.product.prepare(account.id, exit, () => live);
    const signed = f.sign.getMockImplementation()!;
    f.sign.mockImplementationOnce(async input => {
      const result = await signed(input);
      live = false;
      return result;
    });
    await expect(f.product.submit(review, 'test-passphrase', () => live)).rejects.toThrow('session-retired');
    expect(f.base.submitTransaction).not.toHaveBeenCalled();
    expect(f.pending.listUnresolved()).toEqual([]);
    await expect(f.product.prepare(account.id, exit, () => false)).rejects.toThrow('market_session_retired');
  });
  it('requires a fresh passphrase and supports retry after SDK rejection', async () => {
    const f = fixture();
    const review = await f.product.prepare(account.id, exit, () => true);
    expect((await f.product.submit(review, undefined, () => true)).status).toBe('passphrase-required');
    await expect(f.product.submit(review, 'wrong', () => true)).rejects.toThrow('invalid-passcode');
    expect(f.pending.listUnresolved()).toEqual([]);
    expect(f.base.submitTransaction).not.toHaveBeenCalled();
    expect((await f.product.submit(review, 'test-passphrase', () => true)).status).toBe('submitted');
  });
  it('blocks another LP exit across product restart until original-hash reconciliation', async () => {
    const f = fixture();
    f.base.submitTransaction.mockImplementationOnce(async value => {
      const hash = f.base.transactionHash(value);
      expect(f.pending.get(network.id, hash)?.state).toBe('submitting');
      return { status: 'uncertain', transactionHash: hash };
    });
    const review = await f.product.prepare(account.id, exit, () => true);
    const first = await f.product.submit(review, 'test-passphrase', () => true);
    expect(first.status).toBe('uncertain');
    const next = createMarkets(f.dependencies);
    const replacement = await next.prepare(account.id, { ...exit, mode: 'exact_shares', shares: '2' }, () => true);
    expect(await next.submit(replacement, 'test-passphrase', () => true)).toMatchObject({
      status: 'uncertain',
      reason: 'pending-reconciliation',
    });
    expect(f.base.submitTransaction).toHaveBeenCalledTimes(1);
    expect(f.sign).toHaveBeenCalledTimes(1);
    await reconcilePendingSubmissions({ gateway: f.gateway, ...f.recovery, networkId: network.id });
    expect(f.pending.listUnresolved()).toHaveLength(0);
    if ('transactionHash' in first) expect(next.outcome(first.transactionHash)).toBe('confirmed');
  });
  it.each(['buy', 'sell'] as const)('preserves %s intent, BASE amount and exact ratio in actual XDR', async side => {
    const f = fixture();
    const review = await f.product.prepare(
      account.id,
      { ...createOffer, side, amount: '100', price: '0.325' },
      () => true,
    );
    const op = f.gateway.inspect(review.transactionXdrBase64).operation;
    expect(op).toMatchObject({ type: side, amount: '100.0000000', price: { n: 13, d: 40 } });
    expect((await f.product.submit(review, 'test-passphrase', () => true)).status).toBe('submitted');
  });
  it('updates only the exact owned pair; cancel uses current canonical zero-amount sell', async () => {
    const f = fixture();
    const update = { ...createOffer, action: 'update' as const, offerId: '12', amount: '9', price: '0.5' };
    expect((await f.product.prepare(account.id, update, () => true)).operation).toMatchObject({
      type: 'sell',
      offerId: '12',
    });
    const cancelled = await f.product.prepare(account.id, { ...update, action: 'cancel' }, () => true);
    expect(cancelled.operation).toMatchObject({ type: 'sell', amount: '0.0000000', price: rawOffer.price_r });
    f.read.mockResolvedValueOnce({ ...rawOffer, seller: fixture().gateway.network.networkPassphrase });
    await expect(f.product.prepare(account.id, update, () => true)).rejects.toThrow();
  });
  it('refuses updated ledger offers before signing and preserves identity after uncertain create', async () => {
    const f = fixture();
    const review = await f.product.prepare(account.id, { ...createOffer, action: 'cancel', offerId: '12' }, () => true);
    f.read.mockResolvedValueOnce({ ...rawOffer, amount: '9.0000000' });
    await expect(f.product.submit(review, 'test-passphrase', () => true)).rejects.toThrow('offer_state_changed');
    expect(f.sign).not.toHaveBeenCalled();
  });
  it('rejects removed/hidden accounts and a gateway on another network', async () => {
    const f = fixture();
    f.repository.setAccountHidden(account.id, true, new Date());
    await expect(f.product.list(account.id, 'pools')).rejects.toThrow('market_context_mismatch');
    const other = fixture();
    const deps = { ...other.dependencies, network: { ...network, id: 'stellar-mainnet' } };
    await expect(createMarkets(deps).prepare(account.id, exit, () => true)).rejects.toThrow('market_context_mismatch');
  });
});
