import type { AccountSignerRepository } from '../account/AccountSignerRepository';
import type { NetworkContext } from '../network/types';
import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';
import type { StellarAccountStateResult, StellarLedgerParameters, StellarPaymentAsset } from '../stellar/types';
import type { TransactionGatewayPort } from '../transaction/TransactionGateway';
import type { ReviewedTransaction } from '../transaction/ReviewedTransaction';
import type { PendingSubmissionDependencies } from '../transaction/pendingSubmission';

export type Asset = StellarPaymentAsset;
export type Price = Readonly<{ n: number; d: number }>;
export type Offer = Readonly<{
  id: string;
  seller: string;
  selling: Asset;
  buying: Asset;
  amount: string;
  price: Price;
}>;
export type Pool = Readonly<{
  id: string;
  assetA: Asset;
  assetB: Asset;
  reserveA: string;
  reserveB: string;
  totalShares: string;
  protocolFee: number;
  ledger?: number;
}>;
export type OfferOperation = Readonly<{
  type: 'buy' | 'sell';
  selling: Asset;
  buying: Asset;
  amount: string;
  price: Price;
  offerId: string;
}>;
export type ExitOperation = Readonly<{
  type: 'exit';
  pool: Pool;
  shares: string;
  minA: string;
  minB: string;
  close: boolean;
}>;
export type MarketOperation = OfferOperation | ExitOperation;
export type EncodedMarketOperation =
  | OfferOperation
  | Readonly<{
      type: 'exit';
      poolId: string;
      shares: string;
      minA: string;
      minB: string;
      close: boolean;
      cleanup?: Readonly<{ assetA: Asset; assetB: Asset; protocolFee: number }>;
    }>;
export type MarketProjection = Readonly<{
  source: string;
  fee: string;
  expiresAtUnixSeconds: number;
  operation: EncodedMarketOperation;
}>;
export interface MarketGateway extends TransactionGatewayPort {
  readonly network: NetworkContext;
  loadAccountState(address: string): Promise<StellarAccountStateResult>;
  loadLedgerParameters(): Promise<StellarLedgerParameters>;
  loadPool(id: string): Promise<Pool>;
  listOffers(address: string): Promise<readonly Offer[]>;
  loadOffer(id: string): Promise<Offer | undefined>;
  validAsset(asset: Asset): boolean;
  build(source: string, operation: MarketOperation, baseFee: string, expires: number): Promise<string>;
  inspect(xdr: string): MarketProjection;
}
export type MarketDependencies = Readonly<{
  network: NetworkContext;
  gateway: MarketGateway;
  repository: AccountSignerRepository;
  sdk: FresnicaSdkPort;
  recovery: PendingSubmissionDependencies;
  now: () => number;
  monotonic: () => number;
}>;
export type OfferRequest = Readonly<{
  kind: 'offer';
  action: 'create' | 'update' | 'cancel';
  base: Asset;
  counter: Asset;
  side: 'buy' | 'sell';
  amount: string;
  price: string;
  offerId?: string;
}>;
export type ExitRequest = Readonly<{
  kind: 'exit';
  poolId: string;
  mode: 'exact_shares' | 'all';
  shares?: string;
  slippageBps: number;
  close: boolean;
}>;
export type MarketRequest = OfferRequest | ExitRequest;
export type MarketReview = ReviewedTransaction &
  Readonly<{
    accountId: string;
    kind: 'offer' | 'exit';
    operation: MarketOperation;
    facts: readonly Readonly<{ key: string; value: string }>[];
  }>;
