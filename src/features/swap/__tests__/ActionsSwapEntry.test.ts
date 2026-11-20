import React from 'react';
import { ActionsSwapEntry } from '../ActionsSwapEntry';
import { loadActionsSwapSources, type ActionsSwapSource } from '../swapPreviewProductFlow';
import type { AccountRecord } from '@capabilities/account/types';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
let mockSlots: Slot[] = [];
let mockCursor = 0;
let mockEffects: Array<() => void> = [];
const mockSame = (a: readonly unknown[] | undefined, b: readonly unknown[]) =>
  a?.length === b.length && a.every((v, i) => Object.is(v, b[i]));
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: (initial: unknown) => {
    const i = mockCursor++;
    if (!mockSlots[i]) mockSlots[i] = { value: typeof initial === 'function' ? initial() : initial };
    return [
      mockSlots[i].value,
      (value: unknown) => {
        mockSlots[i].value = typeof value === 'function' ? value(mockSlots[i].value) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = mockCursor++;
    if (!mockSlots[i]) mockSlots[i] = { value: { current: initial } };
    return mockSlots[i].value;
  },
  useCallback: (value: unknown, deps: readonly unknown[]) => {
    const i = mockCursor++;
    if (!mockSame(mockSlots[i]?.deps, deps)) mockSlots[i] = { value, deps };
    return mockSlots[i].value;
  },
  useEffect: (run: () => (() => void) | undefined, deps: readonly unknown[]) => {
    const i = mockCursor++;
    if (mockSame(mockSlots[i]?.deps, deps)) return;
    const cleanup = mockSlots[i]?.cleanup;
    mockSlots[i] = { deps };
    mockEffects.push(() => {
      cleanup?.();
      mockSlots[i].cleanup = run();
    });
  },
}));
jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
jest.mock('@ui/components', () => ({ Screen: () => null }));
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});
jest.mock('../swapPreviewProductFlow', () => ({ loadActionsSwapSources: jest.fn() }));
const sources: readonly ActionsSwapSource[] = [
  { asset: { kind: 'native' }, spendable: '3.0000000' },
  { asset: { kind: 'credit', code: 'usd', issuer: 'GISSUER' }, spendable: '5.0000000' },
];
const load = jest.mocked(loadActionsSwapSources);
const account = {
  id: 'a',
  address: 'GA',
  identityKind: 'classic',
  networkId: 'stellar-testnet',
  hidden: false,
} as AccountRecord;
function setup() {
  let revision = 0;
  const children = jest.fn(() => React.createElement('Preview'));
  const renderRecovery = jest.fn(() => React.createElement('History'));
  const captureSession = () => {
    const captured = revision;
    return () => captured === revision;
  };
  const props: React.ComponentProps<typeof ActionsSwapEntry> = {
    account,
    dependencies: {} as never,
    captureSession,
    foreground: true,
    onBack: jest.fn(),
    children,
    renderRecovery,
  };
  const draw = (foreground = true) => {
    mockCursor = 0;
    const root = ActionsSwapEntry({ ...props, foreground });
    const effects = mockEffects;
    mockEffects = [];
    effects.forEach(effect => effect());
    return root;
  };
  return {
    draw,
    children,
    renderRecovery,
    onBack: props.onBack,
    expire: () => {
      revision++;
    },
  };
}
async function settle() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
function find(
  node: React.ReactNode,
  label: string,
): React.ReactElement<{ children?: React.ReactNode; label?: string; onPress?: () => void }> | undefined {
  if (!React.isValidElement<{ children?: React.ReactNode; label?: string; onPress?: () => void }>(node)) return;
  if (node.props.label === label || node.props.children === label) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const value = find(child, label);
    if (value) return value;
  }
}
beforeEach(() => {
  mockSlots = [];
  mockCursor = 0;
  mockEffects = [];
  load.mockReset().mockResolvedValue(sources);
});
afterEach(() => {
  mockSlots.forEach(slot => slot.cleanup?.());
});

