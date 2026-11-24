import React from 'react';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type { AccountRecord } from '../../../capabilities/account/types';
import type { SignerRecord } from '../../../capabilities/signer/types';
import { AddAccountScreen } from '../../accounts/AddAccountScreen';
import { createExistingWalletAccount } from '../../accounts/createExistingWalletAccount';
import { importExistingWalletAccount } from '../../accounts/importExistingWalletAccount';
import { OnboardingScreen } from '../OnboardingScreen';
import { PendingMnemonicBackupScreen } from '../PendingMnemonicBackupScreen';
import { MnemonicBackupVerification, type MnemonicBackupVerificationHandle } from '../MnemonicBackupVerification';
import { SensitiveTextInput, type SensitiveTextInputHandle, type SensitiveTextInputProps } from '../SensitiveTextInput';
import { runGeneratedMnemonicOnboarding, runSecretImportOnboarding, type OnboardingProvisioningDependencies } from '../runOnboardingProvisioning';
import { resolveOnboardingBootstrap } from '../onboardingBootstrap';
import { appStatePort, nodes, sensitiveField, SensitiveFlowHarness } from './sensitiveFlowHarness';
import { mnemonicBackupHarness } from './mnemonicBackupHarness';

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: jest.fn(), useRef: jest.fn(), useEffect: jest.fn(), useLayoutEffect: jest.fn(), useCallback: jest.fn(), useImperativeHandle: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn(), useIsFocused: jest.fn() }));
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme');
  return { ...actual, useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});
jest.mock('../../../locale', () => ({ useLocalization: () => ({
  t: (key: string, params?: { position: number }) => params?.position ? `${key}:${params.position}` : key,
}) }));
jest.mock('../runOnboardingProvisioning', () => ({
  ...jest.requireActual('../runOnboardingProvisioning'),
  runGeneratedMnemonicOnboarding: jest.fn(), runSecretImportOnboarding: jest.fn(),
}));
jest.mock('../../accounts/createExistingWalletAccount', () => ({ createExistingWalletAccount: jest.fn() }));
jest.mock('../../accounts/importExistingWalletAccount', () => ({ importExistingWalletAccount: jest.fn() }));

const mnemonic = 'alpha beta gamma delta epsilon zeta golf hotel india juliet kilo lima';
const passphrase = 'amber river below silver clouds';
const now = new Date('2026-11-24T00:00:00Z');
const account: AccountRecord = {
  id: 'account-created', address: 'GCREATED', identityKind: 'classic', networkId: 'stellar-testnet',
  label: 'Created', sortOrder: 0, hidden: false, createdAt: now, updatedAt: now,
};
const signer: SignerRecord = {
  id: 'signer-created', publicKey: 'GCREATED', kind: 'protected-software', envelopeJson: '{opaque-envelope}',
  recoveryKind: 'mnemonic', backupState: 'pending', createdAt: now, updatedAt: now,
};

function fixture() {
  const repository = new InMemoryAccountSignerRepository();
  const reveal = jest.fn().mockResolvedValue({ kind: 'mnemonic', mnemonic, language: 'english', index: 0 });
  const dependencies: OnboardingProvisioningDependencies = {
    repository, sdk: { reveal } as unknown as OnboardingProvisioningDependencies['sdk'],
    createId: () => 'unused', now: () => now, networkId: 'stellar-testnet',
  };
  const persist = () => repository.createAccountWithSigner({ account, signer, attachedAt: now });
  const created = { account: { account, signer }, backup: { mnemonic, language: 'english', index: 0 },
    systemAuthRegistration: 'not-configured' as const };
  return { repository, dependencies, reveal, persist, created };
}

