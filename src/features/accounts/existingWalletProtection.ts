import { assertNewProtectionPassphrase } from '../../capabilities/application-security/newPassphrasePolicy';
import {
  requiresExistingAppPassphrase,
  verifyExistingAppPassphrase,
} from '../../capabilities/application-security/verifyExistingAppPassphrase';
import type { ProvisionAccountDependencies } from '../../capabilities/account/provisionAccount';
import type { SignerRecord } from '../../capabilities/signer/types';

export type ExistingWalletSystemAuthRegistration = 'not-configured' | 'registered' | 'repair-required';

type ExistingWalletProtectionDependencies = Pick<ProvisionAccountDependencies, 'sdk' | 'repository'>;

export async function authorizeExistingWalletProtection(
  dependencies: ExistingWalletProtectionDependencies,
  appPassphrase: string,
  confirmAppPassphrase?: string,
): Promise<void> {
  if (requiresExistingAppPassphrase(dependencies.repository)) {
    await verifyExistingAppPassphrase(dependencies, appPassphrase);
    return;
  }

  assertNewProtectionPassphrase(appPassphrase);
  if (appPassphrase !== confirmAppPassphrase) {
    throw new Error('app-passphrase-confirmation-mismatch');
  }
}

export async function registerPersistedSignerSystemAuth(
  dependencies: ExistingWalletProtectionDependencies,
  signer: SignerRecord,
  appPassphrase: string,
): Promise<ExistingWalletSystemAuthRegistration> {
  try {
    if (!(await dependencies.sdk.hasSystemAuthDomain())) {
      return 'not-configured';
    }

    const registered = await dependencies.sdk.registerSignerSystemAuth({
      envelopeJson: signer.envelopeJson!,
      appPassphrase,
      expectedSignerPublicKey: signer.publicKey,
    });
    return registered ? 'registered' : 'repair-required';
  } catch {
    return 'repair-required';
  }
}
