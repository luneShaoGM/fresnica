import React from 'react';

import type {
  DappBrowserSurfaceProps,
  DappBrowserSurfaceHandle,
} from '../../../../../capabilities/dapp-interaction/browserTransport';
import type { DappTransactionSigner } from '../../../../../capabilities/dapp-interaction/dappTransactionSigner';
import type { DappPublicSelection } from '../../../../../capabilities/dapp-interaction/freighterSession';
import type {
  DappGrantScope,
  DappPermissionEvent,
  DappPermissionStore,
} from '../../../../../capabilities/dapp-interaction/dappPermissionStore';

jest.mock('../../../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
jest.mock('../../../../../ui/components', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../../../../ui/components/NativeButton', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return { NativeButton: (props: Record<string, unknown>) => ReactActual.createElement('NativeButton', props) };
});
jest.mock('../../../../../ui/theme', () => {
  const actual = jest.requireActual('../../../../../ui/theme') as typeof import('../../../../../ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

const slots: Array<{ current: unknown }> = [];
const refs: Array<{ current: unknown }> = [];
const effects: Array<() => void | (() => void)> = [];
let si = 0;
let ri = 0;
const react = jest.requireActual<typeof import('react')>('react');
jest.spyOn(react, 'useState').mockImplementation(((init: unknown) => {
  const i = si++;
  if (!slots[i]) slots[i] = { current: init };
  return [
    slots[i].current,
    (value: unknown) => {
      slots[i].current = typeof value === 'function' ? (value as (v: unknown) => unknown)(slots[i].current) : value;
    },
  ];
}) as typeof react.useState);
jest.spyOn(react, 'useRef').mockImplementation(((init: unknown) => {
  const i = ri++;
  if (!refs[i]) refs[i] = { current: init };
  return refs[i];
}) as typeof react.useRef);
jest.spyOn(react, 'useEffect').mockImplementation(((effect: () => void | (() => void)) => {
  effects.push(effect);
}) as typeof react.useEffect);

const { DappBrowserScreen } = require('../DappBrowserScreen') as typeof import('../DappBrowserScreen');
const { DappConnectSheet } = require('../DappConnectSheet') as typeof import('../DappConnectSheet');

const selection: DappPublicSelection = {
  accountId: 'wallet1',
  address: 'GSOURCE',
  networkId: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
  networkUrl: 'https://horizon-testnet.stellar.org',
  revision: 3,
};

function BrowserSurface(_props: DappBrowserSurfaceProps & React.RefAttributes<DappBrowserSurfaceHandle>) {
  return null;
}

const token = 'a'.repeat(64);
const request = (method: string, messageId: number) =>
  JSON.stringify({
    source: 'FREIGHTER_EXTERNAL_MSG_REQUEST',
    token,
    messageId,
    type: method,
  });
const grantKeys = new Set<string>();
const permissionEvents = new Set<(event: DappPermissionEvent) => void>();
const keyFor = (scope: DappGrantScope) => JSON.stringify([scope.networkId, scope.accountId, scope.origin]);
let rejectPermissionWrite = false;
let permissionRevision = 0;
const permissions: DappPermissionStore = {
  has: scope => grantKeys.has(keyFor(scope)),
  grant: scope => {
    if (rejectPermissionWrite) throw new Error('realm-write-failed');
    grantKeys.add(keyFor(scope));
    permissionRevision += 1;
    for (const listener of permissionEvents) listener({ kind: 'granted', scope });
  },
  revoke: scope => {
    grantKeys.delete(keyFor(scope));
    permissionRevision += 1;
    for (const listener of permissionEvents) listener({ kind: 'revoked', scope });
  },
  list: () => [],
  subscribe: listener => {
    permissionEvents.add(listener);
    return () => {
      permissionEvents.delete(listener);
    };
  },
  getRevision: () => permissionRevision,
};
function hasDappReadGrant(origin: string, accountId: string, networkId: string): boolean {
  return permissions.has({ origin, accountId, networkId });
}

const replies = jest.fn();
const goBack = jest.fn();
const goForward = jest.fn();
const reload = jest.fn();
const navigateClose = jest.fn();
let subscriber: (() => void) | undefined;

function render(
  active = true,
  signTransaction: DappTransactionSigner = async () => ({ status: 'invalid' }),
  trustedCatalogOrigin?: string,
) {
  si = 0;
  ri = 0;
  return DappBrowserScreen({
    url: 'https://demo.example.org/start',
    active,
    onClose: navigateClose,
    currentSelection: () => selection,
    subscribeSelection: callback => {
      subscriber = callback;
      return () => {
        subscriber = undefined;
      };
    },
    createNonce: () => token,
    signTransaction,
    permissions,
    trustedCatalogOrigin,
    BrowserSurface,
  });
}
type NodeProps = Readonly<{
  children?: React.ReactNode;
  label?: string;
  onPress?: () => void;
  onAllowOnce?: () => void;
  onAllowAlways?: () => void;
  onConfirm?: (passphrase: string) => void;
  source?: string;
  fee?: string;
  operationCount?: number;
  onMessage?: DappBrowserSurfaceProps['onMessage'];
  onNavigation?: DappBrowserSurfaceProps['onNavigation'];
  onDocumentStart?: DappBrowserSurfaceProps['onDocumentStart'];
  shouldLoad?: DappBrowserSurfaceProps['shouldLoad'];
  disabled?: boolean;
  failed?: boolean;
}>;
function find(
  root: React.ReactNode,
  predicate: (node: React.ReactElement<NodeProps>) => boolean,
): React.ReactElement<NodeProps> | undefined {
  if (!React.isValidElement<NodeProps>(root)) return undefined;
  if (predicate(root)) return root;
  for (const child of React.Children.toArray(root.props.children)) {
    const match = find(child, predicate);
    if (match) return match;
  }
  return undefined;
}
beforeEach(() => {
  slots.length = 0;
  refs.length = 0;
  effects.length = 0;
  replies.mockClear();
  goBack.mockClear();
  goForward.mockClear();
  reload.mockClear();
  navigateClose.mockClear();
  subscriber = undefined;
  grantKeys.clear();
  permissionEvents.clear();
  rejectPermissionWrite = false;
  permissionRevision = 0;
});

describe('S15 browser product bridge is real but explicitly consent-gated', () => {
  it('allows any public HTTPS navigation and keeps non-public targets out of the browser', () => {
    const tree = render();
    const webview = find(tree, node => node.type === BrowserSurface);
    expect(webview).toBeDefined();
    expect(webview?.props.shouldLoad?.('https://demo.example.org/next')).toBe(true);
    expect(webview?.props.shouldLoad?.('https://other.example.org/app#swap')).toBe(true);
    expect(webview?.props.shouldLoad?.('about:blank')).toBe(true);
    expect(webview?.props.shouldLoad?.('https://fake.demo.example.org/')).toBe(true);
    expect(webview?.props.shouldLoad?.('http://demo.example.org/')).toBe(false);
    expect(webview?.props.shouldLoad?.('https://127.0.0.1/')).toBe(false);
    const back = find(tree, node => node.props.label === 'dapps.browser.back');
    expect(back?.props.disabled).toBe(true);
    refs[1].current = { reply: replies, goBack, goForward, reload };
    webview?.props.onNavigation?.({
      url: 'https://other.example.org/app#swap',
      canGoBack: true,
      canGoForward: false,
    });
    const moved = render();
    expect(find(moved, node => node.type === BrowserSurface)).toBeDefined();
    expect(find(moved, node => node.props.children === 'https://other.example.org')).toBeDefined();
    find(moved, node => node.props.label === 'dapps.browser.back')?.props.onPress?.();
    find(moved, node => node.props.label === 'dapps.browser.reload')?.props.onPress?.();
    expect(find(moved, node => node.props.label === 'dapps.browser.forward')?.props.disabled).toBe(true);
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(goForward).not.toHaveBeenCalled();
    find(moved, node => node.props.label === 'dapps.browser.close')?.props.onPress?.();
    expect(navigateClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['SUBMIT_TOKEN', { contractId: 'C123', assetType: 'soroban', decimals: 7 }],
    ['SUBMIT_BLOB', { blob: 'payload', apiVersion: '1' }],
    ['SUBMIT_AUTH_ENTRY', { entryXdr: 'AAAA', apiVersion: '1' }],
  ] as const)('replies with unsupported for a valid %s page request without prompting or signing', (type, fields) => {
    const signer = jest.fn(async () => ({ status: 'invalid' as const }));
    render(true, signer);
    refs[1].current = { reply: replies };
    const browser = find(render(true, signer), node => node.type === BrowserSurface);
    browser?.props.onMessage?.(
      JSON.stringify({
        source: 'FREIGHTER_EXTERNAL_MSG_REQUEST',
        messageId: 63,
        type,
        ...fields,
      }),
      'https://demo.example.org/start',
    );
    expect(replies).toHaveBeenCalledWith({
      source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
      messagedId: 63,
      error: 'unsupported',
    });
    expect(signer).not.toHaveBeenCalled();
    expect(find(render(true, signer), node => node.type === DappConnectSheet)).toBeUndefined();
    expect(hasDappReadGrant('https://demo.example.org', 'wallet1', 'stellar-testnet')).toBe(false);
  });

  it('auto-connects read-only on an exact trusted catalog origin without writing durable permission', () => {
    const signer = jest.fn(async () => ({ status: 'invalid' as const }));
    const origin = 'https://demo.example.org';
    render(true, signer, origin);
    refs[1].current = { reply: replies };
    const browser = find(render(true, signer, origin), node => node.type === BrowserSurface);
    browser?.props.onMessage?.(request('REQUEST_ALLOWED_STATUS', 44), origin + '/start');
    browser?.props.onMessage?.(request('REQUEST_ACCESS', 45), origin + '/start');
    browser?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 46), origin + '/start');
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 44, isAllowed: true }));
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 45, publicKey: 'GSOURCE' }));
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 46, publicKey: 'GSOURCE' }));
    expect(find(render(true, signer, origin), node => node.type === DappConnectSheet)).toBeUndefined();
    expect(hasDappReadGrant(origin, 'wallet1', 'stellar-testnet')).toBe(false);
    expect(signer).not.toHaveBeenCalled();
  });

  it('does not trust subdomains or a different origin after catalog navigation', () => {
    render(true, undefined, 'https://demo.example.org.evil.example');
    refs[1].current = { reply: replies };
    let browser = find(
      render(true, undefined, 'https://demo.example.org.evil.example'),
      node => node.type === BrowserSurface,
    );
    browser?.props.onMessage?.(request('REQUEST_ALLOWED_STATUS', 50), 'https://demo.example.org/start');
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 50, isAllowed: false }));

    // The trusted launch cannot automatically authorize another main document.
    replies.mockClear();
    const origin = 'https://demo.example.org';
    browser?.props.onDocumentStart?.('https://other.example.org/landing');
    browser = find(
      render(true, undefined, 'https://demo.example.org.evil.example'),
      node => node.type === BrowserSurface,
    );
    browser?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 51), 'https://other.example.org/landing');
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 51, error: 'not-authorized' }));
    expect(hasDappReadGrant(origin, 'wallet1', 'stellar-testnet')).toBe(false);
  });

  it('does not reauthorize a previously trusted origin after leaving and returning to it', () => {
    const origin = 'https://demo.example.org';
    render(true, undefined, origin);
    refs[1].current = { reply: replies };
    const browser = find(render(true, undefined, origin), node => node.type === BrowserSurface);
    browser?.props.onDocumentStart?.('https://different.example.org/entry');
    browser?.props.onDocumentStart?.(origin + '/start');
    replies.mockClear();
    browser?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 77), origin + '/start');
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 77, error: 'not-authorized' }));
    expect(hasDappReadGrant(origin, 'wallet1', 'stellar-testnet')).toBe(false);
  });

  it('explicit revoke retires a temporary curated connection without leaving a stored grant', () => {
    const origin = 'https://demo.example.org';
    render(true, undefined, origin);
    refs[1].current = { reply: replies };
    const browser = find(render(true, undefined, origin), node => node.type === BrowserSurface);
    browser?.props.onMessage?.(request('REQUEST_ACCESS', 61), origin + '/start');
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 61, publicKey: 'GSOURCE' }));
    for (const effect of effects.splice(0)) effect();
    permissions.revoke({ origin, accountId: 'wallet1', networkId: 'stellar-testnet' });
    replies.mockClear();
    browser?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 62), origin + '/start');
    expect(replies).not.toHaveBeenCalled();
    expect(find(render(true, undefined, origin), node => node.type === BrowserSurface)).toBeUndefined();
  });

  it('does not reveal the address before a separate read-only permission decision', () => {
    render();
    refs[1].current = { reply: replies };
    const webview = find(render(), node => node.type === BrowserSurface);
    webview?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 1), 'https://demo.example.org/start');
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ error: 'not-authorized' }));
    replies.mockClear();
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 2), 'https://demo.example.org/start');
    const prompt = render();
    const sheet = find(prompt, node => node.type === DappConnectSheet);
    expect(sheet).toBeDefined();
    sheet?.props.onAllowOnce?.();
    expect(hasDappReadGrant('https://demo.example.org', 'wallet1', 'stellar-testnet')).toBe(false);
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ publicKey: 'GSOURCE', messagedId: 2 }));
    expect(find(render(), node => node.type === DappConnectSheet)).toBeUndefined();
  });

  it('remembers allow-always for the same account and network', () => {
    render();
    refs[1].current = { reply: replies };
    const webview = find(render(), node => node.type === BrowserSurface);
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 2), 'https://demo.example.org/start');
    find(render(), node => node.type === DappConnectSheet)?.props.onAllowAlways?.();
    expect(hasDappReadGrant('https://demo.example.org', 'wallet1', 'stellar-testnet')).toBe(true);
    replies.mockClear();
    webview?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 3), 'https://demo.example.org/start');
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ publicKey: 'GSOURCE', messagedId: 3 }));
  });

  it('does not persist stale allow-always decisions after session retirement', () => {
    render();
    refs[1].current = { reply: replies };
    const webview = find(render(), node => node.type === BrowserSurface);
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 2), 'https://demo.example.org/start');
    const sheet = find(render(), node => node.type === DappConnectSheet);
    for (const effect of effects.splice(0)) effect();
    subscriber?.();
    sheet?.props.onAllowAlways?.();
    expect(hasDappReadGrant('https://demo.example.org', 'wallet1', 'stellar-testnet')).toBe(false);
  });

  it('immediately retires the active browser and blocks stale requests after a revoke', () => {
    render();
    refs[1].current = { reply: replies };
    const browser = find(render(), node => node.type === BrowserSurface);
    browser?.props.onMessage?.(request('REQUEST_ACCESS', 50), 'https://demo.example.org/start');
    find(render(), node => node.type === DappConnectSheet)?.props.onAllowAlways?.();
    expect(hasDappReadGrant('https://demo.example.org', 'wallet1', 'stellar-testnet')).toBe(true);
    for (const effect of effects.splice(0)) effect();
    permissions.revoke({ origin: 'https://demo.example.org', accountId: 'wallet1', networkId: 'stellar-testnet' });
    replies.mockClear();
    browser?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 51), 'https://demo.example.org/start');
    expect(replies).not.toHaveBeenCalled();
    expect(find(render(), node => node.type === BrowserSurface)).toBeUndefined();
    expect(hasDappReadGrant('https://demo.example.org', 'wallet1', 'stellar-testnet')).toBe(false);
  });

  it('fails closed rather than falling back to allow-once when durable grant storage fails', () => {
    render();
    refs[1].current = { reply: replies };
    const browser = find(render(), node => node.type === BrowserSurface);
    browser?.props.onMessage?.(request('REQUEST_ACCESS', 55), 'https://demo.example.org/start');
    rejectPermissionWrite = true;
    find(render(), node => node.type === DappConnectSheet)?.props.onAllowAlways?.();
    expect(replies).toHaveBeenCalledWith({
      source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
      messagedId: 55,
      error: 'permission-storage-failed',
    });
    expect(hasDappReadGrant('https://demo.example.org', 'wallet1', 'stellar-testnet')).toBe(false);
    expect(find(render(), node => node.type === BrowserSurface)).toBeUndefined();
    replies.mockClear();
    browser?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 56), 'https://demo.example.org/start');
    expect(replies).not.toHaveBeenCalled();
  });

  it('resets message deduplication for a new same-URL document', () => {
    render();
    refs[1].current = { reply: replies };
    const webview = find(render(), node => node.type === BrowserSurface);
    webview?.props.onMessage?.(request('REQUEST_ALLOWED_STATUS', 14), 'https://demo.example.org');
    expect(replies).toHaveBeenCalledTimes(1);
    webview?.props.onDocumentStart?.('https://demo.example.org/start');
    webview?.props.onMessage?.(request('REQUEST_ALLOWED_STATUS', 14), 'https://demo.example.org');
    expect(replies).toHaveBeenCalledTimes(2);
  });

  it('shows the transaction from the session and returns the signed envelope', async () => {
    const signTransaction: DappTransactionSigner = async input => {
      if (input.phase === 'inspect')
        return {
          status: 'ready',
          intent: {
            hash: 'mockhash',
            source: 'GSOURCE',
            sequence: '7',
            fee: '100',
            memo: null,
            operations: [{ type: 'payment', source: 'GSOURCE', destination: 'GDEST', amount: '2', assetCode: 'XLM' }],
          },
        };
      return { status: 'signed', signedTransaction: 'BBBB', signerAddress: input.accountAddress };
    };
    const signed = jest.fn(signTransaction);
    render(true, signed);
    refs[1].current = { reply: replies };
    const webview = find(render(true, signed), node => node.type === BrowserSurface);
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 2), 'https://demo.example.org/start');
    find(render(true, signed), node => node.type === DappConnectSheet)?.props.onAllowOnce?.();
    replies.mockClear();
    webview?.props.onMessage?.(
      JSON.stringify({
        source: 'FREIGHTER_EXTERNAL_MSG_REQUEST',
        token,
        messageId: 4,
        type: 'SUBMIT_TRANSACTION',
        transactionXdr: 'AAAA',
      }),
      'https://demo.example.org/start',
    );
    await Promise.resolve();
    await Promise.resolve();
    const { DappSignSheet } = require('../DappSignSheet') as typeof import('../DappSignSheet');
    const sheet = find(render(true, signed), node => node.type === DappSignSheet);
    expect(sheet?.props).toMatchObject({
      intent: { source: 'GSOURCE', fee: '100', operations: [{ destination: 'GDEST' }] },
    });
    sheet?.props.onConfirm?.('secret');
    await Promise.resolve();
    await Promise.resolve();
    expect(signed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        phase: 'sign',
        transactionXdrBase64: 'AAAA',
        reviewedHash: 'mockhash',
        appPassphrase: 'secret',
      }),
    );
    expect(replies).toHaveBeenCalledWith(
      expect.objectContaining({ signedTransaction: 'BBBB', signerAddress: 'GSOURCE', messagedId: 4 }),
    );
  });

  it('keeps pending permission across History API changes until a real document starts', () => {
    render();
    refs[1].current = { reply: replies };
    const webview = find(render(), node => node.type === BrowserSurface);
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 31), 'https://demo.example.org/start');
    expect(find(render(), node => node.type === DappConnectSheet)).toBeDefined();
    // Android history.pushState must not emit onDocumentStart.
    webview?.props.onNavigation?.({ url: 'https://demo.example.org/new-route', canGoBack: true, canGoForward: false });
    find(render(), node => node.type === DappConnectSheet)?.props.onAllowOnce?.();
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ publicKey: 'GSOURCE', messagedId: 31 }));
    webview?.props.onDocumentStart?.('https://demo.example.org/reloaded');
    expect(find(render(), node => node.type === DappConnectSheet)).toBeUndefined();
  });

  it.each(['document-start', 'navigation-state'] as const)(
    'retires the session and removes the previous trusted address after invalid %s',
    kind => {
      render();
      refs[1].current = { reply: replies };
      const browser = find(render(), node => node.type === BrowserSurface);
      browser?.props.onMessage?.(request('REQUEST_ACCESS', 41), 'https://demo.example.org/start');
      const oldPrompt = find(render(), node => node.type === DappConnectSheet);
      expect(oldPrompt).toBeDefined();

      // A main-frame form POST can bypass shouldOverrideUrlLoading.
      if (kind === 'document-start') {
        browser?.props.onDocumentStart?.('https://127.0.0.1/private');
      } else {
        browser?.props.onNavigation?.({
          url: 'https://127.0.0.1/private',
          canGoBack: true,
          canGoForward: false,
        });
      }
      oldPrompt?.props.onAllowAlways?.();
      expect(hasDappReadGrant('https://demo.example.org', 'wallet1', 'stellar-testnet')).toBe(false);
      replies.mockClear();
      browser?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 42), 'https://demo.example.org/start');
      expect(replies).not.toHaveBeenCalled();
      const retired = render();
      expect(find(retired, node => node.type === BrowserSurface)).toBeUndefined();
      expect(find(retired, node => node.props.label === 'common.back')).toBeDefined();
      expect(find(retired, node => node.props.children === 'https://demo.example.org')).toBeUndefined();
    },
  );

  it('rejects a system-auth cancellation and allows a new sign request', async () => {
    const signTransaction: DappTransactionSigner = async input => {
      if (input.phase === 'inspect')
        return {
          status: 'ready',
          intent: {
            hash: 'mockhash',
            source: 'GSOURCE',
            sequence: '7',
            fee: '100',
            memo: null,
            operations: [{ type: 'payment', source: 'GSOURCE', destination: 'GDEST', amount: '2', assetCode: 'XLM' }],
          },
        };
      throw { code: 'user-cancel' };
    };
    render(true, signTransaction);
    refs[1].current = { reply: replies };
    const browser = find(render(true, signTransaction), node => node.type === BrowserSurface);
    browser?.props.onMessage?.(request('REQUEST_ACCESS', 2), 'https://demo.example.org/start');
    find(render(true, signTransaction), node => node.type === DappConnectSheet)?.props.onAllowOnce?.();
    const submit = (messageId: number) =>
      browser?.props.onMessage?.(
        JSON.stringify({
          source: 'FREIGHTER_EXTERNAL_MSG_REQUEST',
          token,
          messageId,
          type: 'SUBMIT_TRANSACTION',
          transactionXdr: 'AAAA',
        }),
        'https://demo.example.org/start',
      );
    submit(4);
    await Promise.resolve();
    await Promise.resolve();
    const { DappSignSheet } = require('../DappSignSheet') as typeof import('../DappSignSheet');
    find(render(true, signTransaction), node => node.type === DappSignSheet)?.props.onConfirm?.('');
    await Promise.resolve();
    await Promise.resolve();
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ error: 'user-declined', messagedId: 4 }));
    expect(find(render(true, signTransaction), node => node.type === DappSignSheet)).toBeUndefined();
    submit(5);
    await Promise.resolve();
    await Promise.resolve();
    expect(find(render(true, signTransaction), node => node.type === DappSignSheet)).toBeDefined();
  });

  it('shows a retryable signing error for non-cancel exceptions', async () => {
    let calls = 0;
    const signTransaction: DappTransactionSigner = async input => {
      if (input.phase === 'inspect')
        return {
          status: 'ready',
          intent: {
            hash: 'mockhash',
            source: 'GSOURCE',
            sequence: '7',
            fee: '100',
            memo: null,
            operations: [{ type: 'payment', source: 'GSOURCE', destination: 'GDEST', amount: '2', assetCode: 'XLM' }],
          },
        };
      calls += 1;
      if (calls === 1) throw new Error('temporary-native-error');
      return { status: 'signed', signedTransaction: 'BBBB', signerAddress: input.accountAddress };
    };
    render(true, signTransaction);
    refs[1].current = { reply: replies };
    const browser = find(render(true, signTransaction), node => node.type === BrowserSurface);
    browser?.props.onMessage?.(request('REQUEST_ACCESS', 2), 'https://demo.example.org/start');
    find(render(true, signTransaction), node => node.type === DappConnectSheet)?.props.onAllowOnce?.();
    browser?.props.onMessage?.(
      JSON.stringify({
        source: 'FREIGHTER_EXTERNAL_MSG_REQUEST',
        token,
        messageId: 4,
        type: 'SUBMIT_TRANSACTION',
        transactionXdr: 'AAAA',
      }),
      'https://demo.example.org/start',
    );
    await Promise.resolve();
    await Promise.resolve();
    const { DappSignSheet } = require('../DappSignSheet') as typeof import('../DappSignSheet');
    find(render(true, signTransaction), node => node.type === DappSignSheet)?.props.onConfirm?.('');
    await Promise.resolve();
    await Promise.resolve();
    expect(find(render(true, signTransaction), node => node.type === DappSignSheet)?.props.failed).toBe(true);
    find(render(true, signTransaction), node => node.type === DappSignSheet)?.props.onConfirm?.('');
    await Promise.resolve();
    await Promise.resolve();
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 4, signedTransaction: 'BBBB' }));
  });

  it('unmounts the WebView and invalidates permission on any App account revision', () => {
    render();
    for (const effect of effects.splice(0)) effect();
    expect(subscriber).toBeDefined();
    subscriber?.();
    const blocked = render();
    expect(find(blocked, node => node.type === BrowserSurface)).toBeUndefined();
    expect(find(blocked, node => node.props.label === 'common.back')).toBeDefined();
  });
});