function screenHarness(renderScreen: () => React.ReactElement) {
  const h = new SensitiveFlowHarness();
  const fields = new Map<string, ReturnType<typeof sensitiveField>>();
  let root: React.ReactElement;
  const render = () => {
    root = h.render(renderScreen);
    const current = new Set<string>();
    for (const node of nodes(root)) {
      if (!node.props.inputRef && node.type !== SensitiveTextInput) continue;
      const label = String(node.props.label ?? node.props.accessibilityLabel);
      current.add(label);
      const field = fields.get(label) ?? sensitiveField(node.props as SensitiveTextInputProps,
        (node.props.inputRef ?? node.props.ref) as React.Ref<SensitiveTextInputHandle>);
      field.render(node.props as SensitiveTextInputProps);
      fields.set(label, field);
    }
    for (const [label, field] of fields) if (!current.has(label)) { field.close(); fields.delete(label); }
    return root;
  };
  const callback = (label: string) => {
    const action = nodes(root).find(node => (node.props.label === label || node.props.title === label
      || (typeof node.props.onPress === 'function' && nodes(node).some(child => child.props.children === label)))
      && typeof node.props.onPress === 'function');
    if (!action) throw new Error(`missing-action:${label}`);
    return action.props.onPress as () => void | Promise<void>;
  };
  const press = (label: string) => callback(label)();
  render();
  return {
    h, render, press, callback, root: () => root,
    field: (label: string) => {
      const found = fields.get(label);
      if (!found) throw new Error(`missing-field:${label}`);
      return found;
    },
    back() { (nodes(root).find(node => typeof node.props.onBack === 'function')!.props.onBack as () => void)(); },
    verifier() {
      const node = nodes(root).find(value => value.type === MnemonicBackupVerification)!;
      expect(node).toBeDefined();
      expect(node.props).not.toHaveProperty('mnemonic');
      const v = mnemonicBackupHarness(node.props.onVerified as () => Promise<void>,
        node.props.ref as React.Ref<MnemonicBackupVerificationHandle>);
      v.render();
      return v;
    },
    close() { h.unmount(); fields.forEach(field => field.close()); },
  };
}

async function settle() { for (let i = 0; i < 12; i += 1) await Promise.resolve(); }

let lifecycle: ReturnType<typeof appStatePort>;
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Math, 'random').mockReturnValue(0);
  lifecycle = appStatePort();
});
afterEach(() => { lifecycle.close(); jest.restoreAllMocks(); });

it.each(['first-run', 'existing-wallet'] as const)('gates %s create behind actual three-word verification, consumes inputs before provisioning and rolls completion back on failure', async kind => {
  const f = fixture();
  const complete = jest.fn().mockRejectedValueOnce(new Error('default-persistence-failed')).mockResolvedValue(undefined);
  // First-run completion is synchronous by contract; use a synchronous failure.
  const firstComplete = jest.fn().mockImplementationOnce(() => { throw new Error('completion-failed'); });
  const h = screenHarness(() => kind === 'first-run'
    ? OnboardingScreen({ dependencies: f.dependencies, onComplete: firstComplete })
    : AddAccountScreen({ dependencies: f.dependencies, onCreatedAccountReady: complete,
      onAccountPersisted: jest.fn(), onWatchOnlyComplete: jest.fn(), onCancel: jest.fn() }));
  const currentLabel = kind === 'first-run' ? 'App passphrase' : 'accounts.add.newPassphrase';
  const confirmLabel = kind === 'first-run' ? 'Confirm app passphrase' : 'accounts.add.confirmPassphrase';
  const create = async () => {
    expect(h.field(currentLabel).native.read()).toBe('');
    expect(h.field(confirmLabel).native.read()).toBe('');
    expect(h.field(currentLabel).handle.current!.read()).toBe('');
    f.persist();
    return f.created;
  };
  jest.mocked(createExistingWalletAccount).mockImplementation(create);
  jest.mocked(runGeneratedMnemonicOnboarding).mockImplementation(async () => ({
    ...await create(), state: { step: 'backup-generated-mnemonic', method: 'generate-mnemonic' },
  }));
  h.press(kind === 'first-run' ? 'Create new wallet' : 'accounts.add.create.title'); h.render();
  h.field(currentLabel).type(passphrase); h.field(confirmLabel).type(passphrase); h.render();
  const submit = kind === 'first-run' ? 'Continue' : 'accounts.add.create.action';
  h.press(submit); h.press(submit); await settle(); h.render();
  expect(kind === 'first-run' ? runGeneratedMnemonicOnboarding : createExistingWalletAccount).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(h.h.states)).not.toContain(mnemonic);
  expect(JSON.stringify(h.root())).not.toContain(mnemonic);
  const v = h.verifier();
  expect(v.outputs().map(output => output.read())).toEqual(mnemonic.split(' '));
  expect(f.repository.getSigner(signer.id)?.backupState).toBe('pending');
  await v.verify();
  expect(f.repository.getSigner(signer.id)?.backupState).toBe('pending');
  expect(v.h.refs.some(ref => ref.current === mnemonic)).toBe(false);
  v.close();
  const pending = h.render();
  expect(pending.type).toBe(PendingMnemonicBackupScreen);
  const recovery = screenHarness(() => PendingMnemonicBackupScreen(pending.props as React.ComponentProps<typeof PendingMnemonicBackupScreen>));
  recovery.field('App passphrase').type(passphrase); recovery.render();
  await recovery.press('Reveal recovery phrase'); recovery.render();
  const fresh = recovery.verifier(); await fresh.verify();
  expect(f.repository.getSigner(signer.id)?.backupState).toBe('confirmed');
  expect(kind === 'first-run' ? firstComplete : complete).toHaveBeenCalledTimes(2);
  expect(f.reveal).toHaveBeenCalledTimes(1);
  fresh.close(); recovery.close(); h.close();
});

