import React from 'react';

import type {
  DappBrowserSurfaceProps,
  DappBrowserSurfaceHandle,
} from '../../../../../capabilities/dapp-interaction/browserTransport';
import type { DappMessageSigner } from '../../../../../capabilities/dapp-interaction/dappMessageSigner';
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
const { DappSignSheet } = require('../DappSignSheet') as typeof import('../DappSignSheet');
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
const onVisit = jest.fn();
let subscriber: (() => void) | undefined;

function render(
  active = true,
  signTransaction: DappTransactionSigner = async () => ({ status: 'invalid' }),
  trustedCatalogOrigin?: string,
  signMessage?: DappMessageSigner,
) {
  si = 0;
  ri = 0;
  return DappBrowserScreen({
    url: 'https://demo.example.org/start',
    active,
    onClose: navigateClose,
    onVisit,
    currentSelection: () => selection,
    subscribeSelection: callback => {
      subscriber = callback;
      return () => {
        subscriber = undefined;
      };
    },
    createNonce: () => token,
    signTransaction,
    signMessage,
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
  onReject?: () => void;
  source?: string;
  fee?: string;
  operationCount?: number;
  onMessage?: DappBrowserSurfaceProps['onMessage'];
  onNavigation?: DappBrowserSurfaceProps['onNavigation'];
  onDocumentStart?: DappBrowserSurfaceProps['onDocumentStart'];
  onUnavailable?: DappBrowserSurfaceProps['onUnavailable'];
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
  onVisit.mockClear();
  subscriber = undefined;
  grantKeys.clear();
  permissionEvents.clear();
  rejectPermissionWrite = false;
  permissionRevision = 0;
});

describe('S15 browser product bridge is real but explicitly consent-gated', () => {
  it('records public document starts, strips private URL parts and ignores callbacks after close', () => {
    const tree = render();
    const browser = find(tree, node => node.type === BrowserSurface);
    expect(onVisit).not.toHaveBeenCalled();
    browser?.props.shouldLoad?.('https://demo.example.org/start');
    expect(onVisit).not.toHaveBeenCalled();
    browser?.props.onDocumentStart?.('about:blank');
    expect(onVisit).not.toHaveBeenCalled();
    browser?.props.onDocumentStart?.('https://demo.example.org/start?token=private#private');
    expect(onVisit).toHaveBeenCalledWith('https://demo.example.org');
    find(tree, node => node.props.label === 'dapps.browser.close')?.props.onPress?.();
    browser?.props.onDocumentStart?.('https://late.example.org');
    expect(onVisit).toHaveBeenCalledTimes(1);
  });

  it('passes only canonical authority from a React Native pathless document start to Recent', () => {
    const originalURL = global.URL;
    global.URL = jest.requireActual<{ URL: typeof URL }>('react-native/Libraries/Blob/URL').URL;
    try {
      const browser = find(render(), node => node.type === BrowserSurface);
      browser?.props.onDocumentStart?.('https://demo.example.org?session=private');
      expect(onVisit).toHaveBeenCalledWith('https://demo.example.org');
      expect(JSON.stringify(onVisit.mock.calls)).not.toContain('private');
    } finally {
      global.URL = originalURL;
    }
  });

  it('ignores document events while backgrounded', () => {
    const tree = render();
    const browser = find(tree, node => node.type === BrowserSurface);
    render(false);
    browser?.props.onDocumentStart?.('https://demo.example.org/start');
    expect(onVisit).not.toHaveBeenCalled();
  });

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

  it('permits read-only Freighter access for the first exact trusted catalog document without storing a grant', () => {
    const signer = jest.fn(async () => ({ status: 'invalid' as const }));
    const origin = 'https://demo.example.org';
    render(true, signer, origin);
    refs[1].current = { reply: replies };
    const webview = find(render(true, signer, origin), node => node.type === BrowserSurface);
    webview?.props.onDocumentStart?.(origin + '/start');
    webview?.props.onMessage?.(request('REQUEST_ALLOWED_STATUS', 81), origin + '/start');
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 82), origin + '/start');
    webview?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 83), origin + '/start');
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 81, isAllowed: true }));
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 82, publicKey: 'GSOURCE' }));
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 83, publicKey: 'GSOURCE' }));
    expect(find(render(true, signer, origin), node => node.type === DappConnectSheet)).toBeUndefined();
    expect(hasDappReadGrant(origin, 'wallet1', 'stellar-testnet')).toBe(false);
    expect(signer).not.toHaveBeenCalled();
  });

  it('rejects forged trusted subdomains and permanently drops implicit access after changing origin and returning', () => {
    const origin = 'https://demo.example.org';
    render(true, undefined, 'https://demo.example.org.evil.example');
    refs[1].current = { reply: replies };
    let webview = find(
      render(true, undefined, 'https://demo.example.org.evil.example'),
      node => node.type === BrowserSurface,
    );
    webview?.props.onMessage?.(request('REQUEST_ALLOWED_STATUS', 84), origin + '/start');
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 84, isAllowed: false }));

    // Start a separate trusted browser and then leave its initial document.
    slots.length = 0;
    refs.length = 0;
    effects.length = 0;
    replies.mockClear();
    render(true, undefined, origin);
    refs[1].current = { reply: replies };
    webview = find(render(true, undefined, origin), node => node.type === BrowserSurface);
    webview?.props.onDocumentStart?.(origin + '/start');
    webview?.props.onDocumentStart?.('https://other.example.org/');
    webview?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 85), 'https://other.example.org/');
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 85, error: 'not-authorized' }));
    webview?.props.onDocumentStart?.(origin + '/start');
    webview?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 86), origin + '/start');
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 86, error: 'not-authorized' }));
  });

  it('retires curated read permission on a native cross-origin navigation event without document-start', () => {
    const origin = 'https://demo.example.org';
    render(true, undefined, origin);
    refs[1].current = { reply: replies };
    const webview = find(render(true, undefined, origin), node => node.type === BrowserSurface);
    webview?.props.onNavigation?.({
      url: 'https://other.example.org/',
      canGoBack: true,
      canGoForward: false,
    });
    webview?.props.onMessage?.(request('REQUEST_ALLOWED_STATUS', 92), origin + '/start');
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 92, isAllowed: false }));
  });

  it('retires the implicit read permission on a same-origin reload, without a durable grant', () => {
    const origin = 'https://demo.example.org';
    render(true, undefined, origin);
    refs[1].current = { reply: replies };
    const webview = find(render(true, undefined, origin), node => node.type === BrowserSurface);
    webview?.props.onDocumentStart?.(origin + '/start');
    webview?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 87), origin + '/start');
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 87, publicKey: 'GSOURCE' }));
    replies.mockClear();
    webview?.props.onDocumentStart?.(origin + '/start');
    webview?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 88), origin + '/start');
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 88, error: 'not-authorized' }));
    expect(hasDappReadGrant(origin, 'wallet1', 'stellar-testnet')).toBe(false);
  });

  it('requires explicit transaction inspection even in a trusted read-only catalog session', async () => {
    const signer = jest.fn(async () => ({ status: 'invalid' as const }));
    const origin = 'https://demo.example.org';
    render(true, signer, origin);
    refs[1].current = { reply: replies };
    const webview = find(render(true, signer, origin), node => node.type === BrowserSurface);
    webview?.props.onMessage?.(
      JSON.stringify({
        source: 'FREIGHTER_EXTERNAL_MSG_REQUEST',
        token,
        type: 'SUBMIT_TRANSACTION',
        messageId: 89,
        networkPassphrase: selection.networkPassphrase,
        transactionXdr: 'AAAA',
      }),
      origin + '/start',
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(signer).toHaveBeenCalledWith(expect.objectContaining({ phase: 'inspect', accountId: 'wallet1' }));
    expect(signer).toHaveBeenCalledTimes(1);
    expect(hasDappReadGrant(origin, 'wallet1', 'stellar-testnet')).toBe(false);
  });

  it('explicit account grant revocation retires even a temporary catalog read session', () => {
    const origin = 'https://demo.example.org';
    render(true, undefined, origin);
    refs[1].current = { reply: replies };
    const webview = find(render(true, undefined, origin), node => node.type === BrowserSurface);
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 90), origin + '/start');
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 90, publicKey: 'GSOURCE' }));
    for (const effect of effects.splice(0)) effect();
    permissions.revoke({ origin, accountId: 'wallet1', networkId: 'stellar-testnet' });
    replies.mockClear();
    webview?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 91), origin + '/start');
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

  it.each(['document-start', 'navigation-state', 'transport-unavailable'] as const)(
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
      } else if (kind === 'navigation-state') {
        browser?.props.onNavigation?.({
          url: 'https://127.0.0.1/private',
          canGoBack: true,
          canGoForward: false,
        });
      } else {
        browser?.props.onUnavailable?.();
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
    const tree = render();
    const browser = find(tree, node => node.type === BrowserSurface);
    for (const effect of effects.splice(0)) effect();
    expect(subscriber).toBeDefined();
    subscriber?.();
    browser?.props.onDocumentStart?.('https://late.example.org');
    expect(onVisit).not.toHaveBeenCalled();
    const blocked = render();
    expect(find(blocked, node => node.type === BrowserSurface)).toBeUndefined();
    expect(find(blocked, node => node.props.label === 'common.back')).toBeDefined();
  });
});

