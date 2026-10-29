import { createFreighterSession, MAX_BRIDGE_MESSAGE_LENGTH } from '../freighterSession';

const origin = 'https://demo.example.org';
const token = 'a'.repeat(64);
const selection = {
  accountId: 'wallet-1',
  address: 'GABC',
  networkId: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
  revision: 4,
  networkUrl: 'https://horizon-testnet.stellar.org',
};
const request = (type: string, messageId: string | number = 1, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ source: 'FREIGHTER_EXTERNAL_MSG_REQUEST', token, messageId, type, ...extra });

function harness() {
  let current = { ...selection };
  let focused = true;
  const session = createFreighterSession({
    origin,
    token,
    initial: selection,
    current: () => (focused ? current : undefined),
  });
  return {
    session,
    loseFocus: () => {
      focused = false;
    },
    changeAccount: () => {
      current = { ...current, accountId: 'wallet-2', revision: 5 };
    },
    changeBack: () => {
      current = { ...current, accountId: 'wallet-1', revision: 6 };
    },
  };
}

describe('S15/S18 Freighter in-WebView read-only wallet bridge', () => {
  it('does not reveal a public address, network details or user info before permission', () => {
    const { session } = harness();
    for (const method of ['REQUEST_PUBLIC_KEY', 'REQUEST_USER_INFO', 'REQUEST_NETWORK_DETAILS']) {
      const response = session.receive(request(method, method), origin);
      expect(response).toMatchObject({ kind: 'respond', response: { error: 'not-authorized', messagedId: method } });
      expect(JSON.stringify(response)).not.toContain('GABC');
    }
    expect(session.receive(request('REQUEST_ALLOWED_STATUS', 'allowed'), origin)).toMatchObject({
      kind: 'respond',
      response: { isAllowed: false, messagedId: 'allowed' },
    });
    expect(session.receive(request('REQUEST_CONNECTION_STATUS', 'connected'), origin)).toMatchObject({
      kind: 'respond',
      response: { isConnected: true, messagedId: 'connected' },
    });
  });

  it('requires an explicit user decision for every origin/account/network session', () => {
    const { session } = harness();
    expect(session.receive(request('REQUEST_ACCESS'), origin)).toEqual({ kind: 'permission', messageId: 1, origin });
    expect(session.resolvePermission(true)).toMatchObject({
      kind: 'respond',
      response: { publicKey: 'GABC', messagedId: 1 },
    });
    expect(session.receive(request('REQUEST_PUBLIC_KEY', 2), origin)).toMatchObject({
      kind: 'respond',
      response: { publicKey: 'GABC', messagedId: 2 },
    });
    expect(session.receive(request('REQUEST_NETWORK', 3), origin)).toMatchObject({
      kind: 'respond',
      response: { network: 'TESTNET', messagedId: 3 },
    });
    expect(session.receive(request('REQUEST_NETWORK_DETAILS', 4), origin)).toMatchObject({
      kind: 'respond',
      response: {
        messagedId: 4,
        networkDetails: {
          network: 'TESTNET',
          networkName: 'Test Net',
          networkUrl: selection.networkUrl,
          networkPassphrase: selection.networkPassphrase,
          sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
        },
      },
    });
    expect(session.receive(request('REQUEST_USER_INFO', 5), origin)).toMatchObject({
      kind: 'respond',
      response: { userInfo: { publicKey: 'GABC' }, messagedId: 5 },
    });
  });

  it('does not authorize when the user cancels; old decisions cannot grant later requests', () => {
    const { session } = harness();
    expect(session.receive(request('REQUEST_ACCESS'), origin).kind).toBe('permission');
    expect(session.resolvePermission(false)).toMatchObject({ kind: 'respond', response: { error: 'user-declined' } });
    expect(session.resolvePermission(true)).toBeNull();
    expect(session.receive(request('REQUEST_PUBLIC_KEY', 2), origin)).toMatchObject({
      kind: 'respond',
      response: { error: 'not-authorized' },
    });
  });

  it('drops wrong origin/nonce, malformed JSON, excessive payload, unsupported requests and ID replays', () => {
    const { session } = harness();
    expect(session.receive(request('REQUEST_ACCESS'), 'https://evil.example.org').kind).toBe('drop');
    expect(session.receive(request('REQUEST_ACCESS').replace(token, 'b'.repeat(64)), origin).kind).toBe('drop');
    expect(session.receive('{', origin).kind).toBe('drop');
    expect(session.receive('x'.repeat(MAX_BRIDGE_MESSAGE_LENGTH + 1), origin).kind).toBe('drop');
    expect(session.receive(request('SUBMIT_TRANSACTION', 6, { transactionXdr: 'XDR' }), origin).kind).toBe('drop');
    // Recognized but incomplete requests are malformed, not actionable API calls.
    expect(session.receive(request('SUBMIT_BLOB', 7), origin)).toEqual({ kind: 'drop' });
    expect(session.receive(request('REQUEST_ACCESS', 9), origin).kind).toBe('permission');
    expect(session.receive(request('REQUEST_ACCESS', 9), origin).kind).toBe('drop');
    session.resolvePermission(true);
    expect(session.receive(request('REQUEST_PUBLIC_KEY', 9), origin).kind).toBe('drop');
  });

  it('invalidates async permission on account switch, same-account ABA and focus loss', () => {
    const change = harness();
    expect(change.session.receive(request('REQUEST_ACCESS'), origin).kind).toBe('permission');
    change.changeAccount();
    change.changeBack();
    expect(change.session.resolvePermission(true)).toBeNull();
    expect(change.session.receive(request('REQUEST_PUBLIC_KEY', 2), origin)).toMatchObject({
      kind: 'respond',
      response: { error: 'session-stale' },
    });
    const focused = harness();
    focused.session.receive(request('REQUEST_ACCESS'), origin);
    focused.loseFocus();
    expect(focused.session.resolvePermission(true)).toBeNull();
  });

  it('keeps an allow-once grant across same-origin navigation and drops it on close', () => {
    const { session } = harness();
    session.receive(request('REQUEST_ACCESS'), origin);
    session.resolvePermission(true);
    session.reset();
    expect(session.receive(request('REQUEST_PUBLIC_KEY', 3), origin)).toMatchObject({
      kind: 'respond',
      response: { publicKey: 'GABC' },
    });
    session.revoke();
    expect(session.resolvePermission(true)).toBeNull();
    expect(session.receive(request('REQUEST_PUBLIC_KEY', 5), origin).kind).toBe('drop');
  });

  it('requires a new permission after the browser moves to another public origin', () => {
    const next = 'https://other.example.org';
    let active = origin;
    const session = createFreighterSession({
      origin,
      token,
      initial: selection,
      current: () => selection,
      persistedAllowed: () => active === next,
    });
    session.receive(request('REQUEST_ACCESS', 1), origin);
    session.resolvePermission(true);
    session.activateDocument(next);
    expect(session.receive(request('REQUEST_PUBLIC_KEY', 2), origin).kind).toBe('drop');
    expect(session.receive(request('REQUEST_ACCESS', 3), next)).toEqual({
      kind: 'permission',
      messageId: 3,
      origin: next,
    });
    active = next;
    session.activateDocument(next);
    expect(session.receive(request('REQUEST_PUBLIC_KEY', 4), next)).toMatchObject({
      kind: 'respond',
      response: { publicKey: 'GABC' },
    });
  });

  it('treats a persisted allow-always grant as already connected', () => {
    let persist = true;
    const session = createFreighterSession({
      origin,
      token,
      initial: selection,
      current: () => selection,
      persistedAllowed: () => persist,
    });
    expect(session.receive(request('REQUEST_ALLOWED_STATUS', 1), origin)).toMatchObject({
      kind: 'respond',
      response: { isAllowed: true },
    });
    expect(session.receive(request('REQUEST_PUBLIC_KEY', 2), origin)).toMatchObject({
      kind: 'respond',
      response: { publicKey: 'GABC' },
    });
    persist = false;
    expect(session.receive(request('REQUEST_PUBLIC_KEY', 3), origin)).toMatchObject({
      kind: 'respond',
      response: { error: 'not-authorized' },
    });
  });

  it('accepts a page Freighter envelope without a private token and rejects unknown fields', () => {
    const { session } = harness();
    const pageRequest = JSON.stringify({
      source: 'FREIGHTER_EXTERNAL_MSG_REQUEST',
      messageId: 123.5,
      type: 'REQUEST_ALLOWED_STATUS',
      networkPassphrase: selection.networkPassphrase,
    });
    expect(session.receive(pageRequest, origin)).toMatchObject({
      kind: 'respond',
      response: { isAllowed: false, messagedId: 123.5 },
    });
    expect(
      session.receive(
        JSON.stringify({
          source: 'FREIGHTER_EXTERNAL_MSG_REQUEST',
          messageId: 8,
          type: 'REQUEST_ACCESS',
          transactionXdr: 'AAAA',
        }),
        origin,
      ).kind,
    ).toBe('drop');
  });

  it.each([
    [
      'SUBMIT_TOKEN',
      {
        contractId: 'USDC:GISSUER',
        assetType: 'classic',
        assetCode: 'USDC',
        issuer: 'GISSUER',
        symbol: 'USDC',
        decimals: 7,
        iconUrl: 'https://assets.example.org/usdc.png',
        name: 'USD Coin',
      },
    ],
    ['SUBMIT_BLOB', { apiVersion: '1', blob: 'test-payload', accountToSign: selection.address }],
    ['SUBMIT_AUTH_ENTRY', { apiVersion: '1', entryXdr: 'AAAA', networkPassphrase: selection.networkPassphrase }],
  ] as const)('responds explicitly to a valid %s envelope instead of leaving a dApp pending', (type, fields) => {
    const { session } = harness();
    const received = session.receive(request(type, 42, fields), origin);
    expect(received).toEqual({
      kind: 'respond',
      response: {
        source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
        messagedId: 42,
        error: 'unsupported',
      },
    });
    expect(JSON.stringify(received)).not.toMatch(/signedTransaction|signerAddress|publicKey|secret/);
    expect(session.receive(request(type, 42, fields), origin).kind).toBe('drop');
  });

  it('keeps recognized unsupported methods fail-closed for malformed and oversized payloads', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['SUBMIT_TOKEN', { assetCode: 'USD', issuer: 'GISSUER' }],
      ['SUBMIT_TOKEN', { contractId: 'C123', decimals: 19 }],
      ['SUBMIT_TOKEN', { contractId: 'C123', decimals: 2.5 }],
      ['SUBMIT_TOKEN', { contractId: 'C123', decimals: '7' }],
      ['SUBMIT_TOKEN', { contractId: 'C123', assetType: 'unknown' }],
      ['SUBMIT_TOKEN', { contractId: 'C123', iconUrl: 'x'.repeat(2049) }],
      ['SUBMIT_BLOB', { blob: 'hi' }],
      ['SUBMIT_BLOB', { apiVersion: '1', blob: '' }],
      ['SUBMIT_BLOB', { apiVersion: '1', blob: 'x'.repeat(131_073) }],
      ['SUBMIT_AUTH_ENTRY', { entryXdr: 'AAAA' }],
      ['SUBMIT_AUTH_ENTRY', { apiVersion: '', entryXdr: 'AAAA' }],
      ['SUBMIT_AUTH_ENTRY', { apiVersion: '1', entryXdr: 'A'.repeat(200_001) }],
      ['SUBMIT_AUTH_ENTRY', { apiVersion: '1', entryXdr: 'AAAA', transactionXdr: 'AAAA' }],
    ];
    const { session } = harness();
    for (const [type, fields] of cases) {
      expect(session.receive(request(type, 71, fields), origin)).toEqual({ kind: 'drop' });
    }
    // None of those rejected frames consumed the message ID or started a signature.
    expect(
      session.receive(request('SUBMIT_AUTH_ENTRY', 71, { apiVersion: '1', entryXdr: 'AAAA' }), origin),
    ).toMatchObject({
      kind: 'respond',
      response: { error: 'unsupported', messagedId: 71 },
    });
  });

  it('does not expand account permissions or sign when unsupported commands are received', () => {
    const { session } = harness();
    const unsupported = request('SUBMIT_BLOB', 32, { blob: 'test-data', apiVersion: '1' });
    expect(session.receive(unsupported, origin)).toMatchObject({ kind: 'respond', response: { error: 'unsupported' } });
    expect(session.receive(request('REQUEST_ALLOWED_STATUS', 33), origin)).toMatchObject({
      kind: 'respond',
      response: { isAllowed: false },
    });
    expect(session.receive(request('REQUEST_PUBLIC_KEY', 34), origin)).toMatchObject({
      kind: 'respond',
      response: { error: 'not-authorized' },
    });
    session.receive(request('REQUEST_ACCESS', 35), origin);
    session.resolvePermission(true);
    expect(session.receive(request('SUBMIT_TOKEN', 36, { contractId: 'C123' }), origin)).toMatchObject({
      kind: 'respond',
      response: { error: 'unsupported' },
    });
    expect(
      session.finishSign({ status: 'signed', signedTransaction: 'BBBB', signerAddress: selection.address }),
    ).toBeNull();
  });

  it('reviews an authorized transaction and returns only a matching signature', () => {
    const { session } = harness();
    session.receive(request('REQUEST_ACCESS'), origin);
    session.resolvePermission(true);
    expect(session.receive(request('SUBMIT_TRANSACTION', 4), origin).kind).toBe('drop');
    expect(
      session.receive(request('SUBMIT_TRANSACTION', 5, { transactionXdr: 'AAAA', network: 'PUBLIC' }), origin),
    ).toMatchObject({
      kind: 'respond',
      response: { error: 'wrong-network', messagedId: 5 },
    });
    expect(
      session.receive(request('SUBMIT_TRANSACTION', 6, { transactionXdr: 'AAAA', accountToSign: 'GOTHER' }), origin),
    ).toMatchObject({ kind: 'respond', response: { error: 'wrong-account' } });
    const review = session.receive(request('SUBMIT_TRANSACTION', 7, { transactionXdr: 'AAAA' }), origin);
    expect(review).toMatchObject({
      kind: 'sign-transaction',
      transactionXdrBase64: 'AAAA',
      accountAddress: 'GABC',
      messageId: 7,
    });
    expect(session.receive(request('SUBMIT_TRANSACTION', 8, { transactionXdr: 'AAAA' }), origin)).toMatchObject({
      kind: 'respond',
      response: { error: 'sign-pending' },
    });
    expect(session.finishSign({ status: 'signed', signedTransaction: 'AAAA', signerAddress: 'GABC' })).toMatchObject({
      error: 'invalid-transaction',
    });
    const again = session.receive(request('SUBMIT_TRANSACTION', 9, { transactionXdr: 'AAAA' }), origin);
    expect(again.kind).toBe('sign-transaction');
    expect(session.finishSign({ status: 'declined' })).toMatchObject({ error: 'user-declined', messagedId: 9 });
    expect(session.finishSign({ status: 'signed', signedTransaction: 'BBBB', signerAddress: 'GABC' })).toBeNull();
  });

  it('does not review a transaction before the origin is allowed', () => {
    const { session } = harness();
    expect(session.receive(request('SUBMIT_TRANSACTION', 4, { transactionXdr: 'AAAA' }), origin)).toMatchObject({
      kind: 'respond',
      response: { error: 'not-authorized' },
    });
    expect(JSON.stringify(session.receive(request('SUBMIT_BLOB', 7), origin))).not.toContain('signedTransaction');
  });
});