it.each(['back', 'blur', 'background', 'unmount'] as const)('retires a delayed create on %s, never releases its duplicate gate early and preserves only persisted pending identity', async exit => {
  const f = fixture();
  let finish!: () => void;
  jest.mocked(runGeneratedMnemonicOnboarding).mockImplementation(() => new Promise(resolve => {
    finish = () => { f.persist(); resolve({ ...f.created, state: { step: 'backup-generated-mnemonic' } }); };
  }));
  const onComplete = jest.fn();
  const h = screenHarness(() => OnboardingScreen({ dependencies: f.dependencies, onComplete }));
  h.press('Create new wallet'); h.render();
  h.field('App passphrase').type(passphrase); h.field('Confirm app passphrase').type(passphrase); h.render();
  h.press('Continue');
  if (exit === 'back') h.back();
  if (exit === 'blur') { h.h.blur(); h.h.focus(); }
  if (exit === 'background') { lifecycle.change('inactive'); lifecycle.change('active'); }
  if (exit === 'unmount') h.close();
  // Old captured button callbacks cannot start another create after retirement.
  h.press('Continue');
  expect(runGeneratedMnemonicOnboarding).toHaveBeenCalledTimes(1);
  const before = JSON.stringify(h.h.states);
  finish(); await settle();
  expect(resolveOnboardingBootstrap(f.dependencies)).toMatchObject({ kind: 'pending-mnemonic-backup', signerId: signer.id });
  expect(onComplete).not.toHaveBeenCalled();
  if (exit === 'unmount') expect(JSON.stringify(h.h.states)).toBe(before);
  else {
    const root = h.render();
    expect(root.type).toBe(PendingMnemonicBackupScreen);
    expect(JSON.stringify(root)).not.toContain(mnemonic);
    expect(JSON.stringify(h.h.states)).not.toContain(mnemonic);
    h.close();
  }
});

