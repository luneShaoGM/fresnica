import { assertNewProtectionPassphrase } from './newPassphrasePolicy';
import { requiresExistingAppPassphrase, verifyExistingAppPassphrase } from './verifyExistingAppPassphrase';
import type { ProvisionAccountDependencies } from '../account/provisionAccount';

type ProtectionDependencies = Pick<ProvisionAccountDependencies, 'sdk' | 'repository'>;

// Call inside the repository's protected-provisioning owner: another route
// must not establish a different first credential after this inventory read.
export async function authorizeAccountProtection(
  dependencies: ProtectionDependencies,
  appPassphrase: string,
  confirmAppPassphrase?: string,
  shortPassphraseRiskAccepted = false,
): Promise<void> {
  if (requiresExistingAppPassphrase(dependencies.repository)) {
    await verifyExistingAppPassphrase(dependencies, appPassphrase);
    return;
  }

  assertNewProtectionPassphrase(appPassphrase, shortPassphraseRiskAccepted);
  if (appPassphrase !== confirmAppPassphrase) {
    throw new Error('app-passphrase-confirmation-mismatch');
  }
}
