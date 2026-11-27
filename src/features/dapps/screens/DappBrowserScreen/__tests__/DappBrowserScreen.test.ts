import type { DappContractTracking } from '@capabilities/dapp-interaction/dappContractTracking';
import type { AccountRecord } from '@capabilities/account/types';
import type { DappAssetRequest } from '../../../../../capabilities/dapp-interaction/dappAssetRequest';
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
jest.spyOn(react, 'useCallback').mockImplementation(((callback: unknown) => callback) as typeof react.useCallback);
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
  revokeAccount: accountId => {
    for (const key of [...grantKeys]) {
      if (JSON.parse(key)[1] === accountId) grantKeys.delete(key);
    }
    permissionRevision += 1;
    for (const listener of permissionEvents) listener({ kind: 'account-revoked', accountId });
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
let testTracking: DappContractTracking | undefined;
let testSwitch: ((id: string, origin: string) => Promise<void>) | undefined;
let testAccounts: readonly AccountRecord[] | undefined;
const shareWebsite = jest.fn(async (_origin: string) => undefined);
let subscriber: (() => void) | undefined;

function render(
  active = true,
  signTransaction: DappTransactionSigner = async () => ({ status: 'invalid' }),
  trustedCatalogOrigin?: string,
  showNotification?: (origin: string, title: string, body: string, expiresAt: number) => boolean,
  signMessage?: DappMessageSigner,
  addAsset?: DappAssetRequest,
) {
  si = 0;
  ri = 0;
  return DappBrowserScreen({
    url: 'https://demo.example.org/start',
    active,
    onClose: navigateClose,
    onVisit,
    shareWebsite,
    trackContract: testTracking,
    onSwitchAccount: testSwitch,
    accountChoices: testAccounts,
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
    addAsset,
    permissions,
    trustedCatalogOrigin,
    showNotification,
    notificationNow: () => Math.floor(performance.now()),
    BrowserSurface,
  });
}
type NodeProps = Readonly<{
  children?: React.ReactNode;
  label?: string;
  selectable?: boolean;
  onPress?: () => void;
  onAllowOnce?: () => void;
  onAllowAlways?: () => void;
  onConfirm?: (passphrase: string) => void;
  onReject?: () => void;
  source?: string;
  fee?: string;
  operationCount?: number;
  onMessage?: DappBrowserSurfaceProps['onMessage'];
  onReplyExpired?: DappBrowserSurfaceProps['onReplyExpired'];
  onNavigation?: DappBrowserSurfaceProps['onNavigation'];
  onDocumentStart?: DappBrowserSurfaceProps['onDocumentStart'];
  onUnavailable?: DappBrowserSurfaceProps['onUnavailable'];
  shouldLoad?: DappBrowserSurfaceProps['shouldLoad'];
  disabled?: boolean;
  failed?: boolean;
  busy?: boolean;
  expiresAt?: number;
  onExpired?: () => void;
  onPresenceChange?: (present: boolean) => void;
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
  testTracking = undefined;
  testSwitch = undefined;
  testAccounts = undefined;
  slots.length = 0;
  refs.length = 0;
  effects.length = 0;
  replies.mockClear();
  goBack.mockClear();
  goForward.mockClear();
  reload.mockClear();
  navigateClose.mockClear();
  onVisit.mockClear();
  shareWebsite.mockClear();
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
    const target = { replyId: '74f3db5b-10b8-4abd-8198-cfc869980742' };
    const url = origin + '/start';
    webview?.props.onMessage?.(request('REQUEST_ALLOWED_STATUS', 81), origin, target.replyId, undefined, url);
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 82), origin, target.replyId, undefined, url);
    webview?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 83), origin, target.replyId, undefined, url);
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 81, isAllowed: true }), target);
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 82, publicKey: 'GSOURCE' }), target);
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 83, publicKey: 'GSOURCE' }), target);
    expect(find(render(true, signer, origin), node => node.type === DappConnectSheet)).toBeUndefined();
    expect(hasDappReadGrant(origin, 'wallet1', 'stellar-testnet')).toBe(false);
    expect(signer).not.toHaveBeenCalled();
  });

  it('waits for the native first-document commit and rejects a same-origin URL mismatch', () => {
    const origin = 'https://demo.example.org';
    const url = origin + '/start';
    render(true, undefined, origin);
    refs[1].current = { reply: replies };
    const webview = find(render(true, undefined, origin), node => node.type === BrowserSurface);
    const replyId = '74f3db5b-10b8-4abd-8198-cfc869980742';
    webview?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 73), origin, replyId);
    webview?.props.onDocumentStart?.(url);
    webview?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 74), origin, replyId);
    webview?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 75), origin, replyId, undefined, origin + '/redirect');
    webview?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 77), origin, replyId, undefined, url);
    for (const messagedId of [73, 74, 75, 77]) {
      expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId, error: 'not-authorized' }), {
        replyId,
      });
    }
  });

  it('replies to explicit read consent on the requesting document channel', () => {
    const origin = 'https://demo.example.org';
    render();
    refs[1].current = { reply: replies };
    const webview = find(render(), node => node.type === BrowserSurface);
    const target = { replyId: '74f3db5b-10b8-4abd-8198-cfc869980742' };
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 76), origin, target.replyId);
    const consent = find(render(), node => node.type === DappConnectSheet);
    consent?.props.onAllowOnce?.();
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 76, publicKey: 'GSOURCE' }), target);
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
    expect(replies).not.toHaveBeenCalled();
  });

  it('retires the implicit read permission on a same-origin reload, without a durable grant', () => {
    const origin = 'https://demo.example.org';
    render(true, undefined, origin);
    refs[1].current = { reply: replies };
    const webview = find(render(true, undefined, origin), node => node.type === BrowserSurface);
    webview?.props.onDocumentStart?.(origin + '/start');
    webview?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 87), origin, undefined, undefined, origin + '/start');
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 87, publicKey: 'GSOURCE' }));
    replies.mockClear();
    webview?.props.onDocumentStart?.(origin + '/start');
    webview?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 88), origin, undefined, undefined, origin + '/start');
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
      undefined,
      undefined,
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
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 90), origin, undefined, undefined, origin + '/start');
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 90, publicKey: 'GSOURCE' }));
    for (const effect of effects.splice(0)) effect();
    permissions.revoke({ origin, accountId: 'wallet1', networkId: 'stellar-testnet' });
    replies.mockClear();
    webview?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 91), origin, undefined, undefined, origin + '/start');
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

  it('retires manual consent as soon as cross-origin navigation is reported', () => {
    render();
    refs[1].current = { reply: replies };
    const webview = find(render(), node => node.type === BrowserSurface);
    const original = 'https://demo.example.org';
    const next = 'https://next.example.org';
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 42), original, '74f3db5b-10b8-4abd-8198-cfc869980742');
    const oldApprove = find(render(), node => node.type === DappConnectSheet)?.props.onAllowAlways;
    expect(oldApprove).toBeDefined();

    webview?.props.onNavigation?.({ url: next + '/', canGoBack: true, canGoForward: false });
    oldApprove?.();
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 43), original, '74f3db5b-10b8-4abd-8198-cfc869980743');
    expect(find(render(), node => node.type === DappConnectSheet)).toBeUndefined();
    expect(hasDappReadGrant(original, selection.accountId, selection.networkId)).toBe(false);
    expect(replies).not.toHaveBeenCalled();

    webview?.props.onDocumentStart?.(next + '/');
    const nextReplyId = '74f3db5b-10b8-4abd-8198-cfc869980744';
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 44), next, nextReplyId);
    const newApprove = find(render(), node => node.type === DappConnectSheet)?.props.onAllowAlways;
    expect(newApprove).toBeDefined();
    oldApprove?.();
    expect(hasDappReadGrant(original, selection.accountId, selection.networkId)).toBe(false);
    expect(hasDappReadGrant(next, selection.accountId, selection.networkId)).toBe(false);
    newApprove?.();
    expect(hasDappReadGrant(next, selection.accountId, selection.networkId)).toBe(true);
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 44, publicKey: 'GSOURCE' }), {
      replyId: nextReplyId,
    });
  });

  it.each(['back', 'forward'] as const)('reopens manual consent only after confirmed same-document toolbar %s', action => {
    render();
    refs[1].current = { reply: replies, goBack, goForward, reload };
    const webview = find(render(), node => node.type === BrowserSurface);
    const origin = 'https://demo.example.org';
    const navigation = { url: origin + '/next', canGoBack: true, canGoForward: true };
    webview?.props.onDocumentStart?.(origin + '/start');
    webview?.props.onNavigation?.(navigation);
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 80), origin);
    const oldApprove = find(render(), node => node.type === DappConnectSheet)?.props.onAllowAlways;
    expect(oldApprove).toBeDefined();

    find(render(), node => node.props.label === `dapps.browser.${action}`)?.props.onPress?.();
    expect(action === 'back' ? goBack : goForward).toHaveBeenCalledTimes(1);
    oldApprove?.();
    webview?.props.onNavigation?.(navigation);
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 81), origin);
    expect(find(render(), node => node.type === DappConnectSheet)).toBeUndefined();
    expect(hasDappReadGrant(origin, selection.accountId, selection.networkId)).toBe(false);

    webview?.props.onNavigation?.({ ...navigation, sameDocumentHistory: true });
    const replyId = '74f3db5b-10b8-4abd-8198-cfc869980745';
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 82), origin, replyId);
    const newApprove = find(render(), node => node.type === DappConnectSheet)?.props.onAllowAlways;
    expect(newApprove).toBeDefined();
    oldApprove?.();
    expect(hasDappReadGrant(origin, selection.accountId, selection.networkId)).toBe(false);
    newApprove?.();
    expect(hasDappReadGrant(origin, selection.accountId, selection.networkId)).toBe(true);
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 82, publicKey: 'GSOURCE' }), { replyId });
  });

  it.each(['reload', 'cross-origin'] as const)('does not reopen retired consent from a history event after %s', action => {
    render();
    refs[1].current = { reply: replies, goBack, goForward, reload };
    const webview = find(render(), node => node.type === BrowserSurface);
    const origin = 'https://demo.example.org';
    const navigation = { url: origin + '/next', canGoBack: true, canGoForward: true };
    webview?.props.onDocumentStart?.(origin + '/start');
    webview?.props.onNavigation?.(navigation);
    find(render(), node => node.props.label === 'dapps.browser.back')?.props.onPress?.();
    if (action === 'reload') find(render(), node => node.props.label === 'dapps.browser.reload')?.props.onPress?.();
    else webview?.props.onNavigation?.({ ...navigation, url: 'https://next.example.org/' });
    webview?.props.onNavigation?.({ ...navigation, sameDocumentHistory: true });
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 83), origin);
    expect(find(render(), node => node.type === DappConnectSheet)).toBeUndefined();
    expect(hasDappReadGrant(origin, selection.accountId, selection.networkId)).toBe(false);
    webview?.props.onDocumentStart?.(origin + '/new');
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 84), origin);
    expect(find(render(), node => node.type === DappConnectSheet)).toBeDefined();
  });

  it('invalidates the old consent prompt when the user reloads the same URL', () => {
    render();
    refs[1].current = { reply: replies, reload };
    const webview = find(render(), node => node.type === BrowserSurface);
    const origin = 'https://demo.example.org';
    webview?.props.onMessage?.(request('REQUEST_ACCESS', 45), origin);
    const oldApprove = find(render(), node => node.type === DappConnectSheet)?.props.onAllowAlways;
    expect(oldApprove).toBeDefined();

    find(render(), node => node.props.label === 'dapps.browser.reload')?.props.onPress?.();
    expect(reload).toHaveBeenCalledTimes(1);
    oldApprove?.();
    expect(hasDappReadGrant(origin, selection.accountId, selection.networkId)).toBe(false);
    expect(find(render(), node => node.type === DappConnectSheet)).toBeUndefined();
    expect(replies).not.toHaveBeenCalled();
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

  it.each(['once', 'always'] as const)(
    'retires a deleted account with %s consent and ignores other accounts',
    consent => {
      render();
      refs[1].current = { reply: replies };
      const browser = find(render(), node => node.type === BrowserSurface);
      const origin = 'https://demo.example.org';
      browser?.props.onMessage?.(request('REQUEST_ACCESS', 101), origin);
      const prompt = find(render(), node => node.type === DappConnectSheet);
      if (consent === 'always') prompt?.props.onAllowAlways?.();
      else prompt?.props.onAllowOnce?.();
      for (const effect of effects.splice(0)) effect();
      permissions.revokeAccount('other-account');
      replies.mockClear();
      browser?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 102), origin);
      expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 102, publicKey: selection.address }));
      permissions.revokeAccount(selection.accountId);
      replies.mockClear();
      browser?.props.onMessage?.(request('REQUEST_PUBLIC_KEY', 103), origin);
      prompt?.props.onAllowAlways?.();
      expect(replies).not.toHaveBeenCalled();
      expect(find(render(), node => node.type === BrowserSurface)).toBeUndefined();
      expect(permissions.has({ origin, accountId: selection.accountId, networkId: selection.networkId })).toBe(false);
    },
  );

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
      '74f3db5b-10b8-4abd-8198-cfc869980742',
    );
    await Promise.resolve();
    await Promise.resolve();
    const sheet = find(render(true, signed), node => node.type === DappSignSheet);
    expect(sheet?.props).toMatchObject({
      intent: { source: 'GSOURCE', fee: '100', operations: [{ destination: 'GDEST' }] },
      network: 'Testnet',
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
      { replyId: '74f3db5b-10b8-4abd-8198-cfc869980742' },
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
        '74f3db5b-10b8-4abd-8198-cfc869980742',
      );
    submit(4);
    await Promise.resolve();
    await Promise.resolve();
    find(render(true, signTransaction), node => node.type === DappSignSheet)?.props.onConfirm?.('');
    await Promise.resolve();
    await Promise.resolve();
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ error: 'user-declined', messagedId: 4 }), {
      replyId: '74f3db5b-10b8-4abd-8198-cfc869980742',
    });
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
      '74f3db5b-10b8-4abd-8198-cfc869980742',
    );
    await Promise.resolve();
    await Promise.resolve();
    find(render(true, signTransaction), node => node.type === DappSignSheet)?.props.onConfirm?.('');
    await Promise.resolve();
    await Promise.resolve();
    expect(find(render(true, signTransaction), node => node.type === DappSignSheet)?.props.failed).toBe(true);
    find(render(true, signTransaction), node => node.type === DappSignSheet)?.props.onConfirm?.('');
    await Promise.resolve();
    await Promise.resolve();
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 4, signedTransaction: 'BBBB' }), {
      replyId: '74f3db5b-10b8-4abd-8198-cfc869980742',
    });
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

