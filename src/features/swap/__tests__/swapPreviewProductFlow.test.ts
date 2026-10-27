import type { AccountRecord } from '../../../capabilities/account/types';
import { loadPathPaymentQuotes } from '../../../capabilities/path-payment/loadPathPaymentQuotes';
import { preparePathPayment } from '../../../capabilities/path-payment/preparePathPayment';
import type { PathPaymentQuote, PreparedPathPaymentReview } from '../../../capabilities/path-payment/types';
import {
  loadSwapPreviewAssets,
  loadSwapSourceSpendable,
  requestSwapPreviewQuotes,
  prepareSwapPreviewReview,
} from '../swapPreviewProductFlow';

jest.mock('../../../capabilities/path-payment/loadPathPaymentQuotes');
jest.mock('../../../capabilities/path-payment/preparePathPayment');

const network = Object.freeze({ id: 'stellar-testnet', networkPassphrase: 'Test SDF Network ; September 2015' });
const XLM = { kind: 'native' as const };
const USD = { kind: 'credit' as const, code: 'USDC', issuer: 'GISSUER' };
const account: AccountRecord = Object.freeze({
  id: 'a',
  address: 'GSOURCE',
  networkId: network.id,
  identityKind: 'classic',
  hidden: false,
  label: 'Main',
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});
const quote: PathPaymentQuote = Object.freeze({
  request: {
    network,
    source: account.address,
    destination: account.address,
    sourceAsset: XLM,
    destinationAsset: USD,
    mode: 'strict_send' as const,
    fixedAmount: '5.0000000',
  },
  sourceAmount: '5.0000000',
  destinationAmount: '9.0000000',
  path: [],
  quotedAtUnixMs: 100,
  quotedAtMonotonicMs: 100,
  expiresAtUnixMs: 30100,
});
const review = { quote, transactionXdrBase64: 'unsigned' } as PreparedPathPaymentReview;

function fixture() {
  const loadAccountBalances = jest.fn(async () => ({
    status: 'active' as const,
    address: account.address,
    balances: [
      { kind: 'native' as const, balance: '20.0000000' },
      { kind: 'credit' as const, code: 'USDC', issuer: 'GISSUER', balance: '9.0000000', limit: '100' },
    ],
  }));
  const loadLedgerParameters = jest.fn(async () => ({ baseFeeStroops: 100, baseReserveStroops: 5000000 }));
  const loadAccountState = jest.fn(async () => ({
    status: 'active' as const,
    account: {
      address: account.address,
      subentryCount: 2,
      numSponsoring: 1,
      numSponsored: 1,
      flags: { authRequired: false, authClawbackEnabled: false },
      balances: [
        { kind: 'native' as const, balance: '20', sellingLiabilities: '1' },
        {
          kind: 'credit' as const,
          balance: '8',
          buyingLiabilities: '0',
          sellingLiabilities: '3.125',
          code: USD.code,
          issuer: USD.issuer,
          isAuthorized: true,
          isAuthorizedToMaintainLiabilities: true,
          isClawbackEnabled: false,
        },
      ],
    },
  }));
  const deps = {
    network,
    balance: { networkId: network.id, gateway: { loadAccountBalances } },
    quotes: {
      network,
      gateway: { network, loadStrictSendPaths: jest.fn(), loadStrictReceivePaths: jest.fn() },
      isClassicAccountAddress: jest.fn(() => true),
      nowUnixMs: () => 100,
      nowMonotonicMs: () => 100,
    },
    prepare: {
      preflight: {
        network,
        gateway: { network, loadLedgerParameters, loadAccountState },
        clock: { nowUnixMs: () => 100, nowMonotonicMs: () => 100 },
      },
      transactionGateway: { network },
    },
  };
  return { deps, loadAccountBalances, loadLedgerParameters, loadAccountState };
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadPathPaymentQuotes as jest.Mock).mockResolvedValue([quote]);
  (preparePathPayment as jest.Mock).mockResolvedValue(review);
});

