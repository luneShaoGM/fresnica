import React from 'react';
import { createLedgerReadRuntime } from '../readModels/LedgerReadRuntime';
import type { AppServices } from '../createAppServices';
import { createAppServices } from '../createAppServices';
import { resolveAppBootstrap } from '../resolveBootstrap';
import { parseRequestDeepLink, resolveRequestDeepLink } from '../requestDeepLinkRouting';
import { reactNativeRequestDeepLink } from '../../platform/system/requestDeepLink';
import { AppNavigator } from '../navigation/AppNavigator';

jest.mock('../../platform/system/networkConnectivity', () => ({
  subscribeToInternetConnectivity: jest.fn(() => () => {}),
}));
jest.mock('../createAppServices', () => ({ createAppServices: jest.fn() }));
jest.mock('../resolveBootstrap', () => ({ resolveAppBootstrap: jest.fn() }));
jest.mock('../requestDeepLinkRouting', () => ({ parseRequestDeepLink: jest.fn(), resolveRequestDeepLink: jest.fn() }));
jest.mock('../navigation/AppNavigator', () => ({ AppNavigator: () => null }));
jest.mock('../UiNativeProvider', () => ({ UiNativeProvider: () => null }));
jest.mock('../OverlayHost', () => ({ OverlayHost: () => null }));
jest.mock('../readModels/startLedgerReadLifecycle', () => ({ startLedgerReadLifecycle: () => () => {} }));
jest.mock('../../locale', () => ({
  getDeviceLocale: () => 'en',
  resolveLocale: () => 'en',
  LocalizationProvider: () => null,
}));
jest.mock('../../platform/system/requestDeepLink', () => ({
  reactNativeRequestDeepLink: { subscribe: jest.fn(), getInitialUrl: jest.fn() },
}));

type Effect = { deps: readonly unknown[]; run: () => void | (() => void); cleanup?: () => void; pending: boolean };
const states: unknown[] = [],
  refs: Array<{ current: unknown }> = [],
  effects: Effect[] = [];
const memos: Array<{ deps: readonly unknown[]; value: unknown }> = [];
let stateIndex = 0,
  refIndex = 0,
  effectIndex = 0,
  memoIndex = 0;
const same = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
jest.spyOn(React, 'useState').mockImplementation(((initial: unknown) => {
  const i = stateIndex++;
  if (!(i in states)) states[i] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
  return [
    states[i],
    (next: unknown) => {
      states[i] = typeof next === 'function' ? (next as (old: unknown) => unknown)(states[i]) : next;
    },
  ];
}) as typeof React.useState);
jest.spyOn(React, 'useRef').mockImplementation(((initial: unknown) => {
  const i = refIndex++;
  return refs[i] ?? (refs[i] = { current: initial });
}) as typeof React.useRef);
function remember(factory: () => unknown, deps: readonly unknown[]) {
  const i = memoIndex++;
  if (!memos[i] || !same(memos[i].deps, deps)) memos[i] = { deps, value: factory() };
  return memos[i].value;
}
jest.spyOn(React, 'useMemo').mockImplementation(remember as typeof React.useMemo);
jest
  .spyOn(React, 'useCallback')
  .mockImplementation(((fn: unknown, deps: readonly unknown[]) =>
    remember(() => fn, deps)) as typeof React.useCallback);
jest
  .spyOn(React, 'useSyncExternalStore')
  .mockImplementation(((_subscribe: unknown, get: () => unknown) => get()) as typeof React.useSyncExternalStore);