it('clears a displayed phrase on blur and resumes the same persisted account through fresh-passphrase recovery', async () => {
  const f = fixture();
  jest.mocked(runGeneratedMnemonicOnboarding).mockImplementation(async () => {
    f.persist(); return { ...f.created, state: { step: 'backup-generated-mnemonic' } };
  });
  const onComplete = jest.fn();
  const h = screenHarness(() => OnboardingScreen({ dependencies: f.dependencies, onComplete }));
  h.press('Create new wallet'); h.render();
  h.field('App passphrase').type(passphrase); h.field('Confirm app passphrase').type(passphrase); h.render();
  h.press('Continue'); await settle(); h.render();
  const old = h.verifier();
  h.h.blur();
  expect(old.outputs().every(output => output.read() === '')).toBe(true);
  h.h.focus();
  const pending = h.render();
  expect(pending.type).toBe(PendingMnemonicBackupScreen);
  const recovery = screenHarness(() => PendingMnemonicBackupScreen(pending.props as React.ComponentProps<typeof PendingMnemonicBackupScreen>));
  recovery.field('App passphrase').type('fresh-recovery-passphrase'); recovery.render();
  f.reveal.mockImplementation(async input => {
    expect(recovery.field('App passphrase').native.read()).toBe('');
    expect(input.freshAppPassphrase).toBe('fresh-recovery-passphrase');
    return { kind: 'mnemonic', mnemonic };
  });
  await recovery.press('Reveal recovery phrase'); recovery.render();
  const fresh = recovery.verifier(); await fresh.verify();
  expect(runGeneratedMnemonicOnboarding).toHaveBeenCalledTimes(1);
  expect(f.reveal).toHaveBeenCalledTimes(1);
  expect(f.repository.getSigner(signer.id)?.backupState).toBe('confirmed');
  expect(onComplete).toHaveBeenCalledTimes(1);
  fresh.close(); recovery.close(); old.close(); h.close();
});

it('clears failed reveal input, accepts a fresh retry, and ignores a late result after signer replacement', async () => {
  const f = fixture(); f.persist();
  let target = signer.id;
  const onComplete = jest.fn();
  const h = screenHarness(() => PendingMnemonicBackupScreen({ dependencies: f.dependencies, signerId: target, onComplete }));
  f.reveal.mockRejectedValueOnce(new Error('wrong-passphrase'));
  h.field('App passphrase').type('wrong-passphrase'); h.render();
  await h.press('Reveal recovery phrase'); h.render();
  expect(h.field('App passphrase').native.read()).toBe('');
  let finish!: (value: unknown) => void;
  f.reveal.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  h.field('App passphrase').type(passphrase); h.render();
  const pending = h.press('Reveal recovery phrase');
  target = 'replacement-signer'; h.render();
  finish({ kind: 'mnemonic', mnemonic }); await pending; h.render();
  expect(nodes(h.root()).some(node => node.type === MnemonicBackupVerification)).toBe(false);
  expect(JSON.stringify(h.h.states)).not.toContain(mnemonic);
  expect(onComplete).not.toHaveBeenCalled();
  expect(f.repository.getSigner(signer.id)?.backupState).toBe('pending');
  h.close();
});

it('consumes imported private keys and mnemonic/passphrase inputs before the feature operation', async () => {
  const f = fixture();
  const onComplete = jest.fn();
  const first = screenHarness(() => OnboardingScreen({ dependencies: f.dependencies, onComplete }));
  first.press('Import Stellar secret'); first.render();
  first.field('Stellar secret').type('S-PRIVATE-IMPORT');
  first.field('App passphrase').type(passphrase); first.field('Confirm app passphrase').type(passphrase); first.render();
  jest.mocked(runSecretImportOnboarding).mockImplementation(async (_deps, input) => {
    expect(input.secret).toBe('S-PRIVATE-IMPORT');
    expect(first.field('Stellar secret').native.read()).toBe('');
    expect(first.field('App passphrase').native.read()).toBe('');
    return { account: { account, signer }, state: { step: 'complete' } };
  });
  first.press('Continue'); await settle();
  expect(onComplete).toHaveBeenCalledTimes(1);
  first.close();

  const added = screenHarness(() => AddAccountScreen({ dependencies: f.dependencies,
    onCreatedAccountReady: jest.fn(), onAccountPersisted: jest.fn(), onWatchOnlyComplete: jest.fn(), onCancel: jest.fn() }));
  added.press('accounts.add.importMnemonic.title'); added.render();
  added.field('accounts.add.import.mnemonic').type(mnemonic);
  added.field('accounts.add.import.mnemonicPassphrase').type('mnemonic-only-password');
  added.field('accounts.add.newPassphrase').type(passphrase);
  added.field('accounts.add.confirmPassphrase').type(passphrase); added.render();
  jest.mocked(importExistingWalletAccount).mockImplementation(async (_deps, input) => {
    expect(input).toMatchObject({ mnemonic, mnemonicPassphrase: 'mnemonic-only-password', appPassphrase: passphrase });
    for (const key of ['accounts.add.import.mnemonic', 'accounts.add.import.mnemonicPassphrase', 'accounts.add.newPassphrase']) {
      expect(added.field(key).native.read()).toBe('');
    }
    return { account: { account, signer }, systemAuthRegistration: 'not-configured' };
  });
  await added.press('accounts.add.importMnemonic.action');
  expect(importExistingWalletAccount).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(added.h.states)).not.toContain(mnemonic);
  expect(JSON.stringify(added.h.states)).not.toContain('mnemonic-only-password');
  added.close();
});