it.each([
  'approve',
  'cancel',
  'navigate',
  'selection',
  'revoke',
  'account-deleted',
  'background',
  'back',
  'forward',
  'reload',
  'timeout',
  'delayed-timer',
] as const)('requires separate one-time notification consent and handles %s before delivery', action => {
  const origin = 'https://demo.example.org';
  const notify = jest.fn(() => true);
  const draw = (active = true) => render(active, undefined, undefined, notify);
  const browser = find(draw(), node => node.type === BrowserSurface);
  refs[1].current = { reply: replies, goBack, goForward, reload };
  browser?.props.onMessage?.(request('REQUEST_ACCESS', 1), origin);
  find(draw(), node => node.type === DappConnectSheet)?.props.onAllowOnce?.();
  if (action === 'timeout') jest.useFakeTimers();
  const clock = action === 'delayed-timer' ? jest.spyOn(performance, 'now').mockReturnValue(0) : undefined;
  const expiresAt = Math.floor(performance.now()) + 5_000;
  const send = (messageId: number) =>
    browser?.props.onMessage?.(
      JSON.stringify({
        source: 'FRESNICA_DAPP_MSG_REQUEST',
        messageId,
        type: 'SHOW_SYSTEM_NOTIFICATION',
        clock: 'android-elapsed-realtime',
        title: 'Ready',
        body: 'A result is ready',
        expiresAt,
      }),
      origin,
    );
  if (action === 'back' || action === 'forward') {
    browser?.props.onNavigation?.({ url: origin, canGoBack: true, canGoForward: true });
  }
  send(2);
  const approval = find(draw(), node => node.props.label === 'dapps.notification.allow')?.props.onPress;
  expect(approval).toBeDefined();
  expect(notify).not.toHaveBeenCalled();
  if (action === 'cancel') {
    find(draw(), node => node.props.label === 'common.cancel')?.props.onPress?.();
  }
  if (action === 'navigate') browser?.props.onDocumentStart?.(origin + '/another-document');
  if (action === 'selection' || action === 'revoke' || action === 'account-deleted') {
    for (const effect of effects.splice(0)) effect();
    if (action === 'selection') {
      expect(subscriber).toBeDefined();
      subscriber?.();
    } else if (action === 'account-deleted') {
      permissions.revokeAccount(selection.accountId);
    } else {
      permissions.revoke({ origin, accountId: 'wallet1', networkId: 'stellar-testnet' });
    }
  }
  if (action === 'background') draw(false);
  if (action === 'back' || action === 'forward' || action === 'reload') {
    const navigate = find(draw(), node => node.props.label === 'dapps.browser.' + action)?.props.onPress;
    expect(navigate).toBeDefined();
    navigate?.();
    expect({ back: goBack, forward: goForward, reload }[action]).toHaveBeenCalledTimes(1);
    expect(find(draw(), node => node.props.label === 'dapps.notification.allow')).toBeUndefined();
  }
  if (action === 'timeout') {
    jest.advanceTimersByTime(5_000);
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 2, shown: false }));
    jest.useRealTimers();
  }
  clock?.mockReturnValue(5_000);
  approval?.();
  clock?.mockRestore();
  approval?.();
  if (action === 'approve') {
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(origin, 'Ready', 'A result is ready', expiresAt);
    send(3);
    expect(find(draw(), node => node.props.label === 'dapps.notification.allow')).toBeDefined();
    expect(notify).toHaveBeenCalledTimes(1);
    find(draw(), node => node.props.label === 'common.cancel')?.props.onPress?.();
  } else {
    expect(notify).not.toHaveBeenCalled();
  }
});

