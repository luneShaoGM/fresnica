import vm from 'node:vm';

import {
  buildFreighterInjectionScript,
  buildFreighterReplyScript,
  unwrapFreighterMessage,
} from '../freighterInjection';

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

it('delivers a queued signature only in its original document, including after same-origin replacement', () => {
  const origin = 'https://demo.example.org';
  const request = { source: 'FREIGHTER_EXTERNAL_MSG_REQUEST', type: 'SUBMIT_BLOB', messageId: 31, blob: 'abc' };
  const response = { source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE', messagedId: 31, signedBlob: 'signature' } as const;
  const createDocument = (seed: number, address = origin) => {
    const outbound = jest.fn();
    const postMessage = jest.fn();
    const addEventListener = jest.fn();
    const window = {
      location: { protocol: 'https:', origin: address },
      crypto: { getRandomValues: (array: Uint8Array) => array.fill(seed) },
      ReactNativeWebView: { postMessage: outbound },
      addEventListener,
      postMessage,
    };
    Object.assign(window, { top: window, self: window });
    const context = vm.createContext({ window, document: {} });
    vm.runInContext(buildFreighterInjectionScript(), context);
    return { context, window, outbound, postMessage, receive: addEventListener.mock.calls[0][1] };
  };
  const original = createDocument(1);
  original.receive({ source: original.window, origin, data: request });
  const message = unwrapFreighterMessage(original.outbound.mock.calls[0][0]);
  expect(message).toMatchObject({ data: JSON.stringify(request), documentId: '01'.repeat(16) });
  expect(unwrapFreighterMessage(JSON.stringify(request))).toBeUndefined();
  const queued = buildFreighterReplyScript(response, { origin, documentId: message?.documentId ?? '' });
  const replacement = createDocument(2);
  replacement.receive({ source: replacement.window, origin, data: request });
  vm.runInContext(queued, replacement.context);
  expect(replacement.postMessage).not.toHaveBeenCalled();
  const otherOrigin = createDocument(1, 'https://other.example.org');
  vm.runInContext(queued, otherOrigin.context);
  expect(otherOrigin.postMessage).not.toHaveBeenCalled();
  vm.runInContext(queued, original.context);
  expect(original.postMessage).toHaveBeenCalledWith(response, origin);
});
