import { createCuratedSessionLaunch } from '../curatedSessionLaunch';

const selection = {
  accountId: 'wallet1',
  address: 'GSOURCE',
  networkId: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
  networkUrl: 'https://horizon-testnet.stellar.org',
  revision: 4,
};
const url = 'https://dex.example.org/app';

describe('S15 one-use trusted catalog launch proof', () => {
  it('grants only the exact first current browser route and cannot be replayed', () => {
    const launch = createCuratedSessionLaunch(() => 1000);
    launch.prepare(url, selection, true);
    expect(launch.consume(url, selection)).toBe('https://dex.example.org');
    expect(launch.consume(url, selection)).toBeUndefined();
  });

  it('refuses manual and private URLs, subdomains, and wrong paths', () => {
    const launch = createCuratedSessionLaunch(() => 1000);
    launch.prepare(url, selection, false);
    expect(launch.consume(url, selection)).toBeUndefined();
    launch.prepare('https://127.0.0.1/private', selection, true);
    expect(launch.consume('https://127.0.0.1/private', selection)).toBeUndefined();
    launch.prepare(url, selection, true);
    expect(launch.consume('https://dex.example.org.evil.example/app', selection)).toBeUndefined();
    expect(launch.consume(url, selection)).toBeUndefined();
    launch.prepare(url, selection, true);
    expect(launch.consume('https://dex.example.org/other', selection)).toBeUndefined();
  });

  it.each([
    { accountId: 'other' },
    { address: 'GOTHER' },
    { networkId: 'stellar-mainnet' },
    { networkPassphrase: 'Public Global Stellar Network ; September 2015' },
    { networkUrl: 'https://elsewhere.example.org' },
    { revision: 5 },
  ])('fails closed on changed selection identity: %o', change => {
    const launch = createCuratedSessionLaunch(() => 1000);
    launch.prepare(url, selection, true);
    expect(launch.consume(url, { ...selection, ...change })).toBeUndefined();
    expect(launch.consume(url, selection)).toBeUndefined();
  });

  it('expires the one-use proof after 30 seconds, including wall-clock rollback', () => {
    let now = 1000;
    const launch = createCuratedSessionLaunch(() => now);
    launch.prepare(url, selection, true);
    now += 30_001;
    expect(launch.consume(url, selection)).toBeUndefined();
    launch.prepare(url, selection, true);
    now -= 1;
    expect(launch.consume(url, selection)).toBeUndefined();
  });

  it('clears pending proof on manual navigation and invalid launch data', () => {
    const launch = createCuratedSessionLaunch(() => 1000);
    launch.prepare(url, selection, true);
    launch.clear();
    expect(launch.consume(url, selection)).toBeUndefined();
    launch.prepare(url, selection, true);
    launch.prepare(url, undefined, true);
    expect(launch.consume(url, selection)).toBeUndefined();
  });
});
