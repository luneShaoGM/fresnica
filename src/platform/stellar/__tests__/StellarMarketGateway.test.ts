import { Asset, Memo, Operation, Transaction, TransactionBuilder } from '@stellar/stellar-sdk/axios';
import {
  fixture,
  account,
  exit,
  createOffer,
  rawPool,
  poolId,
  rawOffer,
  address,
  issuer,
  network,
} from '@platform/stellar/__tests__/marketFixtures';

describe('S12 provider validation and independent exact envelope inspection', () => {
  it('checks live pool identity from canonical A/B and fee, including wrong/swapped/malformed parameters', async () => {
    const f = fixture();
    expect((await f.gateway.loadPool(poolId)).id).toBe(poolId);
    for (const raw of [
      { ...rawPool, fee_bp: 100 },
      { ...rawPool, reserves: [...rawPool.reserves].reverse() },
      { ...rawPool, total_shares: '1e9' },
    ]) {
      f.read.mockResolvedValueOnce(raw);
      await expect(f.gateway.loadPool(poolId)).rejects.toThrow();
    }
  });
  it('normalizes owned offers with exact ratio, IDs and case-sensitive issuer identity', async () => {
    const f = fixture();
    expect(await f.gateway.listOffers(address)).toEqual([
      {
        id: '12',
        seller: address,
        selling: { kind: 'native' },
        buying: { kind: 'credit', code: 'usd', issuer },
        amount: '10.0000000',
        price: { n: 1, d: 2 },
      },
    ]);
    for (const row of [
      { ...rawOffer, price_r: { n: 0, d: 1 } },
      { ...rawOffer, id: 12 },
      { ...rawOffer, amount: 'NaN' },
      { ...rawOffer, seller: issuer },
      { ...rawOffer, selling: { asset_type: 'liquidity_pool_shares', asset_code: 'usd', asset_issuer: issuer } },
    ]) {
      f.read.mockResolvedValueOnce({ _embedded: { records: [row] } });
      await expect(f.gateway.listOffers(address)).rejects.toThrow();
    }
    f.read.mockResolvedValueOnce({ _embedded: { records: [rawOffer, rawOffer] } });
    await expect(f.gateway.listOffers(address)).rejects.toThrow();
  });
  it('rejects unrelated operations, memo, extra operations, source overrides, signatures and additional preconditions', async () => {
    const f = fixture();
    const review = await f.product.prepare(account.id, exit, () => true);
    const original = new Transaction(review.transactionXdrBase64, network.networkPassphrase);
    const altered = [
      TransactionBuilder.cloneFrom(original).addMemo(Memo.text('hidden')).build(),
      TransactionBuilder.cloneFrom(original)
        .addOperation(Operation.payment({ destination: issuer, asset: Asset.native(), amount: '1' }))
        .build(),
      TransactionBuilder.cloneFrom(original).setMinAccountSequence('1').build(),
    ];
    for (const transaction of altered)
      expect(() => f.gateway.inspect(transaction.toXdr())).toThrow('market_review_mismatch');
    const offered = await f.product.prepare(account.id, createOffer, () => true);
    expect(f.gateway.inspect(offered.transactionXdrBase64).operation.type).toBe('sell');
    const tx = new Transaction(offered.transactionXdrBase64, network.networkPassphrase);
    expect(tx.operations).toHaveLength(1);
  });
  it('maps LP operation result codes while preserving deterministic rejection and original hash', async () => {
    const f = fixture();
    const review = await f.product.prepare(account.id, exit, () => true);
    f.base.submitTransaction.mockResolvedValueOnce({
      status: 'rejected',
      transactionHash: 'original',
      resultCode: 'tx_failed',
      operationResultCodes: ['op_under_minimum'],
    });
    await expect(f.gateway.submitTransaction(review.transactionXdrBase64)).resolves.toMatchObject({
      status: 'rejected',
      transactionHash: 'original',
      resultCode: 'under_minimum',
    });
  });
});
