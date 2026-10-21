import type { PathPaymentQuote } from '../types';
import { preparePathPayment } from '../preparePathPayment';
import { assertPathPaymentPreflight } from '../preflightPathPayment';

jest.mock('../preflightPathPayment', () => ({ assertPathPaymentPreflight: jest.fn() }));

const now = 1_782_000_000_000;
const mono = 20_000;
const network = Object.freeze({ id: 'stellar-testnet', networkPassphrase: 'Test SDF Network ; September 2015' });
const sourceAsset = Object.freeze({ kind: 'native' as const });
const destinationAsset = Object.freeze({ kind: 'credit' as const, code: 'USDC', issuer: 'GISSUER' });
const intermediate = Object.freeze({ kind: 'credit' as const, code: 'EUR', issuer: 'GISSUER' });
const account = { address: 'GSOURCE', networkId: network.id, identityKind: 'classic' as const };
const settings = Object.freeze({ slippageBps: 100, feeStroops: 100, transactionTimeoutSeconds: 180 });
const clock = { nowUnixMs: jest.fn(() => now), nowMonotonicMs: jest.fn(() => mono + 1_000) };

function selected(mode: 'strict_send' | 'strict_receive' = 'strict_send'): PathPaymentQuote {
  return {
    request: {
      network,
      source: account.address,
      destination: 'GDESTINATION',
      sourceAsset,
      destinationAsset,
      mode,
      fixedAmount: mode === 'strict_send' ? '5.0000000' : '10.0000000',
      memo: { type: 'text', value: 'purpose' },
    },
    sourceAmount: '5.0000000',
    destinationAmount: '10.0000000',
    path: [intermediate],
    quotedAtUnixMs: now,
    expiresAtUnixMs: now + 30_000,
    quotedAtMonotonicMs: mono,
  };
}
function setup(mode: 'strict_send' | 'strict_receive' = 'strict_send') {
  const quote = selected(mode);
  const projection = {
    source: quote.request.source,
    destination: quote.request.destination,
    sourceAsset,
    destinationAsset,
    mode,
    path: [intermediate],
    memo: { type: 'text' as const, value: 'purpose' },
    fee: '100',
    minTimeUnixSeconds: 0,
    expiresAtUnixSeconds: now / 1000 + 180,
    ...(mode === 'strict_send'
      ? { sendAmount: '5.0000000', destinationMinimum: '9.9000000' }
      : { sendMaximum: '5.0500000', destinationAmount: '10.0000000' }),
  };
  const gateway = {
    network,
    buildPathPaymentStrictSend: jest
      .fn()
      .mockResolvedValue({ source: account.address, networkId: network.id, transactionXdrBase64: 'encoded' }),
    buildPathPaymentStrictReceive: jest
      .fn()
      .mockResolvedValue({ source: account.address, networkId: network.id, transactionXdrBase64: 'encoded' }),
    inspectPathPaymentTransaction: jest.fn().mockReturnValue(projection),
  };
  const preflight = {
    network,
    clock,
    gateway: {
      network,
      isClassicAccountAddress: jest.fn(() => true),
      loadAccountState: jest.fn(),
      loadLedgerParameters: jest.fn(),
    },
  };
  const deps = { preflight, transactionGateway: gateway };
  return { quote, gateway, preflight, projection, deps };
}

beforeEach(() => {
  jest.clearAllMocks();
  (assertPathPaymentPreflight as jest.Mock).mockResolvedValue(undefined);
  clock.nowUnixMs.mockReturnValue(now);
  clock.nowMonotonicMs.mockReturnValue(mono + 1_000);
});

