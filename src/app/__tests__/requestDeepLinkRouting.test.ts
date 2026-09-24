import type { AccountRecord } from '../../capabilities/account/types';
import { parseRequestDeepLink, resolveRequestDeepLink } from '../requestDeepLinkRouting';

const network = {
  id: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
};
const destination = `G${'A'.repeat(55)}`;

function account(overrides: Partial<AccountRecord> = {}): AccountRecord {
  const now = new Date('2026-09-24T00:00:00.000Z');
  return {
    id: 'account-a',
    address: `G${'B'.repeat(55)}`,
    identityKind: 'classic',
    networkId: network.id,
    label: 'Wallet',
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const dependencies = {
  network,
  gateway: {
    isClassicAccountAddress: (value: string) => /^G[A-Z0-9]{55}$/.test(value),
  },
};

describe('request deep-link routing', () => {
  it('uses the canonical Request parser and binds the persisted visible classic account without mutating selection', () => {
    const parsed = parseRequestDeepLink(
      dependencies as never,
      `web+stellar:pay?destination=${destination}&amount=1&network_passphrase=${encodeURIComponent(network.networkPassphrase)}`,
    );
    const isWatchOnly = jest.fn(() => false);

    expect(parsed.diagnostics).toEqual({
      carrier: 'deep-link',
      outcome: 'accepted',
      category: 'payment-request',
    });
    expect(
      resolveRequestDeepLink(
        parsed,
        [account(), account({ id: 'account-b', sortOrder: 1 })],
        network.id,
        'account-a',
        isWatchOnly,
      ),
    ).toMatchObject({
      kind: 'ready',
      accountId: 'account-a',
      intent: { destination, amount: '1' },
    });
    expect(isWatchOnly).toHaveBeenCalledWith('account-a');
  });

  it('fails closed on a network mismatch without choosing another account', () => {
    const parsed = parseRequestDeepLink(dependencies as never, `web+stellar:pay?destination=${destination}`);

    expect(parsed.result).toMatchObject({ status: 'rejected', reason: 'network-mismatch' });
    expect(resolveRequestDeepLink(parsed, [account()], network.id, 'account-a', () => false)).toEqual({
      kind: 'blocked',
      reason: 'network-mismatch',
    });
  });

  it('keeps unsupported SEP-7 operations distinguishable', () => {
    const parsed = parseRequestDeepLink(dependencies as never, 'web+stellar:tx?xdr=AAAA');

    expect(resolveRequestDeepLink(parsed, [account()], network.id, 'account-a', () => false)).toEqual({
      kind: 'blocked',
      reason: 'unsupported',
    });
  });

  it('does not auto-switch away from an ineligible current/default account', () => {
    const parsed = parseRequestDeepLink(
      dependencies as never,
      `web+stellar:pay?destination=${destination}&network_passphrase=${encodeURIComponent(network.networkPassphrase)}`,
    );
    const watchOnlyDefault = account({ id: 'watch-only' });
    const signingAlternative = account({ id: 'signing', sortOrder: 1 });

    expect(
      resolveRequestDeepLink(
        parsed,
        [watchOnlyDefault, signingAlternative],
        network.id,
        'watch-only',
        id => id === 'watch-only',
      ),
    ).toEqual({ kind: 'blocked', reason: 'account-ineligible' });
  });

  it('does not expose raw malformed content in stable routing output', () => {
    const secret = `S${'A'.repeat(55)}`;
    const parsed = parseRequestDeepLink(dependencies as never, secret);
    const resolved = resolveRequestDeepLink(parsed, [account()], network.id, 'account-a', () => false);

    expect(JSON.stringify(parsed.diagnostics)).not.toContain(secret);
    expect(JSON.stringify(resolved)).not.toContain(secret);
    expect(resolved).toEqual({ kind: 'blocked', reason: 'invalid' });
  });
});
