import { createAccountAvatarPort, type AccountAvatarPort } from '../../../capabilities/contacts/AccountAvatars';
import { ActivityAccountAvatar } from '../ActivityAvatar';
import { AccountAvatarImage } from '../../../ui/components/AccountAvatarImage';
type AnyEffect = Readonly<{ deps?: readonly unknown[]; cleanup?: () => void }>;
const mockRuntime = {
  service: undefined as AccountAvatarPort | undefined,
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

jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});
const address = 'G' + 'A'.repeat(55);
const other = 'M' + 'B'.repeat(68);
const uri = 'data:image/png;base64,AAAA';
const otherUri = 'data:image/png;base64,BBBB';
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function render(value = address, active = true) {
  mockRuntime.resetRender();
  const element = ActivityAccountAvatar({ address: value, active });
  mockRuntime.runEffects();
  return element;
}
beforeEach(() => {
  mockRuntime.states = [];
  mockRuntime.refs = [];
  mockRuntime.effects = [];
});
afterEach(() => {
  for (const effect of mockRuntime.effects) effect.cleanup?.();
  mockRuntime.service?.close();
  mockRuntime.service = undefined;
});
it('renders a generic profile without service, consent, or an active valid public identity', async () => {
  expect(render().props.uri).toBeUndefined();
  const loadImage = jest.fn(async () => uri);
  const port = createAccountAvatarPort({ available: true, initialEnabled: false, loadImage });
  port.setReadable(true);
  mockRuntime.service = port;
  expect(render().props.uri).toBeUndefined();
  port.setEnabled(true);
  expect(render(address, false).props.uri).toBeUndefined();
  expect(render('invalid').props.uri).toBeUndefined();
  await flush();
  expect(loadImage).not.toHaveBeenCalled();
});
it('uses bounded inline images and ignores old account decode errors after identity changes', async () => {
  const loadImage = jest.fn(async (url: string) => (url.includes(other) ? otherUri : uri));
  const port = createAccountAvatarPort({ available: true, initialEnabled: true, loadImage });
  port.setReadable(true);
  mockRuntime.service = port;
  render();
  await flush();
  const first = render();
  expect(first.type).toBe(AccountAvatarImage);
  expect(first.props.uri).toBe(uri);
  expect(render(other).props.uri).toBeUndefined();
  await flush();
  const next = render(other);
  expect(next.type).toBe(AccountAvatarImage);
  expect(next.props.uri).toBe(otherUri);
  first.props.onError();
  expect(render(other).props.uri).toBe(otherUri);
  next.props.onError();
  expect(render(other).props.uri).toBeUndefined();
  expect(loadImage).toHaveBeenCalledTimes(2);
  port.setEnabled(false);
  expect(render(other).props.uri).toBeUndefined();
});
it('aborts a departed row and never displays its late result on another account', async () => {
  let complete!: (value: string) => void;
  const pending = new Promise<string>(resolve => {
    complete = resolve;
  });
  const loadImage = jest.fn(async (url: string, _signal: AbortSignal) => (url.includes(other) ? otherUri : pending));
  const port = createAccountAvatarPort({ available: true, initialEnabled: true, loadImage });
  port.setReadable(true);
  mockRuntime.service = port;
  render();
  await flush();
  render(other);
  await flush();
  expect(loadImage.mock.calls[0][1].aborted).toBe(true);
  complete(uri);
  await flush();
  expect(render(other).props.uri).toBe(otherUri);
  expect(port.read(address)).toBeUndefined();
  expect(render(other, false).props.uri).toBeUndefined();
});

it('never reuses a previous service generation image or decode error for the same address', async () => {
  const firstPort = createAccountAvatarPort({ available: true, initialEnabled: true, loadImage: async () => uri });
  firstPort.setReadable(true);
  mockRuntime.service = firstPort;
  render();
  await flush();
  const old = render();
  expect(old.props.uri).toBe(uri);
  const nextPort = createAccountAvatarPort({ available: true, initialEnabled: true, loadImage: async () => otherUri });
  nextPort.setReadable(true);
  mockRuntime.service = nextPort;
  expect(render().props.uri).toBeUndefined();
  await flush();
  expect(render().props.uri).toBe(otherUri);
  old.props.onError();
  expect(render().props.uri).toBe(otherUri);
  firstPort.close();
});

it('reloads an expired image on the same mounted avatar using the real service clock', async () => {
  let now = 0;
  const loadImage = jest.fn().mockResolvedValueOnce(uri).mockResolvedValueOnce(otherUri);
  const port = createAccountAvatarPort({ available: true, initialEnabled: true, loadImage, now: () => now });
  port.setReadable(true);
  mockRuntime.service = port;
  render();
  await flush();
  expect(render().props.uri).toBe(uri);
  now = 599999;
  expect(render().props.uri).toBe(uri);
  expect(loadImage).toHaveBeenCalledTimes(1);
  const revision = port.getSnapshot().revision;
  now = 600000;
  expect(render().props.uri).toBeUndefined();
  await flush();
  expect(render().props.uri).toBe(otherUri);
  expect(loadImage).toHaveBeenCalledTimes(2);
  expect(port.getSnapshot().revision).toBe(revision);
  // URI missing also triggers the effect after decode rejection, but the shared port blocks a retry loop.
  render().props.onError();
  for (let i = 0; i < 5; i++) {
    expect(render().props.uri).toBeUndefined();
    await flush();
  }
  expect(loadImage).toHaveBeenCalledTimes(2);
});
it('makes one controlled reload when an expired mounted image fails, without retrying on unrelated renders', async () => {
  let now = 0;
  const loadImage = jest.fn().mockResolvedValueOnce(uri).mockRejectedValueOnce(new Error('fixture-load-failed'));
  const port = createAccountAvatarPort({ available: true, initialEnabled: true, loadImage, now: () => now });
  port.setReadable(true);
  mockRuntime.service = port;
  render();
  await flush();
  expect(render().props.uri).toBe(uri);
  now = 600001;
  expect(render().props.uri).toBeUndefined();
  await flush();
  for (let i = 0; i < 5; i++) {
    expect(render().props.uri).toBeUndefined();
    await flush();
  }
  expect(loadImage).toHaveBeenCalledTimes(2);
});
it('reloads an evicted image on a still mounted avatar without a policy revision change', async () => {
  const loadImage = jest.fn(async () => uri);
  const port = createAccountAvatarPort({ available: true, initialEnabled: true, loadImage });
  port.setReadable(true);
  mockRuntime.service = port;
  render();
  await flush();
  expect(render().props.uri).toBe(uri);
  const revision = port.getSnapshot().revision;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  for (let i = 1; i <= 64; i++) {
    const otherAddress = 'G' + 'A'.repeat(53) + alphabet[Math.floor(i / 32)] + alphabet[i % 32];
    await port.load(otherAddress, new AbortController().signal);
  }
  expect(port.read(address)).toBeUndefined();
  expect(render().props.uri).toBeUndefined();
  await flush();
  expect(render().props.uri).toBe(uri);
  expect(port.getSnapshot().revision).toBe(revision);
  expect(loadImage).toHaveBeenCalledTimes(66);
});
