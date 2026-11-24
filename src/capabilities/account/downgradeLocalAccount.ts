import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';
import type { PendingSubmissionRepository } from '../transaction/pendingSubmission';
import type { AccountSignerRepository } from './AccountSignerRepository';
import { isProtectedAccountProvisioning } from './provisionAccount';

export type DowngradeLocalAccountDependencies = Readonly<{
  repository: AccountSignerRepository;
  pendingSubmissions: PendingSubmissionRepository;
  sdk: Pick<FresnicaSdkPort, 'verifyProtectedSignerPassphrase'>;
  assertCurrent: () => void;
  onDowngraded: () => void;
  networkId: string;
}>;

export function canDowngradeLocalAccount(repository: AccountSignerRepository, accountId: string): boolean {
  const account = repository.getAccount(accountId);
  const signers = repository.listSignersForAccount(accountId);
  return (
    account?.identityKind === 'classic' &&
    signers.length === 1 &&
    signers[0].kind === 'protected-software' &&
    signers[0].publicKey === account.address &&
    Boolean(signers[0].envelopeJson?.trim()) &&
    signers[0].backupState !== 'pending'
  );
}

export async function downgradeLocalAccount(
  deps: DowngradeLocalAccountDependencies,
  accountId: string,
  freshAppPassphrase: string,
  signal: AbortSignal,
): Promise<void> {
  const check = () => {
    deps.assertCurrent();
    if (signal.aborted) throw new Error('account-downgrade-cancelled');
    if (isProtectedAccountProvisioning(deps.repository)) throw new Error('account-downgrade-busy');
    if (
      deps.repository
        .listSigners()
        .some(signer => signer.recoveryKind === 'mnemonic' && signer.backupState === 'pending')
    )
      throw new Error('account-downgrade-pending-backup');
    const account = deps.repository.getAccount(accountId);
    if (!account || account.networkId !== deps.networkId || !canDowngradeLocalAccount(deps.repository, accountId))
      throw new Error('account-context-changed');
    if (
      deps.pendingSubmissions
        .listUnresolved()
        .some(record => record.accountId === accountId || record.sourceAddress === account.address)
    )
      throw new Error('account-downgrade-pending-submission');
    return account;
  };
  const account = check();
  const signer = deps.repository.listSignersForAccount(accountId)[0];
  if (!freshAppPassphrase) throw new Error('invalid-passcode');
  const verified = await deps.sdk.verifyProtectedSignerPassphrase({
    envelopeJson: signer.envelopeJson!,
    appPassphrase: freshAppPassphrase,
    expectedSignerPublicKey: signer.publicKey,
  });
  if (verified !== true) throw new Error('invalid-passcode');
  const current = check();
  const currentSigner = deps.repository.listSignersForAccount(accountId)[0];
  if (
    current.id !== account.id ||
    current.address !== account.address ||
    current.identityKind !== account.identityKind ||
    current.hidden !== account.hidden ||
    current.sortOrder !== account.sortOrder ||
    current.label !== account.label ||
    current.updatedAt.getTime() !== account.updatedAt.getTime() ||
    currentSigner.id !== signer.id ||
    currentSigner.envelopeJson !== signer.envelopeJson ||
    currentSigner.envelopeRevision !== signer.envelopeRevision ||
    currentSigner.backupState !== signer.backupState
  )
    throw new Error('account-context-changed');
  deps.repository.downgradeToReadOnly(accountId, signer.id, signer.envelopeRevision);
  deps.onDowngraded();
}
