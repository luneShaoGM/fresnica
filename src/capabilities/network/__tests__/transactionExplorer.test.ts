import { transactionExplorerUrl } from '../transactionExplorer';

describe('transactionExplorerUrl', () => {
  const hash = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

  it('projects the frozen trusted Stellar explorer URLs', () => {
    expect(transactionExplorerUrl('stellar-testnet', hash)).toBe(`https://stellar.expert/explorer/testnet/tx/${hash}`);
    expect(transactionExplorerUrl('stellar-mainnet', hash)).toBe(`https://stellar.expert/explorer/public/tx/${hash}`);
  });

  it('preserves a valid public hash without adding query or fragment data', () => {
    const uppercase = hash.toUpperCase();
    expect(transactionExplorerUrl('stellar-testnet', uppercase)).toBe(
      `https://stellar.expert/explorer/testnet/tx/${uppercase}`,
    );
  });

  it('returns no projection for unsupported networks or invalid hashes', () => {
    expect(transactionExplorerUrl('custom-network', hash)).toBeUndefined();
    expect(transactionExplorerUrl('stellar-testnet', 'not-a-hash')).toBeUndefined();
    expect(transactionExplorerUrl('stellar-testnet', `${hash}?redirect=https://example.com`)).toBeUndefined();
  });
});
