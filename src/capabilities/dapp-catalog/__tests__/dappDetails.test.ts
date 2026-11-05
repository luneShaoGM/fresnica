import {
  DAPP_DETAIL_CACHE_VERSION,
  DAPP_DETAIL_TTL_MS,
  DAPP_ICON_WINNER_TTL_MS,
  normalizeDappDetailSnapshot,
  normalizePublicDappDetail,
  validDappIdentity,
} from '../dappDetails';

const detail = {
  id: 'demo.app',
  title: 'Demo',
  description: 'A public dApp',
  longDescription: 'Longer description from directory provider',
  developerName: 'Developer',
  category: 'Tools',
  websiteUrl: 'https://demo.example.org/app',
  iconUrl: 'https://cdn.example.org/demo.png',
};
const snapshot = {
  schemaVersion: DAPP_DETAIL_CACHE_VERSION,
  networkId: 'stellar-mainnet',
  appId: 'demo.app',
  savedAtUnixMs: 12345,
  detail,
  iconPreference: { winner: detail.iconUrl, winnerExpiresAt: DAPP_ICON_WINNER_TTL_MS, failures: {} },
};

describe('LC5 public dApp detail and icon candidate cache contract', () => {
  it('validates network+identifier strictly and stores only bounded public display metadata', () => {
    expect(validDappIdentity('stellar-mainnet', 'demo.app')).toBe(true);
    expect(validDappIdentity('stellar-testnet', 'demo.app')).toBe(true);
    expect(validDappIdentity('stellar-mainnet', '../app')).toBe(false);
    expect(validDappIdentity('stellar-mainnet', 'x%2fapi')).toBe(false);
    expect(normalizeDappDetailSnapshot(snapshot, 'stellar-mainnet', 'demo.app')).toEqual(snapshot);
    expect(normalizeDappDetailSnapshot(snapshot, 'stellar-testnet', 'demo.app')).toBeUndefined();
    expect(normalizeDappDetailSnapshot(snapshot, 'stellar-mainnet', 'DEMO.app')).toBeUndefined();
    expect(
      normalizeDappDetailSnapshot({ ...snapshot, schemaVersion: 2 }, 'stellar-mainnet', 'demo.app'),
    ).toBeUndefined();
    expect(DAPP_DETAIL_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('does not persist account identifiers, permissions, image bytes or arbitrary provider properties', () => {
    const value = normalizeDappDetailSnapshot(
      {
        ...snapshot,
        grants: [{ accountId: 'SECRET' }],
        lastVisitedUrl: 'https://demo.example.org/transfer?private=1',
        detail: { ...detail, accountId: 'SECRET', signedXdr: 'signed-XDR', description: detail.description },
        iconPreference: { ...snapshot.iconPreference, rawImage: 'data:image/png;base64,SECRET' },
      },
      'stellar-mainnet',
      'demo.app',
    );
    expect(value).toEqual(snapshot);
    expect(JSON.stringify(value)).not.toContain('SECRET');
  });

  it('rejects unsafe icon locations and forged detail origins, while valid optional absence is allowed', () => {
    expect(
      normalizePublicDappDetail({ ...detail, iconUrl: 'http://127.0.0.1/x.png' }, 'stellar-mainnet', 'demo.app'),
    ).toBeUndefined();
    expect(normalizePublicDappDetail({ ...detail, id: 'evil' }, 'stellar-mainnet', 'demo.app')).toBeUndefined();
    expect(
      normalizePublicDappDetail({ ...detail, websiteUrl: 'http://localhost/' }, 'stellar-mainnet', 'demo.app'),
    ).toBeUndefined();
    const withoutIcon = { ...detail };
    delete (withoutIcon as Partial<typeof detail>).iconUrl;
    expect(normalizePublicDappDetail(withoutIcon, 'stellar-mainnet', 'demo.app')).toEqual(withoutIcon);
    expect(
      normalizeDappDetailSnapshot(
        {
          ...snapshot,
          iconPreference: { winner: 'http://localhost/private', winnerExpiresAt: 100, failures: {} },
        },
        'stellar-mainnet',
        'demo.app',
      ),
    ).toBeUndefined();
  });
});