it.each([
  ['expired in transit', 5_000, 5_001, 0, false],
  ['remaining budget', 5_000, 4_000, 1_000, true],
  ['short client budget', 1_000, 800, 200, true],
  ['before shared expiry', 5_000, 4_000, 999, false],
] as const)('honors client expiry across bridge delay: %s', (_label, budget, transit, wait, timedOut) => {
  jest.useFakeTimers({ now: 10_000 });
  try {
    const origin = 'https://demo.example.org';
    const notify = jest.fn(() => true);
    const draw = () => render(true, undefined, undefined, notify);
    const browser = find(draw(), node => node.type === BrowserSurface);
    refs[1].current = { reply: replies };
    browser?.props.onMessage?.(request('REQUEST_ACCESS', 1), origin);
    find(draw(), node => node.type === DappConnectSheet)?.props.onAllowOnce?.();
    const expiresAt = Math.floor(performance.now()) + budget;
    const envelope = JSON.stringify({
      source: 'FRESNICA_DAPP_MSG_REQUEST',
      messageId: 2,
      type: 'SHOW_SYSTEM_NOTIFICATION',
      clock: 'android-elapsed-realtime',
      title: 'Ready',
      body: 'Ready',
      expiresAt,
    });
    let clientPending = true;
    setTimeout(
      () => {
        clientPending = false;
      },
      expiresAt - Math.floor(performance.now()),
    );
    jest.advanceTimersByTime(transit);
    browser?.props.onMessage?.(envelope, origin);
    const approval = find(draw(), node => node.props.label === 'dapps.notification.allow')?.props.onPress;
    if (transit >= budget) {
      expect(clientPending).toBe(false);
      expect(approval).toBeUndefined();
    } else {
      expect(approval).toBeDefined();
      jest.advanceTimersByTime(wait);
      expect(clientPending).toBe(!timedOut);
      approval?.();
      expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 2, shown: !timedOut }));
    }
    expect(notify).toHaveBeenCalledTimes(transit < budget && !timedOut ? 1 : 0);
  } finally {
    jest.useRealTimers();
  }
});