jest.spyOn(React, 'useEffect').mockImplementation(((run: Effect['run'], deps: readonly unknown[]) => {
  const i = effectIndex++;
  const previous = effects[i];
  const changed = !previous || !same(previous.deps, deps);
  if (changed) previous?.cleanup?.();
  effects[i] = changed ? { deps, run, pending: true } : previous;
}) as typeof React.useEffect);
const { App } = require('../App') as typeof import('../App');
async function settle() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
async function render() {
  stateIndex = refIndex = effectIndex = memoIndex = 0;
  const tree = App();
  for (const effect of effects)
    if (effect.pending) {
      effect.pending = false;
      effect.cleanup = effect.run() || undefined;
    }
  await settle();
  let props: Record<string, unknown> = {};
  function visit(node: React.ReactNode) {
    if (!React.isValidElement<Record<string, unknown>>(node)) return;
    if (node.type === AppNavigator) props = { ...node.props, navigatorKey: node.key };
    React.Children.forEach(node.props.children as React.ReactNode, visit);
  }
  visit(tree);
  return props;
}
async function flush() {
  await render();
  await render();
  return render();
}
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}
let warm!: (url: string) => void;
let runtime: ReturnType<typeof createLedgerReadRuntime>;
let services: AppServices;
const unsubscribe = jest.fn();
beforeEach(() => {
  states.length = refs.length = effects.length = memos.length = 0;
  jest.clearAllMocks();
  runtime = createLedgerReadRuntime();
  services = {
    ledgerReadRuntime: runtime,
    onboarding: { networkId: 'testnet', repository: { isWatchOnly: () => false } },
    accountSelectionPreferences: { getDefaultAccountId: () => 'a' },
    localePreferences: { getLocale: () => 'en' },
    diagnostics: { info: jest.fn(), warn: jest.fn() },
    request: {},
    send: {},
    close: jest.fn(),
  } as unknown as AppServices;
  jest.mocked(createAppServices).mockResolvedValue(services);
  jest.mocked(resolveAppBootstrap).mockReturnValue({ kind: 'ready', accounts: [] });
  jest.mocked(reactNativeRequestDeepLink.subscribe).mockImplementation(listener => {
    warm = listener;
    return unsubscribe;
  });
  jest.mocked(reactNativeRequestDeepLink.getInitialUrl).mockResolvedValue(undefined);
  jest
    .mocked(parseRequestDeepLink)
    .mockImplementation(
      (_, raw) => ({ diagnostics: { category: raw } }) as unknown as ReturnType<typeof parseRequestDeepLink>,
    );
  jest.mocked(resolveRequestDeepLink).mockResolvedValue({ kind: 'blocked', reason: 'invalid' });
});
afterEach(() => {
  for (const effect of effects) effect.cleanup?.();
});
it('waits for service/bootstrap/foreground readiness and does not reset a displayed duplicate', async () => {
  const created = deferred<AppServices>();
  jest.mocked(createAppServices).mockReturnValue(created.promise);
  await render();
  warm('request-a');
  expect(parseRequestDeepLink).not.toHaveBeenCalled();
  runtime.update({ foreground: false, connectivity: 'online' });
  created.resolve(services);
  await flush();
  expect(parseRequestDeepLink).not.toHaveBeenCalled();
  runtime.update({ foreground: true, connectivity: 'online' });
  const shown = await flush();
  expect(shown.deepLink).toEqual({ kind: 'blocked', reason: 'invalid' });
  warm('request-a');
  await flush();
  expect(parseRequestDeepLink).toHaveBeenCalledTimes(1);
  expect(resolveRequestDeepLink).toHaveBeenCalledTimes(1);
  runtime.update({ foreground: false, connectivity: 'online' });
  await flush();
  runtime.update({ foreground: true, connectivity: 'online' });
  const resumed = await flush();
  expect(resumed.deepLink).toBe(shown.deepLink);
  expect(resolveRequestDeepLink).toHaveBeenCalledTimes(1);
  (resumed.onDismissDeepLink as () => void)();
  warm('request-a');
  await flush();
  expect(parseRequestDeepLink).toHaveBeenCalledTimes(2);
});
it('does not resolve during onboarding or offline, and ignores resolution completing in background', async () => {
  jest.mocked(resolveAppBootstrap).mockReturnValueOnce({ kind: 'onboarding' });
  await flush();
  warm('request-a');
  await flush();
  expect(parseRequestDeepLink).not.toHaveBeenCalled();
  const props = await render();
  (props.onRefreshBootstrap as () => void)();
  runtime.update({ foreground: true, connectivity: 'offline' });
  await flush();
  expect(parseRequestDeepLink).toHaveBeenCalledTimes(1);
  expect(resolveRequestDeepLink).not.toHaveBeenCalled();
  const pending = deferred<Awaited<ReturnType<typeof resolveRequestDeepLink>>>();
  jest.mocked(resolveRequestDeepLink).mockReturnValueOnce(pending.promise);
  runtime.update({ foreground: true, connectivity: 'online' });
  await flush();
  runtime.update({ foreground: false, connectivity: 'online' });
  pending.resolve({ kind: 'blocked', reason: 'unsupported' });
  await settle();
  expect((await flush()).deepLink).toBeUndefined();
  runtime.update({ foreground: true, connectivity: 'online' });
  expect((await flush()).deepLink).toEqual({ kind: 'blocked', reason: 'invalid' });
});
it('rejects old resolution after replacement or dismissal, and removes subscriptions on unmount', async () => {
  await flush();
  const old = deferred<Awaited<ReturnType<typeof resolveRequestDeepLink>>>();
  jest.mocked(resolveRequestDeepLink).mockReturnValueOnce(old.promise);
  warm('request-a');
  await flush();
  warm('request-b');
  await flush();
  old.resolve({ kind: 'blocked', reason: 'unsupported' });
  await settle();
  expect((await render()).deepLink).toEqual({ kind: 'blocked', reason: 'invalid' });
  const pending = deferred<Awaited<ReturnType<typeof resolveRequestDeepLink>>>();
  jest.mocked(resolveRequestDeepLink).mockReturnValueOnce(pending.promise);
  warm('request-c');
  const props = await flush();
  (props.onDismissDeepLink as () => void)();
  pending.resolve({ kind: 'blocked', reason: 'unsupported' });
  await settle();
  expect((await flush()).deepLink).toBeUndefined();
  for (const effect of effects) effect.cleanup?.();
  effects.length = 0;
  warm('late');
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(services.close).toHaveBeenCalledTimes(1);
});

it('keeps the native navigation host stable while a new network session loads, and drops old deep links', async () => {
  await flush();
  warm('old-network-request');
  const before = await flush();
  expect(before.deepLink).toBeDefined();
  const next = deferred<AppServices>();
  jest.mocked(createAppServices).mockReturnValueOnce(next.promise);
  const options = jest.mocked(createAppServices).mock.calls[0][0];
  options?.onNetworkChanged?.();
  const loading = await flush();
  expect(loading.runtime).toEqual({ kind: 'loading' });
  expect(loading.deepLink).toBeUndefined();
  expect(loading.navigatorKey).toBeNull();
  expect(loading.navigatorKey).toBe(before.navigatorKey);
  expect(services.close).toHaveBeenCalledTimes(1);
  const newServices = { ...services, onboarding: { ...services.onboarding, networkId: 'mainnet' } } as AppServices;
  next.resolve(newServices);
  const after = await flush();
  expect(after.runtime).toMatchObject({ kind: 'ready', services: newServices });
  expect(after.deepLink).toBeUndefined();
  expect(after.navigatorKey).toBe(before.navigatorKey);
});
