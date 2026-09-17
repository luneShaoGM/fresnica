import { orderAccounts } from '../../capabilities/account/accountOrder';
import { deriveMnemonicAccount, type ProvisionedAccount } from '../../capabilities/account/provisionAccount';
import type { SignerRecord } from '../../capabilities/signer/types';
import type { OnboardingProvisioningDependencies } from '../onboarding/runOnboardingProvisioning';
import {
  authorizeExistingWalletProtection,
  registerPersistedSignerSystemAuth,
  type ExistingWalletSystemAuthRegistration,
} from './existingWalletProtection';

const MAX_STELLAR_ACCOUNT_INDEX = 0x7fffffff;

type EligibleBackupState = 'confirmed' | 'not-required';

export type ExistingWalletHdSourceCandidate = Readonly<{
  signerId: string;
  signerPublicKey: string;
  backupState: EligibleBackupState;
  accountLabel: string;
}>;

export type ExistingWalletHdDeriveInput = Readonly<{
  sourceSignerId: string;
  index: number;
  appPassphrase: string;
  label?: string;
}>;

export type ExistingWalletHdDeriveResult = Readonly<{
  account: ProvisionedAccount;
  systemAuthRegistration: ExistingWalletSystemAuthRegistration;
}>;

export function stellarHdPath(index: number): string {
  assertStellarAccountIndex(index);
  return `m/44'/148'/${index}'`;
}

export function listExistingWalletHdSourceCandidates(
  dependencies: Pick<OnboardingProvisioningDependencies, 'networkId' | 'repository'>,
): ExistingWalletHdSourceCandidate[] {
  const seen = new Set<string>();
  const candidates: ExistingWalletHdSourceCandidate[] = [];
  const accounts = orderAccounts(
    dependencies.repository
      .listAccounts()
      .filter(account => account.networkId === dependencies.networkId && !account.hidden),
  );

  for (const account of accounts) {
    for (const signer of dependencies.repository.listSignersForAccount(account.id)) {
      if (seen.has(signer.id) || !isEligibleHdSource(signer)) {
        continue;
      }
      seen.add(signer.id);
      candidates.push({
        signerId: signer.id,
        signerPublicKey: signer.publicKey,
        backupState: signer.backupState,
        accountLabel: account.label.trim() || account.address,
      });
    }
  }

  return candidates;
}

export async function deriveExistingWalletAccount(
  dependencies: OnboardingProvisioningDependencies,
  input: ExistingWalletHdDeriveInput,
): Promise<ExistingWalletHdDeriveResult> {
  assertStellarAccountIndex(input.index);
  const source = requireEligibleSourceSigner(dependencies, input.sourceSignerId);

  await authorizeExistingWalletProtection(dependencies, input.appPassphrase);

  const account = await deriveMnemonicAccount(dependencies, {
    sourceEnvelopeJson: source.envelopeJson!,
    expectedSourceSignerPublicKey: source.publicKey,
    index: input.index,
    appPassphrase: input.appPassphrase,
    networkId: dependencies.networkId,
    backupState: source.backupState as EligibleBackupState,
    label: input.label,
  });

  const systemAuthRegistration = await registerPersistedSignerSystemAuth(
    dependencies,
    account.signer,
    input.appPassphrase,
  );

  return { account, systemAuthRegistration };
}

function requireEligibleSourceSigner(
  dependencies: Pick<OnboardingProvisioningDependencies, 'networkId' | 'repository'>,
  signerId: string,
): SignerRecord {
  const normalizedSignerId = signerId.trim();
  if (!normalizedSignerId) {
    throw new Error('hd-source-not-eligible');
  }

  const candidate = listExistingWalletHdSourceCandidates(dependencies).find(
    item => item.signerId === normalizedSignerId,
  );
  const signer = candidate ? dependencies.repository.getSigner(candidate.signerId) : undefined;
  if (!signer || !isEligibleHdSource(signer)) {
    throw new Error('hd-source-not-eligible');
  }
  return signer;
}

function isEligibleHdSource(
  signer: SignerRecord,
): signer is SignerRecord & { envelopeJson: string; backupState: EligibleBackupState } {
  return (
    signer.kind === 'protected-software' &&
    signer.recoveryKind === 'mnemonic' &&
    (signer.backupState === 'confirmed' || signer.backupState === 'not-required') &&
    Boolean(signer.envelopeJson?.trim())
  );
}

function assertStellarAccountIndex(index: number): void {
  if (!Number.isSafeInteger(index) || index < 0 || index > MAX_STELLAR_ACCOUNT_INDEX) {
    throw new Error('invalid-derivation-index');
  }
}
