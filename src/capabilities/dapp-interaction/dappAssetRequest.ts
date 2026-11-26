import type { DappTransactionIntent } from './dappTransactionIntent';
import type { DappPublicSelection } from './freighterSession';

export type ReviewedDappAsset = Readonly<{
  intent: DappTransactionIntent;
  submit: (
    passphrase: string,
    isCurrent: () => boolean,
  ) => Promise<'added' | 'asset-failed' | 'submission-uncertain' | 'passphrase-required'>;
  contractId: string;
}>;

export type DappAssetRequest = (
  selection: DappPublicSelection,
  request: Readonly<{ code: string; issuer: string; contractId?: string }>,
) => Promise<ReviewedDappAsset | undefined>;