describe('Swap product read-only quote → prepare → exact-XDR review', () => {
  it('loads only current Classic account real balances, preserving full issuer identity', async () => {
    const { deps, loadAccountBalances } = fixture();
    const assets = await loadSwapPreviewAssets(deps as never, account, () => true);
    expect(assets).toEqual([XLM, USD]);
    expect(loadAccountBalances).toHaveBeenCalledWith(account.address);
  });

  it('blocks stale active account from revealing balances after awaited Horizon read', async () => {
    const { deps, loadAccountBalances } = fixture();
    let active = true;
    loadAccountBalances.mockImplementationOnce(async () => {
      active = false;
      return { status: 'active', address: account.address, balances: [] };
    });
    await expect(loadSwapPreviewAssets(deps as never, account, () => active)).rejects.toThrow('swap-session-stale');
  });

  it('projects the live account spendable with native fee/reserves and trustline liabilities', async () => {
    const { deps, loadAccountState, loadLedgerParameters } = fixture();
    await expect(loadSwapSourceSpendable(deps as never, account, XLM, () => true)).resolves.toBe('16.9999900');
    await expect(loadSwapSourceSpendable(deps as never, account, USD, () => true)).resolves.toBe('4.8750000');
    expect(loadAccountState).toHaveBeenCalledWith(account.address);
    expect(loadLedgerParameters).toHaveBeenCalledTimes(2);
  });

  it('rejects stale Max after a changed selection and refuses account/network mismatches', async () => {
    const { deps, loadAccountState } = fixture();
    let current = true;
    loadAccountState.mockImplementationOnce(async () => {
      current = false;
      return { status: 'inactive', address: account.address } as never;
    });
    await expect(loadSwapSourceSpendable(deps as never, account, XLM, () => current)).rejects.toThrow(
      'swap-session-stale',
    );
    await expect(
      loadSwapSourceSpendable(deps as never, { ...account, networkId: 'other' }, XLM, () => true),
    ).rejects.toThrow('swap-session-stale');
  });

  it('requests same-account strict-send quote and best path without changing user-selected fixed side', async () => {
    const { deps } = fixture();
    const result = await requestSwapPreviewQuotes(
      deps as never,
      account,
      { sourceAsset: XLM, destinationAsset: USD, mode: 'strict_send', fixedAmount: '5' },
      () => true,
    );
    expect(loadPathPaymentQuotes).toHaveBeenCalledWith(deps.quotes, {
      source: account.address,
      destination: account.address,
      network,
      sourceAsset: XLM,
      destinationAsset: USD,
      mode: 'strict_send',
      fixedAmount: '5',
    });
    expect(result.best).toBe(quote);
    expect(result.quotes).toEqual([quote]);
  });

  it('drops quote results after route blur or selection change while Horizon loads', async () => {
    const { deps } = fixture();
    let active = true;
    (loadPathPaymentQuotes as jest.Mock).mockImplementationOnce(async () => {
      active = false;
      return [quote];
    });
    await expect(
      requestSwapPreviewQuotes(
        deps as never,
        account,
        { sourceAsset: XLM, destinationAsset: USD, mode: 'strict_send', fixedAmount: '5' },
        () => active,
      ),
    ).rejects.toThrow('swap-session-stale');
  });

  it('uses live network ledger fee and explicit slippage/time window for unchanged selected quote', async () => {
    const { deps, loadLedgerParameters } = fixture();
    const result = await prepareSwapPreviewReview(deps as never, account, quote, 100, () => true);
    expect(loadLedgerParameters).toHaveBeenCalledTimes(1);
    expect(preparePathPayment).toHaveBeenCalledWith(deps.prepare, account, quote, {
      slippageBps: 100,
      feeStroops: 100,
      transactionTimeoutSeconds: 180,
    });
    expect(result).toBe(review);
  });

  it('cannot prepare after account selection changes while loading the current ledger fee', async () => {
    const { deps, loadLedgerParameters } = fixture();
    let active = true;
    loadLedgerParameters.mockImplementationOnce(async () => {
      active = false;
      return { baseFeeStroops: 100, baseReserveStroops: 5000000 };
    });
    await expect(prepareSwapPreviewReview(deps as never, account, quote, 100, () => active)).rejects.toThrow(
      'swap-session-stale',
    );
    expect(preparePathPayment).not.toHaveBeenCalled();
  });

  it('discards constructed unsigned XDR if source account selection becomes stale while SDK awaits', async () => {
    const { deps } = fixture();
    let active = true;
    (preparePathPayment as jest.Mock).mockImplementationOnce(async () => {
      active = false;
      return review;
    });
    await expect(prepareSwapPreviewReview(deps as never, account, quote, 100, () => active)).rejects.toThrow(
      'swap-session-stale',
    );
  });

  it('rejects a network-mismatched/contract source before triggering quote or prepare I/O', async () => {
    const { deps } = fixture();
    await expect(
      requestSwapPreviewQuotes(
        deps as never,
        { ...account, networkId: 'mainnet' },
        { sourceAsset: XLM, destinationAsset: USD, mode: 'strict_send', fixedAmount: '5' },
        () => true,
      ),
    ).rejects.toThrow('swap-session-stale');
    expect(loadPathPaymentQuotes).not.toHaveBeenCalled();
    await expect(
      prepareSwapPreviewReview(deps as never, { ...account, identityKind: 'contract' }, quote, 100, () => true),
    ).rejects.toThrow('swap-session-stale');
    expect(preparePathPayment).not.toHaveBeenCalled();
  });
});
