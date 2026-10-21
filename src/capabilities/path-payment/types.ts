import type { NetworkContext } from '../network/types';
import type { BuiltTransaction } from '../stellar/types';
import type {
  StellarAccountStateResult,
  StellarLedgerParameters,
  StellarPaymentAsset,
  StellarPaymentMemo,
} from '../stellar/types';

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
  quotedAtMonotonicMs: number;
}>;

export type PathPaymentQuoteClock = Readonly<{
  nowUnixMs: () => number;
  nowMonotonicMs: () => number;
}>;

export type PathPaymentQuoteProtection =
  | Readonly<{
      mode: 'strict_send';
      quote: PathPaymentQuote;
      slippageBps: number;
      destinationMinimum: string;
    }>
  | Readonly<{
      mode: 'strict_receive';
      quote: PathPaymentQuote;
      slippageBps: number;
      sourceMaximum: string;
    }>;

export interface PathPaymentPreflightGatewayPort {
  readonly network: NetworkContext;
  isClassicAccountAddress(address: string): boolean;
  loadAccountState(address: string): Promise<StellarAccountStateResult>;
  loadLedgerParameters(): Promise<StellarLedgerParameters>;
}

export type PathPaymentPreflightDependencies = Readonly<{
  gateway: PathPaymentPreflightGatewayPort;
  network: NetworkContext;
  clock: PathPaymentQuoteClock;
}>;

// The SDK adapter is a separate, unsigned build/inspect port. It does NOT
// expose signing or submission methods to the Capability.
export type PathPaymentBuildStrictSendInput = Readonly<{
  source: string;
  destination: string;
  sendAsset: StellarPaymentAsset;
  sendAmount: string;
  destinationAsset: StellarPaymentAsset;
  destinationMinimum: string;
  path: readonly StellarPaymentAsset[];
  memo?: StellarPaymentMemo;
  baseFee: string;
  expiresAtUnixSeconds: number;
}>;

export type PathPaymentBuildStrictReceiveInput = Readonly<{
  source: string;
  destination: string;
  sendAsset: StellarPaymentAsset;
  sendMaximum: string;
  destinationAsset: StellarPaymentAsset;
  destinationAmount: string;
  path: readonly StellarPaymentAsset[];
  memo?: StellarPaymentMemo;
  baseFee: string;
  expiresAtUnixSeconds: number;
}>;

export type PathPaymentTransactionProjection = Readonly<
  {
    source: string;
    destination: string;
    sourceAsset: StellarPaymentAsset;
    destinationAsset: StellarPaymentAsset;
    path: readonly StellarPaymentAsset[];
    memo?: StellarPaymentMemo;
    fee: string;
    minTimeUnixSeconds: number;
    expiresAtUnixSeconds: number;
  } & (
    | Readonly<{ mode: 'strict_send'; sendAmount: string; destinationMinimum: string }>
    | Readonly<{ mode: 'strict_receive'; sendMaximum: string; destinationAmount: string }>
  )
>;

export interface PathPaymentTransactionGatewayPort {
  readonly network: NetworkContext;
  buildPathPaymentStrictSend(input: PathPaymentBuildStrictSendInput): Promise<BuiltTransaction>;
  buildPathPaymentStrictReceive(input: PathPaymentBuildStrictReceiveInput): Promise<BuiltTransaction>;
  inspectPathPaymentTransaction(
    input: Readonly<{
      transactionXdrBase64: string;
      networkPassphrase: string;
    }>,
  ): PathPaymentTransactionProjection;
}

export type PreparePathPaymentDependencies = Readonly<{
  preflight: PathPaymentPreflightDependencies;
  transactionGateway: PathPaymentTransactionGatewayPort;
}>;

export type PathPaymentPrepareOptions = Readonly<{
  slippageBps: number;
  feeStroops: number;
  transactionTimeoutSeconds: number;
}>;

export type PreparedPathPaymentReview = Readonly<
  {
    transactionXdrBase64: string;
    networkId: string;
    source: string;
    destination: string;
    sourceAsset: StellarPaymentAsset;
    destinationAsset: StellarPaymentAsset;
    path: readonly StellarPaymentAsset[];
    quote: PathPaymentQuote;
    memo?: StellarPaymentMemo;
    quotedSourceAmount: string;
    quotedDestinationAmount: string;
    slippageBps: number;
    fee: string;
    expiresAtUnixSeconds: number;
  } & (
    | Readonly<{ mode: 'strict_send'; sendAmount: string; destinationMinimum: string }>
    | Readonly<{ mode: 'strict_receive'; destinationAmount: string; sourceMaximum: string }>
  )
>;

export type LoadPathPaymentQuotesDependencies = Readonly<{
  gateway: PathPaymentQuoteGatewayPort;
  network: NetworkContext;
  isClassicAccountAddress: (address: string) => boolean;
  nowUnixMs: () => number;
  nowMonotonicMs: () => number;
}>;
