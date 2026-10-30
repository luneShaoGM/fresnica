import React from 'react';
import { NativeModules, Platform } from 'react-native';

import type {
  DappBrowserSurfaceHandle,
  DappBrowserSurfaceProps,
} from '../../../capabilities/dapp-interaction/browserTransport';
import { canMountDappWebView } from '../browserAvailability';

jest.mock('react-native-webview', () => 'NativeWebView');

const actual = jest.requireActual<typeof import('react')>('react');
let ready: boolean | undefined;
let effect: (() => (() => void) | void) | undefined;
jest.spyOn(actual, 'useRef').mockImplementation(((value: unknown) => ({ current: value })) as typeof actual.useRef);
jest.spyOn(actual, 'useMemo').mockImplementation(((factory: () => unknown) => factory()) as typeof actual.useMemo);
jest.spyOn(actual, 'useImperativeHandle').mockImplementation((() => undefined) as typeof actual.useImperativeHandle);
jest.spyOn(actual, 'useState').mockImplementation(((initial: boolean) => {
  ready ??= initial;
  return [
    ready,
    (value: boolean) => {
      ready = value;
    },
  ];
}) as typeof actual.useState);
jest.spyOn(actual, 'useEffect').mockImplementation(callback => {
  effect = callback;
});

const { SecureDappWebView } = require('../SecureDappWebView') as typeof import('../SecureDappWebView');
const props: DappBrowserSurfaceProps = {
  url: 'https://example.org',
  nonce: 'a'.repeat(64),
  shouldLoad: () => true,
  onMessage: () => undefined,
  onNavigation: () => undefined,
  onDocumentStart: () => undefined,
};
const transport = SecureDappWebView as unknown as {
  render: (input: DappBrowserSurfaceProps, ref: React.Ref<DappBrowserSurfaceHandle>) => React.ReactElement | null;
};
const originalOS = Platform.OS;
const originalGuard = NativeModules.DappNetworkGuard;
const drain = async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

beforeEach(() => {
  ready = undefined;
  effect = undefined;
});
afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  NativeModules.DappNetworkGuard = originalGuard;
});
afterAll(() => jest.restoreAllMocks());

describe('Android native network readiness boundary', () => {
  it('mounts no native WebView or bridge when the guard is unavailable', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    NativeModules.DappNetworkGuard = undefined;
    expect(canMountDappWebView()).toBe(false);
    expect(transport.render(props, null)).toBeNull();
  });

  it('waits for the native proxy acknowledgement before the first request', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    let acknowledge: () => void = () => undefined;
    NativeModules.DappNetworkGuard = {
      available: true,
      prepare: () =>
        new Promise<void>(resolve => {
          acknowledge = resolve;
        }),
    };
    expect(canMountDappWebView()).toBe(true);
    expect(transport.render(props, null)).toBeNull();
    effect?.();
    await drain();
    expect(transport.render(props, null)).toBeNull();
    acknowledge();
    await drain();
    expect(
      (transport.render(props, null) as React.ReactElement<{ source: { uri: string } }> | null)?.props.source,
    ).toEqual({ uri: props.url });
  });

  it('retires the browser session if native preparation fails', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    NativeModules.DappNetworkGuard = {
      available: true,
      prepare: async () => {
        throw new Error('failed');
      },
    };
    const onUnavailable = jest.fn();
    expect(transport.render({ ...props, onUnavailable }, null)).toBeNull();
    effect?.();
    await drain();
    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(transport.render(props, null)).toBeNull();
  });

  it('does not mount after unmounting while native preparation is pending', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    let acknowledge: () => void = () => undefined;
    NativeModules.DappNetworkGuard = {
      available: true,
      prepare: () =>
        new Promise<void>(resolve => {
          acknowledge = resolve;
        }),
    };
    transport.render(props, null);
    const cleanup = effect?.();
    cleanup?.();
    acknowledge();
    await drain();
    expect(ready).toBe(false);
  });

  it('retains the iOS browser transport', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    expect(canMountDappWebView()).toBe(true);
    expect(
      (transport.render(props, null) as React.ReactElement<{ source: { uri: string } }> | null)?.props.source,
    ).toEqual({ uri: props.url });
  });
});
