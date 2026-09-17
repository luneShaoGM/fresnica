import React, { useState } from 'react';

import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type { SignerRecord } from '../../../capabilities/signer/types';
import type { OnboardingProvisioningDependencies } from '../../onboarding/runOnboardingProvisioning';
import { AddAccountScreen } from '../AddAccountScreen';

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return { ...actual, useState: jest.fn() };
});

jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme') as typeof import('@ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

jest.mock('../../../locale', () => ({
  useLocalization: () => ({
    t: (key: string, params?: { count?: number }) =>
      ({
        'common.back': 'Back',
        'accounts.add.title': 'Add account',
        'accounts.add.intro': 'Choose how to add another account.',
        'accounts.add.create.title': 'Create new wallet',
        'accounts.add.create.subtitle': 'Generate a new recovery phrase.',
        'accounts.add.importMnemonic.title': 'Import recovery phrase',
        'accounts.add.importMnemonic.subtitle': 'Protect an existing mnemonic.',
        'accounts.add.importMnemonic.intro': 'Import recovery material.',
        'accounts.add.importMnemonic.action': 'Import account',
        'accounts.add.importSecret.title': 'Import Stellar secret',
        'accounts.add.importSecret.subtitle': 'Protect an existing secret.',
        'accounts.add.importSecret.intro': 'Import a Stellar secret.',
        'accounts.add.importSecret.action': 'Import account',
        'accounts.add.import.secret': 'Stellar secret',
        'accounts.add.import.secretPlaceholder': 'S...',
        'accounts.add.import.mnemonic': 'Recovery phrase',
        'accounts.add.import.mnemonicPlaceholder': 'Enter words in order',
        'accounts.add.import.mnemonicPassphrase': 'Mnemonic passphrase (optional)',
        'accounts.add.import.mnemonicPassphrasePlaceholder': 'Leave blank if none',
        'accounts.add.import.mnemonicIndex': 'Derivation index',
        'accounts.add.import.mnemonicLanguage': 'Mnemonic language (optional)',
        'accounts.add.import.mnemonicLanguagePlaceholder': 'For example: english',
        'accounts.add.watchOnly.title': 'Watch-only account',
        'accounts.add.watchOnly.subtitle': 'Track an address only.',
        'accounts.add.label': 'Account label',
        'accounts.add.labelPlaceholder': 'Additional account',
        'accounts.add.currentPassphrase': 'Current App Passphrase',
        'accounts.add.currentPassphrasePlaceholder': 'Enter current App Passphrase',
        'accounts.add.newPassphrase': 'New App Passphrase',
        'accounts.add.newPassphrasePlaceholder': 'At least 15 characters',
        'accounts.add.confirmPassphrase': 'Confirm App Passphrase',
        'accounts.add.confirmPassphrasePlaceholder': 'Enter it again',
        'accounts.add.passphraseMinimum': `At least ${params?.count ?? 15} characters`,
        'accounts.add.create.existingPassphraseIntro': 'Verify current passphrase.',
        'accounts.add.create.newPassphraseIntro': 'Set the first passphrase.',
        'accounts.add.create.action': 'Create account',
      })[key] ?? key,
  }),
}));

const mockedUseState = useState as unknown as jest.Mock;
const now = new Date('2026-09-16T00:00:00.000Z');

function dependencies(repository = new InMemoryAccountSignerRepository()): OnboardingProvisioningDependencies {
  return {
    repository,
    sdk: {} as never,
    createId: () => 'unused',
    now: () => now,
    networkId: 'stellar-testnet',
  };
}

function protectedSigner(): SignerRecord {
  return {
    id: 'signer-a',
    publicKey: 'GSIGNER',
    kind: 'protected-software',
    envelopeJson: '{envelope}',
    createdAt: now,
    updatedAt: now,
  };
}

type TestProps = Readonly<{
  children?: React.ReactNode;
  label?: string;
  title?: string;
}>;

function visit(node: React.ReactNode, callback: (element: React.ReactElement<TestProps>) => void): void {
  if (!React.isValidElement<TestProps>(node)) return;
  callback(node);
  React.Children.forEach(node.props.children, child => visit(child, callback));
}

function renderWithMode(
  mode?: 'create' | 'import-mnemonic' | 'import-secret' | 'watch-only',
  repository?: InMemoryAccountSignerRepository,
) {
  let call = 0;
  mockedUseState.mockImplementation((initial: unknown) => {
    const value = call === 0 && mode !== undefined ? mode : initial;
    call += 1;
    return [value, jest.fn()];
  });
  return AddAccountScreen({
    dependencies: dependencies(repository),
    onCreatedAccountReady: jest.fn(),
    onAccountPersisted: jest.fn(),
    onWatchOnlyComplete: jest.fn(),
    onCancel: jest.fn(),
  });
}

describe('AddAccountScreen Existing-wallet account choices', () => {
  beforeEach(() => mockedUseState.mockReset());

  it('exposes Create, both Import paths and watch-only while HD remains separate', () => {
    const root = renderWithMode();
    const titles: string[] = [];
    visit(root, element => {
      if (element.props.title) titles.push(element.props.title);
    });

    expect(titles).toContain('Create new wallet');
    expect(titles).toContain('Watch-only account');
    expect(titles).toContain('Import recovery phrase');
    expect(titles).toContain('Import Stellar secret');
  });

  it('asks for the current App Passphrase when a protected signer already exists', () => {
    const repository = new InMemoryAccountSignerRepository();
    repository.createSigner(protectedSigner());
    const root = renderWithMode('create', repository);
    const labels: string[] = [];
    visit(root, element => {
      if (element.props.label) labels.push(element.props.label);
    });

    expect(labels).toContain('Current App Passphrase');
    expect(labels).not.toContain('New App Passphrase');
    expect(labels).not.toContain('Confirm App Passphrase');
  });

  it('asks for a new confirmed App Passphrase when no protected signer exists', () => {
    const root = renderWithMode('create');
    const labels: string[] = [];
    visit(root, element => {
      if (element.props.label) labels.push(element.props.label);
    });

    expect(labels).toContain('New App Passphrase');
    expect(labels).toContain('Confirm App Passphrase');
    expect(labels).not.toContain('Current App Passphrase');
  });

  it('shows mnemonic recovery metadata fields without placing them in navigation state', () => {
    const root = renderWithMode('import-mnemonic');
    const labels: string[] = [];
    visit(root, element => {
      if (element.props.label) labels.push(element.props.label);
    });

    expect(labels).toContain('Recovery phrase');
    expect(labels).toContain('Mnemonic passphrase (optional)');
    expect(labels).toContain('Derivation index');
    expect(labels).toContain('Mnemonic language (optional)');
    expect(labels).toContain('New App Passphrase');
    expect(labels).toContain('Confirm App Passphrase');
  });

  it('shows Stellar secret import with current App Passphrase when protected signers exist', () => {
    const repository = new InMemoryAccountSignerRepository();
    repository.createSigner(protectedSigner());
    const root = renderWithMode('import-secret', repository);
    const labels: string[] = [];
    visit(root, element => {
      if (element.props.label) labels.push(element.props.label);
    });

    expect(labels).toContain('Stellar secret');
    expect(labels).toContain('Current App Passphrase');
    expect(labels).not.toContain('Confirm App Passphrase');
  });
});
