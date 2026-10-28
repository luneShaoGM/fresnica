import vm from 'node:vm';

import { buildFreighterInjectionScript } from '../freighterInjection';

function install(windowMock: Record<string, unknown>) {
  vm.runInNewContext(buildFreighterInjectionScript(), {
    window: windowMock,
    JSON,
  });
}

describe('injected in-app Freighter bridge', () => {
  it('marks the top HTTPS document as Freighter and forwards its request envelope', () => {
    const posts: string[] = [];
    const listeners: Array<(event: { source: unknown; origin: string; data: unknown }) => void> = [];
    const windowMock: Record<string, unknown> = {
      location: { protocol: 'https:', origin: 'https://demo.example.org' },
      ReactNativeWebView: { postMessage: (data: string) => posts.push(data) },
      addEventListener: (
        _name: string,
        handler: (event: { source: unknown; origin: string; data: unknown }) => void,
      ) => {
        listeners.push(handler);
      },
    };
    windowMock.top = windowMock;
    windowMock.self = windowMock;
    install(windowMock);
    expect(windowMock.freighter).toBe(true);
    expect(windowMock.stellar).toMatchObject({
      provider: 'freighter',
      platform: 'desktop',
      wallet: 'fresnica',
    });
    const request = {
      source: 'FREIGHTER_EXTERNAL_MSG_REQUEST',
      messageId: 4,
      type: 'REQUEST_PUBLIC_KEY',
    };
    listeners[0]?.({ source: windowMock, origin: 'https://demo.example.org', data: request });
    expect(JSON.parse(posts[0])).toEqual(request);
    listeners[0]?.({
      source: {},
      origin: 'https://demo.example.org',
      data: { ...request, messageId: 5 },
    });
    listeners[0]?.({
      source: windowMock,
      origin: 'https://evil.example',
      data: { ...request, messageId: 6 },
    });
    expect(posts).toHaveLength(1);
  });

  it('does not install into an iframe or a non-HTTPS document', () => {
    const frame: Record<string, unknown> = {
      top: {},
      self: {},
      location: { protocol: 'https:', origin: 'https://demo.example.org' },
      ReactNativeWebView: { postMessage: jest.fn() },
      addEventListener: jest.fn(),
    };
    install(frame);
    expect(frame.freighter).toBeUndefined();
    const insecure: Record<string, unknown> = {
      location: { protocol: 'http:', origin: 'http://demo.example.org' },
      ReactNativeWebView: { postMessage: jest.fn() },
      addEventListener: jest.fn(),
    };
    insecure.top = insecure;
    insecure.self = insecure;
    install(insecure);
    expect(insecure.freighter).toBeUndefined();
  });
});
