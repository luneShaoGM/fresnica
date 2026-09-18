import React, { useEffect, useState } from 'react';

import type { AccountRecord } from '../../../capabilities/account/types';
import type { SignerRecord } from '../../../capabilities/signer/types';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import { AddAccountScreen } from '../../accounts/AddAccountScreen';
import type { ExistingWalletCreateResult } from '../../accounts/createExistingWalletAccount';
import { MnemonicBackupVerification } from '../MnemonicBackupVerification';
import { OnboardingScreen } from '../OnboardingScreen';
import { PendingMnemonicBackupScreen } from '../PendingMnemonicBackupScreen';
import type { OnboardingProvisioningDependencies } from '../runOnboardingProvisioning';

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return { ...actual, useEffect: jest.fn(), useState: jest.fn() };
});

jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme') as typeof import('@ui/theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});
jest.mock('../../../locale', () => ({
  useLocalization: () => ({
    t: (key: string) => key,
  }),
}));

const mockedUseState = useState as unknown as jest.Mock;
const mockedUseEffect = useEffect as unknown as jest.Mock;
const now = new Date('2026-09-18T00:00:00.000Z');
const mnemonic = 'alpha beta gamma delta epsilon zeta golf hotel india juliet kilo lima';

function account(): AccountRecord {
  return {
    id: 'account-created',
    address: 'GCREATED',
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: 'Created',
    sortOrder: 1,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
}

function pendingSigner(): SignerRecord {
  return {
    id: 'signer-created',
    publicKey: 'GCREATED',
    kind: 'protected-software',
    envelopeJson: '{opaque-envelope}',
    recoveryKind: 'mnemonic',
    backupState: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}

function setupDependencies() {
  const repository = new InMemoryAccountSignerRepository();
  repository.createAccountWithSigner({
    account: account(),
    signer: pendingSigner(),
    attachedAt: now,
  });
  const dependencies: OnboardingProvisioningDependencies = {
    repository,
    sdk: {} as never,
    createId: () => 'unused',
    now: () => new Date('2026-09-18T01:00:00.000Z'),
    networkId: 'stellar-testnet',
  };
  return { dependencies, repository };
}

function useStateValues(values: Readonly<Record<number, unknown>>) {
  let call = 0;
  mockedUseState.mockImplementation((initial: unknown) => {
    const value = Object.prototype.hasOwnProperty.call(values, call) ? values[call] : initial;
    call += 1;
    return [value, jest.fn()];
  });
}

type NodeProps = Readonly<{
  children?: React.ReactNode;
  mnemonic?: string;
  onVerified?: () => void | Promise<void>;
}>;

function findVerifier(root: React.ReactNode): React.ReactElement<NodeProps> | undefined {
  let verifier: React.ReactElement<NodeProps> | undefined;
  function visit(node: React.ReactNode): void {
    if (!React.isValidElement<NodeProps>(node)) return;
    if (node.type === MnemonicBackupVerification) verifier = node;
    React.Children.forEach(node.props.children, visit);
  }
  visit(root);
  return verifier;
}

describe('S01 mnemonic backup verification entry points', () => {
  beforeEach(() => {
    mockedUseState.mockReset();
    mockedUseEffect.mockReset();
    mockedUseEffect.mockImplementation(() => undefined);
  });

  it('gates first-run generated backup completion behind the shared verifier', async () => {
    const { dependencies, repository } = setupDependencies();
    const onComplete = jest.fn();
    useStateValues({
      7: { mnemonic, language: 'english', index: 0, signerId: 'signer-created' },
    });

    const root = OnboardingScreen({ dependencies, onComplete });
    const verifier = findVerifier(root);

    expect(verifier?.props.mnemonic).toBe(mnemonic);
    expect(repository.getSigner('signer-created')?.backupState).toBe('pending');
    expect(onComplete).not.toHaveBeenCalled();

    await verifier?.props.onVerified?.();

    expect(repository.getSigner('signer-created')?.backupState).toBe('confirmed');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('gates Existing-wallet Add Account Create completion behind the shared verifier', async () => {
    const { dependencies, repository } = setupDependencies();
    const onCreatedAccountReady = jest.fn();
    const created: ExistingWalletCreateResult = {
      account: { account: account(), signer: pendingSigner() },
      backup: { mnemonic, language: 'english', index: 0 },
      systemAuthRegistration: 'not-configured',
    };
    useStateValues({ 12: created });

    const root = AddAccountScreen({
      dependencies,
      onCreatedAccountReady,
      onAccountPersisted: jest.fn(),
      onWatchOnlyComplete: jest.fn(),
      onCancel: jest.fn(),
    });
    const verifier = findVerifier(root);

    expect(verifier?.props.mnemonic).toBe(mnemonic);
    expect(repository.getSigner('signer-created')?.backupState).toBe('pending');
    expect(onCreatedAccountReady).not.toHaveBeenCalled();

    await verifier?.props.onVerified?.();

    expect(repository.getSigner('signer-created')?.backupState).toBe('confirmed');
    expect(onCreatedAccountReady).toHaveBeenCalledWith('account-created');
  });

  it('gates recovered process-death backup completion behind the same verifier', async () => {
    const { dependencies, repository } = setupDependencies();
    const onComplete = jest.fn();
    useStateValues({ 1: { mnemonic, language: 'english', index: 0 } });

    const root = PendingMnemonicBackupScreen({
      dependencies,
      signerId: 'signer-created',
      onComplete,
    });
    const verifier = findVerifier(root);

    expect(verifier?.props.mnemonic).toBe(mnemonic);
    expect(repository.getSigner('signer-created')?.backupState).toBe('pending');
    expect(onComplete).not.toHaveBeenCalled();

    await verifier?.props.onVerified?.();

    expect(repository.getSigner('signer-created')?.backupState).toBe('confirmed');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
