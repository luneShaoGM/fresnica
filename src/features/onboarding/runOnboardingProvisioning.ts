import {
  generateMnemonicAccount,
  importMnemonicAccount,
  importSecretAccount,
  registerWatchOnlyAccount,
  type GenerateMnemonicAccountInput,
  type ImportMnemonicAccountInput,
  type ImportSecretAccountInput,
  type ProvisionAccountDependencies,
  type ProvisionedAccount,
  type WatchOnlyAccountInput,
} from '../../capabilities/account/provisionAccount';
import type { AccountRecord } from '../../capabilities/account/types';
import { completeOnboarding, markGeneratedMnemonicBackupRequired, type OnboardingState } from './onboardingState';

export type OnboardingProvisioningDependencies = ProvisionAccountDependencies & Readonly<{ networkId: string }>;

export type GeneratedMnemonicBackup = Readonly<{
  mnemonic: string;
  language: string;
  index: number;
}>;

export type GeneratedOnboardingResult = Readonly<{
  account: ProvisionedAccount;
  backup: GeneratedMnemonicBackup;
  state: OnboardingState;
}>;

export async function runWatchOnlyOnboarding(
  dependencies: OnboardingProvisioningDependencies,
  input: Omit<WatchOnlyAccountInput, 'networkId'>,
): Promise<Readonly<{ account: AccountRecord; state: OnboardingState }>> {
  const account = await registerWatchOnlyAccount(dependencies, {
    ...input,
    networkId: dependencies.networkId,
  });

  return {
    account,
    state: completeOnboarding('watch-only'),
  };
}

export async function runSecretImportOnboarding(
  dependencies: OnboardingProvisioningDependencies,
  input: Omit<ImportSecretAccountInput, 'networkId'>,
): Promise<Readonly<{ account: ProvisionedAccount; state: OnboardingState }>> {
  const account = await importSecretAccount(dependencies, {
    ...input,
    networkId: dependencies.networkId,
  });

  return {
    account,
    state: completeOnboarding('import-secret'),
  };
}

export async function runMnemonicImportOnboarding(
  dependencies: OnboardingProvisioningDependencies,
  input: Omit<ImportMnemonicAccountInput, 'networkId'>,
): Promise<Readonly<{ account: ProvisionedAccount; state: OnboardingState }>> {
  const account = await importMnemonicAccount(dependencies, {
    ...input,
    networkId: dependencies.networkId,
  });

  return {
    account,
    state: completeOnboarding('import-mnemonic'),
  };
}

export async function runGeneratedMnemonicOnboarding(
  dependencies: OnboardingProvisioningDependencies,
  input: Omit<GenerateMnemonicAccountInput, 'networkId'>,
): Promise<GeneratedOnboardingResult> {
  const generated = await generateMnemonicAccount(dependencies, {
    ...input,
    networkId: dependencies.networkId,
  });

  return {
    account: {
      account: generated.account,
      signer: generated.signer,
    },
    backup: {
      mnemonic: generated.mnemonic,
      language: generated.language,
      index: generated.index,
    },
    state: markGeneratedMnemonicBackupRequired(),
  };
}
