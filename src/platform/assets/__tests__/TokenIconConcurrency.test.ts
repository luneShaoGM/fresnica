import type { TokenMetadataRepository, TokenMetadataSnapshot } from '../../../capabilities/assets/TokenMetadataCache';
import { createNativeSafePublicTransport, type SafePublicTransport } from '../NativeSafePublicTransport';
import { createTokenIconPort } from '../TokenIconPort';
import { createTokenMetadataPort, type TokenMetadataPort } from '../TokenMetadataResolver';

const issuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const networkId = 'stellar-testnet';
const networkPassphrase = 'Test SDF Network ; September 2015';
const horizonUrl = 'https://horizon-testnet.stellar.org/';
const imageUrl = 'https://issuer.example.org/token.png';
const base64 = 'aGVsbG8=';
const dataUri = 'data:image/png;base64,' + base64;
const codes = Array.from({ length: 25 }, (_, index) => 'T' + index);

type NativeReply = Readonly<{ text?: string; mimeType?: 'image/png'; base64?: string }>;
type PendingRequest = Readonly<{
  url: string;
  kind: 'text' | 'icon';
  resolve: (reply: NativeReply) => void;
}>;

function nextTurn(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

describe('S06 bursty Testnet icon loads', () => {
  it('drains 25 real metadata resolutions through the bounded native queue without 24h false cooldowns', async () => {
    const waiting: PendingRequest[] = [];
    const native = {
      fetch: jest.fn(
        (url: string, kind: 'text' | 'icon') =>
          new Promise<NativeReply>(resolve => waiting.push({ url, kind, resolve })),
      ),
      cancel: jest.fn(),
    };
    const transport = createNativeSafePublicTransport(native);
    const saved = new Map<string, TokenMetadataSnapshot>();
    const cache: TokenMetadataRepository = {
      read: (network, code, identity) => saved.get(JSON.stringify([network, code, identity])),
      replace: snapshot => {
        saved.set(JSON.stringify([snapshot.networkId, snapshot.code, snapshot.issuer]), snapshot);
      },
    };
    const metadata = createTokenMetadataPort({
      networkId,
      networkPassphrase,
      horizonUrl,
      cache,
      catalog: { read: jest.fn() },
      transport,
    });
    let activeMetadata = 0;
    let maxActiveMetadata = 0;
    const countedMetadata: TokenMetadataPort = {
      peek: metadata.peek,
      resolve: async (identity, signal, forceRefresh) => {
        activeMetadata += 1;
        maxActiveMetadata = Math.max(maxActiveMetadata, activeMetadata);
        try {
          return await metadata.resolve(identity, signal, forceRefresh);
        } finally {
          activeMetadata -= 1;
        }
      },
      close: metadata.close,
    };
    const icons = createTokenIconPort({ networkId, metadata: countedMetadata, transport });
    const toml = codes
      .map(code =>
        ['[[CURRENCIES]]', 'code="' + code + '"', 'issuer="' + issuer + '"', 'image="' + imageUrl + '"'].join('\n'),
      )
      .join('\n');

    expect(
      await icons.loadIcon({ kind: 'credit', code: codes[0], issuer }, new AbortController().signal),
    ).toBeUndefined();
    expect(native.fetch).not.toHaveBeenCalled();

    icons.setEnabled(true);
    let finished = 0;
    const results = codes.map(code =>
      icons.loadIcon({ kind: 'credit' as const, code, issuer }, new AbortController().signal).then(value => {
        finished += 1;
        return value;
      }),
    );

    // The native fetches remain unresolved until the fixture completes them.
    // More than 18 simultaneous metadata resolves used to overflow the
    // production native queue and persist a negative issuer cache record.
    for (let turn = 0; turn < 200 && finished < codes.length; turn += 1) {
      await nextTurn();
      const batch = waiting.splice(0);
      for (const request of batch) {
        if (request.kind === 'icon') {
          request.resolve({ mimeType: 'image/png', base64 });
        } else if (request.url === horizonUrl) {
          request.resolve({ text: JSON.stringify({ network_passphrase: networkPassphrase }) });
        } else if (request.url.includes('/accounts/')) {
          request.resolve({ text: JSON.stringify({ account_id: issuer, home_domain: 'issuer.example.org' }) });
        } else {
          request.resolve({ text: toml });
        }
      }
    }

    expect(finished).toBe(codes.length);
    expect(await Promise.all(results)).toEqual(codes.map(() => dataUri));
    expect(maxActiveMetadata).toBeLessThanOrEqual(2);
    expect(saved.size).toBe(codes.length);
    expect([...saved.values()].every(snapshot => snapshot.retryAfterUnixMs === undefined)).toBe(true);
    icons.close();
    expect(native.cancel).not.toHaveBeenCalled();
  });

  it('opt-out cancels a queued burst without starting additional requests and re-enable recovers', async () => {
    const resolvers: Array<() => void> = [];
    const metadataResult = {
      metadata: { source: 'issuer-toml' as const, icons: [imageUrl] },
      fromCache: false,
      stale: false,
      refreshFailed: false,
    };
    const resolveMetadata = jest.fn(
      () =>
        new Promise<typeof metadataResult>(resolve => {
          resolvers.push(() => resolve(metadataResult));
        }),
    );
    const metadata: TokenMetadataPort = {
      peek: () => undefined,
      resolve: resolveMetadata,
      close: jest.fn(),
    };
    const readIcon = jest.fn(async () => ({ mimeType: 'image/png' as const, dataUri }));
    const transport: SafePublicTransport = {
      available: true,
      readIcon,
      readText: jest.fn(),
      close: jest.fn(),
    };
    const icons = createTokenIconPort({ networkId, metadata, transport });
    icons.setEnabled(true);
    const loads = codes.map(code => icons.loadIcon({ kind: 'credit', code, issuer }, new AbortController().signal));
    await nextTurn();
    expect(resolveMetadata).toHaveBeenCalledTimes(2);
    expect(resolvers).toHaveLength(2);

    icons.setEnabled(false);
    for (const resolve of resolvers.splice(0)) resolve();
    expect(await Promise.all(loads)).toEqual(codes.map(() => undefined));
    expect(resolveMetadata).toHaveBeenCalledTimes(2);
    expect(readIcon).not.toHaveBeenCalled();

    icons.setEnabled(true);
    const next = icons.loadIcon({ kind: 'credit', code: 'NEW', issuer }, new AbortController().signal);
    await nextTurn();
    expect(resolveMetadata).toHaveBeenCalledTimes(3);
    resolvers[0]();
    expect(await next).toBe(dataUri);
    icons.close();
  });

  it('service retirement cancels queued work and prevents late native image loads', async () => {
    const resolvers: Array<() => void> = [];
    const metadataResult = {
      metadata: { source: 'issuer-toml' as const, icons: [imageUrl] },
      fromCache: false,
      stale: false,
      refreshFailed: false,
    };
    const metadata: TokenMetadataPort = {
      peek: () => undefined,
      resolve: jest.fn(
        () =>
          new Promise<typeof metadataResult>(resolve => {
            resolvers.push(() => resolve(metadataResult));
          }),
      ),
      close: jest.fn(),
    };
    const readIcon = jest.fn(async () => ({ mimeType: 'image/png' as const, dataUri }));
    const transport: SafePublicTransport = {
      available: true,
      readIcon,
      readText: jest.fn(),
      close: jest.fn(),
    };
    const icons = createTokenIconPort({ networkId, metadata, transport });
    icons.setEnabled(true);
    const loads = codes.map(code => icons.loadIcon({ kind: 'credit', code, issuer }, new AbortController().signal));
    await nextTurn();
    expect(metadata.resolve).toHaveBeenCalledTimes(2);
    icons.close();
    for (const resolve of resolvers) resolve();

    expect(await Promise.all(loads)).toEqual(codes.map(() => undefined));
    expect(metadata.resolve).toHaveBeenCalledTimes(2);
    expect(readIcon).not.toHaveBeenCalled();
    expect(metadata.close).toHaveBeenCalledTimes(1);
    expect(transport.close).toHaveBeenCalledTimes(1);
  });
});