it.each(['shared expiry', 'backward wall clock'] as const)(
  'blocks a late approval before the timer callback: %s',
  mode => {
    const wall = jest.spyOn(Date, 'now').mockReturnValue(10_000);
    const monotonic = jest.spyOn(performance, 'now').mockReturnValue(0);
    try {
      const origin = 'https://demo.example.org';
      const notify = jest.fn(() => true);
      const draw = () => render(true, undefined, undefined, notify);
      const browser = find(draw(), node => node.type === BrowserSurface);
      refs[1].current = { reply: replies };
      browser?.props.onMessage?.(request('REQUEST_ACCESS', 1), origin);
      find(draw(), node => node.type === DappConnectSheet)?.props.onAllowOnce?.();
      browser?.props.onMessage?.(
        JSON.stringify({
          source: 'FRESNICA_DAPP_MSG_REQUEST',
          messageId: 2,
          type: 'SHOW_SYSTEM_NOTIFICATION',
          clock: 'android-elapsed-realtime',
          title: 'Ready',
          body: 'Ready',
          expiresAt: 1_000,
        }),
        origin,
      );
      const approval = find(draw(), node => node.props.label === 'dapps.notification.allow')?.props.onPress;
      expect(approval).toBeDefined();
      wall.mockReturnValue(mode === 'shared expiry' ? 11_000 : 9_000);
      monotonic.mockReturnValue(1_000);
      approval?.();
      expect(notify).not.toHaveBeenCalled();
      expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 2, shown: false }));
    } finally {
      wall.mockRestore();
      monotonic.mockRestore();
    }
  },
);

