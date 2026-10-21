import type { AccountRecord } from '../../account/types';
import type { StellarAccountState, StellarPaymentAsset, StellarTrustlineBalance } from '../../stellar/types';
import { assertPathPaymentPreflight } from '../preflightPathPayment';
import type { PathPaymentPreflightGatewayPort, PathPaymentQuote, PathPaymentQuoteRequest } from '../types';

const NETWORK = Object.freeze({ id: 'stellar-testnet', networkPassphrase: 'Test SDF Network ; September 2015' });
const SOURCE = 'GSOURCE';
const DEST = 'GDESTINATION';
const ISSUER = 'GISSUER';
const NATIVE: StellarPaymentAsset = Object.freeze({ kind: 'native' });
const CREDIT: StellarPaymentAsset = Object.freeze({ kind: 'credit', code: 'USD', issuer: ISSUER });
const NOW = 1_782_000_000_000;
const MONO = 20_000;

function localAccount(address = SOURCE, overrides: Partial<AccountRecord> = {}): AccountRecord {
  return {
    id: 'wallet',
    address,
    networkId: NETWORK.id,
    identityKind: 'classic',
    label: 'Wallet',
    sortOrder: 0,
    hidden: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}
function trustline(asset = CREDIT, overrides: Partial<StellarTrustlineBalance> = {}): StellarTrustlineBalance {
  if (asset.kind !== 'credit') throw new Error('credit required');
  return {
    kind: 'credit',
    code: asset.code,
    issuer: asset.issuer,
    balance: '20.0000000',
    limit: '100.0000000',
    buyingLiabilities: '2',
    sellingLiabilities: '1',
    isAuthorized: true,
    isAuthorizedToMaintainLiabilities: false,
    isClawbackEnabled: false,
    ...overrides,
  };
}
function active(
  address: string,
  options: {
    native?: string;
    nativeSelling?: string;
    nativeBuying?: string;
    credit?: StellarTrustlineBalance | null;
    memoRequired?: boolean;
    subentries?: number;
    numSponsoring?: number;
    numSponsored?: number;
  } = {},
): StellarAccountState {
  return {
    address,
    subentryCount: options.subentries ?? (options.credit ? 1 : 0),
    numSponsoring: options.numSponsoring ?? 0,
    numSponsored: options.numSponsored ?? 0,
    memoRequired: options.memoRequired ?? false,
    flags: { authRequired: false, authClawbackEnabled: false },
    balances: [
      {
        kind: 'native',
        balance: options.native ?? '30',
        sellingLiabilities: options.nativeSelling ?? '2',
        buyingLiabilities: options.nativeBuying ?? '1',
      },
      ...(options.credit ? [options.credit] : []),
    ],
  };
}
function quote(
  overrides: Partial<PathPaymentQuote> = {},
  requestOverrides: Partial<PathPaymentQuoteRequest> = {},
): PathPaymentQuote {
  return Object.freeze({
    request: Object.freeze({
      network: NETWORK,
      source: SOURCE,
      destination: DEST,
      sourceAsset: NATIVE,
      destinationAsset: CREDIT,
      mode: 'strict_send' as const,
      fixedAmount: '5.0000000',
      ...requestOverrides,
    }),
    sourceAmount: '5.0000000',
    destinationAmount: '10.0000000',
    path: Object.freeze([]),
    quotedAtUnixMs: NOW,
    expiresAtUnixMs: NOW + 30_000,
    quotedAtMonotonicMs: MONO,
    ...overrides,
  });
}
type Dependencies = Parameters<typeof assertPathPaymentPreflight>[0];
function fixture(
  options: {
    source?: StellarAccountState | null;
    destination?: StellarAccountState | null;
    issuer?: StellarAccountState | null;
    reserve?: number;
    fee?: number;
  } = {},
) {
  const source = options.source === undefined ? active(SOURCE) : options.source;
  const destination = options.destination === undefined ? active(DEST, { credit: trustline() }) : options.destination;
  const issuer = options.issuer === undefined ? active(ISSUER) : options.issuer;
  const records: Record<string, StellarAccountState | null> = {
    [SOURCE]: source,
    [DEST]: destination,
    [ISSUER]: issuer,
  };
  const gateway: jest.Mocked<PathPaymentPreflightGatewayPort> = {
    network: NETWORK,
    isClassicAccountAddress: jest.fn(value => value.startsWith('G') && value.length > 2),
    loadAccountState: jest.fn(async address => {
      const item = records[address];
      return item ? { status: 'active' as const, account: item } : { status: 'inactive' as const, address };
    }),
    loadLedgerParameters: jest.fn().mockResolvedValue({
      baseReserveStroops: options.reserve ?? 5_000_000,
      baseFeeStroops: options.fee ?? 100,
    }),
  };
  const clock = { nowUnixMs: jest.fn(() => NOW + 1_000), nowMonotonicMs: jest.fn(() => MONO + 1_000) };
  const dependencies: Dependencies = { network: NETWORK, gateway, clock };
  return { gateway, clock, dependencies, records };
}

describe('Swap-C1 account/ledger preflight, no executable transaction', () => {
  it('permits strict-send with valid source balance, authorized destination trustline and active issuer', async () => {
    const { dependencies, gateway } = fixture();
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), quote(), 100)).resolves.toBeUndefined();
    expect(gateway.loadAccountState.mock.calls.map(([address]) => address)).toEqual([SOURCE, DEST, ISSUER]);
    expect(gateway.loadLedgerParameters).toHaveBeenCalledTimes(1);
    expect(gateway).not.toHaveProperty('buildPayment');
    expect(gateway).not.toHaveProperty('buildPathPaymentStrictSend');
  });

  it('strict-receive checks the worst-case sourceMaximum, not the quote source amount', async () => {
    const sourceAsset: StellarPaymentAsset = { kind: 'credit', code: 'USD', issuer: ISSUER };
    const dest = active(DEST);
    const q = quote(
      { sourceAmount: '6.0000000' },
      {
        sourceAsset,
        destinationAsset: NATIVE,
        mode: 'strict_receive',
        fixedAmount: '10.0000000',
      },
    );
    const enough = fixture({
      source: active(SOURCE, { credit: trustline(sourceAsset, { balance: '8', sellingLiabilities: '1' }) }),
      destination: dest,
    });
    await expect(assertPathPaymentPreflight(enough.dependencies, localAccount(), q, 1000)).resolves.toBeUndefined();
    const short = fixture({
      source: active(SOURCE, { credit: trustline(sourceAsset, { balance: '7.5', sellingLiabilities: '1' }) }),
      destination: dest,
    });
    await expect(assertPathPaymentPreflight(short.dependencies, localAccount(), q, 1000)).rejects.toThrow(
      'insufficient_source',
    );
  });

  it('checks selling liabilities and reserve plus fee before spending native source', async () => {
    const { dependencies } = fixture({ source: active(SOURCE, { native: '6', nativeSelling: '0', subentries: 0 }) });
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), quote(), 100)).rejects.toThrow(
      'insufficient_source',
    );
  });

  it('requires fee capacity even for an issued-asset source', async () => {
    const q = quote(
      { sourceAmount: '5' },
      {
        sourceAsset: CREDIT,
        destinationAsset: NATIVE,
        fixedAmount: '5',
      },
    );
    const { dependencies } = fixture({
      source: active(SOURCE, { native: '1', nativeSelling: '0', credit: trustline(CREDIT, { balance: '10' }) }),
      destination: active(DEST),
    });
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), q, 0)).rejects.toThrow('insufficient_source');
  });

  it('rejects missing or unauthorized issued source trustline', async () => {
    const q = quote({}, { sourceAsset: CREDIT, destinationAsset: NATIVE });
    const missing = fixture({ source: active(SOURCE), destination: active(DEST) });
    await expect(assertPathPaymentPreflight(missing.dependencies, localAccount(), q, 0)).rejects.toThrow(
      'insufficient_source',
    );
    const unauthorized = fixture({
      source: active(SOURCE, {
        credit: trustline(CREDIT, { isAuthorized: false, isAuthorizedToMaintainLiabilities: true }),
      }),
      destination: active(DEST),
    });
    await expect(assertPathPaymentPreflight(unauthorized.dependencies, localAccount(), q, 0)).rejects.toThrow(
      'not_authorized',
    );
  });

  it('rejects missing, unauthorized or full destination trustline including buying liabilities', async () => {
    const missing = fixture({ destination: active(DEST) });
    await expect(assertPathPaymentPreflight(missing.dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'destination_no_trust',
    );
    const unauthorized = fixture({ destination: active(DEST, { credit: trustline(CREDIT, { isAuthorized: false }) }) });
    await expect(assertPathPaymentPreflight(unauthorized.dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'not_authorized',
    );
    const full = fixture({
      destination: active(DEST, { credit: trustline(CREDIT, { balance: '88', limit: '100', buyingLiabilities: '3' }) }),
    });
    await expect(assertPathPaymentPreflight(full.dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'line_full',
    );
  });

  it('rejects a missing destination account; never falls back to CreateAccount', async () => {
    const { dependencies } = fixture({ destination: null });
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'destination_missing',
    );
  });

  it('requires the referenced issued asset issuer to exist', async () => {
    const { dependencies } = fixture({ issuer: null });
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'issuer_missing',
    );
  });

  it('allows issuer-side source and issuer-side destination without a trustline', async () => {
    const issuerSourceQuote = quote(
      { sourceAmount: '5' },
      {
        source: ISSUER,
        sourceAsset: CREDIT,
        destinationAsset: NATIVE,
      },
    );
    const issuerSource = fixture({ destination: active(DEST) });
    await expect(
      assertPathPaymentPreflight(issuerSource.dependencies, localAccount(ISSUER), issuerSourceQuote, 0),
    ).resolves.toBeUndefined();

    const issuerDestQuote = quote(
      { destinationAmount: '10' },
      {
        destination: ISSUER,
        destinationAsset: { kind: 'credit', code: 'USD', issuer: ISSUER },
      },
    );
    const issuerDest = fixture({ destination: active(DEST) });
    await expect(
      assertPathPaymentPreflight(issuerDest.dependencies, localAccount(), issuerDestQuote, 0),
    ).resolves.toBeUndefined();
  });

  it('permits same-account Swap without SEP-29 cross-account memo requirement', async () => {
    const source = active(SOURCE, { credit: trustline(), memoRequired: true });
    const { dependencies, gateway } = fixture({ source });
    await expect(
      assertPathPaymentPreflight(dependencies, localAccount(), quote({}, { destination: SOURCE }), 0),
    ).resolves.toBeUndefined();
    expect(gateway.loadAccountState.mock.calls.filter(([id]) => id === SOURCE)).toHaveLength(1);
  });

  it('requires a memo for a cross-account destination with memoRequired', async () => {
    const { dependencies } = fixture({ destination: active(DEST, { credit: trustline(), memoRequired: true }) });
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'invalid_request',
    );
    const withMemo = quote({}, { memo: { type: 'text', value: 'purpose' } });
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), withMemo, 0)).resolves.toBeUndefined();
  });

  it('rejects native destination capacity overflow including buying liabilities', async () => {
    const q = quote({}, { sourceAsset: CREDIT, destinationAsset: NATIVE });
    const { dependencies } = fixture({
      source: active(SOURCE, { credit: trustline(CREDIT, { balance: '100' }) }),
      destination: active(DEST, { native: '922337203685.4775807', nativeBuying: '1' }),
    });
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), q, 0)).rejects.toThrow('line_full');
  });

  it.each([
    [{ identityKind: 'contract' as const }, {}, 'invalid_request'],
    [{ networkId: 'stellar-mainnet' }, {}, 'invalid_request'],
    [{ address: 'GOTHER' }, {}, 'invalid_request'],
    [{}, { network: { id: NETWORK.id, networkPassphrase: 'WRONG' } }, 'invalid_request'],
  ])('rejects mismatched wallet or network before ledger I/O', async (accountOverrides, quoteOverrides, error) => {
    const { dependencies, gateway } = fixture();
    await expect(
      assertPathPaymentPreflight(dependencies, localAccount(SOURCE, accountOverrides), quote({}, quoteOverrides), 0),
    ).rejects.toThrow(error);
    expect(gateway.loadAccountState).not.toHaveBeenCalled();
  });

  it('rejects unexpected source/destination account returned by Horizon', async () => {
    const { dependencies, gateway, records } = fixture();
    records[SOURCE] = active('GWRONG');
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'invalid_request',
    );
    records[SOURCE] = active(SOURCE);
    records[DEST] = active('GWRONG', { credit: trustline() });
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'invalid_request',
    );
    expect(gateway.loadLedgerParameters).not.toHaveBeenCalled();
  });

  it('fails closed when gateway network changes while awaiting a ledger read', async () => {
    const { dependencies, gateway } = fixture();
    gateway.loadAccountState.mockImplementationOnce(async () => {
      Object.defineProperty(gateway, 'network', { configurable: true, value: { ...NETWORK, id: 'stellar-mainnet' } });
      return { status: 'active', account: active(SOURCE) };
    });
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'invalid_request',
    );
  });

  it('re-checks quote lifetime after ledger reads, not only at entry', async () => {
    const { dependencies, gateway, clock } = fixture();
    gateway.loadLedgerParameters.mockImplementation(async () => {
      clock.nowMonotonicMs.mockReturnValue(MONO + 30_000);
      return { baseFeeStroops: 100, baseReserveStroops: 5_000_000 };
    });
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), quote(), 0)).rejects.toThrow('quote_expired');
  });

  it('rejects malformed ledger fee/reserve instead of treating it as an executable intent', async () => {
    const { dependencies } = fixture({ reserve: Number.NaN, fee: -1 });
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'quote_unavailable',
    );
  });

  it('rejects inactive source account and misbound external issuer identity', async () => {
    const inactive = fixture({ source: null });
    await expect(assertPathPaymentPreflight(inactive.dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'insufficient_source',
    );

    const { dependencies, records } = fixture();
    records[ISSUER] = active('GOTHER');
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'invalid_request',
    );
  });

  it('rejects missing credit capacity limit and missing full authorization', async () => {
    const missingLimit = fixture({
      destination: active(DEST, { credit: trustline(CREDIT, { limit: undefined }) }),
    });
    await expect(assertPathPaymentPreflight(missingLimit.dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'destination_no_trust',
    );
    const unauthorized = fixture({
      destination: active(DEST, {
        credit: trustline(CREDIT, {
          isAuthorized: false,
          isAuthorizedToMaintainLiabilities: true,
        }),
      }),
    });
    await expect(assertPathPaymentPreflight(unauthorized.dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'not_authorized',
    );
  });

  it('allows exact destination credit capacity after buying liabilities, denies 1 stroop above', async () => {
    const atCapacity = fixture({
      destination: active(DEST, {
        credit: trustline(CREDIT, {
          balance: '88',
          buyingLiabilities: '2',
          limit: '100',
        }),
      }),
    });
    await expect(
      assertPathPaymentPreflight(atCapacity.dependencies, localAccount(), quote(), 0),
    ).resolves.toBeUndefined();
    const oneAbove = fixture({
      destination: active(DEST, {
        credit: trustline(CREDIT, {
          balance: '88.0000001',
          buyingLiabilities: '2',
          limit: '100',
        }),
      }),
    });
    await expect(assertPathPaymentPreflight(oneAbove.dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'line_full',
    );
  });

  it('does not permit empty Memo to satisfy SEP-29 requirement', async () => {
    const { dependencies } = fixture({
      destination: active(DEST, {
        credit: trustline(),
        memoRequired: true,
      }),
    });
    await expect(
      assertPathPaymentPreflight(dependencies, localAccount(), quote({}, { memo: { type: 'text', value: '' } }), 0),
    ).rejects.toThrow('invalid_request');
  });

  it('fails closed on malformed sponsorship counts and an invalid issued asset issuer', async () => {
    const { dependencies } = fixture({ source: active(SOURCE, { numSponsored: -1 }) });
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'quote_unavailable',
    );
    const other = fixture();
    await expect(
      assertPathPaymentPreflight(
        other.dependencies,
        localAccount(),
        quote({}, { destinationAsset: { kind: 'credit', code: 'USD', issuer: 'MISSUER' } }),
        0,
      ),
    ).rejects.toThrow('invalid_request');
  });

  it('rejects a forged same-asset quote before any Horizon I/O', async () => {
    const { dependencies, gateway } = fixture();
    await expect(
      assertPathPaymentPreflight(dependencies, localAccount(), quote({}, { destinationAsset: NATIVE }), 0),
    ).rejects.toThrow('invalid_request');
    expect(gateway.loadAccountState).not.toHaveBeenCalled();
  });

  it('rejects malformed untrusted balance collections with stable error', async () => {
    const { dependencies, records } = fixture();
    records[SOURCE] = { ...active(SOURCE), balances: [null] as unknown as StellarAccountState['balances'] };
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'quote_unavailable',
    );
  });

  it('rejects an already expired quote before querying Horizon', async () => {
    const { dependencies, clock, gateway } = fixture();
    clock.nowMonotonicMs.mockReturnValue(MONO + 30_000);
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), quote(), 0)).rejects.toThrow('quote_expired');
    expect(gateway.loadAccountState).not.toHaveBeenCalled();
  });

  it('maps unexpected Horizon I/O failure to a stable error without leaking raw provider details', async () => {
    const { dependencies, gateway } = fixture();
    gateway.loadAccountState.mockRejectedValue(new Error('sensitive-horizon-url'));
    await expect(assertPathPaymentPreflight(dependencies, localAccount(), quote(), 0)).rejects.toThrow(
      'quote_unavailable',
    );
  });
});
