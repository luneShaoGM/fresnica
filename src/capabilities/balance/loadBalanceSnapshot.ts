import {APP_CONFIG} from '../../app/config/appConfig';
import type {AccountRecord} from '../account/types';
import type {StellarGateway} from '../../platform/stellar/StellarGateway';
import type {BalanceLine, BalanceSnapshot} from './types';

export type BalanceDependencies = Readonly<{
  gateway: StellarGateway;
}>;

export async function loadBalanceSnapshot(
  dependencies: BalanceDependencies,
  account: AccountRecord,
): Promise<BalanceSnapshot> {
  if (account.networkId !== APP_CONFIG.network.id) {
    throw new Error(`balance-network-mismatch:${account.networkId}`);
  }

  if (account.identityKind !== 'classic') {
    return {status: 'unsupported-account', address: account.address};
  }

  const result = await dependencies.gateway.loadAccountBalances(account.address);
  if (result.status === 'inactive') {
    return result;
  }

  const balances: BalanceLine[] = [];
  let hiddenLiquidityPoolShareCount = 0;

  for (const line of result.balances) {
    switch (line.kind) {
      case 'native':
        balances.push({
          asset: {kind: 'native', code: 'XLM'},
          balance: line.balance,
        });
        break;
      case 'credit':
        balances.push({
          asset: {kind: 'credit', code: line.code, issuer: line.issuer},
          balance: line.balance,
        });
        break;
      case 'liquidity-pool-share':
        hiddenLiquidityPoolShareCount += 1;
        break;
    }
  }

  return {
    status: 'active',
    address: result.address,
    balances,
    hiddenLiquidityPoolShareCount,
  };
}
