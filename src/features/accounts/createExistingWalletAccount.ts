import type {
  GeneratedMnemonicBackup,
  OnboardingProvisioningDependencies,
} from '../onboarding/runOnboardingProvisioning';
import { generateMnemonicAccount, type ProvisionedAccount } from '../../capabilities/account/provisionAccount';
import {
  authorizeExistingWalletProtection,
  type ExistingWalletSystemAuthRegistration,
} from './existingWalletProtection';

export type ExistingWalletCreateInput = Readonly<{
  appPassphrase: string;
  confirmAppPassphrase?: string;
  shortPassphraseRiskAccepted?: boolean;
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
  await authorizeExistingWalletProtection(
    dependencies,
    input.appPassphrase,
    input.confirmAppPassphrase,
    input.shortPassphraseRiskAccepted,
  );

  // Authorization above owns first-time policy or exact existing-credential verification.
  const generated = await generateMnemonicAccount(dependencies, {
    networkId: dependencies.networkId,
    language: 'english',
    strength: 128,
    mnemonicPassphrase: '',
    index: 0,
    appPassphrase: input.appPassphrase,
    label: input.label,
  });

  const systemAuthRegistration = 'not-configured' as const;

  return {
    account: { account: generated.account, signer: generated.signer },
    backup: { mnemonic: generated.mnemonic, language: generated.language, index: generated.index },
    systemAuthRegistration,
  };
}
