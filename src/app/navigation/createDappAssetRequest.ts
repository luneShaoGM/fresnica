import { Asset, StrKey } from '@stellar/stellar-sdk';

import type { DappAssetRequest } from '../../capabilities/dapp-interaction/dappAssetRequest';
import {
  prepareTrustlineProductReview,
  submitTrustlineProductReview,
  type TrustlineProductDependencies,
} from '../../features/trustlines/trustlineProductFlow';
import { readReviewableDappTransaction } from '../../platform/stellar/readReviewableDappTransaction';

export function createDappAssetRequest(deps: TrustlineProductDependencies): DappAssetRequest {
  return async (selection, request) => {
    const account = deps.repository.getAccount(selection.accountId);
    if (
      !account ||
      account.hidden ||
      account.identityKind !== 'classic' ||
      account.address !== selection.address ||
      account.networkId !== selection.networkId ||
      deps.network.id !== selection.networkId ||
      deps.network.networkPassphrase !== selection.networkPassphrase ||
      !/^[A-Za-z0-9]{1,12}$/.test(request.code) ||
      !StrKey.isValidEd25519PublicKey(request.issuer) ||
      request.issuer === account.address
    )
      return undefined;
    const signers = deps.repository.listSignersForAccount(account.id);
    if (signers.length !== 1 || signers[0].kind !== 'protected-software' || signers[0].publicKey !== account.address) {
      return undefined;
    }
    const asset = { code: request.code, issuer: request.issuer };
    const classicId = `${asset.code}:${asset.issuer}`;
    const contractId = request.contractId ?? classicId;
    if (
      contractId !== classicId &&
      contractId !== new Asset(asset.code, asset.issuer).contractId(selection.networkPassphrase)
    ) {
      return undefined;
    }
    const review = await prepareTrustlineProductReview(deps, account, { action: 'add', asset });
    const intent = readReviewableDappTransaction(
      review.transactionXdrBase64,
      selection.networkPassphrase,
      account.address,
    );
    const operation = intent?.operations[0];
    if (
      !intent ||
      review.operation !== 'add' ||
      operation?.type !== 'change-trust' ||
      operation.assetCode !== asset.code ||
      operation.assetIssuer !== asset.issuer ||
      operation.limit !== review.limit
    )
      return undefined;
    return {
      intent,
      contractId,
      submit: async (passphrase, isCurrent) => {
        if (!passphrase || !isCurrent()) return { status: 'asset-failed' };
        const result = await submitTrustlineProductReview(deps, account, review, '', passphrase, isCurrent);
        switch (result.status) {
          case 'submitted':
            return { status: 'added' };
          case 'passphrase-required':
            return { status: 'passphrase-required' };
          case 'uncertain':
            return { status: 'submission-uncertain', transactionHash: result.transactionHash };
          default:
            return { status: 'asset-failed' };
        }
      },
    };
  };
}