// Load the separately pinned Demo checkout; never vendor reference implementation into Mobile.
const demoNotificationModule = process.env.FRESNICA_DEMO_NOTIFICATION_MODULE;
(demoNotificationModule ? describe : describe.skip)('actual Demo client through the injected browser bridge', () => {
  it.each([
    ['approved', 5_000, 100, 100, true],
    ['expired in transit', 5_000, 5_001, 0, false],
    ['remaining budget expired', 5_000, 4_000, 1_000, false],
    ['short client budget', 1_000, 800, 200, false],
    ['cancelled', 5_000, 100, 100, false],
    ['navigated', 5_000, 100, 100, false],
    ['rollback in transit', 5_000, 4_000, 1_000, false],
    ['rollback before expired receipt', 5_000, 5_001, 0, false],
    ['rollback before timely approval', 5_000, 4_000, 999, true],
    ['forward then rollback in transit', 5_000, 4_000, 1_000, false],
  ] as const)('%s', async (action, budget, transit, approvalDelay, shown) => {
    jest.useFakeTimers({ now: 10_000 });
    try {
      const { sendSystemNotificationRequest } = require(demoNotificationModule!) as {
        sendSystemNotificationRequest: (target: unknown, messageId: string, timeout: number) => Promise<boolean>;
      };
      const { buildFreighterInjectionScript } =
        require('../../../../../platform/dapp-browser/freighterInjection') as typeof import('../../../../../platform/dapp-browser/freighterInjection');
      const vm = require('node:vm') as typeof import('node:vm');
      const origin = 'https://demo.example.org';
      const notify = jest.fn(() => true);
      const draw = () => render(true, undefined, undefined, notify);
      const browser = find(draw(), node => node.type === BrowserSurface);
      browser?.props.onMessage?.(request('REQUEST_ACCESS', 1), origin);
      find(draw(), node => node.type === DappConnectSheet)?.props.onAllowOnce?.();
      const listeners = new Set<(event: { source: unknown; origin: string; data: unknown }) => void>();
      const page: Record<string, unknown> = {
        FresnicaNotificationClock: { now: () => Math.floor(performance.now()) },
        location: { protocol: 'https:', origin },
        addEventListener: (
          _name: string,
          listener: (event: { source: unknown; origin: string; data: unknown }) => void,
        ) => listeners.add(listener),
        removeEventListener: (
          _name: string,
          listener: (event: { source: unknown; origin: string; data: unknown }) => void,
        ) => listeners.delete(listener),
        postMessage: (data: unknown) => {
          for (const listener of listeners) listener({ source: page, origin, data });
        },
        ReactNativeWebView: {
          postMessage: (raw: string) => setTimeout(() => browser?.props.onMessage?.(raw, origin), transit),
        },
      };
      page.top = page;
      page.self = page;
      vm.runInNewContext(buildFreighterInjectionScript(), { window: page, JSON });
      refs[1].current = {
        reply: (data: unknown) => {
          for (const listener of listeners) listener({ source: page, origin, data });
        },
      };
      const clientResult = sendSystemNotificationRequest(page, 'notification-integration', budget);
      if (action.includes('rollback')) {
        jest.advanceTimersByTime(1_000);
        jest.setSystemTime(action.startsWith('forward') ? 20_000 : 9_000);
        jest.advanceTimersByTime(1_000);
        jest.setSystemTime(9_000);
        jest.advanceTimersByTime(transit - 2_000);
      } else {
        jest.advanceTimersByTime(transit);
      }
      const approve = find(draw(), node => node.props.label === 'dapps.notification.allow')?.props.onPress;
      if (transit < budget) expect(approve).toBeDefined();
      else expect(approve).toBeUndefined();
      if (action === 'cancelled') find(draw(), node => node.props.label === 'common.cancel')?.props.onPress?.();
      if (action === 'navigated') browser?.props.onDocumentStart?.(origin + '/next');
      jest.advanceTimersByTime(approvalDelay);
      approve?.();
      jest.advanceTimersByTime(budget);
      await expect(clientResult).resolves.toBe(shown);
      expect(notify).toHaveBeenCalledTimes(shown ? 1 : 0);
      // Only the injection listener remains after the real client's completion/timeout.
      expect(listeners.size).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

it.each([
  'approve',
  'base64',
  'cancel',
  'reload',
  'document',
  'late-result',
  'account-deleted',
  'missing-native-reply',
] as const)('holds the exact SEP-53 message for passphrase review and handles %s', async action => {
  const signature = 'A'.repeat(86) + '==';
  let complete: ((value: string) => void) | undefined;
  const signer = jest.fn<ReturnType<DappMessageSigner>, Parameters<DappMessageSigner>>(
    () =>
      new Promise(resolve => {
        complete = resolve;
      }),
  );
  const draw = () => render(true, undefined, undefined, undefined, signer);
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
  if (action === 'account-deleted') {
    for (const effect of effects.splice(0)) effect();
    permissions.revokeAccount(selection.accountId);
  }
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
    if (action !== 'late-result' && action !== 'account-deleted') expect(signer).not.toHaveBeenCalled();
    if (action === 'cancel')
      expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 31, error: 'user-declined' }), target);
  }
});

it.each(['approve', 'reload', 'signature-expiry'] as const)(
  'keeps notification consent and the native SEP-53 reply independent: %s',
  async action => {
    jest.useFakeTimers({ now: 10_000 });
    try {
      const origin = 'https://demo.example.org';
      const replyId = '74f3db5b-10b8-4abd-8198-cfc869980742';
      const replyTarget = { replyId, expiresAt: Date.now() + 120_000 };
      const signature = 'A'.repeat(86) + '==';
      const signer = jest
        .fn<ReturnType<DappMessageSigner>, Parameters<DappMessageSigner>>()
        .mockResolvedValue(signature);
      const notify = jest.fn(() => true);
      const draw = () => render(true, undefined, undefined, notify, signer);
      const browser = find(draw(), node => node.type === BrowserSurface);
      refs[1].current = { reply: replies, reload };
      browser?.props.onMessage?.(request('REQUEST_ACCESS', 40), origin);
      find(draw(), node => node.type === DappConnectSheet)?.props.onAllowOnce?.();
      browser?.props.onMessage?.(
        JSON.stringify({
          source: 'FRESNICA_DAPP_MSG_REQUEST',
          type: 'SHOW_SYSTEM_NOTIFICATION',
          messageId: 41,
          clock: 'android-elapsed-realtime',
          expiresAt: Math.floor(performance.now()) + 5_000,
          title: 'Ready',
          body: 'Ready',
        }),
        origin,
      );
      const approveNotification = find(draw(), node => node.props.label === 'dapps.notification.allow')?.props.onPress;
      browser?.props.onMessage?.(
        JSON.stringify({
          source: 'FREIGHTER_EXTERNAL_MSG_REQUEST',
          type: 'SUBMIT_BLOB',
          messageId: 42,
          apiVersion: '6.0.1',
          blob: 'Sign this exact message',
        }),
        origin,
        replyId,
        replyTarget.expiresAt,
      );
      const sheet = find(draw(), node => node.type === DappSignSheet);
      expect(approveNotification).toBeDefined();
      expect(sheet).toBeDefined();
      if (action === 'reload') find(draw(), node => node.props.label === 'dapps.browser.reload')?.props.onPress?.();
      if (action === 'signature-expiry') {
        browser?.props.onReplyExpired?.(replyId, origin);
        expect(find(draw(), node => node.type === DappSignSheet)).toBeUndefined();
        expect(find(draw(), node => node.props.label === 'dapps.notification.allow')).toBeDefined();
      }
      approveNotification?.();
      sheet?.props.onConfirm?.('fresh passphrase');
      await Promise.resolve();
      if (action !== 'reload') {
        expect(notify).toHaveBeenCalledTimes(1);
        expect(replies).toHaveBeenCalledWith({ source: 'FRESNICA_DAPP_MSG_RESPONSE', messagedId: 41, shown: true });
      } else {
        expect(notify).not.toHaveBeenCalled();
      }
      if (action === 'approve') {
        expect(signer).toHaveBeenCalledTimes(1);
        expect(replies).toHaveBeenCalledWith(
          expect.objectContaining({ messagedId: 42, signedBlob: signature }),
          replyTarget,
        );
      } else {
        expect(signer).not.toHaveBeenCalled();
        expect(replies).toHaveBeenCalledWith(
          expect.objectContaining({
            messagedId: 42,
            error: action === 'reload' ? 'user-declined' : 'request-expired',
          }),
          replyTarget,
        );
      }
      for (const [response, target] of replies.mock.calls) {
        if (response.signedBlob !== undefined) expect(target).toEqual(replyTarget);
        if (response.source === 'FRESNICA_DAPP_MSG_RESPONSE') expect(target).toBeUndefined();
      }
    } finally {
      jest.useRealTimers();
    }
  },
);

describe('native SEP-53 reply deadline', () => {
  const now = 1_800_000_000_000;
  const origin = 'https://demo.example.org';
  const replyId = '74f3db5b-10b8-4abd-8198-cfc869980742';
  const nextReplyId = '74f3db5b-10b8-4abd-8198-cfc869980743';
  const signature = 'A'.repeat(86) + '==';

  beforeEach(() => jest.useFakeTimers({ now }));
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function start(
    signer: DappMessageSigner,
    beforeReceive?: (expire: NonNullable<DappBrowserSurfaceProps['onReplyExpired']>) => void,
    initialExpiresAt = now + 1000,
  ) {
    const draw = () => render(true, undefined, undefined, undefined, signer);
    const browser = find(draw(), node => node.type === BrowserSurface);
    refs[1].current = { reply: replies, reload };
    browser?.props.onMessage?.(request('REQUEST_ACCESS', 30), origin);
    find(draw(), node => node.type === DappConnectSheet)?.props.onAllowOnce?.();
    const send = (id: number, handle: string, expiresAt: number) =>
      browser?.props.onMessage?.(
        JSON.stringify({
          source: 'FREIGHTER_EXTERNAL_MSG_REQUEST',
          type: 'SUBMIT_BLOB',
          messageId: id,
          apiVersion: '6.0.1',
          blob: 'challenge ' + id,
        }),
        origin,
        handle,
        expiresAt,
      );
    const expire = (handle: string, source = origin) => browser?.props.onReplyExpired?.(handle, source);
    beforeReceive?.(expire);
    send(31, replyId, initialExpiresAt);
    const sheet = find(draw(), node => node.type === DappSignSheet);
    return { draw, send, sheet, expire };
  }

  it('retires the native lifetime when wall time rolls back while the request is in transit', () => {
    const signer = jest.fn<ReturnType<DappMessageSigner>, Parameters<DappMessageSigner>>(async () => signature);
    const nativeLifetime = 120_000;
    const transit = 15_000;
    const { draw, sheet } = start(
      signer,
      expire => {
        // Model the native lifetime starting before JS receives the request.
        // Its callback retains the original elapsed-time budget through wall-clock changes.
        setTimeout(() => expire(replyId, origin), nativeLifetime);
        jest.advanceTimersByTime(transit);
        jest.setSystemTime(now - 3_600_000);
      },
      now + nativeLifetime,
    );
    for (const effect of effects.splice(0)) effect();
    jest.advanceTimersByTime(nativeLifetime - transit - 1);
    expect(find(draw(), node => node.type === DappSignSheet)).toBeDefined();
    jest.advanceTimersByTime(1);
    expect(find(draw(), node => node.type === DappSignSheet)).toBeUndefined();
    sheet?.props.onConfirm?.('late old entry');
    expect(signer).not.toHaveBeenCalled();
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 31, error: 'request-expired' }), {
      replyId,
      expiresAt: now + nativeLifetime,
    });
  });

  it('retires a request and expiry delivered before the next React commit', () => {
    const signer = jest.fn<ReturnType<DappMessageSigner>, Parameters<DappMessageSigner>>(async () => signature);
    const { draw, send, expire } = start(signer);
    expire(replyId);
    send(32, nextReplyId, now + 5000);
    // No draw/effect occurs between the new request and its native expiry event.
    expire(nextReplyId);
    expect(find(draw(), node => node.type === DappSignSheet)).toBeUndefined();
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 32, error: 'request-expired' }), {
      replyId: nextReplyId,
      expiresAt: now + 5000,
    });
    expect(signer).not.toHaveBeenCalled();
  });

  it('ignores mismatched origins and old handles while allowing a fresh request to finish', async () => {
    const signer = jest.fn<ReturnType<DappMessageSigner>, Parameters<DappMessageSigner>>(async () => signature);
    const { draw, send, sheet, expire } = start(signer);
    expire(nextReplyId);
    expire(replyId, 'https://other.example.org');
    expect(find(draw(), node => node.type === DappSignSheet)).toBeDefined();
    expect(replies.mock.calls.some(([response]) => response.error === 'request-expired')).toBe(false);
    expire(replyId);
    send(32, nextReplyId, now + 5000);
    expire(replyId);
    expire(nextReplyId, 'https://other.example.org');
    sheet?.props.onConfirm?.('old entry');
    expect(signer).not.toHaveBeenCalled();
    find(draw(), node => node.type === DappSignSheet)?.props.onConfirm?.('new entry');
    await Promise.resolve();
    await Promise.resolve();
    expect(replies.mock.calls.filter(([response]) => response.signedBlob)).toEqual([
      [
        expect.objectContaining({ messagedId: 32, signedBlob: signature }),
        { replyId: nextReplyId, expiresAt: now + 5000 },
      ],
    ]);
  });

  it('retires the scheduled generation even after a wall-clock rollback and accepts a fresh request', () => {
    const signer = jest.fn<ReturnType<DappMessageSigner>, Parameters<DappMessageSigner>>(async () => signature);
    const { draw, send, sheet } = start(signer);
    for (const effect of effects.splice(0)) effect();
    jest.setSystemTime(now - 10_000);
    jest.advanceTimersByTime(1000);
    expect(find(draw(), node => node.type === DappSignSheet)).toBeUndefined();
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 31, error: 'request-expired' }), {
      replyId,
      expiresAt: now + 1000,
    });
    send(32, nextReplyId, now + 5000);
    sheet?.props.onConfirm?.('late old passphrase');
    expect(signer).not.toHaveBeenCalled();
    expect(find(draw(), node => node.type === DappSignSheet)?.props.expiresAt).toBe(now + 5000);
  });

  it('refuses a deadline-crossing confirm before the timer callback executes', () => {
    const signer = jest.fn<ReturnType<DappMessageSigner>, Parameters<DappMessageSigner>>(async () => signature);
    const { draw, sheet } = start(signer);
    jest.setSystemTime(now + 1000);
    sheet?.props.onConfirm?.('too late');
    expect(signer).not.toHaveBeenCalled();
    expect(find(draw(), node => node.type === DappSignSheet)).toBeUndefined();
  });

  it.each([
    ['timer', 'resolve'],
    ['timer', 'reject'],
    ['native', 'resolve'],
    ['native', 'reject'],
  ] as const)('keeps a fresh review intact after %s expiry and a late SDK %s', async (expiry, outcome) => {
    let resolveOld: ((value: string) => void) | undefined;
    let rejectOld: ((error: Error) => void) | undefined;
    const signer = jest
      .fn<ReturnType<DappMessageSigner>, Parameters<DappMessageSigner>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            resolveOld = resolve;
            rejectOld = reject;
          }),
      )
      .mockResolvedValue(signature);
    const { draw, send, sheet, expire } = start(signer);
    for (const effect of effects.splice(0)) effect();
    sheet?.props.onConfirm?.('first passphrase');
    expect(signer.mock.calls[0][0].isCurrent()).toBe(true);
    if (expiry === 'native') {
      jest.setSystemTime(now - 10_000);
      expire(replyId);
    } else jest.advanceTimersByTime(1000);
    expect(signer.mock.calls[0][0].isCurrent()).toBe(false);
    send(32, nextReplyId, now + 5000);
    const next = find(draw(), node => node.type === DappSignSheet);
    expect(next?.props.busy).toBe(true);
    next?.props.onConfirm?.('must not start while old SDK call is busy');
    expect(signer).toHaveBeenCalledTimes(1);
    if (outcome === 'resolve') resolveOld?.(signature);
    else rejectOld?.(new Error('late failure'));
    await Promise.resolve();
    await Promise.resolve();
    const ready = find(draw(), node => node.type === DappSignSheet);
    expect(ready?.props).toMatchObject({ busy: false, failed: false, expiresAt: now + 5000 });
    ready?.props.onConfirm?.('fresh passphrase');
    await Promise.resolve();
    await Promise.resolve();
    expect(replies.mock.calls.filter(([value]) => value.signedBlob)).toEqual([
      [
        expect.objectContaining({ messagedId: 32, signedBlob: signature }),
        { replyId: nextReplyId, expiresAt: now + 5000 },
      ],
    ]);
  });

  it('suppresses an SDK completion after the deadline before a delayed timer runs', async () => {
    let complete: ((value: string) => void) | undefined;
    const signer = jest.fn<ReturnType<DappMessageSigner>, Parameters<DappMessageSigner>>(
      () =>
        new Promise(resolve => {
          complete = resolve;
        }),
    );
    const { draw, sheet } = start(signer);
    for (const effect of effects.splice(0)) effect();
    sheet?.props.onConfirm?.('fresh entry');
    jest.setSystemTime(now + 1000);
    expect(signer.mock.calls[0][0].isCurrent()).toBe(false);
    complete?.(signature);
    await Promise.resolve();
    await Promise.resolve();
    expect(replies.mock.calls.some(([response]) => response.signedBlob)).toBe(false);
    jest.advanceTimersByTime(1000);
    expect(find(draw(), node => node.type === DappSignSheet)).toBeUndefined();
  });

  it('retains the original deadline across wrong-passphrase retry', async () => {
    const signer = jest
      .fn<ReturnType<DappMessageSigner>, Parameters<DappMessageSigner>>()
      .mockRejectedValueOnce({ code: 'invalid-passcode' })
      .mockResolvedValueOnce(signature);
    const { draw, sheet } = start(signer);
    sheet?.props.onConfirm?.('wrong');
    await Promise.resolve();
    await Promise.resolve();
    expect(find(draw(), node => node.type === DappSignSheet)?.props).toMatchObject({
      failed: true,
      expiresAt: now + 1000,
    });
    jest.setSystemTime(now + 500);
    find(draw(), node => node.type === DappSignSheet)?.props.onConfirm?.('new entry');
    await Promise.resolve();
    await Promise.resolve();
    expect(signer.mock.calls.map(([input]) => input.appPassphrase)).toEqual(['wrong', 'new entry']);
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 31, signedBlob: signature }), {
      replyId,
      expiresAt: now + 1000,
    });
  });

  it.each(['expired', 'busy'] as const)('does not consume secure input on a %s sheet confirmation', state => {
    const consume = jest.fn(() => 'secret');
    const clear = jest.fn();
    const onConfirm = jest.fn();
    const onExpired = jest.fn();
    const props = {
      visible: true,
      origin,
      message: 'challenge',
      address: 'GSOURCE',
      network: 'TESTNET',
      passphraseRequired: true,
      failed: false,
      busy: state === 'busy',
      expiresAt: now + 1000,
      onConfirm,
      onExpired,
      onReject: jest.fn(),
    };
    const draw = () => {
      si = 0;
      ri = 0;
      return DappSignSheet(props);
    };
    const tree = draw();
    refs[0].current = { consume, clear };
    find(tree, node => node.props.label === 'dapps.sign.passphrase')?.props.onPresenceChange?.(true);
    const button = find(
      draw(),
      node =>
        node.props.children !== undefined &&
        React.Children.toArray(node.props.children).some(
          child => React.isValidElement<{ children?: unknown }>(child) && child.props.children === 'dapps.sign.confirm',
        ),
    );
    if (state === 'expired') jest.setSystemTime(now + 1000);
    button?.props.onPress?.();
    expect(consume).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onExpired).toHaveBeenCalledTimes(state === 'expired' ? 1 : 0);
    expect(clear).toHaveBeenCalledTimes(state === 'expired' ? 1 : 0);
  });

  it('requires a native document handle and a fresh approval before submitting a Classic asset', async () => {
    const origin = 'https://demo.example.org';
    const submit = jest.fn(async () => ({ status: 'added' as const }));
    const addAsset = jest.fn(async () => ({
      intent: { hash: 'hash', source: 'GSOURCE', sequence: '7', fee: '100', memo: null, operations: [] },
      contractId: 'USD:GISSUER',
      submit,
    }));
    const show = () => render(true, undefined, undefined, undefined, undefined, addAsset);
    show();
    refs[1].current = { reply: replies };
    const browser = find(show(), node => node.type === BrowserSurface);
    browser?.props.onMessage?.(request('REQUEST_ACCESS', 70), origin);
    find(show(), node => node.type === DappConnectSheet)?.props.onAllowOnce?.();
    const tokenRequest = (messageId: number) =>
      JSON.stringify({
        source: 'FREIGHTER_EXTERNAL_MSG_REQUEST',
        token,
        type: 'SUBMIT_TOKEN',
        issuer: 'GISSUER',
        assetCode: 'USD',
        messageId,
      });
    browser?.props.onMessage?.(tokenRequest(71), origin);
    expect(addAsset).not.toHaveBeenCalled();
    browser?.props.onMessage?.(tokenRequest(72), origin, 'asset-document-1');
    await Promise.resolve();
    await Promise.resolve();
    const review = find(show(), node => node.type === DappSignSheet);
    expect(review).toBeDefined();
    expect(submit).not.toHaveBeenCalled();
    const oldApproval = review?.props.onConfirm;
    browser?.props.onNavigation?.({ url: 'https://other.example.org/', canGoBack: true, canGoForward: false });
    oldApproval?.('test passphrase');
    expect(submit).not.toHaveBeenCalled();

    browser?.props.onDocumentStart?.(origin + '/new-document');
    browser?.props.onMessage?.(request('REQUEST_ACCESS', 73), origin);
    find(show(), node => node.type === DappConnectSheet)?.props.onAllowOnce?.();
    browser?.props.onMessage?.(tokenRequest(74), origin, 'asset-document-2');
    await Promise.resolve();
    await Promise.resolve();
    find(show(), node => node.type === DappSignSheet)?.props.onConfirm?.('test passphrase');
    await Promise.resolve();
    await Promise.resolve();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 74, contractId: 'USD:GISSUER' }), {
      replyId: 'asset-document-2',
    });
  });
});

