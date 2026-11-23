import vm from 'node:vm';

import { buildFreighterInjectionScript, buildFreighterReply, readSep53ReplyId } from '../freighterInjection';

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

it.each(['android', 'ios'] as const)('returns SEP-53 only through the native %s request channel', async platform => {
  const origin = 'https://demo.example.org';
  const request = { source: 'FREIGHTER_EXTERNAL_MSG_REQUEST', type: 'SUBMIT_BLOB', messageId: 31, blob: 'abc' };
  const response = { source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE', messagedId: 31, signedBlob: 'signature' } as const;
  const makeDocument = () => {
    const outbound = jest.fn();
    const toNative = jest.fn();
    const listeners = jest.fn();
    const nativeListeners = jest.fn();
    const postMessage = jest.fn();
    const window = {
      location: { protocol: 'https:', origin },
      ReactNativeWebView: { postMessage: outbound, addEventListener: nativeListeners },
      webkit: platform === 'ios' ? { messageHandlers: { FresnicaSep53: { postMessage: toNative } } } : undefined,
      addEventListener: listeners,
      postMessage,
    };
    Object.assign(window, { top: window, self: window });
    install(window);
    return { outbound, toNative, listeners, nativeListeners, window, postMessage };
  };
  const original = makeDocument();
  const replacement = makeDocument();
  let resolveReply: ((payload: string) => void) | undefined;
  original.toNative.mockReturnValue(
    new Promise<string>(resolve => {
      resolveReply = resolve;
    }),
  );
  original.listeners.mock.calls[0][1]({ source: original.window, origin, data: request });
  const wire = JSON.stringify(response);
  if (platform === 'android') {
    expect(original.outbound).toHaveBeenCalledWith('fresnica-sep53:' + JSON.stringify(request));
    original.nativeListeners.mock.calls[0][1]({ data: wire });
  } else {
    expect(original.toNative).toHaveBeenCalledWith(JSON.stringify(request));
    expect(original.outbound).not.toHaveBeenCalled();
    resolveReply?.(wire);
    await Promise.resolve();
  }
  expect(original.postMessage).toHaveBeenCalledWith(response, origin);
  expect(replacement.postMessage).not.toHaveBeenCalled();
  const replyId = '74f3db5b-10b8-4abd-8198-cfc869980742';
  expect(readSep53ReplyId(replyId)).toBe(replyId);
  expect(readSep53ReplyId('page-selected-id')).toBeUndefined();
  expect(buildFreighterReply(response)).toBeUndefined();
  expect(buildFreighterReply(response, { replyId })).toEqual({
    nativeCommand: 'fresnica-sep53:' + replyId + ':' + wire,
  });
});
