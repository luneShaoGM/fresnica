import { Image } from 'react-native';
import type { TokenIconPort } from '../../../capabilities/assets/TokenIcons';
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
      getSnapshot: () => ({ enabled, revision }),
      subscribe: () => () => undefined,
      readIcon,
      readDomain: jest.fn(),
      loadIcon,
      rejectIcon: jest.fn(),
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
