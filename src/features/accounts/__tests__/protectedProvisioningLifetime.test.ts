import { createApplicationSession } from '../../../app/applicationSession';
import { createServiceSession } from '../../../app/network/createServiceSession';
import { createNetworkAccountRepository } from '../../../capabilities/account/createNetworkAccountRepository';
import { verifyExistingAppPassphrase } from '../../../capabilities/application-security/verifyExistingAppPassphrase';
import type { FresnicaSdkPort } from '../../../capabilities/ports/FresnicaSdkPort';
import type {
  DeriveMnemonicSignerInput,
  GenerateMnemonicInput,
  ProtectMnemonicInput,
  ProtectSecretInput,
  VerifyProtectedSignerPassphraseInput,
} from '../../../capabilities/ports/fresnicaTypes';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import {
  runGeneratedMnemonicOnboarding,
  runMnemonicImportOnboarding,
  runSecretImportOnboarding,
  type OnboardingProvisioningDependencies,
} from '../../onboarding/runOnboardingProvisioning';
import { createExistingWalletAccount } from '../createExistingWalletAccount';
import { deriveExistingWalletAccount } from '../deriveExistingWalletAccount';
import { importExistingWalletAccount } from '../importExistingWalletAccount';

type Entry = 'existing-wallet' | 'first-run';
type Operation = 'create' | 'secret' | 'mnemonic';
const firstPassphrase = 'amber river below silver clouds';
const otherPassphrase = 'violet forest beyond golden hills';
const now = new Date('2026-11-24T00:00:00Z');

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function settle() {
  for (let i = 0; i < 24; i += 1) await Promise.resolve();
}

function fixture(entry: Entry = 'existing-wallet') {
  const records = new InMemoryAccountSignerRepository();
  if (entry === 'existing-wallet') records.createAccount({
    id: 'watch', address: 'GWATCH', identityKind: 'classic', networkId: 'stellar-testnet',
    label: 'Watch only', sortOrder: 0, hidden: false, createdAt: now, updatedAt: now,
  });
  // These credentials belong only to the controlled native test double. The
  // real repository receives opaque envelope references, as production does.
  const credentials = new Map<string, { passphrase: string; publicKey: string }>();
  let nextEnvelope = 0;
  const protect = (passphrase: string) => {
    nextEnvelope += 1;
    const signerPublicKey = `GPROTECTED${nextEnvelope}`;
    const envelopeJson = `{opaque-envelope-${nextEnvelope}}`;
    credentials.set(envelopeJson, { passphrase, publicKey: signerPublicKey });
    return { signerPublicKey, envelopeJson };
  };
  let paused: { operation: Operation | 'authorize' | 'derive'; wait: ReturnType<typeof deferred> } | undefined;
  const pause = (operation: Operation | 'authorize' | 'derive') => {
    const wait = deferred();
    paused = { operation, wait };
    return wait;
  };
  const waitForNative = async (operation: Operation | 'authorize' | 'derive') => {
    if (paused?.operation !== operation) return;
    const wait = paused.wait;
    paused = undefined;
    await wait.promise;
  };
  const native = {
    parseAccount: jest.fn(async (address: string) => ({ kind: 'classic' as const, address, publicKey: address })),
    generateMnemonic: jest.fn(async (input: GenerateMnemonicInput) => {
      await waitForNative('create');
      return { signer: protect(input.appPassphrase), mnemonic: 'alpha beta gamma delta', language: input.language, index: input.index };
    }),
    protectSecret: jest.fn(async (input: ProtectSecretInput) => {
      await waitForNative('secret');
      return protect(input.appPassphrase);
    }),
    protectMnemonic: jest.fn(async (input: ProtectMnemonicInput) => {
      await waitForNative('mnemonic');
      return protect(input.appPassphrase);
    }),
    verifyProtectedSignerPassphrase: jest.fn(async (input: VerifyProtectedSignerPassphraseInput) => {
      await waitForNative('authorize');
      const credential = credentials.get(input.envelopeJson);
      return credential?.passphrase === input.appPassphrase && credential.publicKey === input.expectedSignerPublicKey;
    }),
    deriveMnemonicSigner: jest.fn(async (input: DeriveMnemonicSignerInput) => {
      await waitForNative('derive');
      const source = credentials.get(input.sourceEnvelopeJson);
      if (source?.passphrase !== input.appPassphrase || source.publicKey !== input.expectedSourceSignerPublicKey) {
        throw new Error('invalid-passcode');
      }
      return protect(input.appPassphrase);
    }),
  };
  const service = createServiceSession();
  const rawSdk = service.bind(native as unknown as FresnicaSdkPort, true);
  const application = createApplicationSession({ repository: records, sdk: rawSdk }, () => 0);
  application.setForeground(true);
  const repository = createNetworkAccountRepository(records, 'stellar-testnet');
  let nextId = 0;
  const dependencies: OnboardingProvisioningDependencies = {
    repository,
    sdk: application.bindSensitive(rawSdk),
    networkId: 'stellar-testnet',
    createId: kind => `${kind}-${++nextId}`,
    now: () => now,
  };
  const invoke = (operation: Operation, appPassphrase: string): Promise<unknown> => {
    // Each call represents a fresh entry owner sharing the same wallet store.
    const current = { ...dependencies };
    if (entry === 'existing-wallet') {
      const protection = { appPassphrase, confirmAppPassphrase: appPassphrase };
      if (operation === 'create') return createExistingWalletAccount(current, protection);
      if (operation === 'secret') return importExistingWalletAccount(current, { ...protection, kind: 'secret', secret: 'S-IMPORT' });
      return importExistingWalletAccount(current, {
        ...protection, kind: 'mnemonic', mnemonic: 'imported recovery words', mnemonicPassphrase: '', index: 0,
      });
    }
    if (operation === 'create') return runGeneratedMnemonicOnboarding(current, {
      appPassphrase, language: 'english', strength: 128, mnemonicPassphrase: '', index: 0,
    });
    if (operation === 'secret') return runSecretImportOnboarding(current, { appPassphrase, secret: 'S-IMPORT' });
    return runMnemonicImportOnboarding(current, {
      appPassphrase, mnemonic: 'imported recovery words', mnemonicPassphrase: '', index: 0,
    });
  };
  const nativeProvisions = () => native.generateMnemonic.mock.calls.length + native.protectSecret.mock.calls.length
    + native.protectMnemonic.mock.calls.length + native.deriveMnemonicSigner.mock.calls.length;
  return { records, repository, dependencies, native, application, service, pause, invoke, nativeProvisions };
}

