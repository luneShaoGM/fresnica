import type { AccountSignerRepository } from '../../capabilities/account/AccountSignerRepository';
import type { DappTransactionSigner } from '../../capabilities/dapp-interaction/dappTransactionSigner';
import { signPreparedDappTransaction } from '../../capabilities/dapp-interaction/signPreparedDappTransaction';
import type { FresnicaSdkPort } from '../../capabilities/ports/FresnicaSdkPort';
import { readTransactionIdentity } from '../../platform/stellar/readTransactionIdentity';

export function createDappTransactionSigner(dependencies: {
  sdk: FresnicaSdkPort;
  repository: AccountSignerRepository;
}): DappTransactionSigner {
  return async input => {
    const account = dependencies.repository.getAccount(input.accountId);
    if (!account || account.address !== input.accountAddress || account.networkId !== input.networkId) {
      return { status: 'unsupported-signer' };
    }
    const signer = dependencies.repository
      .listSignersForAccount(account.id)
      .find(item => item.kind === 'protected-software' && item.publicKey === account.address && item.envelopeJson);
    if (!signer) return { status: 'unsupported-signer' };

    const identity = readTransactionIdentity(input.transactionXdrBase64, input.networkPassphrase);
    if (!identity || identity.operationCount < 1) return { status: 'invalid' };
    if (input.phase === 'inspect') {
      return {
        status: 'ready',
        source: identity.source,
        fee: identity.fee,
        operationCount: identity.operationCount,
      };
    }

    const signed = await signPreparedDappTransaction({
      sdk: dependencies.sdk,
      signer,
      accountAddress: account.address,
      networkPassphrase: input.networkPassphrase,
      appPassphrase: input.appPassphrase,
      review: {
        transactionXdrBase64: input.transactionXdrBase64,
        networkId: input.networkId,
        source: identity.source,
        fee: identity.fee,
        ...(identity.expiresAtUnixSeconds === undefined ? {} : { expiresAtUnixSeconds: identity.expiresAtUnixSeconds }),
      },
    });
    if (signed.status === 'signed') {
      return {
        status: 'signed',
        signedTransaction: signed.signedTransactionXdrBase64,
        signerAddress: account.address,
      };
    }
    return signed;
  };
}
