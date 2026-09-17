import {
  importMnemonicAccount,
  importSecretAccount,
  type ProvisionedAccount,
} from '../../capabilities/account/provisionAccount';
import type { OnboardingProvisioningDependencies } from '../onboarding/runOnboardingProvisioning';
import {
  authorizeExistingWalletProtection,
  registerPersistedSignerSystemAuth,
  type ExistingWalletSystemAuthRegistration,
} from './existingWalletProtection';

export type ExistingWalletSecretImportInput = Readonly<{
  kind: 'secret';
  secret: string;
  appPassphrase: string;
  confirmAppPassphrase?: string;
  label?: string;
}>;

export type ExistingWalletMnemonicImportInput = Readonly<{
  kind: 'mnemonic';
  mnemonic: string;
  mnemonicPassphrase: string;
  index: number;
  language?: string;
  appPassphrase: string;
  confirmAppPassphrase?: string;
  label?: string;
}>;

export type ExistingWalletImportInput = ExistingWalletSecretImportInput | ExistingWalletMnemonicImportInput;

export type ExistingWalletImportResult = Readonly<{
  account: ProvisionedAccount;
  systemAuthRegistration: ExistingWalletSystemAuthRegistration;
}>;

export async function importExistingWalletAccount(
  dependencies: OnboardingProvisioningDependencies,
  input: ExistingWalletImportInput,
): Promise<ExistingWalletImportResult> {
  await authorizeExistingWalletProtection(dependencies, input.appPassphrase, input.confirmAppPassphrase);

  const account =
    input.kind === 'secret'
      ? await importSecretAccount(dependencies, {
          secret: input.secret,
          appPassphrase: input.appPassphrase,
          networkId: dependencies.networkId,
          label: input.label,
        })
      : await importMnemonicAccount(dependencies, {
          mnemonic: input.mnemonic,
          mnemonicPassphrase: input.mnemonicPassphrase,
          index: input.index,
          language: input.language,
          appPassphrase: input.appPassphrase,
          networkId: dependencies.networkId,
          label: input.label,
        });

  const systemAuthRegistration = await registerPersistedSignerSystemAuth(
    dependencies,
    account.signer,
    input.appPassphrase,
  );

  return { account, systemAuthRegistration };
}
