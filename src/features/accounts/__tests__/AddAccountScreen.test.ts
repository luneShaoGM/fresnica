import React, { useState } from 'react';

import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type { AccountRecord } from '../../../capabilities/account/types';
import type { SignerRecord } from '../../../capabilities/signer/types';
import type { OnboardingProvisioningDependencies } from '../../onboarding/runOnboardingProvisioning';
import { AddAccountScreen } from '../AddAccountScreen';
import type { SensitiveTextInputHandle, SensitiveTextInputProps } from '../../onboarding/SensitiveTextInput';
import { nodes, sensitiveField, SensitiveFlowHarness } from '../../onboarding/__tests__/sensitiveFlowHarness';

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useState: jest.fn(),
    useRef: jest.fn((initial: unknown) => ({ current: initial })),
    useCallback: jest.fn((callback: unknown) => callback),
    useEffect: jest.fn(),
    useLayoutEffect: jest.fn(),
    useImperativeHandle: jest.fn(),
  };
});
jest.mock('@react-navigation/native', () => ({ useIsFocused: jest.fn(() => true), useFocusEffect: jest.fn() }));

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
        'accounts.add.deriveHd.title': 'Derive from recovery phrase',
        'accounts.add.deriveHd.subtitle': 'Create another SEP-5 account.',
        'accounts.add.deriveHd.unavailableSubtitle': 'Requires an eligible recovery source.',
        'accounts.add.deriveHd.intro': 'Choose a source and index.',
        'accounts.add.deriveHd.source': 'Recovery source',
        'accounts.add.deriveHd.index': 'Account index',
        'accounts.add.deriveHd.path': 'Derivation path',
        'accounts.add.deriveHd.invalidPath': 'Enter a valid index.',
        'accounts.add.deriveHd.action': 'Derive account',
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
    recoveryKind: 'mnemonic',
    backupState: 'confirmed',
    createdAt: now,
    updatedAt: now,
  };
}

type TestProps = Readonly<{
  children?: React.ReactNode;
  label?: string;
  title?: string;
  disabled?: boolean;
  candidate?: { signerPublicKey?: string };
}>;

function visit(node: React.ReactNode, callback: (element: React.ReactElement<TestProps>) => void): void {
  if (!React.isValidElement<TestProps>(node)) return;
  callback(node);
  React.Children.forEach(node.props.children, child => visit(child, callback));
}

function renderWithMode(
  mode?: 'create' | 'derive-hd' | 'import-mnemonic' | 'import-secret' | 'watch-only',
  repository?: InMemoryAccountSignerRepository,
) {
  let call = 0;
  mockedUseState.mockImplementation((initial: unknown) => {
    const value = call === 0 && mode !== undefined ? mode : typeof initial === 'function' ? initial() : initial;
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

function sourceAccount(): AccountRecord {
  return {
    id: 'source-account',
    address: 'GSIGNER',
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: 'Primary recovery',
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
}

function collectText(node: React.ReactNode, output: string[]): void {
  if (typeof node === 'string' || typeof node === 'number') {
    output.push(String(node));
    return;
  }
  if (!React.isValidElement<TestProps>(node)) return;
  React.Children.forEach(node.props.children, child => collectText(child, output));
}

describe('AddAccountScreen Existing-wallet account choices', () => {
  beforeEach(() => mockedUseState.mockReset());

  it('exposes Create, both Import paths, HD derivation and watch-only', () => {
    const root = renderWithMode();
    const titles: string[] = [];
    visit(root, element => {
      if (element.props.title) titles.push(element.props.title);
    });

    expect(titles).toContain('Create new wallet');
    expect(titles).toContain('Watch-only account');
    expect(titles).toContain('Import recovery phrase');
    expect(titles).toContain('Import Stellar secret');
    expect(titles).toContain('Derive from recovery phrase');
  });

  it('keeps HD derivation unavailable until an eligible mnemonic source exists', () => {
    const root = renderWithMode();
    let disabled: boolean | undefined;
    visit(root, element => {
      if (element.props.title === 'Derive from recovery phrase') disabled = element.props.disabled;
    });
    expect(disabled).toBe(true);
  });

  it('shows explicit source, index, SEP-5 path and current passphrase for HD derivation', () => {
    const repository = new InMemoryAccountSignerRepository();
    repository.createAccountWithSigner({
      account: sourceAccount(),
      signer: protectedSigner(),
      attachedAt: now,
    });
    const root = renderWithMode('derive-hd', repository);
    const labels: string[] = [];
    const sourceKeys: string[] = [];
    const textContent: string[] = [];
    visit(root, element => {
      if (element.props.label) labels.push(element.props.label);
      if (element.props.candidate?.signerPublicKey) sourceKeys.push(element.props.candidate.signerPublicKey);
    });
    collectText(root, textContent);

    expect(labels).toContain('Account label');
    expect(labels).toContain('Account index');
    expect(labels).toContain('Current App Passphrase');
    expect(labels).not.toContain('Recovery phrase');
    expect(sourceKeys).toEqual(['GSIGNER']);
    expect(textContent).toContain("m/44'/148'/1'");
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

it('requires short-password consent, resets it on edit, and prevents weak-password override', () => {
  const h = new SensitiveFlowHarness();
  const fields = new Map<string, ReturnType<typeof sensitiveField>>();
  const deps = dependencies();
  const render = () => h.render(() => AddAccountScreen({
    dependencies: deps,
    onCreatedAccountReady: jest.fn(),
    onAccountPersisted: jest.fn(),
    onWatchOnlyComplete: jest.fn(),
    onCancel: jest.fn(),
  }));
  const choices = nodes(render());
  (choices.find(node => node.props.title === 'Create new wallet')!.props.onPress as () => void)();
  const draw = () => {
    const rendered = nodes(render());
    for (const node of rendered.filter(value => value.props.inputRef)) {
      const label = String(node.props.label);
      const field = fields.get(label) ?? sensitiveField(node.props as SensitiveTextInputProps,
        node.props.inputRef as React.Ref<SensitiveTextInputHandle>);
      field.render(node.props as SensitiveTextInputProps);
      fields.set(label, field);
    }
    return {
      edit: (label: string, value: string) => fields.get(label)!.type(value),
      consent: rendered.find(n => typeof n.props.onAccept === 'function')!.props,
      create: rendered.find(n => n.props.label === 'Create account')!.props,
    };
  };
  draw().edit('New App Passphrase', 'river sky');
  draw().edit('Confirm App Passphrase', 'river sky');
  expect(draw().create.disabled).toBe(true);
  (draw().consent.onAccept as (v: boolean) => void)(true);
  expect(draw().create.disabled).toBe(false);
  draw().edit('New App Passphrase', 'river moon');
  draw().edit('Confirm App Passphrase', 'river moon');
  expect(draw().consent.accepted).toBe(false);
  expect(draw().create.disabled).toBe(true);
  draw().edit('New App Passphrase', '111111111111111');
  draw().edit('Confirm App Passphrase', '111111111111111');
  (draw().consent.onAccept as (v: boolean) => void)(true);
  expect(draw().create.disabled).toBe(true);
  expect(JSON.stringify(h.states)).not.toContain('111111111111111');
  h.unmount();
  fields.forEach(field => field.close());
});
