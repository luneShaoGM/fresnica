import {APP_CONFIG} from '../../app/config/appConfig';
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
import type {AccountRecord} from '../../capabilities/account/types';
import {
  completeOnboarding,
  markGeneratedMnemonicBackupRequired,
  type OnboardingState,
} from './onboardingState';

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
  dependencies: ProvisionAccountDependencies,
  input: Omit<WatchOnlyAccountInput, 'networkId'>,
): Promise<Readonly<{account: AccountRecord; state: OnboardingState}>> {
  const account = await registerWatchOnlyAccount(dependencies, {
    ...input,
    networkId: APP_CONFIG.network.id,
  });

  return {
    account,
    state: completeOnboarding('watch-only'),
  };
}

export async function runSecretImportOnboarding(
  dependencies: ProvisionAccountDependencies,
  input: Omit<ImportSecretAccountInput, 'networkId'>,
): Promise<Readonly<{account: ProvisionedAccount; state: OnboardingState}>> {
  const account = await importSecretAccount(dependencies, {
    ...input,
    networkId: APP_CONFIG.network.id,
  });

  return {
    account,
    state: completeOnboarding('import-secret'),
  };
}

export async function runMnemonicImportOnboarding(
  dependencies: ProvisionAccountDependencies,
  input: Omit<ImportMnemonicAccountInput, 'networkId'>,
): Promise<Readonly<{account: ProvisionedAccount; state: OnboardingState}>> {
  const account = await importMnemonicAccount(dependencies, {
    ...input,
    networkId: APP_CONFIG.network.id,
  });

  return {
    account,
    state: completeOnboarding('import-mnemonic'),
  };
}

export async function runGeneratedMnemonicOnboarding(
  dependencies: ProvisionAccountDependencies,
  input: Omit<GenerateMnemonicAccountInput, 'networkId'>,
): Promise<GeneratedOnboardingResult> {
  const generated = await generateMnemonicAccount(dependencies, {
    ...input,
    networkId: APP_CONFIG.network.id,
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
