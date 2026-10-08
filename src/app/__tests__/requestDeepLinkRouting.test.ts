import type { AccountRecord } from '../../capabilities/account/types';
import { parseRequestDeepLink, resolveRequestDeepLink } from '../requestDeepLinkRouting';

const network = {
  id: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
};
const destination = `G${'A'.repeat(55)}`;
const sourceAddress = `G${'B'.repeat(55)}`;
const issuer = `G${'C'.repeat(55)}`;
const wrongIssuer = `G${'D'.repeat(55)}`;

function account(overrides: Partial<AccountRecord> = {}): AccountRecord {
  const now = new Date('2026-09-24T00:00:00.000Z');
  return {
    id: 'account-a',
    address: sourceAddress,
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

function sourceEligibilityDependencies(
  trustlines: ReadonlyArray<
    Readonly<{
      code: string;
      issuer: string;
      balance: string;
      sellingLiabilities?: string;
      isAuthorized?: boolean;
    }>
  >,
) {
  return {
    network,
    gateway: {
      isClassicAccountAddress: dependencies.gateway.isClassicAccountAddress,
      loadAccountState: jest.fn(async () => ({
        status: 'active' as const,
        account: {
          address: sourceAddress,
          subentryCount: trustlines.length,
          numSponsoring: 0,
          numSponsored: 0,
          flags: { authRequired: false, authClawbackEnabled: false },
          balances: [
            { kind: 'native' as const, balance: '100', sellingLiabilities: '0' },
            ...trustlines.map(trustline => ({
              kind: 'credit' as const,
              balance: trustline.balance,
              buyingLiabilities: '0',
              sellingLiabilities: trustline.sellingLiabilities ?? '0',
              code: trustline.code,
              issuer: trustline.issuer,
              limit: '1000',
              isAuthorized: trustline.isAuthorized ?? true,
              isAuthorizedToMaintainLiabilities: false,
              isClawbackEnabled: false,
            })),
          ],
        },
      })),
      loadLedgerParameters: jest.fn(async () => ({ baseReserveStroops: 5_000_000, baseFeeStroops: 100 })),
    },
  };
}

function parseIssuedDeepLink() {
  return parseRequestDeepLink(
    dependencies as never,
    `web+stellar:pay?destination=${destination}&amount=2&asset_code=USD&asset_issuer=${issuer}&network_passphrase=${encodeURIComponent(network.networkPassphrase)}`,
  );
}

describe('request deep-link routing', () => {
  it('uses the canonical Request parser and binds the persisted visible classic account without mutating selection', async () => {
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
      await resolveRequestDeepLink(
        dependencies as never,
        parsed,
        [account(), account({ id: 'account-b', sortOrder: 1 })],
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

  it('accepts an issued asset only after authoritative source preflight proves the exact asset and amount', async () => {
    const eligibility = sourceEligibilityDependencies([{ code: 'USD', issuer, balance: '5', sellingLiabilities: '1' }]);

    expect(
      await resolveRequestDeepLink(eligibility as never, parseIssuedDeepLink(), [account()], 'account-a', () => false),
    ).toMatchObject({
      kind: 'ready',
      accountId: 'account-a',
      intent: { amount: '2', asset: { kind: 'credit', code: 'USD', issuer } },
    });
    expect(eligibility.gateway.loadAccountState).toHaveBeenCalledWith(sourceAddress);
    expect(eligibility.gateway.loadLedgerParameters).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing trustline', []],
    ['same code with the wrong issuer', [{ code: 'USD', issuer: wrongIssuer, balance: '5' }]],
    ['insufficient available balance', [{ code: 'USD', issuer, balance: '5', sellingLiabilities: '4' }]],
    ['unauthorized trustline', [{ code: 'USD', issuer, balance: '5', isAuthorized: false }]],
  ])('fails closed for an issued asset with %s', async (_name, trustlines) => {
    const eligibility = sourceEligibilityDependencies(trustlines);

    expect(
      await resolveRequestDeepLink(eligibility as never, parseIssuedDeepLink(), [account()], 'account-a', () => false),
    ).toEqual({ kind: 'blocked', reason: 'account-ineligible' });
  });

  it('fails closed on a network mismatch without choosing another account', async () => {
    const parsed = parseRequestDeepLink(dependencies as never, `web+stellar:pay?destination=${destination}`);

    expect(parsed.result).toMatchObject({ status: 'rejected', reason: 'network-mismatch' });
    expect(await resolveRequestDeepLink(dependencies as never, parsed, [account()], 'account-a', () => false)).toEqual({
      kind: 'blocked',
      reason: 'network-mismatch',
    });
  });

  it('keeps unsupported SEP-7 operations distinguishable', async () => {
    const parsed = parseRequestDeepLink(dependencies as never, 'web+stellar:tx?xdr=AAAA');

    expect(await resolveRequestDeepLink(dependencies as never, parsed, [account()], 'account-a', () => false)).toEqual({
      kind: 'blocked',
      reason: 'unsupported',
    });
  });

  it('does not auto-switch away from an ineligible current/default account', async () => {
    const parsed = parseRequestDeepLink(
      dependencies as never,
      `web+stellar:pay?destination=${destination}&network_passphrase=${encodeURIComponent(network.networkPassphrase)}`,
    );
    const watchOnlyDefault = account({ id: 'watch-only' });
    const signingAlternative = account({ id: 'signing', sortOrder: 1 });

    expect(
      await resolveRequestDeepLink(
        dependencies as never,
        parsed,
        [watchOnlyDefault, signingAlternative],
        'watch-only',
        id => id === 'watch-only',
      ),
    ).toEqual({ kind: 'blocked', reason: 'account-ineligible' });
  });

  it('does not expose raw malformed content in stable routing output', async () => {
    const secret = `S${'A'.repeat(55)}`;
    const parsed = parseRequestDeepLink(dependencies as never, secret);
    const resolved = await resolveRequestDeepLink(dependencies as never, parsed, [account()], 'account-a', () => false);

    expect(JSON.stringify(parsed.diagnostics)).not.toContain(secret);
    expect(JSON.stringify(resolved)).not.toContain(secret);
    expect(resolved).toEqual({ kind: 'blocked', reason: 'invalid' });
  });
});
