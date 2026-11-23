import { fromBase64, toBase64 } from '@exodus/bytes/base64.js';

import type { AccountSignerRepository } from '../account/AccountSignerRepository';
import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';

export function createDappMessageSigner(
  sdk: Pick<FresnicaSdkPort, 'signMessageWithPassphrase'>,
  repository: Pick<AccountSignerRepository, 'getAccount' | 'listSignersForAccount'>,
): DappMessageSigner {
  return async input => {
    const account = repository.getAccount(input.accountId);
    if (
      account?.identityKind !== 'classic' ||
      account.hidden ||
      account.address !== input.accountAddress ||
      account.networkId !== input.networkId ||
      !input.appPassphrase
    )
      return undefined;
    const signer = repository
      .listSignersForAccount(account.id)
      .find(
        candidate =>
          candidate.kind === 'protected-software' && candidate.publicKey === account.address && candidate.envelopeJson,
      );
    if (!signer?.envelopeJson || !input.isCurrent()) return undefined;
    const signature = await sdk.signMessageWithPassphrase({
      envelopeJson: signer.envelopeJson,
      expectedSignerPublicKey: account.address,
      appPassphrase: input.appPassphrase,
      message: input.message,
    });
    if (!input.isCurrent()) return undefined;
    const bytes = fromBase64(signature, { padding: true });
    if (bytes.length !== 64 || toBase64(bytes) !== signature) throw new Error('invalid-message-signature');
    return input.encoding === 'hex'
      ? Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
      : signature;
  };
}

export type DappMessageSigner = (
  input: Readonly<{
    accountId: string;
    accountAddress: string;
    networkId: string;
    message: string;
    encoding: 'base64' | 'hex';
    appPassphrase: string;
    isCurrent: () => boolean;
  }>,
) => Promise<string | undefined>;