describe('Classic dApp transaction review', () => {
  it.each([
    ['Mainnet', false],
    ['Testnet', true],
  ])('shows %s on the transaction confirmation sheet (submitsAsset=%s)', (network, submitsAsset) => {
    const tree = DappSignSheet({
      intent: { hash: 'hash', source: 'GSOURCE', sequence: '7', fee: '100', memo: null, operations: [] },
      origin: 'https://demo.example.org',
      network,
      submitsAsset,
      visible: true,
      passphraseRequired: true,
      failed: false,
      onConfirm: jest.fn(),
      onReject: jest.fn(),
    });

    expect(find(tree, node => node.props.children === network)).toBeDefined();
  });

  it.each([false, true])('keeps both uncertain asset hashes in the wallet (expired=%s)', async expired => {
    const origin = 'https://demo.example.org';
    const replyId = 'asset-document';
    const result = { status: 'submission-uncertain', transactionHash: 'a'.repeat(64) } as const;
    let finishSubmission!: (value: typeof result) => void;
    const submission = new Promise<typeof result>(resolve => {
      finishSubmission = resolve;
    });
    const nextResult: typeof result = { ...result, transactionHash: 'b'.repeat(64) };
    const submit = jest
      .fn((_passphrase: string, _isCurrent: () => boolean) => submission)
      .mockImplementationOnce(() => submission)
      .mockResolvedValueOnce(nextResult);
    const addAsset: DappAssetRequest = async () => ({
      intent: { hash: 'hash', source: 'GSOURCE', sequence: '7', fee: '100', memo: null, operations: [] },
      contractId: 'USD:GISSUER',
      submit,
    });
    const show = () => render(true, undefined, undefined, undefined, undefined, addAsset);
    const browser = find(show(), node => node.type === BrowserSurface);
    refs[1].current = { reply: replies };
    browser?.props.onMessage?.(request('REQUEST_ACCESS', 75), origin);
    find(show(), node => node.type === DappConnectSheet)?.props.onAllowOnce?.();
    replies.mockClear();
    const requestAsset = (messageId: number, assetCode: string, handle: string) =>
      browser?.props.onMessage?.(
        JSON.stringify({
          source: 'FREIGHTER_EXTERNAL_MSG_REQUEST',
          token,
          type: 'SUBMIT_TOKEN',
          issuer: 'GISSUER',
          assetCode,
          messageId,
        }),
        origin,
        handle,
      );
    requestAsset(76, 'USD', replyId);
    await Promise.resolve();
    await Promise.resolve();

    find(show(), node => node.type === DappSignSheet)?.props.onConfirm?.('test passphrase');
    expect(submit).toHaveBeenCalledTimes(1);
    const [, isCurrent] = submit.mock.calls[0];
    expect(isCurrent()).toBe(true);

    if (expired) {
      browser?.props.onReplyExpired?.(replyId, origin);
      expect(isCurrent()).toBe(false);
      expect(find(show(), node => node.type === DappSignSheet)).toBeUndefined();
    }
    finishSubmission(result);
    await submission;

    const secondReplyId = 'asset-document-2';
    requestAsset(77, 'EUR', secondReplyId);
    await Promise.resolve();
    await Promise.resolve();
    find(show(), node => node.type === DappSignSheet)?.props.onConfirm?.('test passphrase');
    expect(submit).toHaveBeenCalledTimes(2);
    await submit.mock.results[1].value;

    const tree = show();
    expect(find(tree, node => node.props.children === 'dapps.sign.assetUncertain')).toBeDefined();
    expect(find(tree, node => node.props.children === result.transactionHash)?.props.selectable).toBe(true);
    expect(find(tree, node => node.props.children === nextResult.transactionHash)?.props.selectable).toBe(true);
    expect(find(tree, node => node.type === DappSignSheet)).toBeUndefined();
    expect(replies.mock.calls).toEqual([
      [
        {
          source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
          messagedId: 76,
          error: expired ? 'request-expired' : 'submission-uncertain',
        },
        { replyId },
      ],
      [
        {
          source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
          messagedId: 77,
          error: 'submission-uncertain',
        },
        { replyId: secondReplyId },
      ],
    ]);
  });
});

