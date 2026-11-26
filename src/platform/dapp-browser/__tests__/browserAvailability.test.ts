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

it('uses only native iOS deadline metadata and withholds an incomplete reply handle', () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  const onMessage = jest.fn();
  const tree = transport.render({ ...props, onMessage }, null) as React.ReactElement<{
    onMessage: (event: { nativeEvent: Record<string, unknown> }) => void;
  }>;
  const replyId = '74f3db5b-10b8-4abd-8198-cfc869980742';
  const data = JSON.stringify({
    source: 'FREIGHTER_EXTERNAL_MSG_REQUEST',
    type: 'SUBMIT_BLOB',
    messageId: 31,
    blob: 'abc',
    sep53ReplyExpiresAt: 1_800_000_000_000,
  });
  const nativeEvent = { data, sourceOrigin: 'https://example.org', isMainFrame: true, sep53ReplyId: replyId };
  tree.props.onMessage({ nativeEvent });
  expect(onMessage).not.toHaveBeenCalled();
  tree.props.onMessage({ nativeEvent: { ...nativeEvent, sep53ReplyExpiresAt: 1_800_000_000_000 } });
  expect(onMessage).toHaveBeenLastCalledWith(data, 'https://example.org', replyId, 1_800_000_000_000);
});

it('forwards first-document confirmation only from the verified native event', () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  const onMessage = jest.fn();
  const tree = transport.render({ ...props, onMessage }, null) as React.ReactElement<{
    onMessage: (event: { nativeEvent: Record<string, unknown> }) => void;
  }>;
  const origin = 'https://example.org';
  const url = origin + '/start';
  const replyId = '74f3db5b-10b8-4abd-8198-cfc869980742';
  const deadline = 1_800_000_000_000;
  const data = JSON.stringify({ type: 'REQUEST_PUBLIC_KEY', firstCommittedDocumentUrl: url });
  const nativeEvent = {
    data,
    sourceOrigin: origin,
    isMainFrame: true,
    sep53ReplyId: replyId,
    sep53ReplyExpiresAt: deadline,
  };
  tree.props.onMessage({ nativeEvent });
  expect(onMessage).toHaveBeenLastCalledWith(data, origin, replyId, deadline);
  tree.props.onMessage({ nativeEvent: { ...nativeEvent, firstCommittedDocumentUrl: url } });
  expect(onMessage).toHaveBeenLastCalledWith(data, origin, replyId, deadline, url);
});

describe('native SEP-53 reply expiry events', () => {
  const replyId = '74f3db5b-10b8-4abd-8198-cfc869980742';
  const origin = 'https://example.org';
  const nativeEvent = {
    data: '{}',
    sourceOrigin: origin,
    isMainFrame: true,
    sep53ReplyId: replyId,
    sep53ReplyExpired: true,
  };

  function mount(os: 'ios' | 'android' = 'ios') {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    NativeModules.DappNetworkGuard = { available: true, prepare: async () => undefined };
    ready = true;
    const onMessage = jest.fn();
    const onReplyExpired = jest.fn();
    const tree = transport.render({ ...props, onMessage, onReplyExpired }, null) as React.ReactElement<{
      onMessage: (event: { nativeEvent: Record<string, unknown> }) => void;
    }>;
    const receive = (overrides: Record<string, unknown> = {}) =>
      tree.props.onMessage({ nativeEvent: { ...nativeEvent, ...overrides } });
    return { receive, onMessage, onReplyExpired };
  }

  it('delivers trusted iOS expiry without a Unix deadline and never treats it as a page message', () => {
    const { receive, onMessage, onReplyExpired } = mount();
    receive();
    expect(onReplyExpired).toHaveBeenCalledWith(replyId, origin);
    expect(onMessage).not.toHaveBeenCalled();
  });

  it.each([
    ['subframe', { isMainFrame: false }],
    ['non-HTTPS origin', { sourceOrigin: 'http://example.org' }],
    ['non-canonical origin', { sourceOrigin: origin + '/path' }],
    ['invalid reply handle', { sep53ReplyId: 'page-chosen-handle' }],
  ])('drops expiry with an untrusted %s', (_name, overrides) => {
    const { receive, onMessage, onReplyExpired } = mount();
    receive(overrides as Record<string, unknown>);
    expect(onReplyExpired).not.toHaveBeenCalled();
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('does not accept an iOS expiry event on Android', () => {
    const { receive, onMessage, onReplyExpired } = mount('android');
    receive();
    expect(onReplyExpired).not.toHaveBeenCalled();
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('never reads expiry authority from page JSON or a non-Boolean native flag', () => {
    const { receive, onMessage, onReplyExpired } = mount();
    const data = JSON.stringify({
      sep53ReplyExpired: true,
      sep53ReplyId: replyId,
      sourceOrigin: origin,
      isMainFrame: true,
    });
    receive({ data, sep53ReplyExpired: undefined });
    receive({ data, sep53ReplyExpired: 'true' });
    expect(onReplyExpired).not.toHaveBeenCalled();
    expect(onMessage).not.toHaveBeenCalled();
  });
});