it.each(['first-run', 'existing-wallet'] as const)('reconciles a retired %s import from public persistence without reviving its secrets or changing an old default', async kind => {
  const f = fixture();
  const refreshed = jest.fn();
  const selected = jest.fn();
  let finish!: () => void;
  const imported = { account: { account, signer: { ...signer, backupState: 'not-required' as const } },
    systemAuthRegistration: 'not-configured' as const };
  const waitForImport = () => new Promise<typeof imported>(resolve => {
    finish = () => {
      f.repository.createAccountWithSigner({ account, signer: imported.account.signer, attachedAt: now });
      resolve(imported);
    };
  });
  jest.mocked(importExistingWalletAccount).mockImplementation(waitForImport);
  jest.mocked(runSecretImportOnboarding).mockImplementation(async () => ({
    ...await waitForImport(), state: { step: 'complete' },
  }));
  const h = screenHarness(() => kind === 'first-run'
    ? OnboardingScreen({ dependencies: f.dependencies, onComplete: refreshed })
    : AddAccountScreen({ dependencies: f.dependencies, onCreatedAccountReady: selected,
      onAccountPersisted: refreshed, onWatchOnlyComplete: jest.fn(), onCancel: jest.fn() }));
  h.press(kind === 'first-run' ? 'Import Stellar secret' : 'accounts.add.importSecret.title'); h.render();
  h.field(kind === 'first-run' ? 'Stellar secret' : 'accounts.add.import.secret').type('S-RETIRED-IMPORT');
  h.field(kind === 'first-run' ? 'App passphrase' : 'accounts.add.newPassphrase').type(passphrase);
  h.field(kind === 'first-run' ? 'Confirm app passphrase' : 'accounts.add.confirmPassphrase').type(passphrase);
  h.render();
  h.press(kind === 'first-run' ? 'Continue' : 'accounts.add.importSecret.action');
  h.h.blur(); h.h.focus();
  finish(); await settle(); h.render();
  expect(resolveOnboardingBootstrap(f.dependencies).kind).toBe('ready');
  expect(refreshed).toHaveBeenCalledTimes(1);
  expect(selected).not.toHaveBeenCalled();
  expect(JSON.stringify(h.h.states)).not.toContain('S-RETIRED-IMPORT');
  h.close();
});

