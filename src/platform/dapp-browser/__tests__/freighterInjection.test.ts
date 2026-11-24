import vm from 'node:vm';

import {
  buildFreighterInjectionScript,
  buildFreighterReply,
  readSep53ReplyId,
  readSep53ReplyExpiresAt,
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
      FresnicaNotificationClock: { now: () => 123_456 },
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
    expect((windowMock.stellar as { notificationNow: () => number }).notificationNow()).toBe(123_456);
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

it('supports notification replies without creating a signature injection fallback', () => {
  const notification = { source: 'FRESNICA_DAPP_MSG_RESPONSE', messagedId: 41, shown: true } as const;
  expect(buildFreighterReply(notification)).toEqual({
    script: 'window.postMessage(' + JSON.stringify(notification) + ', window.location.origin);true;',
  });
  expect(
    buildFreighterReply({ source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE', messagedId: 42, signedBlob: 'secret' }),
  ).toBeUndefined();
});

it('returns native iOS rejection to the original document with the captured request id', async () => {
  const origin = 'https://demo.example.org';
  let rejectReply: ((error: Error) => void) | undefined;
  const listeners = jest.fn();
  const postMessage = jest.fn();
  const replacementPost = jest.fn();
  const window = {
    location: { protocol: 'https:', origin },
    ReactNativeWebView: { postMessage: jest.fn() },
    webkit: {
      messageHandlers: {
        FresnicaSep53: {
          postMessage: () =>
            new Promise((_resolve, reject) => {
              rejectReply = reject;
            }),
        },
      },
    },
    addEventListener: listeners,
    postMessage,
  };
  Object.assign(window, { top: window, self: window });
  install(window);
  const replacement = { ...window, postMessage: replacementPost, addEventListener: jest.fn() };
  Object.assign(replacement, { top: replacement, self: replacement, __fresnicaBridge: false });
  install(replacement);
  const request = { source: 'FREIGHTER_EXTERNAL_MSG_REQUEST', type: 'SUBMIT_BLOB', messageId: 31, blob: 'abc' };
  listeners.mock.calls[0][1]({ source: window, origin, data: request });
  request.messageId = 99;
  rejectReply?.(new Error('Wallet request expired; native diagnostic must not be exposed'));
  await Promise.resolve();
  expect(postMessage).toHaveBeenCalledWith(
    {
      source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
      messagedId: 31,
      error: 'request-unavailable',
      apiError: { code: -1, apiCode: -1, message: 'Wallet request unavailable' },
    },
    origin,
  );
  expect(replacementPost).not.toHaveBeenCalled();
});

it.each([undefined, null, 0, -1, NaN, Infinity, '1800000000000', Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid native reply deadlines (%s)',
  value => expect(readSep53ReplyExpiresAt(value)).toBeUndefined(),
);
it('keeps a native reply deadline without rounding it', () => {
  expect(readSep53ReplyExpiresAt(1_800_000_000_000.5)).toBe(1_800_000_000_000.5);
});
