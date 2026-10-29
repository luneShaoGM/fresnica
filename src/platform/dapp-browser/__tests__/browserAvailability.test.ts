import React from 'react';
import { Platform } from 'react-native';

import type {
  DappBrowserSurfaceHandle,
  DappBrowserSurfaceProps,
} from '../../../capabilities/dapp-interaction/browserTransport';
import { canMountDappWebView } from '../browserAvailability';

jest.mock('react-native-webview', () => 'NativeWebView');

const actual = jest.requireActual<typeof import('react')>('react');
jest.spyOn(actual, 'useRef').mockImplementation(((value: unknown) => ({ current: value })) as typeof actual.useRef);
jest.spyOn(actual, 'useMemo').mockImplementation(((factory: () => unknown) => factory()) as typeof actual.useMemo);
jest.spyOn(actual, 'useImperativeHandle').mockImplementation((() => undefined) as typeof actual.useImperativeHandle);

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

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
});

afterAll(() => jest.restoreAllMocks());

describe('Android in-app dApp POST boundary', () => {
  it('mounts no native WebView, network request or Freighter bridge on Android', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    expect(canMountDappWebView()).toBe(false);
    expect(transport.render(props, null)).toBeNull();
    // Since the native view is absent, an HTML main-frame form POST can never
    // be dispatched from this app-owned dApp browser to a blocked target.
  });

  it('retains the approved iOS browser transport', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    expect(canMountDappWebView()).toBe(true);
    const rendered = transport.render(props, null);
    expect((rendered as React.ReactElement<{ source: { uri: string } }> | null)?.props.source).toEqual({
      uri: props.url,
    });
  });
});