it.each(['approve', 'base64', 'cancel', 'reload', 'document', 'late-result', 'missing-native-reply'] as const)(
  'holds the exact SEP-53 message for passphrase review and handles %s',
  async action => {
    const signature = 'A'.repeat(86) + '==';
    let complete: ((value: string) => void) | undefined;
    const signer = jest.fn<ReturnType<DappMessageSigner>, Parameters<DappMessageSigner>>(
      () =>
        new Promise(resolve => {
          complete = resolve;
        }),
    );
    const draw = () => render(true, undefined, undefined, signer);
    const origin = 'https://demo.example.org';
    const replyId = '74f3db5b-10b8-4abd-8198-cfc869980742';
    const target = { replyId };
    const browser = find(draw(), node => node.type === BrowserSurface);
    refs[1].current = { reply: replies, reload };
    browser?.props.onMessage?.(request('REQUEST_ACCESS', 30), origin);
    find(draw(), node => node.type === DappConnectSheet)?.props.onAllowOnce?.();
    const blob = '  café\nAuthorize demo  ';
    browser?.props.onMessage?.(
      JSON.stringify({
        source: 'FREIGHTER_EXTERNAL_MSG_REQUEST',
        type: 'SUBMIT_BLOB',
        messageId: 31,
        apiVersion: '6.0.1',
        blob: action === 'base64' ? Buffer.from(blob, 'utf8').toString('base64') : blob,
        ...(action === 'base64' ? { blobEncoding: 'base64' } : {}),
      }),
      origin,
      action === 'missing-native-reply' ? undefined : replyId,
    );
    const sheet = find(draw(), node => node.type === DappSignSheet);
    if (action === 'missing-native-reply') {
      expect(sheet).toBeUndefined();
      expect(signer).not.toHaveBeenCalled();
      return;
    }
    expect(sheet?.props).toMatchObject({ message: blob, origin, passphraseRequired: true });
    sheet?.props.onConfirm?.('');
    expect(signer).not.toHaveBeenCalled();
    if (action === 'cancel') find(draw(), node => node.type === DappSignSheet)?.props.onReject?.();
    if (action === 'reload') find(draw(), node => node.props.label === 'dapps.browser.reload')?.props.onPress?.();
    if (action === 'document') browser?.props.onDocumentStart?.(origin + '/new');
    sheet?.props.onConfirm?.('fresh passphrase');
    if (action === 'late-result') browser?.props.onDocumentStart?.(origin + '/new');
    complete?.(signature);
    await Promise.resolve();
    if (action === 'approve' || action === 'base64') {
      expect(signer).toHaveBeenCalledWith(
        expect.objectContaining({ message: blob, appPassphrase: 'fresh passphrase', encoding: 'base64' }),
      );
      expect(replies).toHaveBeenCalledWith(
        expect.objectContaining({ messagedId: 31, signedBlob: signature, signerAddress: selection.address }),
        target,
      );
    } else {
      expect(replies.mock.calls.some(([result]) => result.signedBlob)).toBe(false);
      if (action !== 'late-result') expect(signer).not.toHaveBeenCalled();
      if (action === 'cancel')
        expect(replies).toHaveBeenCalledWith(
          expect.objectContaining({ messagedId: 31, error: 'user-declined' }),
          target,
        );
    }
  },
);
