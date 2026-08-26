import { APP_CONFIG } from '../appConfig';

describe('APP_CONFIG', () => {
  it('uses Fresnica naming and a single immutable Stellar Testnet configuration', () => {
    expect(APP_CONFIG.appName).toBe('Fresnica');
    expect(APP_CONFIG.projectName).toBe('fresnica-mobile');
    expect(APP_CONFIG.network.id).toBe('stellar-testnet');
    expect(APP_CONFIG.network.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    expect(APP_CONFIG.network.networkPassphrase).toBe('Test SDF Network ; September 2015');
    expect(Object.isFrozen(APP_CONFIG.network)).toBe(true);
    expect(Object.isFrozen(APP_CONFIG)).toBe(true);
  });
});
