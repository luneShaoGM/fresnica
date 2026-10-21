import type { StellarPaymentAsset } from '../../stellar/types';
import { loadPathPaymentQuotes } from '../loadPathPaymentQuotes';
import type {
  LoadPathPaymentQuotesDependencies,
  PathPaymentQuoteGatewayPort,
  PathPaymentQuoteRequest,
  PathPaymentRoute,
} from '../types';

const official = require('../../../../spec/test-vectors/path-payment-v1.json') as {
  schema: string;
  path: { maximum_intermediate_assets: number; endpoints_are_excluded_from_intermediate_path: boolean };
  quote_ttl: { maximum_seconds: number; expires_when_now_equals_expires_at: boolean };
  swap: {
    source_account: string;
    destination_account: string;
    source_asset: string;
    destination_asset: string;
    strict_send_meaning: string;
    strict_receive_meaning: string;
  };
  selection: readonly unknown[];
  slippage: readonly unknown[];
};

const NETWORK = Object.freeze({ id: 'stellar-testnet', networkPassphrase: 'Test SDF Network ; September 2015' });
const NATIVE = Object.freeze({ kind: 'native' as const });
const CREDIT = Object.freeze({ kind: 'credit' as const, code: 'USDC', issuer: 'GISSUER' });
const PATH = Object.freeze({ kind: 'credit' as const, code: 'EUR', issuer: 'GISSUER' });
const SEND_ENDPOINTS = Object.freeze({ sourceAsset: NATIVE, destinationAsset: CREDIT });
const RECEIVE_ENDPOINTS = Object.freeze({ sourceAsset: CREDIT, destinationAsset: NATIVE });
const NOW = 1_782_000_000_000;

function gateway(routes: readonly PathPaymentRoute[] = []): jest.Mocked<PathPaymentQuoteGatewayPort> {
  return {
    network: NETWORK,
    loadStrictSendPaths: jest.fn().mockResolvedValue(routes),
    loadStrictReceivePaths: jest.fn().mockResolvedValue(routes),
  };
}

function request(overrides: Partial<PathPaymentQuoteRequest> = {}): PathPaymentQuoteRequest {
  return {
    network: NETWORK,
    source: 'GSOURCE',
    destination: 'GDESTINATION',
    sourceAsset: NATIVE,
    destinationAsset: CREDIT,
    mode: 'strict_send',
    fixedAmount: '5',
    ...overrides,
  };
}

function dependencies(
  pathGateway: PathPaymentQuoteGatewayPort,
  overrides: Partial<LoadPathPaymentQuotesDependencies> = {},
): LoadPathPaymentQuotesDependencies {
  return {
    gateway: pathGateway,
    network: NETWORK,
    isClassicAccountAddress: address => address.startsWith('G') && address.length > 1,
    nowUnixMs: () => NOW,
    nowMonotonicMs: () => 20_000,
    ...overrides,
  };
}