async function expectSharedCredential(f: ReturnType<typeof fixture>, passphrase: string, count: number) {
  expect(f.records.listSigners()).toHaveLength(count);
  await expect(verifyExistingAppPassphrase(f.dependencies, passphrase)).resolves.toBe(count);
  const wrong = passphrase === firstPassphrase ? otherPassphrase : firstPassphrase;
  await expect(verifyExistingAppPassphrase(f.dependencies, wrong)).rejects.toThrow('invalid-passcode');
  expect(f.application.getSnapshot().revision).toBe(0);
}

describe.each(['existing-wallet', 'first-run'] as const)('%s protected provisioning ownership', entry => {
  it.each([
    ['create', 'secret'], ['create', 'mnemonic'],
    ['secret', 'create'], ['mnemonic', 'create'],
    ['secret', 'mnemonic'], ['mnemonic', 'secret'],
  ] as const)('keeps %s -> %s inside one credential decision until the first operation settles', async (firstOperation, replacementOperation) => {
    const f = fixture(entry);
    const firstNative = f.pause(firstOperation);
    const first = f.invoke(firstOperation, firstPassphrase);
    await settle();
    expect(f.nativeProvisions()).toBe(1);
    expect(() => f.service.assertIdle()).toThrow('network-session-busy');
    const replacement = f.invoke(replacementOperation, otherPassphrase);
    const replacementFailure = expect(replacement).rejects.toThrow('account-provisioning-in-progress');
    await settle();
    expect(f.nativeProvisions()).toBe(1);
    expect(f.native.verifyProtectedSignerPassphrase).not.toHaveBeenCalled();
    expect(f.records.listSigners()).toHaveLength(0);

    firstNative.resolve();
    await first;
    await replacementFailure;
    expect(f.nativeProvisions()).toBe(1);
    expect(f.records.listAccounts()).toHaveLength(entry === 'existing-wallet' ? 2 : 1);
    expect(f.records.listSigners().filter(signer => signer.backupState === 'pending'))
      .toHaveLength(firstOperation === 'create' ? 1 : 0);
    await expectSharedCredential(f, firstPassphrase, 1);
    expect(() => f.service.assertIdle()).not.toThrow();
  });

  it.each(['create', 'secret'] as const)('releases a failed %s without automatically provisioning the replacement passphrase', async firstOperation => {
    const f = fixture(entry);
    const firstNative = f.pause(firstOperation);
    const first = f.invoke(firstOperation, firstPassphrase);
    const firstFailure = expect(first).rejects.toThrow('native-provision-failed');
    await settle();
    const replacementOperation = firstOperation === 'create' ? 'secret' : 'create';
    const replacementFailure = expect(f.invoke(replacementOperation, otherPassphrase))
      .rejects.toThrow('account-provisioning-in-progress');
    firstNative.reject(new Error('native-provision-failed'));
    await Promise.all([firstFailure, replacementFailure]);
    expect(f.records.listSigners()).toHaveLength(0);
    expect(f.nativeProvisions()).toBe(1);

    await f.invoke(replacementOperation, otherPassphrase);
    expect(f.nativeProvisions()).toBe(2);
    await expectSharedCredential(f, otherPassphrase, 1);
  });
});