it.each(['mode-change', 'blur-return'] as const)('rejects an old Continue after %s and request settlement while a freshly rendered callback still works', async change => {
  const f = fixture();
  let rejectFirst!: (reason: Error) => void;
  jest.mocked(runGeneratedMnemonicOnboarding).mockReset()
    .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }))
    .mockRejectedValueOnce(new Error('fresh-create-rejected'));
  jest.mocked(runSecretImportOnboarding).mockResolvedValue({
    account: { account, signer }, state: { step: 'complete' },
  });
  const h = screenHarness(() => OnboardingScreen({ dependencies: f.dependencies, onComplete: jest.fn() }));
  h.press('Create new wallet'); h.render();
  h.field('App passphrase').type(passphrase); h.field('Confirm app passphrase').type(passphrase); h.render();
  const oldContinue = h.callback('Continue');
  oldContinue();
  if (change === 'mode-change') {
    h.back(); h.render();
    h.press('Import Stellar secret'); h.render();
  } else {
    h.h.blur(); h.h.focus();
  }
  rejectFirst(new Error('retired-create-rejected')); await settle(); h.render();
  if (change === 'mode-change') h.field('Stellar secret').type('S-FRESH-IMPORT');
  h.field('App passphrase').type(passphrase); h.field('Confirm app passphrase').type(passphrase); h.render();
  const freshContinue = h.callback('Continue');
  oldContinue(); await settle();
  expect(runGeneratedMnemonicOnboarding).toHaveBeenCalledTimes(1);
  expect(runSecretImportOnboarding).not.toHaveBeenCalled();
  expect(h.field('App passphrase').native.read()).toBe(passphrase);
  freshContinue(); await settle();
  expect(change === 'mode-change' ? runSecretImportOnboarding : runGeneratedMnemonicOnboarding)
    .toHaveBeenCalledTimes(change === 'mode-change' ? 1 : 2);
  h.close();
});

it('retires an old reveal callback on owner replacement and schedules a usable public render for the new scope', async () => {
  const first = fixture(), next = fixture();
  first.persist(); next.persist();
  let dependencies = first.dependencies;
  const h = screenHarness(() => PendingMnemonicBackupScreen({ dependencies, signerId: signer.id, onComplete: jest.fn() }));
  h.field('App passphrase').type(passphrase); h.render();
  // The form is empty before replacement; epoch publication, rather than
  // plaintext/presence changes, must make the next scope render usable.
  h.field('App passphrase').type(''); h.render();
  h.h.blur(); h.h.focus(); h.render();
  const oldReveal = h.callback('Reveal recovery phrase');
  const before = JSON.stringify(h.h.states);
  dependencies = next.dependencies;
  h.render();
  expect(JSON.stringify(h.h.states)).not.toBe(before);
  h.render();
  h.field('App passphrase').type('fresh-replacement-passphrase'); h.render();
  await oldReveal();
  expect(first.reveal).not.toHaveBeenCalled();
  expect(next.reveal).not.toHaveBeenCalled();
  expect(h.field('App passphrase').native.read()).toBe('fresh-replacement-passphrase');
  await h.press('Reveal recovery phrase');
  expect(next.reveal).toHaveBeenCalledWith(expect.objectContaining({ freshAppPassphrase: 'fresh-replacement-passphrase' }));
  expect(next.reveal).toHaveBeenCalledTimes(1);
  h.close();
});