describe('browser connection controls', () => {
  const origin = 'https://demo.example.org';
  const other = { origin, accountId: 'other-wallet', networkId: selection.networkId };
  const scope = { origin, accountId: selection.accountId, networkId: selection.networkId };

  const openControls = () => {
    const tree = render();
    find(tree, node => node.props.label === 'dapps.browser.connection')?.props.onPress?.();
    return render();
  };

  it('shows the authorized public address and revokes only the active site/account/network', () => {
    permissions.grant(scope);
    permissions.grant(other);
    const tree = openControls();
    const web = find(tree, node => node.type === BrowserSurface);
    expect(find(tree, node => node.props.children === 'dapps.browser.connectedRead')).toBeDefined();
    expect(find(tree, node => node.props.children === selection.address)).toBeDefined();
    find(tree, node => node.props.label === 'dapps.browser.disconnect')?.props.onPress?.();
    expect(navigateClose).toHaveBeenCalledTimes(1);
    expect(permissions.has(scope)).toBe(false);
    expect(permissions.has(other)).toBe(true);
    web?.props.onMessage?.(request('REQUEST_ACCESS', 91), origin);
    expect(replies).not.toHaveBeenCalled();
    expect(find(render(), node => node.type === BrowserSurface)).toBeUndefined();
  });

  it('stops the session but does not claim that a failed revocation was saved', () => {
    permissions.grant(scope);
    const revoke = jest.spyOn(permissions, 'revoke').mockImplementationOnce(() => {
      throw new Error('realm-write-failed');
    });
    try {
      const tree = openControls();
      find(tree, node => node.props.label === 'dapps.browser.disconnect')?.props.onPress?.();
      expect(navigateClose).not.toHaveBeenCalled();
      expect(permissions.has(scope)).toBe(true);
      const closed = render();
      expect(find(closed, node => node.type === BrowserSurface)).toBeUndefined();
      expect(find(closed, node => node.props.children === 'dapps.browser.revokeFailed')).toBeDefined();
    } finally {
      revoke.mockRestore();
    }
  });

  it('shares only the current site origin and ignores stale controls after navigation', () => {
    const start = render();
    const web = find(start, node => node.type === BrowserSurface);
    const url = origin + '/review?private=fixture#fragment';
    web?.props.onDocumentStart?.(url);
    web?.props.onNavigation?.({ url, canGoBack: false, canGoForward: false });
    const tree = openControls();
    expect(find(tree, node => node.props.children === 'dapps.browser.disconnected')).toBeDefined();
    expect(find(tree, node => node.props.children === selection.address)).toBeUndefined();
    const share = find(tree, node => node.props.label === 'dapps.browser.shareOrigin');
    share?.props.onPress?.();
    expect(shareWebsite).toHaveBeenCalledWith(origin);
    web?.props.onDocumentStart?.('https://other.example.org/path');
    share?.props.onPress?.();
    expect(shareWebsite).toHaveBeenCalledTimes(1);
  });
});