it('owns the authorization phase before a second entry can inspect credentials or invoke its SDK operation', async () => {
  const f = fixture();
  await f.invoke('secret', firstPassphrase);
  f.native.verifyProtectedSignerPassphrase.mockClear();
  const authorization = f.pause('authorize');
  const first = f.invoke('create', firstPassphrase);
  await settle();
  expect(f.native.verifyProtectedSignerPassphrase).toHaveBeenCalledTimes(1);
  const replacementFailure = expect(f.invoke('mnemonic', otherPassphrase))
    .rejects.toThrow('account-provisioning-in-progress');
  await settle();
  expect(f.native.verifyProtectedSignerPassphrase).toHaveBeenCalledTimes(1);
  expect(f.native.generateMnemonic).not.toHaveBeenCalled();
  expect(f.native.protectMnemonic).not.toHaveBeenCalled();
  authorization.resolve();
  await first;
  await replacementFailure;
  expect(f.native.verifyProtectedSignerPassphrase).toHaveBeenCalledTimes(1);
  expect(f.native.protectMnemonic).not.toHaveBeenCalled();
  await expectSharedCredential(f, firstPassphrase, 2);
});

it.each(['create', 'secret', 'mnemonic'] as const)('a stale first-run %s entry rechecks the established credential instead of starting new protection', async operation => {
  const f = fixture('first-run');
  await f.invoke('secret', firstPassphrase);
  f.native.verifyProtectedSignerPassphrase.mockClear();
  await expect(f.invoke(operation, otherPassphrase)).rejects.toThrow('invalid-passcode');
  expect(f.nativeProvisions()).toBe(1);
  expect(f.native.verifyProtectedSignerPassphrase).toHaveBeenCalledTimes(1);

  f.native.verifyProtectedSignerPassphrase.mockClear();
  await f.invoke(operation, firstPassphrase);
  expect(f.nativeProvisions()).toBe(2);
  expect(f.native.verifyProtectedSignerPassphrase).toHaveBeenCalledTimes(1);
  await expectSharedCredential(f, firstPassphrase, 2);
});

it('holds the same owner through native-authorized HD derivation without an extra credential verification', async () => {
  const f = fixture();
  await f.invoke('mnemonic', firstPassphrase);
  const source = f.records.listSigners()[0];
  const deriving = f.pause('derive');
  const first = deriveExistingWalletAccount(f.dependencies, {
    sourceSignerId: source.id, index: 1, appPassphrase: firstPassphrase,
  });
  await settle();
  expect(f.native.deriveMnemonicSigner).toHaveBeenCalledTimes(1);
  const replacementFailure = expect(f.invoke('create', otherPassphrase))
    .rejects.toThrow('account-provisioning-in-progress');
  await settle();
  expect(f.native.verifyProtectedSignerPassphrase).not.toHaveBeenCalled();
  expect(f.native.generateMnemonic).not.toHaveBeenCalled();
  deriving.resolve();
  await first;
  await replacementFailure;
  expect(f.native.verifyProtectedSignerPassphrase).not.toHaveBeenCalled();
  expect(f.native.generateMnemonic).not.toHaveBeenCalled();
  await expectSharedCredential(f, firstPassphrase, 2);
});