it('enters the existing preview directly for one source and chooses explicitly for several', async () => {
  load.mockResolvedValueOnce([sources[1]]);
  const h = setup();
  h.draw();
  await settle();
  h.draw();
  expect(h.children).toHaveBeenLastCalledWith(sources[1].asset);
  // Existing screen keeps its lifecycle when foreground changes after entry is complete.
  h.draw(false);
  h.draw(true);
  await settle();
  expect(load).toHaveBeenCalledTimes(1);
});
it('requires a multi-source selection and forwards exact code/issuer identity', async () => {
  const h = setup();
  h.draw();
  await settle();
  const root = h.draw();
  expect(h.children).not.toHaveBeenCalled();
  const choose = find(root, 'usd:GISSUER · 5.0000000')?.props.onPress;
  choose?.();
  choose?.();
  h.draw();
  expect(h.children).toHaveBeenCalledTimes(1);
  expect(h.children).toHaveBeenCalledWith(sources[1].asset);
});
it('shows no-source feedback without entering preview and recovers from a failed read on retry', async () => {
  load.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([sources[0]]);
  const h = setup();
  h.draw();
  await settle();
  let root = h.draw();
  expect(find(root, 'actions.swap.noSources')).toBeDefined();
  expect(h.children).not.toHaveBeenCalled();
  find(root, 'swap.preview.retryAssets')?.props.onPress?.();
  h.draw();
  await settle();
  root = h.draw();
  expect(find(root, 'nav.accountUnavailable')).toBeDefined();
  find(root, 'swap.preview.retryAssets')?.props.onPress?.();
  h.draw();
  await settle();
  h.draw();
  expect(h.children).toHaveBeenCalledWith(sources[0].asset);
});
it('does not enter preview from a canceled or stale pending read', async () => {
  let resolve!: (value: readonly ActionsSwapSource[]) => void;
  load.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const h = setup();
  const initial = h.draw();
  await settle();
  find(initial, 'common.back')?.props.onPress?.();
  resolve([sources[0]]);
  await settle();
  h.draw();
  expect(h.onBack).toHaveBeenCalledTimes(1);
  expect(h.children).not.toHaveBeenCalled();
});
it('retires old choices across background return and selection revision changes', async () => {
  const h = setup();
  h.draw();
  await settle();
  const root = h.draw();
  const late = find(root, 'usd:GISSUER · 5.0000000')?.props.onPress;
  h.draw(false);
  late?.();
  expect(h.children).not.toHaveBeenCalled();
  h.draw(true);
  await settle();
  const fresh = h.draw();
  late?.();
  expect(h.children).not.toHaveBeenCalled();
  h.expire();
  find(fresh, 'usd:GISSUER · 5.0000000')?.props.onPress?.();
  h.draw();
  expect(h.children).not.toHaveBeenCalled();
});

it.each(['empty', 'assets', 'offline'])('offers independent recovery when Pay preflight returns %s', async reason => {
  if (reason === 'empty') load.mockResolvedValueOnce([]);
  else load.mockRejectedValueOnce(new Error(reason === 'assets' ? 'swap-assets-unavailable' : 'offline'));
  const h = setup();
  h.draw();
  await settle();
  find(h.draw(), 'swap.history.title')?.props.onPress?.();
  h.draw();
  expect(h.renderRecovery).toHaveBeenCalledTimes(1);
  expect(h.children).not.toHaveBeenCalled();
});

it('does not let a late preflight replace explicit recovery', async () => {
  let resolve!: (value: readonly ActionsSwapSource[]) => void;
  load.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const h = setup();
  const root = h.draw();
  await settle();
  find(root, 'swap.history.title')?.props.onPress?.();
  resolve([sources[0]]);
  await settle();
  h.draw();
  expect(h.renderRecovery).toHaveBeenCalledTimes(1);
  expect(h.children).not.toHaveBeenCalled();
});

it('rejects a queued recovery press after Back or selection expiry', () => {
  const h = setup();
  const root = h.draw();
  const late = find(root, 'swap.history.title')?.props.onPress;
  h.expire();
  late?.();
  find(root, 'common.back')?.props.onPress?.();
  late?.();
  h.draw();
  expect(h.renderRecovery).not.toHaveBeenCalled();
});
