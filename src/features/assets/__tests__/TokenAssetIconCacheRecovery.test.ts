import { Image } from 'react-native';
import type { TokenIconPort } from '../../../capabilities/assets/TokenIcons';
import { createTokenIconPort, TOKEN_ICON_FRESHNESS_MS } from '../../../platform/assets/TokenIconPort';
import { TokenFallbackAvatar } from '../../../ui/components/TokenFallbackAvatar';
import { TokenAssetIcon } from '../TokenAssetIcon';

type AnyEffect = Readonly<{ deps?: readonly unknown[]; cleanup?: () => void }>;
const mockRuntime = {
  service: undefined as TokenIconPort | undefined,
  states: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
  effects: [] as AnyEffect[],
  waiting: [] as Array<() => void | (() => void)>,
  stateIndex: 0,
  refIndex: 0,
  effectIndex: 0,
  resetRender() {
    this.stateIndex = 0;
    this.refIndex = 0;
    this.effectIndex = 0;
    this.waiting = [];
  },
  runEffects() {
    for (const effect of this.waiting) effect();
    this.waiting = [];
  },
};

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useContext: () => mockRuntime.service,
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
    useState: (initial: unknown) => {
      const index = mockRuntime.stateIndex++;
      if (!(index in mockRuntime.states)) mockRuntime.states[index] = initial;
      return [
        mockRuntime.states[index],
        (value: unknown) => {
          mockRuntime.states[index] =
            typeof value === 'function'
              ? (value as (mockPrevious: unknown) => unknown)(mockRuntime.states[index])
              : value;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const index = mockRuntime.refIndex++;
      if (!mockRuntime.refs[index]) mockRuntime.refs[index] = { current: initial };
      return mockRuntime.refs[index];
    },
    useEffect: (fn: () => void | (() => void), deps: readonly unknown[] | undefined) => {
      const index = mockRuntime.effectIndex++;
      const previous = mockRuntime.effects[index];
      if (
        previous &&
        deps &&
        previous.deps &&
        deps.length === previous.deps.length &&
        deps.every((value, i) => Object.is(value, previous.deps?.[i]))
      )
        return;
      previous?.cleanup?.();
      mockRuntime.waiting.push(() => {
        const cleanup = fn();
        mockRuntime.effects[index] = { deps, ...(cleanup ? { cleanup } : {}) };
      });
    },
  };
});
jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));

const issuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const asset = { kind: 'credit' as const, code: 'USD', issuer };
const dataUri = 'data:image/png;base64,aGVsbG8=';

describe('S06 shared icon cache recovery across mounted UI consumers', () => {
  it('switches from the default image to a verified icon cached by another consumer, without remounting or refetching', () => {
    mockRuntime.states = [];
    mockRuntime.refs = [];
    mockRuntime.effects = [];
    let revision = 0;
    let enabled = true;
    const cachedIcon: { current?: string } = {};
    const readIcon = jest.fn(() => cachedIcon.current);
    const loadIcon = jest.fn(() => new Promise<string | undefined>(() => undefined));
    mockRuntime.service = {
      available: true,
      getSnapshot: () => ({ enabled, revision, retryRevision: 0 }),
      subscribe: () => () => undefined,
      readIcon,
      readDomain: jest.fn(),
      loadIcon,
      rejectIcon: jest.fn(),
      setReadable: jest.fn(),
      setEnabled: value => {
        enabled = value;
        revision += 1;
      },
      close: jest.fn(),
    };

    const render = () => {
      mockRuntime.resetRender();
      const element = TokenAssetIcon({ asset });
      mockRuntime.runEffects();
      return element;
    };
    expect(render().type).toBe(TokenFallbackAvatar);
    expect(loadIcon).toHaveBeenCalledTimes(1);

    // A second mounted Token icon consumer successfully caches the image.
    // The first consumer's asynchronous load is still pending or superseded.
    cachedIcon.current = dataUri;
    revision += 1;
    render();
    const updated = render();
    expect(updated.type).toBe(Image);
    expect(updated.props.source.uri).toBe(dataUri);
    expect(loadIcon).toHaveBeenCalledTimes(1);

    enabled = false;
    revision += 1;
    render();
    expect(render().type).toBe(TokenFallbackAvatar);
    mockRuntime.service = undefined;
  });
});

