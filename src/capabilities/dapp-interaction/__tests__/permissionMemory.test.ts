import { clearDappReadGrants, hasDappReadGrant, rememberDappReadGrant } from '../permissionMemory';

describe('dApp read grants', () => {
  beforeEach(() => {
    clearDappReadGrants();
  });

  it('remembers an origin only for the same account and network', () => {
    rememberDappReadGrant('https://demo.example', 'account-a', 'stellar-testnet');
    expect(hasDappReadGrant('https://demo.example', 'account-a', 'stellar-testnet')).toBe(true);
    expect(hasDappReadGrant('https://demo.example', 'account-b', 'stellar-testnet')).toBe(false);
    expect(hasDappReadGrant('https://demo.example', 'account-a', 'stellar-mainnet')).toBe(false);
    expect(hasDappReadGrant('https://other.example', 'account-a', 'stellar-testnet')).toBe(false);
  });
});
