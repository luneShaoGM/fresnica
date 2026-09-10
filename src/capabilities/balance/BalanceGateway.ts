import type { StellarAccountBalanceResult } from '../stellar/types';

export interface BalanceGatewayPort {
  loadAccountBalances(address: string): Promise<StellarAccountBalanceResult>;
}
