import { assertNewProtectionPassphrase } from '../../capabilities/application-security/newPassphrasePolicy';
import {
  requiresExistingAppPassphrase,
  verifyExistingAppPassphrase,
} from '../../capabilities/application-security/verifyExistingAppPassphrase';
import {
  runGeneratedMnemonicOnboarding,
  type GeneratedMnemonicBackup,
  type OnboardingProvisioningDependencies,
} from '../onboarding/runOnboardingProvisioning';
import type { ProvisionedAccount } from '../../capabilities/account/provisionAccount';

export type ExistingWalletCreateInput = Readonly<{
  appPassphrase: string;
  confirmAppPassphrase?: string;
  label?: string;
}>;

export type ExistingWalletCreateResult = Readonly<{
  account: ProvisionedAccount;
  backup: GeneratedMnemonicBackup;
  systemAuthRegistration: 'not-configured' | 'registered' | 'repair-required';
}>;

export async function createExistingWalletAccount(
  dependencies: OnboardingProvisioningDependencies,
  input: ExistingWalletCreateInput,
): Promise<ExistingWalletCreateResult> {
  const requiresExisting = requiresExistingAppPassphrase(dependencies.repository);

  if (requiresExisting) {
    await verifyExistingAppPassphrase(dependencies, input.appPassphrase);
  } else {
    assertNewProtectionPassphrase(input.appPassphrase);
    if (input.appPassphrase !== input.confirmAppPassphrase) {
      throw new Error('app-passphrase-confirmation-mismatch');
    }
  }

  const generated = await runGeneratedMnemonicOnboarding(dependencies, {
    language: 'english',
    strength: 128,
    mnemonicPassphrase: '',
    index: 0,
    appPassphrase: input.appPassphrase,
    label: input.label,
  });

  let systemAuthRegistration: ExistingWalletCreateResult['systemAuthRegistration'] = 'not-configured';

  try {
    if (await dependencies.sdk.hasSystemAuthDomain()) {
      const registered = await dependencies.sdk.registerSignerSystemAuth({
        envelopeJson: generated.account.signer.envelopeJson!,
        appPassphrase: input.appPassphrase,
        expectedSignerPublicKey: generated.account.signer.publicKey,
      });
      systemAuthRegistration = registered ? 'registered' : 'repair-required';
    }
  } catch {
    systemAuthRegistration = 'repair-required';
  }

  return {
    account: generated.account,
    backup: generated.backup,
    systemAuthRegistration,
  };
}