describe('Path Payment Swap-A quote capability', () => {
  it('loads strict-send candidates without changing order, amount, path or request identity', async () => {
    const routes: PathPaymentRoute[] = [
      { ...SEND_ENDPOINTS, sourceAmount: '5.0000000', destinationAmount: '9.9000000', path: [PATH] },
      { ...SEND_ENDPOINTS, sourceAmount: '5', destinationAmount: '10', path: [] },
    ];
    const provider = gateway(routes);
    const input = request({ fixedAmount: '5.0000000', memo: { type: 'text', value: 'memo' } });
    const quotes = await loadPathPaymentQuotes(dependencies(provider), input);

    expect(provider.loadStrictSendPaths).toHaveBeenCalledWith({
      sourceAsset: NATIVE,
      sourceAmount: '5.0000000',
      destinationAssets: [CREDIT],
    });
    expect(provider.loadStrictReceivePaths).not.toHaveBeenCalled();
    expect(quotes).toHaveLength(2);
    expect(quotes.map(q => q.destinationAmount)).toEqual(['9.9000000', '10.0000000']);
    expect(quotes[0]).toMatchObject({
      request: {
        network: NETWORK,
        source: 'GSOURCE',
        destination: 'GDESTINATION',
        sourceAsset: NATIVE,
        destinationAsset: CREDIT,
        mode: 'strict_send',
        fixedAmount: '5.0000000',
        memo: { type: 'text', value: 'memo' },
      },
      sourceAmount: '5.0000000',
      destinationAmount: '9.9000000',
      path: [PATH],
      quotedAtUnixMs: NOW,
      expiresAtUnixMs: NOW + official.quote_ttl.maximum_seconds * 1000,
      quotedAtMonotonicMs: 20_000,
    });
    expect(quotes[1]?.path).toEqual([]);
    expect(quotes[0]?.path).not.toBe(routes[0]?.path);
    expect(Object.isFrozen(quotes[0]?.request)).toBe(true);
    expect(Object.isFrozen(quotes[0]?.path)).toBe(true);
    expect(Object.isFrozen(quotes[0])).toBe(true);
  });

  it('loads strict-receive candidates while fixing destination amount exactly', async () => {
    const provider = gateway([
      { ...RECEIVE_ENDPOINTS, sourceAmount: '3.1415926', destinationAmount: '10.0000000', path: [PATH] },
    ]);
    const quotes = await loadPathPaymentQuotes(
      dependencies(provider),
      request({
        mode: 'strict_receive',
        fixedAmount: '10.0000000',
        sourceAsset: CREDIT,
        destinationAsset: NATIVE,
      }),
    );
    expect(provider.loadStrictReceivePaths).toHaveBeenCalledWith({
      sourceAssets: [CREDIT],
      destinationAsset: NATIVE,
      destinationAmount: '10.0000000',
    });
    expect(provider.loadStrictSendPaths).not.toHaveBeenCalled();
    expect(quotes[0]).toMatchObject({
      request: { mode: 'strict_receive', fixedAmount: '10.0000000' },
      sourceAmount: '3.1415926',
      destinationAmount: '10.0000000',
    });
  });

  it('accepts the Normative same-account Swap specialization, preserving the full identity', async () => {
    expect(official.schema).toBe('fresnica-path-payment-v1');
    expect(official.swap.source_account).toBe(official.swap.destination_account);
    expect(official.swap.strict_send_meaning).toBe('sell_exact');
    expect(official.swap.strict_receive_meaning).toBe('buy_exact');
    const provider = gateway([{ ...SEND_ENDPOINTS, sourceAmount: '5', destinationAmount: '10', path: [] }]);
    const quotes = await loadPathPaymentQuotes(
      dependencies(provider),
      request({
        source: official.swap.source_account,
        destination: official.swap.destination_account,
        sourceAsset: NATIVE,
        destinationAsset: CREDIT,
      }),
    );
    expect(quotes[0]?.request.source).toBe(official.swap.source_account);
    expect(quotes[0]?.request.destination).toBe(official.swap.destination_account);
    expect(quotes[0]?.request.sourceAsset).not.toEqual(quotes[0]?.request.destinationAsset);
  });

  it.each([
    ['different network ID', { network: { id: 'stellar-mainnet', networkPassphrase: NETWORK.networkPassphrase } }],
    ['different network passphrase', { network: { id: NETWORK.id, networkPassphrase: 'PUBLIC' } }],
    ['muxed source', { source: 'MSOURCE' }],
    ['muxed destination', { destination: 'MDESTINATION' }],
    ['source/destination same asset', { destinationAsset: NATIVE }],
    ['bad asset code', { destinationAsset: { kind: 'credit', code: 'TOO-LONG-CODE', issuer: 'GISSUER' } }],
    ['issuer not classic', { destinationAsset: { kind: 'credit', code: 'USDC', issuer: 'MISSUER' } }],
    ['unknown mode', { mode: 'sell_now' }],
    ['zero amount', { fixedAmount: '0' }],
    ['negative amount', { fixedAmount: '-1' }],
    ['exponent amount', { fixedAmount: '1e12' }],
    ['precision exceeds 7dp', { fixedAmount: '1.00000001' }],
    ['overflow Stellar i64', { fixedAmount: '922337203685.4775808' }],
    ['bad memo', { memo: { type: 'id', value: '-1' } }],
  ] as const)('rejects %s before calling Horizon', async (_label, overrides) => {
    const provider = gateway();
    await expect(
      loadPathPaymentQuotes(dependencies(provider), request(overrides as Partial<PathPaymentQuoteRequest>)),
    ).rejects.toThrow('invalid_request');
    expect(provider.loadStrictSendPaths).not.toHaveBeenCalled();
    expect(provider.loadStrictReceivePaths).not.toHaveBeenCalled();
  });

  it('rejects misbound gateway network identity before any I/O', async () => {
    const provider = gateway();
    Object.defineProperty(provider, 'network', { value: { id: NETWORK.id, networkPassphrase: 'incorrect' } });
    await expect(loadPathPaymentQuotes(dependencies(provider), request())).rejects.toThrow('invalid_request');
    expect(provider.loadStrictSendPaths).not.toHaveBeenCalled();
  });

  it('rejects gateway network changes during an awaited Horizon request', async () => {
    const provider = gateway([{ ...SEND_ENDPOINTS, sourceAmount: '5', destinationAmount: '9', path: [] }]);
    provider.loadStrictSendPaths.mockImplementation(async () => {
      Object.defineProperty(provider, 'network', { value: { id: 'other', networkPassphrase: 'other' } });
      return [{ ...SEND_ENDPOINTS, sourceAmount: '5', destinationAmount: '9', path: [] }];
    });
    await expect(loadPathPaymentQuotes(dependencies(provider), request())).rejects.toThrow('invalid_request');
  });

  it.each([
    ['fixed-side mismatch', [{ ...SEND_ENDPOINTS, sourceAmount: '4', destinationAmount: '10', path: [] }]],
    ['zero quoted destination', [{ ...SEND_ENDPOINTS, sourceAmount: '5', destinationAmount: '0', path: [] }]],
    [
      'invalid quoted precision',
      [{ ...SEND_ENDPOINTS, sourceAmount: '5', destinationAmount: '10.12345678', path: [] }],
    ],
    [
      'six intermediate assets',
      [{ ...SEND_ENDPOINTS, sourceAmount: '5', destinationAmount: '10', path: Array(6).fill(PATH) }],
    ],
    ['endpoint present in path', [{ ...SEND_ENDPOINTS, sourceAmount: '5', destinationAmount: '10', path: [NATIVE] }]],
    [
      'invalid intermediate issuer',
      [
        {
          ...SEND_ENDPOINTS,
          sourceAmount: '5',
          destinationAmount: '10',
          path: [{ kind: 'credit', code: 'EUR', issuer: 'MISSUER' }],
        },
      ],
    ],
  ] as const)('fails closed on malformed provider route: %s', async (_label, routes) => {
    expect(official.path.maximum_intermediate_assets).toBe(5);
    expect(official.path.endpoints_are_excluded_from_intermediate_path).toBe(true);
    await expect(loadPathPaymentQuotes(dependencies(gateway(routes)), request())).rejects.toThrow('quote_unavailable');
  });

  it.each([
    ['strict_send', 'source', NATIVE, CREDIT, CREDIT, CREDIT],
    ['strict_send', 'destination', NATIVE, CREDIT, NATIVE, NATIVE],
    ['strict_receive', 'source', CREDIT, NATIVE, NATIVE, NATIVE],
    ['strict_receive', 'destination', CREDIT, NATIVE, CREDIT, CREDIT],
  ] as const)(
    'rejects a %s response with the wrong %s endpoint asset',
    async (mode, _endpoint, requestedSource, requestedDestination, reportedSource, reportedDestination) => {
      const providerRoute = {
        sourceAmount: '5',
        destinationAmount: '10',
        sourceAsset: reportedSource,
        destinationAsset: reportedDestination,
        path: [],
      };
      await expect(
        loadPathPaymentQuotes(
          dependencies(gateway([providerRoute])),
          request({
            mode,
            sourceAsset: requestedSource,
            destinationAsset: requestedDestination,
            fixedAmount: mode === 'strict_send' ? '5' : '10',
          }),
        ),
      ).rejects.toThrow('quote_unavailable');
    },
  );

  it.each(['strict_send', 'strict_receive'] as const)(
    'rejects %s when Horizon does not provide route endpoint identities',
    async mode => {
      const legacyRoute = { sourceAmount: '5', destinationAmount: '10', path: [] } as unknown as PathPaymentRoute;
      await expect(
        loadPathPaymentQuotes(
          dependencies(gateway([legacyRoute])),
          request({
            mode,
            sourceAsset: mode === 'strict_send' ? NATIVE : CREDIT,
            destinationAsset: mode === 'strict_send' ? CREDIT : NATIVE,
            fixedAmount: mode === 'strict_send' ? '5' : '10',
          }),
        ),
      ).rejects.toThrow('quote_unavailable');
    },
  );

  it('rejects a destination issuer mismatch even when the asset code is the same', async () => {
    const route = {
      sourceAmount: '5',
      destinationAmount: '10',
      sourceAsset: NATIVE,
      destinationAsset: { kind: 'credit' as const, code: 'USDC', issuer: 'GOTHERISSUER' },
      path: [],
    };
    await expect(loadPathPaymentQuotes(dependencies(gateway([route])), request())).rejects.toThrow('quote_unavailable');
  });

  it('rejects malformed untrusted route objects with the stable provider error', async () => {
    const provider = gateway([null as unknown as PathPaymentRoute]);
    await expect(loadPathPaymentQuotes(dependencies(provider), request())).rejects.toThrow('quote_unavailable');
  });

  it('accepts five intermediate assets without introducing source/destination endpoints', async () => {
    const path: StellarPaymentAsset[] = Array.from({ length: official.path.maximum_intermediate_assets }, (_, n) => ({
      kind: 'credit',
      code: `A${n}`,
      issuer: 'GISSUER',
    }));
    const quotes = await loadPathPaymentQuotes(
      dependencies(gateway([{ ...SEND_ENDPOINTS, sourceAmount: '5', destinationAmount: '10', path }])),
      request(),
    );
    expect(quotes[0]?.path).toEqual(path);
  });

  it('distinguishes no route from Horizon errors without leaking provider details', async () => {
    await expect(loadPathPaymentQuotes(dependencies(gateway()), request())).rejects.toThrow('route_unavailable');
    const provider = gateway();
    provider.loadStrictSendPaths.mockRejectedValue(new Error('sensitive-provider-message'));
    await expect(loadPathPaymentQuotes(dependencies(provider), request())).rejects.toThrow('quote_unavailable');
  });

  it('preserves the maximum signed Stellar amount without floating-point conversion', async () => {
    const maximum = '922337203685.4775807';
    const quotes = await loadPathPaymentQuotes(
      dependencies(gateway([{ ...SEND_ENDPOINTS, sourceAmount: maximum, destinationAmount: maximum, path: [] }])),
      request({ fixedAmount: maximum }),
    );
    expect(quotes[0]?.sourceAmount).toBe(maximum);
    expect(quotes[0]?.destinationAmount).toBe(maximum);
  });

  it('records both audit wall-time and monotonic anchor only after the awaited provider response', async () => {
    const provider = gateway();
    let resolved = false;
    provider.loadStrictSendPaths.mockImplementation(async () => {
      resolved = true;
      return [{ ...SEND_ENDPOINTS, sourceAmount: '5', destinationAmount: '10', path: [] }];
    });
    const nowUnixMs = jest.fn(() => {
      expect(resolved).toBe(true);
      return NOW;
    });
    const nowMonotonicMs = jest.fn(() => {
      expect(resolved).toBe(true);
      return 99_999.25;
    });
    const quotes = await loadPathPaymentQuotes(dependencies(provider, { nowUnixMs, nowMonotonicMs }), request());
    expect(nowUnixMs).toHaveBeenCalledTimes(1);
    expect(nowMonotonicMs).toHaveBeenCalledTimes(1);
    expect(quotes[0]).toMatchObject({
      quotedAtUnixMs: NOW,
      quotedAtMonotonicMs: 99_999.25,
      expiresAtUnixMs: NOW + official.quote_ttl.maximum_seconds * 1_000,
    });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'rejects an invalid monotonic receipt anchor %s rather than issuing a usable quote',
    async value => {
      const provider = gateway([{ ...SEND_ENDPOINTS, sourceAmount: '5', destinationAmount: '10', path: [] }]);
      await expect(
        loadPathPaymentQuotes(dependencies(provider, { nowMonotonicMs: () => value }), request()),
      ).rejects.toThrow('quote_unavailable');
    },
  );

  it('rejects invalid local quote receipt time and malformed route collections', async () => {
    const provider = gateway([{ ...SEND_ENDPOINTS, sourceAmount: '5', destinationAmount: '10', path: [] }]);
    await expect(
      loadPathPaymentQuotes(dependencies(provider, { nowUnixMs: () => Number.NaN }), request()),
    ).rejects.toThrow('quote_unavailable');
    provider.loadStrictSendPaths.mockResolvedValue(undefined as unknown as readonly PathPaymentRoute[]);
    await expect(loadPathPaymentQuotes(dependencies(provider), request())).rejects.toThrow('quote_unavailable');
  });

  it('does not impose slippage or selected-route semantics before Swap-B', () => {
    expect(official.selection.length).toBeGreaterThan(0);
    expect(official.slippage.length).toBeGreaterThan(0);
    expect(official.quote_ttl.expires_when_now_equals_expires_at).toBe(true);
  });
});
