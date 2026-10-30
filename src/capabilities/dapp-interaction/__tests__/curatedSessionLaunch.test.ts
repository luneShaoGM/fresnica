import { createCuratedSessionLaunch } from '../curatedSessionLaunch';

const selection = {
  accountId: 'account-A',
  address: 'GACCOUNT',
  networkId: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
  networkUrl: 'https://horizon-testnet.stellar.org',
  revision: 19,
};
const url = 'https://dex.example.org/app';

describe('S15 trusted catalog launch is a one-time read-only session capability', () => {
  it('consumes an exact launch once; does not leave a durable or replayable grant', () => {
    const launch = createCuratedSessionLaunch();
    launch.prepare(url, selection, true);
    expect(launch.consume(url, selection)).toBe('https://dex.example.org');
    expect(launch.consume(url, selection)).toBeUndefined();
  });

  it('refuses manual URLs, invalid origin, subdomain impersonation and a changed launch URL', () => {
    const launch = createCuratedSessionLaunch();
    launch.prepare(url, selection, false);
    expect(launch.consume(url, selection)).toBeUndefined();
    launch.prepare('https://127.0.0.1/private', selection, true);
    expect(launch.consume('https://127.0.0.1/private', selection)).toBeUndefined();
    launch.prepare(url, selection, true);
    expect(launch.consume('https://dex.example.org.evil.example/app', selection)).toBeUndefined();
    // The failed consume removed the pending attestation.
    expect(launch.consume(url, selection)).toBeUndefined();
  });

  it.each([
    { accountId: 'account-B' },
    { address: 'GCHANGED' },
    { networkId: 'stellar-mainnet' },
    { networkPassphrase: 'Public Global Stellar Network ; September 2015' },
    { networkUrl: 'https://horizon.stellar.org' },
    { revision: 20 },
  ])('retire stale trust on account/network/selection identity change: %o', changed => {
    const launch = createCuratedSessionLaunch();
    launch.prepare(url, selection, true);
    expect(launch.consume(url, { ...selection, ...changed })).toBeUndefined();
    expect(launch.consume(url, selection)).toBeUndefined();
  });

  it('never carries a prior catalog grant into a later direct-navigation attempt', () => {
    const launch = createCuratedSessionLaunch();
    launch.prepare(url, selection, true);
    launch.clear();
    expect(launch.consume(url, selection)).toBeUndefined();
    launch.prepare(url, undefined, true);
    expect(launch.consume(url, selection)).toBeUndefined();
  });
});
