import type {AccountSignerRepository} from '../../capabilities/account/AccountSignerRepository';
import type {SignerRecord} from '../../capabilities/signer/types';

export function resolveSendSigner(
  repository: AccountSignerRepository,
  accountId: string,
): SignerRecord {
  const signers = repository.listSignersForAccount(accountId);

  if (signers.length === 0) {
    throw new Error('send-watch-only-account');
  }
  if (signers.length > 1) {
    throw new Error('send-multisig-not-supported');
  }

  return signers[0];
}