it.each([
  ['first-run', 'pending'], ['first-run', 'empty'],
  ['existing-wallet', 'pending'], ['existing-wallet', 'empty'],
] as const)('reconciles a late %s create against the current %s repository instead of its retired owner', async (kind, currentState) => {
  const old = fixture(), next = fixture();
  const currentAccount = { ...account, id: 'account-current', address: 'GCURRENT' };
  const currentSigner = { ...signer, id: 'signer-current', publicKey: 'GCURRENT' };
  if (currentState === 'pending') next.repository.createAccountWithSigner({
    account: currentAccount, signer: currentSigner, attachedAt: now,
  });
  let dependencies = old.dependencies;
  const oldComplete = jest.fn(), currentComplete = jest.fn();
  const oldRefresh = jest.fn(), currentRefresh = jest.fn();
  let finish!: () => void;
  const waitForOldCreate = () => new Promise<typeof old.created>(resolve => {
    finish = () => { old.persist(); resolve(old.created); };
  });
  jest.mocked(createExistingWalletAccount).mockImplementation(waitForOldCreate);
  jest.mocked(runGeneratedMnemonicOnboarding).mockImplementation(async () => ({
    ...await waitForOldCreate(), state: { step: 'backup-generated-mnemonic' },
  }));
  const h = screenHarness(() => kind === 'first-run'
    ? OnboardingScreen({ dependencies, onComplete: dependencies === old.dependencies ? oldComplete : currentComplete })
    : AddAccountScreen({ dependencies,
      onCreatedAccountReady: dependencies === old.dependencies ? oldComplete : currentComplete,
      onAccountPersisted: dependencies === old.dependencies ? oldRefresh : currentRefresh,
      onWatchOnlyComplete: jest.fn(), onCancel: jest.fn() }));
  const passphraseLabel = kind === 'first-run' ? 'App passphrase' : 'accounts.add.newPassphrase';
  const confirmationLabel = kind === 'first-run' ? 'Confirm app passphrase' : 'accounts.add.confirmPassphrase';
  const submitLabel = kind === 'first-run' ? 'Continue' : 'accounts.add.create.action';
  h.press(kind === 'first-run' ? 'Create new wallet' : 'accounts.add.create.title'); h.render();
  h.field(passphraseLabel).type(passphrase); h.field(confirmationLabel).type(passphrase); h.render();
  h.press(submitLabel);
  dependencies = next.dependencies; h.render(); h.render();
  finish(); await settle();
  const root = h.render();
  expect(old.repository.getSigner(signer.id)?.backupState).toBe('pending');
  expect(oldComplete).not.toHaveBeenCalled();
  expect(oldRefresh).not.toHaveBeenCalled();
  expect(currentComplete).not.toHaveBeenCalled();
  if (currentState === 'pending') {
    expect(root.type).toBe(PendingMnemonicBackupScreen);
    expect((root.props as { signerId: string }).signerId).toBe(currentSigner.id);
    expect((root.props as { disabled: boolean }).disabled).toBe(false);
    expect(JSON.stringify(h.h.states)).not.toContain(signer.id);
  } else {
    expect(nodes(root).some(node => node.type === PendingMnemonicBackupScreen)).toBe(false);
    expect(JSON.stringify(h.h.states)).not.toContain(signer.id);
    h.field(passphraseLabel).type(passphrase); h.field(confirmationLabel).type(passphrase); h.render();
    const rejectFreshCreate = async (deps: OnboardingProvisioningDependencies) => {
      expect(deps).toBe(next.dependencies);
      throw new Error('fresh-create-request');
    };
    jest.mocked(createExistingWalletAccount).mockImplementation(rejectFreshCreate);
    jest.mocked(runGeneratedMnemonicOnboarding).mockImplementation(rejectFreshCreate);
    h.press(submitLabel); await settle();
    expect(kind === 'first-run' ? runGeneratedMnemonicOnboarding : createExistingWalletAccount).toHaveBeenCalledTimes(2);
  }
  h.close();
});

