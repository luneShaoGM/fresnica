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
