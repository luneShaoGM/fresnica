import { issuerTomlUrl, TOKEN_METADATA_TTL_MS, validateTokenMetadataSnapshot } from '../TokenMetadataCache';
import { safePublicHttpsUrl } from '../safePublicHttpsUrl';

const issuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const icon = 'https://raw.githubusercontent.com/org/icons/main/token.png';

describe('Token metadata identity and safe public URL policy', () => {
  it('does not allow local targets, credentialed URLs, fragments or alternate ports', () => {
    for (const value of [
      'http://raw.githubusercontent.com/test.png',
      'https://127.0.0.1/icon.png',
      'https://[::1]/icon.png',
      'https://localhost/icon.png',
      'https://local.internal/icon.png',
      'https://user:secret@raw.githubusercontent.com/icon.png',
      'https://raw.githubusercontent.com:8443/icon.png',
      'https://raw.githubusercontent.com/icon.png#frag',
      'https://raw.githubusercontent.com/icon.png ',
    ])
      expect(safePublicHttpsUrl(value)).toBeUndefined();
    expect(safePublicHttpsUrl(icon)).toBe(icon);
    expect(issuerTomlUrl('ISSUER.EXAMPLE.ORG')).toBe('https://issuer.example.org/.well-known/stellar.toml');
    expect(issuerTomlUrl('localhost')).toBeUndefined();
    expect(issuerTomlUrl('https://issuer.example.org')).toBeUndefined();
  });

  it('stores only exact code/issuer Mainnet metadata and no image bytes or account IDs', () => {
    const value = {
      schemaVersion: 1,
      networkId: 'stellar-mainnet',
      code: 'Usd',
      issuer,
      savedAtUnixMs: TOKEN_METADATA_TTL_MS,
      metadata: { name: 'USD', source: 'issuer-toml', icons: [icon] },
    };
    expect(validateTokenMetadataSnapshot(value, 'stellar-mainnet', 'Usd', issuer)).toEqual(value);
    expect(validateTokenMetadataSnapshot(value, 'stellar-testnet', 'Usd', issuer)).toBeUndefined();
    expect(validateTokenMetadataSnapshot(value, 'stellar-mainnet', 'USD', issuer)).toBeUndefined();
    expect(validateTokenMetadataSnapshot(value, 'stellar-mainnet', 'Usd', issuer.replace('G', 'H'))).toBeUndefined();
    expect(
      validateTokenMetadataSnapshot(
        { ...value, metadata: { ...value.metadata, icons: ['http://localhost/icon'] } },
        'stellar-mainnet',
        'Usd',
        issuer,
      ),
    ).toBeUndefined();
    expect(
      validateTokenMetadataSnapshot(
        { ...value, metadata: { ...value.metadata, icons: [icon, icon] } },
        'stellar-mainnet',
        'Usd',
        issuer,
      ),
    ).toBeUndefined();
  });
});