it.each(['first-run', 'existing-wallet'] as const)('clears the former %s pending identity when an empty repository replaces it during recovery', async kind => {
  const old = fixture(), next = fixture();
  let dependencies = old.dependencies;
  const oldComplete = jest.fn(), currentComplete = jest.fn();
  jest.mocked(createExistingWalletAccount).mockImplementation(async () => { old.persist(); return old.created; });
  jest.mocked(runGeneratedMnemonicOnboarding).mockImplementation(async () => {
    old.persist(); return { ...old.created, state: { step: 'backup-generated-mnemonic' } };
  });
  const h = screenHarness(() => kind === 'first-run'
    ? OnboardingScreen({ dependencies, onComplete: dependencies === old.dependencies ? oldComplete : currentComplete })
    : AddAccountScreen({ dependencies,
      onCreatedAccountReady: dependencies === old.dependencies ? oldComplete : currentComplete,
      onAccountPersisted: jest.fn(), onWatchOnlyComplete: jest.fn(), onCancel: jest.fn() }));
  const passphraseLabel = kind === 'first-run' ? 'App passphrase' : 'accounts.add.newPassphrase';
  const confirmationLabel = kind === 'first-run' ? 'Confirm app passphrase' : 'accounts.add.confirmPassphrase';
  h.press(kind === 'first-run' ? 'Create new wallet' : 'accounts.add.create.title'); h.render();
  h.field(passphraseLabel).type(passphrase); h.field(confirmationLabel).type(passphrase); h.render();
  h.press(kind === 'first-run' ? 'Continue' : 'accounts.add.create.action'); await settle(); h.render();
  const displayed = h.verifier();
  h.h.blur(); h.h.focus();
  const pending = h.render();
  expect(pending.type).toBe(PendingMnemonicBackupScreen);
  const recovery = screenHarness(() => PendingMnemonicBackupScreen(pending.props as React.ComponentProps<typeof PendingMnemonicBackupScreen>));
  let finishReveal!: (value: unknown) => void;
  old.reveal.mockImplementationOnce(() => new Promise(resolve => { finishReveal = resolve; }));
  recovery.field('App passphrase').type(passphrase); recovery.render();
  const revealing = recovery.press('Reveal recovery phrase');
  dependencies = next.dependencies; h.render();
  const current = h.render();
  expect(nodes(current).some(node => node.type === PendingMnemonicBackupScreen)).toBe(false);
  expect(JSON.stringify(h.h.states)).not.toContain(signer.id);
  expect(JSON.stringify(h.h.states)).not.toContain(account.id);
  // React unmounts this old recovery child when the parent returns to its form.
  recovery.close();
  finishReveal({ kind: 'mnemonic', mnemonic }); await revealing;
  expect(oldComplete).not.toHaveBeenCalled();
  expect(currentComplete).not.toHaveBeenCalled();
  expect(old.repository.getSigner(signer.id)?.backupState).toBe('pending');
  expect(nodes(h.render()).some(node => node.type === PendingMnemonicBackupScreen)).toBe(false);
  expect((h.field(passphraseLabel).render().props as { editable: boolean }).editable).toBe(true);
  displayed.close(); h.close();
});

it('drops a reveal from replaced dependencies and completes only the current repository pending identity', async () => {
  const old = fixture(), next = fixture(); old.persist();
  const currentAccount = { ...account, id: 'account-current', address: 'GCURRENT' };
  const currentSigner = { ...signer, id: 'signer-current', publicKey: 'GCURRENT' };
  next.repository.createAccountWithSigner({ account: currentAccount, signer: currentSigner, attachedAt: now });
  const currentWords = mnemonic.split(' ').reverse();
  next.reveal.mockResolvedValue({ kind: 'mnemonic', mnemonic: currentWords.join(' ') });
  let dependencies = old.dependencies;
  const oldComplete = jest.fn(), currentComplete = jest.fn();
  const h = screenHarness(() => PendingMnemonicBackupScreen({
    dependencies, signerId: dependencies === old.dependencies ? signer.id : currentSigner.id,
    onComplete: dependencies === old.dependencies ? oldComplete : currentComplete,
  }));
  let finishReveal!: (value: unknown) => void;
  old.reveal.mockImplementationOnce(() => new Promise(resolve => { finishReveal = resolve; }));
  h.field('App passphrase').type(passphrase); h.render();
  const revealing = h.press('Reveal recovery phrase');
  dependencies = next.dependencies; h.render(); h.render();
  finishReveal({ kind: 'mnemonic', mnemonic }); await revealing; h.render();
  expect(nodes(h.root()).some(node => node.type === MnemonicBackupVerification)).toBe(false);
  expect(oldComplete).not.toHaveBeenCalled();
  h.field('App passphrase').type('fresh-current-passphrase'); h.render();
  await h.press('Reveal recovery phrase'); h.render();
  const current = h.verifier();
  expect(current.outputs().map(output => output.read())).toEqual(currentWords);
  await current.verify(currentWords.slice(0, 3));
  expect(currentComplete).toHaveBeenCalledTimes(1);
  expect(oldComplete).not.toHaveBeenCalled();
  expect(old.repository.getSigner(signer.id)?.backupState).toBe('pending');
  expect(next.repository.getSigner(currentSigner.id)?.backupState).toBe('confirmed');
  current.close(); h.close();
});