it('recovers identical bytes restored after a decode failure and follows shared invalidation', () => {
  mockRuntime.states = [];
  mockRuntime.refs = [];
  mockRuntime.effects = [];
  let revision = 0;
  let cached: string | undefined = dataUri;
  mockRuntime.service = {
    available: true,
    getSnapshot: () => ({ enabled: true, revision, retryRevision: 0 }),
    subscribe: () => () => undefined,
    readIcon: () => cached,
    readDomain: jest.fn(),
    loadIcon: () => new Promise(() => undefined),
    rejectIcon: () => {
      cached = undefined;
      revision += 1;
    },
    setReadable: jest.fn(),
    setEnabled: jest.fn(),
    close: jest.fn(),
  };
  const render = () => {
    mockRuntime.resetRender();
    const element = TokenAssetIcon({ asset });
    mockRuntime.runEffects();
    return element;
  };
  render();
  const image = render();
  expect(image.type).toBe(Image);
  image.props.onError();
  expect(render().type).toBe(TokenFallbackAvatar);
  // A separate successful consumer restores exactly the same image bytes.
  cached = dataUri;
  revision += 1;
  render();
  expect(render().type).toBe(Image);
  cached = undefined;
  revision += 1;
  expect(render().type).toBe(TokenFallbackAvatar);
  cached = dataUri;
  revision += 1;
  // A new instance using that same service/cache displays the icon.
  mockRuntime.states = [];
  mockRuntime.refs = [];
  mockRuntime.effects = [];
  render();
  expect(render().type).toBe(Image);
  mockRuntime.service = undefined;
});

it.each([true, false])('keeps stale bytes visible while mounted and refreshes on runtime recovery (succeeds: %s)', async succeeds => {
  mockRuntime.states = [];
  mockRuntime.refs = [];
  mockRuntime.effects = [];
  let now = 0;
  const readIcon = jest.fn(async () => ({ mimeType: 'image/png' as const, dataUri }));
  const service = createTokenIconPort({
    networkId: 'stellar-testnet',
    initialEnabled: true,
    now: () => now,
    metadata: {
      peek: () => ({ source: 'issuer-toml', icons: ['https://example.org/icon.png'] }),
      resolve: jest.fn(async () => ({ fromCache: true, stale: false, refreshFailed: false })),
      close: jest.fn(),
    },
    transport: { available: true, readIcon, readText: jest.fn(), close: jest.fn() },
  });
  await service.loadIcon(asset, new AbortController().signal);
  const load = jest.spyOn(service, 'loadIcon');
  mockRuntime.service = service;
  const render = () => {
    mockRuntime.resetRender();
    const element = TokenAssetIcon({ asset });
    mockRuntime.runEffects();
    return element;
  };
  expect(render().type).toBe(Image);
  const baselineLoads = load.mock.calls.length;
  expect(readIcon).toHaveBeenCalledTimes(1);
  const revisionBeforeExpiry = service.getSnapshot().revision;
  if (!succeeds) readIcon.mockRejectedValueOnce(new Error('offline'));
  now += TOKEN_ICON_FRESHNESS_MS;
  // Expiry does not erase accepted bytes or start a polling/re-render loop.
  expect(render().type).toBe(Image);
  expect(service.getSnapshot().revision).toBe(revisionBeforeExpiry);
  expect(load).toHaveBeenCalledTimes(baselineLoads);
  service.setReadable(false);
  service.setReadable(true);
  expect(render().type).toBe(Image);
  expect(load).toHaveBeenCalledTimes(baselineLoads + 1);
  render();
  render();
  expect(load).toHaveBeenCalledTimes(baselineLoads + 1);
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(readIcon).toHaveBeenCalledTimes(2);
  expect(render().type).toBe(Image);
  render();
  render();
  // Success and failure both settle without a retry loop on cache revisions.
  expect(load).toHaveBeenCalledTimes(baselineLoads + 1);
  expect(readIcon).toHaveBeenCalledTimes(2);
  for (const effect of mockRuntime.effects) effect.cleanup?.();
  service.close();
  mockRuntime.service = undefined;
});

