import { useEffect, useState } from 'react';
import type { AccountRecord } from '@capabilities/account/types';
import { loadBalanceSnapshot } from '@capabilities/balance/loadBalanceSnapshot';
import type { BalanceAsset } from '@capabilities/balance/types';
import { SendFlowScreen } from '../SendFlowScreen';
import type { SendProductDependencies } from '../sendProductFlow';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useEffect: jest.fn(),
  useState: jest.fn(),
  useRef: (value: unknown) => ({ current: value }),
  useCallback: (fn: unknown) => fn,
}));
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
jest.mock('@capabilities/balance/loadBalanceSnapshot', () => ({ loadBalanceSnapshot: jest.fn() }));
const load = jest.mocked(loadBalanceSnapshot);
const account = { id: 'a', address: 'GA', networkId: 'stellar-testnet', identityKind: 'classic' } as AccountRecord;
const dependencies = {
  gateway: {},
  network: { id: account.networkId },
  repository: {},
} as unknown as SendProductDependencies;
const usd = { kind: 'credit', code: 'usd', issuer: 'GISSUER' } as const;
const native = { kind: 'native', code: 'XLM' } as const;
async function prepare(initialAsset: BalanceAsset) {
  const setters: jest.Mock[] = [];
  jest.mocked(useState).mockImplementation((initial?: unknown) => {
    const setter = jest.fn();
    setters.push(setter);
    return [initial, setter] as ReturnType<typeof useState>;
  });
  jest.mocked(useEffect).mockClear();
  load.mockResolvedValue({
    status: 'active',
    address: account.address,
    balances: [
      { asset: native, balance: '1' },
      { asset: usd, balance: '2' },
    ],
    hiddenLiquidityPoolShareCount: 0,
  });
  SendFlowScreen({ account, dependencies, initialAsset, onDone: jest.fn() });
  jest.mocked(useEffect).mock.calls[0][0]();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  return setters;
}
describe('Send asset-sheet preselection', () => {
  it('uses the exact code/issuer instead of the first balance', async () => {
    const setters = await prepare(usd);
    expect(setters[2]).toHaveBeenLastCalledWith(usd);
    expect(setters[0]).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'ready' }));
  });
  it.each([
    { ...usd, code: 'USD' },
    { ...usd, issuer: 'GOTHER' },
  ])('blocks a missing identity rather than changing the intended asset', async asset => {
    const setters = await prepare(asset);
    expect(setters[2]).toHaveBeenCalledTimes(1);
    expect(setters[2]).toHaveBeenCalledWith(undefined);
    expect(setters[0]).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'blocked' }));
  });
});