describe('Soroban tracking requests', () => {
  const origin = 'https://demo.example.org';
  const id = 'C' + 'A'.repeat(55);
  const target = 'contract-request';
  const payload = JSON.stringify({
    source: 'FREIGHTER_EXTERNAL_MSG_REQUEST',
    type: 'SUBMIT_TOKEN',
    messageId: 404,
    contractId: id,
    networkPassphrase: selection.networkPassphrase,
  });

  function openAssetReview() {
    permissions.grant({ origin, accountId: selection.accountId, networkId: selection.networkId });
    render();
    refs[1].current = { reply: replies };
    const web = find(render(), node => node.type === BrowserSurface);
    web?.props.onMessage?.(payload, origin, target);
    const approve = find(render(), node => node.props.label === 'dapps.contract.confirm')?.props.onPress;
    expect(approve).toBeDefined();
    return { web, approve };
  }

  it('does not read or write before wallet confirmation and returns only to its document', async () => {
    const track = jest.fn(
      async (_selection: DappPublicSelection, _id: string, _signal: AbortSignal, isCurrent: () => boolean) =>
        isCurrent(),
    );
    testTracking = { canReview: () => true, track };
    const { approve } = openAssetReview();
    expect(track).not.toHaveBeenCalled();
    approve?.();
    await Promise.resolve();
    expect(track).toHaveBeenCalledTimes(1);
    expect(replies).toHaveBeenCalledWith(expect.objectContaining({ messagedId: 404, contractId: id }), {
      replyId: target,
    });
  });

  it('aborts an approved read after expiry and never replies late', async () => {
    let finish: (() => void) | undefined;
    const track = jest.fn(
      (_selection: DappPublicSelection, _id: string, signal: AbortSignal, isCurrent: () => boolean) =>
        new Promise<boolean>(resolve => {
          finish = () => resolve(!signal.aborted && isCurrent());
        }),
    );
    testTracking = { canReview: () => true, track };
    const { web, approve } = openAssetReview();
    approve?.();
    web?.props.onReplyExpired?.(target, origin);
    finish?.();
    await Promise.resolve();
    expect(track.mock.calls[0]?.[2].aborted).toBe(true);
    expect(replies).toHaveBeenCalledTimes(1);
    expect(replies).not.toHaveBeenCalledWith(expect.objectContaining({ contractId: id }), expect.anything());
  });
});

it('retires the original bridge before handing an account switch to wallet navigation', () => {
  const next = { id: 'wallet2', networkId: selection.networkId, address: 'GSECOND' } as AccountRecord;
  testAccounts = [next];
  testSwitch = jest.fn(async () => undefined);
  const tree = render();
  const web = find(tree, node => node.type === BrowserSurface);
  refs[1].current = { reply: replies };
  find(tree, node => node.props.label === 'dapps.browser.connection')?.props.onPress?.();
  find(render(), node => node.props.label === 'dapps.browser.switchAccount')?.props.onPress?.();
  find(render(), node => node.props.label === 'GSECOND')?.props.onPress?.();
  expect(testSwitch).toHaveBeenCalledWith('wallet2', 'https://demo.example.org');
  web?.props.onMessage?.(request('REQUEST_ACCESS', 500), 'https://demo.example.org');
  expect(replies).not.toHaveBeenCalled();
  expect(find(render(), node => node.type === BrowserSurface)).toBeUndefined();
});
