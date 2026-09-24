import type { AccountRecord } from '../../../capabilities/account/types';
import type { NetworkContext } from '../../../capabilities/network/types';
import type { PaymentGatewayPort } from '../../../capabilities/payment/PaymentGateway';
import type { RequestOutputPort } from '../../../capabilities/request/RequestOutputPort';
import type { StellarAccountState } from '../../../capabilities/stellar/types';
import {
  buildRequestDraftUri,
  copyRequestUri,
  loadRequestAssetChoices,
  requestAvailableForAccount,
  shareRequestUri,
  type RequestProductDependencies,
} from '../requestProductFlow';

const NETWORK: NetworkContext = Object.freeze({
  id: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
});
const address = 'GDESTINATION';
const issuer = 'GISSUER';

function account(overrides: Partial<AccountRecord> = {}): AccountRecord {
  const now = new Date('2026-09-24T00:00:00.000Z');
  return {
    id: 'account-request',
    address,
    identityKind: 'classic',
    networkId: NETWORK.id,
    label: 'Primary',
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function dependencies(state: StellarAccountState | 'inactive'): RequestProductDependencies {
  const gateway = {
    isClassicAccountAddress: (value: string) => value.startsWith('G'),
    loadAccountState: jest
      .fn()
      .mockResolvedValue(state === 'inactive' ? { status: 'inactive', address } : { status: 'active', account: state }),
  } as unknown as Pick<PaymentGatewayPort, 'isClassicAccountAddress' | 'loadAccountState'>;
  const output: RequestOutputPort = {
    copyRequestUri: jest.fn().mockResolvedValue(undefined),
    shareRequestUri: jest.fn().mockResolvedValue('shared'),
  };
  return { gateway, network: NETWORK, output };
}

function activeState(): StellarAccountState {
  return {
    address,
    subentryCount: 4,
    numSponsoring: 0,
    numSponsored: 0,
    flags: { authRequired: false, authClawbackEnabled: false },
    balances: [
      { kind: 'native', balance: '10', buyingLiabilities: '0', sellingLiabilities: '0' },
      {
        kind: 'credit',
        balance: '1',
        limit: '10',
        buyingLiabilities: '2',
        sellingLiabilities: '0',
        code: 'usd',
        issuer,
        isAuthorized: true,
        isAuthorizedToMaintainLiabilities: true,
        isClawbackEnabled: false,
      },
      {
        kind: 'credit',
        balance: '1',
        limit: '10',
        buyingLiabilities: '0',
        sellingLiabilities: '0',
        code: 'NOAUTH',
        issuer,
        isAuthorized: false,
        isAuthorizedToMaintainLiabilities: true,
        isClawbackEnabled: false,
      },
      {
        kind: 'credit',
        balance: '10',
        limit: '10',
        buyingLiabilities: '0',
        sellingLiabilities: '0',
        code: 'FULL',
        issuer,
        isAuthorized: true,
        isAuthorizedToMaintainLiabilities: true,
        isClawbackEnabled: false,
      },
      { kind: 'liquidity-pool-share', balance: '1', liquidityPoolId: 'pool' },
    ],
  };
}

describe('Request product flow', () => {
  it('allows visible Classic accounts regardless of signer ownership and rejects hidden/contract/network mismatch', () => {
    expect(requestAvailableForAccount(account(), NETWORK.id)).toBe(true);
    expect(requestAvailableForAccount(account({ hidden: true }), NETWORK.id)).toBe(false);
    expect(requestAvailableForAccount(account({ identityKind: 'contract' }), NETWORK.id)).toBe(false);
    expect(requestAvailableForAccount(account({ networkId: 'stellar-mainnet' }), NETWORK.id)).toBe(false);
  });

  it('offers only XLM for an inactive Classic account', async () => {
    await expect(loadRequestAssetChoices(dependencies('inactive'), account())).resolves.toEqual([{ kind: 'native' }]);
  });

  it('offers only authorized issued trustlines with positive remaining receive capacity', async () => {
    await expect(loadRequestAssetChoices(dependencies(activeState()), account())).resolves.toEqual([
      { kind: 'native' },
      { kind: 'credit', code: 'usd', issuer },
    ]);
  });

  it('builds one canonical URI and passes that exact string to copy/share ports', async () => {
    const deps = dependencies(activeState());
    const uri = buildRequestDraftUri(
      deps,
      account(),
      {
        asset: { kind: 'credit', code: 'usd', issuer },
        amount: '1.25',
        memo: { type: 'id', value: '7' },
        message: 'Invoice 42',
      },
      [{ kind: 'native' }, { kind: 'credit', code: 'usd', issuer }],
    );

    await copyRequestUri(deps, uri);
    await expect(shareRequestUri(deps, uri)).resolves.toBe('shared');

    expect(uri).toContain('destination=GDESTINATION');
    expect(uri).toContain('asset_code=usd');
    expect(deps.output.copyRequestUri).toHaveBeenCalledWith(uri);
    expect(deps.output.shareRequestUri).toHaveBeenCalledWith(uri);
  });

  it('fails closed when a draft asset is not in the authoritative receivable choices', () => {
    const deps = dependencies(activeState());
    expect(() =>
      buildRequestDraftUri(deps, account(), { asset: { kind: 'credit', code: 'NOAUTH', issuer } }, [
        { kind: 'native' },
        { kind: 'credit', code: 'usd', issuer },
      ]),
    ).toThrow('request-asset-not-receivable');
  });

  it('fails closed if a hidden, contract, or cross-network account reaches the feature boundary', () => {
    const deps = dependencies(activeState());
    for (const invalid of [
      account({ hidden: true }),
      account({ identityKind: 'contract' }),
      account({ networkId: 'stellar-mainnet' }),
    ]) {
      expect(() => buildRequestDraftUri(deps, invalid, { asset: { kind: 'native' } }, [{ kind: 'native' }])).toThrow();
    }
  });
});