it('does not cancel enrichment when the known image becomes visible', async () => {
  mockRuntime.states = [];
  mockRuntime.refs = [];
  mockRuntime.effects = [];
  let enrichmentSignal!: AbortSignal;
  let finish!: () => void;
  const service = createTokenIconPort({
    networkId: 'stellar-testnet',
    initialEnabled: true,
    metadata: {
      peek: () => ({ source: 'curated', icons: ['https://example.org/icon.png'] }),
      resolve: (_identity, signal) => {
        enrichmentSignal = signal;
        return new Promise(resolve => { finish = () => resolve({ fromCache: false, stale: false, refreshFailed: false }); });
      },
      close: jest.fn(),
    },
    transport: {
      available: true,
      readIcon: jest.fn(async () => ({ mimeType: 'image/png' as const, dataUri })),
      readText: jest.fn(), close: jest.fn(),
    },
  });
  mockRuntime.service = service;
  const render = () => {
    mockRuntime.resetRender();
    const element = TokenAssetIcon({ asset });
    mockRuntime.runEffects();
    return element;
  };
  expect(render().type).toBe(TokenFallbackAvatar);
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(render().type).toBe(Image);
  expect(enrichmentSignal.aborted).toBe(false);
  finish();
  await new Promise<void>(resolve => setImmediate(resolve));
  for (const effect of mockRuntime.effects) effect.cleanup?.();
  service.close();
  mockRuntime.service = undefined;
});

it('does not start an eviction/reload loop when more than 24 identities are mounted', async () => {
  mockRuntime.states = [];
  mockRuntime.refs = [];
  mockRuntime.effects = [];
  const readIcon = jest.fn(async () => ({ mimeType: 'image/png' as const, dataUri }));
  const service = createTokenIconPort({
    networkId: 'stellar-testnet', initialEnabled: true,
    metadata: {
      peek: () => ({ source: 'curated', icons: ['https://example.org/icon.png'] }),
      resolve: jest.fn(async () => ({ fromCache: true, stale: false, refreshFailed: false })),
      close: jest.fn(),
    },
    transport: { available: true, readIcon, readText: jest.fn(), close: jest.fn() },
  });
  mockRuntime.service = service;
  const render = () => {
    mockRuntime.resetRender();
    const element = TokenAssetIcon({ asset });
    mockRuntime.runEffects();
    return element;
  };
  render();
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(render().type).toBe(Image);
  await Promise.all(Array.from({ length: 24 }, (_, index) => service.loadIcon({ ...asset, code: 'T' + index }, new AbortController().signal)));
  expect(render().type).toBe(TokenFallbackAvatar);
  render();
  render();
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(readIcon).toHaveBeenCalledTimes(25);
  for (const effect of mockRuntime.effects) effect.cleanup?.();
  service.close();
  mockRuntime.service = undefined;
});

it('hydrates a mounted icon when offline detection interrupts the initial disk read', async () => {
  mockRuntime.states = [];
  mockRuntime.refs = [];
  mockRuntime.effects = [];
  const cached = { mimeType: 'image/png' as const, dataUri, sourceUrl: 'https://example.org/icon.png', savedAtUnixMs: Date.now() };
  let finishOld!: (value: typeof cached) => void;
  const diskRead = jest.fn(async () => cached);
  diskRead.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
  const readIcon = jest.fn();
  const service = createTokenIconPort({
    networkId: 'stellar-testnet', initialEnabled: true,
    diskCache: { setEnabled: jest.fn(), read: diskRead, write: jest.fn(), remove: jest.fn(), close: jest.fn() },
    metadata: {
      peek: () => undefined,
      resolve: jest.fn(async () => ({ fromCache: false, stale: true, refreshFailed: true })),
      close: jest.fn(),
    },
    transport: { available: true, readIcon, readText: jest.fn(), close: jest.fn() },
  });
  mockRuntime.service = service;
  const render = () => {
    mockRuntime.resetRender();
    const element = TokenAssetIcon({ asset });
    mockRuntime.runEffects();
    return element;
  };
  expect(render().type).toBe(TokenFallbackAvatar);
  await new Promise<void>(resolve => setImmediate(resolve));
  service.setReadable(false);
  render();
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(render().type).toBe(Image);
  finishOld({ ...cached, dataUri: 'data:image/png;base64,b2xk' });
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(render().props.source.uri).toBe(dataUri);
  expect(diskRead).toHaveBeenCalledTimes(2);
  expect(readIcon).not.toHaveBeenCalled();
  for (const effect of mockRuntime.effects) effect.cleanup?.();
  service.close();
  mockRuntime.service = undefined;
});
