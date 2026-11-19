import { createDappRecentHistory, isDappRecentOrigins } from '../dappRecentHistory';

function repository() {
  const rows = new Map<string, readonly string[]>();
  return {
    rows,
    read: jest.fn((network: string) => rows.get(network) ?? []),
    replace: jest.fn((network: string, origins: readonly string[]) => {
      rows.set(network, origins);
    }),
  };
}

describe('shared Recent public history', () => {
  it('strips paths/query/hash, deduplicates most-recent-first and bounds history at ten', () => {
    const repo = repository();
    const history = createDappRecentHistory(repo, 'testnet');
    const listener = jest.fn();
    history.subscribe(listener);
    for (let i = 0; i < 12; i++) history.record(`https://app${i}.example.org/app?secret=never-save#private`);
    history.record('https://app5.example.org/other');
    expect(history.getSnapshot().origins).toEqual([
      'https://app5.example.org',
      ...[11, 10, 9, 8, 7, 6, 4, 3, 2].map(i => `https://app${i}.example.org`),
    ]);
    expect(listener).toHaveBeenCalledTimes(13);
    expect(JSON.stringify([...repo.rows])).not.toMatch(/never-save|private|other/);
    expect(createDappRecentHistory(repo, 'testnet').getSnapshot()).toEqual(history.getSnapshot());
    expect(createDappRecentHistory(repo, 'mainnet').getSnapshot().origins).toEqual([]);
  });

  it('ignores credentials, nonpublic URLs and callbacks after network disposal', () => {
    const repo = repository();
    const history = createDappRecentHistory(repo, 'testnet');
    for (const url of [
      'http://example.org',
      'https://u:p@example.org',
      'https://localhost',
      'https://127.0.0.1',
      'garbage',
    ])
      history.record(url);
    history.close();
    history.record('https://late.example.org');
    history.retry();
    expect(repo.replace).not.toHaveBeenCalled();
    expect(repo.read).toHaveBeenCalledTimes(1);
  });

  it('retains the last saved history on write failure and retries without fabricating an open', () => {
    const repo = repository();
    const history = createDappRecentHistory(repo, 'testnet');
    history.record('https://saved.example.org');
    repo.replace.mockImplementationOnce(() => {
      throw new Error('disk-full');
    });
    history.record('https://unsaved.example.org');
    expect(history.getSnapshot()).toEqual({ origins: ['https://saved.example.org'], unavailable: true });
    history.retry();
    expect(history.getSnapshot()).toEqual({ origins: ['https://saved.example.org'], unavailable: false });
    history.record('https://unsaved.example.org');
    expect(history.getSnapshot().origins[0]).toBe('https://unsaved.example.org');
  });

  it('does not overwrite unread history during read failure; recovers and merges on next visit', () => {
    const repo = repository();
    repo.rows.set('testnet', ['https://saved.example.org']);
    repo.read
      .mockImplementationOnce(() => {
        throw new Error('closed');
      })
      .mockImplementationOnce(() => {
        throw new Error('closed');
      });
    const history = createDappRecentHistory(repo, 'testnet');
    history.record('https://new.example.org');
    expect(repo.replace).not.toHaveBeenCalled();
    expect(history.getSnapshot().unavailable).toBe(true);
    history.record('https://new.example.org');
    expect(history.getSnapshot().origins).toEqual(['https://new.example.org', 'https://saved.example.org']);
  });

  it('rejects persisted full URLs, duplicates, oversized lists and non-HTTPS origins', () => {
    for (const value of [
      null,
      {},
      ['https://example.org/path'],
      ['https://example.org?secret=x'],
      ['https://example.org/'],
      ['http://example.org'],
      ['https://example.org', 'https://example.org'],
      Array.from({ length: 11 }, (_, i) => `https://app${i}.example.org`),
    ])
      expect(isDappRecentOrigins(value)).toBe(false);
    expect(isDappRecentOrigins(['https://example.org:8443'])).toBe(true);
  });
});

describe.each(['node', 'react-native'] as const)('Recent origin privacy with %s URL', parser => {
  const originalURL = global.URL;
  const originalSearchParams = global.URLSearchParams;
  beforeEach(() => {
    if (parser === 'react-native') {
      global.URL = jest.requireActual<{ URL: typeof URL }>('react-native/Libraries/Blob/URL').URL;
      global.URLSearchParams = jest.requireActual<{ URLSearchParams: typeof URLSearchParams }>(
        'react-native/Libraries/Blob/URLSearchParams',
      ).URLSearchParams;
    }
  });
  afterEach(() => {
    global.URL = originalURL;
    global.URLSearchParams = originalSearchParams;
  });

  it('saves only authority for pathless queries and keeps ports separate from query data', () => {
    if (parser === 'react-native') expect(new URL('https://example.org?token=private').origin).toContain('?');
    const repo = repository();
    const history = createDappRecentHistory(repo, 'testnet');
    for (const [url, expected] of [
      ['https://example.org?token=private', 'https://example.org'],
      ['https://example.org?preview', 'https://example.org'],
      ['https://example.org:443?token=private', 'https://example.org'],
      ['https://example.org:8443?token=private', 'https://example.org:8443'],
      ['https://example.org?next=https%3A%2F%2Fother.example.org:9443', 'https://example.org'],
      ['https://example.org/app?token=private#private', 'https://example.org'],
    ]) {
      history.record(url);
      expect(history.getSnapshot().origins[0]).toBe(expected);
      expect(JSON.stringify([...repo.rows])).not.toMatch(/private|token|preview|next|9443/);
    }
    history.close();
    expect(createDappRecentHistory(repo, 'testnet').getSnapshot().origins).toEqual([
      'https://example.org',
      'https://example.org:8443',
    ]);
  });

  it('independently rejects query/path/fragment/credential records on read and write validation', () => {
    for (const origin of [
      'https://example.org?token=private',
      'https://example.org?',
      'https://example.org/?token=private',
      'https://example.org#private',
      'https://example.org/path',
      'https://u:p@example.org',
      'https://example.org:443',
      'https://example.org:65536',
      'https://example.org:bad',
    ]) {
      expect(isDappRecentOrigins([origin])).toBe(false);
      const repo = repository();
      repo.rows.set('testnet', [origin]);
      const history = createDappRecentHistory(repo, 'testnet');
      expect(history.getSnapshot()).toEqual({ origins: [], unavailable: true });
    }
  });
});
