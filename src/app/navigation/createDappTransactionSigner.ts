import type { AccountSignerRepository } from '../../capabilities/account/AccountSignerRepository';
import type { DappTransactionSigner } from '../../capabilities/dapp-interaction/dappTransactionSigner';
import { signPreparedDappTransaction } from '../../capabilities/dapp-interaction/signPreparedDappTransaction';
import type { FresnicaSdkPort } from '../../capabilities/ports/FresnicaSdkPort';
import { readReviewableDappTransaction } from '../../platform/stellar/readReviewableDappTransaction';

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

    const intent = readReviewableDappTransaction(input.transactionXdrBase64, input.networkPassphrase, account.address);
    if (!intent) return { status: 'invalid' };
    if (input.phase === 'inspect') return { status: 'ready', intent };
    const expiresAt = intent.operations.some(operation => 'contract' in operation)
      ? Number(intent.timeBounds?.maxTime) * 1000
      : undefined;
    const isCurrent = () => current(input.isCurrent) && (expiresAt === undefined || Date.now() < expiresAt);
    if (input.reviewedHash !== intent.hash || !isCurrent()) return { status: 'invalid' };

    const signed = await signPreparedDappTransaction({
      sdk: dependencies.sdk,
      signer,
      accountAddress: account.address,
      networkPassphrase: input.networkPassphrase,
      appPassphrase: input.appPassphrase,
      isCurrent,
      review: {
        transactionXdrBase64: input.transactionXdrBase64,
        networkId: input.networkId,
        source: intent.source,
        fee: intent.fee,
        ...(intent.timeBounds?.maxTime === undefined || intent.timeBounds.maxTime === '0'
          ? {}
          : { expiresAtUnixSeconds: Number(intent.timeBounds.maxTime) }),
      },
    });
    if (signed.status === 'signed') {
      if (!isCurrent()) return { status: 'invalid' };
      return {
        status: 'signed',
        signedTransaction: signed.signedTransactionXdrBase64,
        signerAddress: account.address,
      };
    }
    return signed;
  };
}

function current(check: () => boolean): boolean {
  try {
    return check() === true;
  } catch {
    return false;
  }
}
