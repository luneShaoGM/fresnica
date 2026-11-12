import { assertNewProtectionPassphrase } from '../../capabilities/application-security/newPassphrasePolicy';
import {
  requiresExistingAppPassphrase,
  verifyExistingAppPassphrase,
} from '../../capabilities/application-security/verifyExistingAppPassphrase';
import type { ProvisionAccountDependencies } from '../../capabilities/account/provisionAccount';

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
