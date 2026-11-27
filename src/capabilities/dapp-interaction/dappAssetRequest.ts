import type { DappTransactionIntent } from './dappTransactionIntent';
import type { DappPublicSelection } from './freighterSession';

type DappAssetSubmissionResult =
  | Readonly<{ status: 'added' | 'asset-failed' | 'passphrase-required' }>
  | Readonly<{ status: 'submission-uncertain'; transactionHash: string }>;

export type ReviewedDappAsset = Readonly<{
  intent: DappTransactionIntent;
  submit: (
    passphrase: string,
    isCurrent: () => boolean,
  ) => Promise<DappAssetSubmissionResult>;
  contractId: string;
}>;

export type DappAssetRequest = (
  selection: DappPublicSelection,
  request: Readonly<{ code: string; issuer: string; contractId?: string }>,
) => Promise<ReviewedDappAsset | undefined>;