describe('Swap-C2 preparation and exact decoded-XDR review', () => {
  it.each(['strict_send', 'strict_receive'] as const)(
    'binds selected %s quote to exact operation, memo, fee and transaction TimeBounds',
    async mode => {
      const { quote, gateway, deps } = setup(mode);
      const result = await preparePathPayment(deps, account, quote, settings);
      expect(assertPathPaymentPreflight).toHaveBeenCalledTimes(2);
      expect(assertPathPaymentPreflight).toHaveBeenNthCalledWith(1, deps.preflight, account, quote, 100, 100);
      expect(assertPathPaymentPreflight).toHaveBeenNthCalledWith(2, deps.preflight, account, quote, 100, 100);
      const operation =
        mode === 'strict_send' ? gateway.buildPathPaymentStrictSend : gateway.buildPathPaymentStrictReceive;
      expect(operation).toHaveBeenCalledWith({
        source: account.address,
        destination: quote.request.destination,
        sendAsset: sourceAsset,
        destinationAsset,
        path: [intermediate],
        baseFee: '100',
        memo: { type: 'text', value: 'purpose' },
        expiresAtUnixSeconds: now / 1000 + 180,
        ...(mode === 'strict_send'
          ? { sendAmount: '5.0000000', destinationMinimum: '9.9000000' }
          : { sendMaximum: '5.0500000', destinationAmount: '10.0000000' }),
      });
      expect(gateway.inspectPathPaymentTransaction).toHaveBeenCalledWith({
        transactionXdrBase64: 'encoded',
        networkPassphrase: network.networkPassphrase,
      });
      expect(result.transactionXdrBase64).toBe('encoded');
      expect(result.quote).toBe(quote);
      expect(result.fee).toBe('100');
      expect(result.slippageBps).toBe(100);
      expect(result.mode).toBe(mode);
      expect(result.expiresAtUnixSeconds).toBe(now / 1000 + 180);
      expect(Object.isFrozen(result)).toBe(true);
      expect(gateway.buildPathPaymentStrictSend).toHaveBeenCalledTimes(mode === 'strict_send' ? 1 : 0);
      expect(gateway.buildPathPaymentStrictReceive).toHaveBeenCalledTimes(mode === 'strict_receive' ? 1 : 0);
    },
  );

  it.each([
    ['different source', { source: 'GOTHER' }],
    ['different destination', { destination: 'GOTHER' }],
    ['different asset', { destinationAsset: { kind: 'native' } }],
    ['different path', { path: [] }],
    ['different memo', { memo: { type: 'text', value: 'altered' } }],
    ['different fee', { fee: '101' }],
    ['missing transaction expiry', { expiresAtUnixSeconds: undefined }],
    ['wrong expiry', { expiresAtUnixSeconds: now / 1000 + 100 }],
    ['nonzero min-time', { minTimeUnixSeconds: 1 }],
    ['wrong operation mode', { mode: 'strict_receive' }],
    ['wrong source amount', { sendAmount: '4.0000000' }],
    ['weakened slippage', { destinationMinimum: '9.8000000' }],
  ] as const)('rejects decoded-XDR drift: %s', async (_name, drift) => {
    const { deps, gateway, projection } = setup();
    gateway.inspectPathPaymentTransaction.mockReturnValue({ ...projection, ...drift });
    await expect(preparePathPayment(deps, account, selected(), settings)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
  });

  it('rejects wrong build output network and source without trusting declared result', async () => {
    const { deps, gateway } = setup();
    gateway.buildPathPaymentStrictSend.mockResolvedValue({
      source: 'GOTHER',
      networkId: network.id,
      transactionXdrBase64: 'encoded',
    });
    await expect(preparePathPayment(deps, account, selected(), settings)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
    gateway.buildPathPaymentStrictSend.mockResolvedValue({
      source: account.address,
      networkId: 'other',
      transactionXdrBase64: 'encoded',
    });
    await expect(preparePathPayment(deps, account, selected(), settings)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
  });

  it('preflight rejection means zero builder calls and no prepared review', async () => {
    const { deps, gateway } = setup();
    (assertPathPaymentPreflight as jest.Mock).mockRejectedValueOnce(new Error('insufficient_source'));
    await expect(preparePathPayment(deps, account, selected(), settings)).rejects.toThrow('insufficient_source');
    expect(gateway.buildPathPaymentStrictSend).not.toHaveBeenCalled();
  });

  it('re-checks ledger after awaited builder and refuses a quote that expires while building', async () => {
    const { deps, gateway } = setup();
    (assertPathPaymentPreflight as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('quote_expired'));
    await expect(preparePathPayment(deps, account, selected(), settings)).rejects.toThrow('quote_expired');
    expect(gateway.buildPathPaymentStrictSend).toHaveBeenCalledTimes(1);
    expect(gateway.inspectPathPaymentTransaction).not.toHaveBeenCalled();
  });

  it('rejects a network rebind that occurs during the builder wait', async () => {
    const { deps, gateway } = setup();
    gateway.buildPathPaymentStrictSend.mockImplementation(async () => {
      Object.defineProperty(gateway, 'network', { value: { ...network, id: 'other' }, configurable: true });
      return { source: account.address, networkId: network.id, transactionXdrBase64: 'encoded' };
    });
    await expect(preparePathPayment(deps, account, selected(), settings)).rejects.toThrow('invalid_request');
  });

  it.each([
    { feeStroops: 0 },
    { feeStroops: Number.NaN },
    { transactionTimeoutSeconds: 0 },
    { transactionTimeoutSeconds: 7200 },
  ])('rejects invalid fee/timeout options before ledger I/O: %p', async changes => {
    const { deps, gateway } = setup();
    await expect(preparePathPayment(deps, account, selected(), { ...settings, ...changes })).rejects.toThrow(
      'invalid_request',
    );
    expect(assertPathPaymentPreflight).not.toHaveBeenCalled();
    expect(gateway.buildPathPaymentStrictSend).not.toHaveBeenCalled();
  });

  it('rejects invalid intermediate assets, endpoint repetition, or more than five hops before any I/O', async () => {
    const { deps, gateway } = setup();
    const cases = [
      { ...selected(), path: [sourceAsset] },
      { ...selected(), path: [destinationAsset] },
      { ...selected(), path: Array(6).fill(intermediate) },
      { ...selected(), path: [{ kind: 'credit' as const, code: 'TOO-LONG-ASSET', issuer: 'GISSUER' }] },
    ];
    for (const candidate of cases) {
      await expect(preparePathPayment(deps, account, candidate, settings)).rejects.toThrow('invalid_request');
    }
    expect(assertPathPaymentPreflight).not.toHaveBeenCalled();
    expect(gateway.buildPathPaymentStrictSend).not.toHaveBeenCalled();
  });

  it('rejects options being changed while the SDK builder awaits Horizon', async () => {
    const { deps, gateway } = setup();
    const mutable: { feeStroops: number; slippageBps: number; transactionTimeoutSeconds: number } = { ...settings };
    gateway.buildPathPaymentStrictSend.mockImplementation(async () => {
      mutable.feeStroops = 150;
      return { source: account.address, networkId: network.id, transactionXdrBase64: 'encoded' };
    });
    await expect(preparePathPayment(deps, account, selected(), mutable)).rejects.toThrow('invalid_request');
    expect(gateway.inspectPathPaymentTransaction).not.toHaveBeenCalled();
  });

  it('rejects the selected route changing while the builder awaits Horizon', async () => {
    const { deps, gateway } = setup();
    const candidate = { ...selected(), path: [{ kind: 'credit' as const, code: 'EUR', issuer: 'GISSUER' }] };
    gateway.buildPathPaymentStrictSend.mockImplementation(async () => {
      (candidate.path as unknown as Array<{ code: string }>)[0].code = 'MUTATED';
      return { source: account.address, networkId: network.id, transactionXdrBase64: 'encoded' };
    });
    await expect(preparePathPayment(deps, account, candidate, settings)).rejects.toThrow('invalid_request');
    expect(gateway.inspectPathPaymentTransaction).not.toHaveBeenCalled();
  });

  it('rejects an expired quote at the final projection gate even after successful ledger checks', async () => {
    const { deps, gateway } = setup();
    gateway.inspectPathPaymentTransaction.mockImplementation(() => {
      clock.nowMonotonicMs.mockReturnValue(mono + 30_000);
      return setup().projection;
    });
    await expect(preparePathPayment(deps, account, selected(), settings)).rejects.toThrow('quote_expired');
  });

  it('rejects signature/operation inspection errors instead of creating a review', async () => {
    const { deps, gateway } = setup();
    gateway.inspectPathPaymentTransaction.mockImplementation(() => {
      throw new Error('invalid path operation');
    });
    await expect(preparePathPayment(deps, account, selected(), settings)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
  });
});
