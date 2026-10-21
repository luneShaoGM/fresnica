import type { NetworkContext } from '../network/types';
import type { StellarPaymentAsset, StellarPaymentMemo } from '../stellar/types';

export type PathPaymentMode = 'strict_send' | 'strict_receive';

export type PathPaymentQuoteRequest = Readonly<{
  network: NetworkContext;
  source: string;
  destination: string;
  sourceAsset: StellarPaymentAsset;
  destinationAsset: StellarPaymentAsset;
  mode: PathPaymentMode;
  fixedAmount: string;
  memo?: StellarPaymentMemo;
}>;

export type PathPaymentRoute = Readonly<{
  sourceAmount: string;
  destinationAmount: string;
  sourceAsset: StellarPaymentAsset;
  destinationAsset: StellarPaymentAsset;
  path: readonly StellarPaymentAsset[];
}>;

export interface PathPaymentQuoteGatewayPort {
  readonly network: NetworkContext;
  loadStrictSendPaths(
    input: Readonly<{
      sourceAsset: StellarPaymentAsset;
      sourceAmount: string;
      destinationAssets: readonly StellarPaymentAsset[];
    }>,
  ): Promise<readonly PathPaymentRoute[]>;
  loadStrictReceivePaths(
    input: Readonly<{
      sourceAssets: readonly StellarPaymentAsset[];
      destinationAsset: StellarPaymentAsset;
      destinationAmount: string;
    }>,
  ): Promise<readonly PathPaymentRoute[]>;
}

export type PathPaymentQuote = Readonly<{
  request: PathPaymentQuoteRequest;
  sourceAmount: string;
  destinationAmount: string;
  path: readonly StellarPaymentAsset[];
  quotedAtUnixMs: number;
  expiresAtUnixMs: number;
}>;

export type LoadPathPaymentQuotesDependencies = Readonly<{
  gateway: PathPaymentQuoteGatewayPort;
  network: NetworkContext;
  isClassicAccountAddress: (address: string) => boolean;
  nowUnixMs: () => number;
}>;
