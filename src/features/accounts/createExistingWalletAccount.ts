import {
  runGeneratedMnemonicOnboarding,
  type GeneratedMnemonicBackup,
  type OnboardingProvisioningDependencies,
} from '../onboarding/runOnboardingProvisioning';
import type { ProvisionedAccount } from '../../capabilities/account/provisionAccount';
import {
  authorizeExistingWalletProtection,
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

  const systemAuthRegistration = 'not-configured' as const;

  return {
    account: generated.account,
    backup: generated.backup,
    systemAuthRegistration,
  };
}
