import type { NetworkContext } from '../network/types';
import type { ReviewedTransaction } from '../transaction/ReviewedTransaction';
import type { TrustlineGatewayPort } from './TrustlineGateway';

export type TrustlineOperation = 'add' | 'set-limit' | 'remove';
export type TrustlineAuthorization = 'full' | 'maintain-liabilities' | 'unauthorized';

export type TrustlineReview = ReviewedTransaction &
  Readonly<{
    operation: TrustlineOperation;
    asset: Readonly<{ code: string; issuer: string }>;
    limit?: string;
    expectedAuthorization?: TrustlineAuthorization;
    expectedClawbackEnabled?: boolean;
  }>;

export type BuildTrustlineReviewDependencies = Readonly<{
  gateway: Pick<TrustlineGatewayPort, 'inspectTrustlineTransaction'>;
  network: NetworkContext;
}>;

export function buildTrustlineReview(
  dependencies: BuildTrustlineReviewDependencies,
  input: Readonly<{
    transactionXdrBase64: string;
    networkId: string;
    operation?: TrustlineOperation;
    expectedAuthorization?: TrustlineAuthorization;
    expectedClawbackEnabled?: boolean;
  }>,
): TrustlineReview {
  if (input.networkId !== dependencies.network.id) {
    throw new Error('Trustline review network mismatch');
  }

  const projection = dependencies.gateway.inspectTrustlineTransaction({
    transactionXdrBase64: input.transactionXdrBase64,
    networkPassphrase: dependencies.network.networkPassphrase,
  });
  const operation: TrustlineOperation = input.operation ?? (projection.limit === undefined ? 'remove' : 'add');
  if (operation === 'remove' ? projection.limit !== undefined : projection.limit === undefined) {
    throw new Error('trustline-review-operation-xdr-mismatch');
  }

  return Object.freeze({
    transactionXdrBase64: input.transactionXdrBase64,
    networkId: input.networkId,
    source: projection.source,
    fee: projection.fee,
    ...(projection.expiresAtUnixSeconds === undefined ? {} : { expiresAtUnixSeconds: projection.expiresAtUnixSeconds }),
    operation,
    asset: Object.freeze(projection.asset),
    ...(projection.limit === undefined ? {} : { limit: projection.limit }),
    ...(input.expectedAuthorization === undefined ? {} : { expectedAuthorization: input.expectedAuthorization }),
    ...(input.expectedClawbackEnabled === undefined ? {} : { expectedClawbackEnabled: input.expectedClawbackEnabled }),
  });
}
