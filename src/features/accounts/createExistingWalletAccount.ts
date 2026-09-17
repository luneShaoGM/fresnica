import {
  runGeneratedMnemonicOnboarding,
  type GeneratedMnemonicBackup,
  type OnboardingProvisioningDependencies,
} from '../onboarding/runOnboardingProvisioning';
import type { ProvisionedAccount } from '../../capabilities/account/provisionAccount';
import {
  authorizeExistingWalletProtection,
  registerPersistedSignerSystemAuth,
  type ExistingWalletSystemAuthRegistration,
} from './existingWalletProtection';

export type ExistingWalletCreateInput = Readonly<{
  appPassphrase: string;
  confirmAppPassphrase?: string;
  label?: string;
}>;

export type ExistingWalletCreateResult = Readonly<{
  account: ProvisionedAccount;
  backup: GeneratedMnemonicBackup;
  systemAuthRegistration: ExistingWalletSystemAuthRegistration;
}>;

export async function createExistingWalletAccount(
  dependencies: OnboardingProvisioningDependencies,
  input: ExistingWalletCreateInput,
): Promise<ExistingWalletCreateResult> {
  await authorizeExistingWalletProtection(dependencies, input.appPassphrase, input.confirmAppPassphrase);

  const generated = await runGeneratedMnemonicOnboarding(dependencies, {
    language: 'english',
    strength: 128,
    mnemonicPassphrase: '',
    index: 0,
    appPassphrase: input.appPassphrase,
    label: input.label,
  });

  const systemAuthRegistration = await registerPersistedSignerSystemAuth(
    dependencies,
    generated.account.signer,
    input.appPassphrase,
  );

  return {
    account: generated.account,
    backup: generated.backup,
    systemAuthRegistration,
  };
}
