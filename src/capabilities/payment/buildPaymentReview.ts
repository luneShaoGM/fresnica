import type { NetworkContext } from '../network/types';
import type { StellarPaymentAsset } from '../stellar/types';
import type { ReviewedTransaction } from '../transaction/ReviewedTransaction';
import type { PaymentGatewayPort } from './PaymentGateway';

export type PaymentReviewAsset = StellarPaymentAsset;

export type PaymentReview = ReviewedTransaction &
  Readonly<{
    operation: 'payment' | 'create-account';
    destination: string;
    amount: string;
    asset: Readonly<PaymentReviewAsset>;
    memo?: string;
  }>;

export type BuildPaymentReviewDependencies = Readonly<{
  gateway: Pick<PaymentGatewayPort, 'inspectPaymentTransaction'>;
  network: NetworkContext;
}>;

export function buildPaymentReview(
  dependencies: BuildPaymentReviewDependencies,
  input: Readonly<{
    transactionXdrBase64: string;
    networkId: string;
  }>,
): PaymentReview {
  if (input.networkId !== dependencies.network.id) {
    throw new Error('Payment review network mismatch');
  }

  const projection = dependencies.gateway.inspectPaymentTransaction({
    transactionXdrBase64: input.transactionXdrBase64,
    networkPassphrase: dependencies.network.networkPassphrase,
  });

  return Object.freeze({
    transactionXdrBase64: input.transactionXdrBase64,
    networkId: input.networkId,
    ...projection,
    asset: Object.freeze(projection.asset),
  });
}
