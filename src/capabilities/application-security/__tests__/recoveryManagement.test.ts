import type { FresnicaSdkPort } from '../../ports/FresnicaSdkPort';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import {
  changeWalletPassphrase,
  revealRecoveryMaterial,
  recoverySigners,
  type RecoveryManagementDependencies,
} from '../recoveryManagement';
const now = new Date('2026-11-12T00:00:00Z');
function setup() {
  const repository = new InMemoryAccountSignerRepository();
  for (const [id, networkId, hidden] of [
    ['a', 'stellar-mainnet', false],
    ['b', 'stellar-testnet', true],
  ] as const) {
    repository.createAccountWithSigner({
      account: {
        id,
        address: `G${id}`,
        networkId,
        hidden,
        label: id,
        identityKind: 'classic',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
      signer: {
        id,
        publicKey: `G${id}`,
        kind: 'protected-software',
        recoveryKind: 'mnemonic',
        backupState: 'confirmed',
        envelopeJson: `old-${id}`,
        createdAt: now,
        updatedAt: now,
      },
      attachedAt: now,
    });
  }
  const sdk = {
    reveal: jest.fn(async () => ({ kind: 'mnemonic', mnemonic: 'words', index: 0 })),
    reprotect: jest.fn(async (input: { expectedSignerPublicKey: string }) => ({
      signerPublicKey: input.expectedSignerPublicKey,
      envelopeJson: `new-${input.expectedSignerPublicKey}`,
    })),
    verifyProtectedSignerPassphrase: jest.fn(async () => true),
    hasSystemAuthDomain: jest.fn(async () => true),
    removeSystemAuthDomain: jest.fn(async () => true),
  };
  const deps: RecoveryManagementDependencies = {
    repository,
    sdk: sdk as unknown as FresnicaSdkPort,
    assertCurrent: jest.fn(),
    hasUnresolvedSubmission: () => false,
    now: () => new Date(now.getTime() + 1),
  };
  return { deps, repository, sdk };
}
const rotation = () => ({
  currentPassphrase: 'old-passphrase',
  newPassphrase: 'new-strong-passphrase',
  confirmation: 'new-strong-passphrase',
  signal: new AbortController().signal,
});
const reveal = () => ({ accountId: 'a', signerId: 'a', passphrase: 'fresh', signal: new AbortController().signal });
it('reveals only the attached exact signer through fresh SDK authentication', async () => {
  const { deps, sdk } = setup();
  await expect(revealRecoveryMaterial(deps, reveal())).resolves.toMatchObject({ kind: 'mnemonic' });
  expect(sdk.reveal).toHaveBeenCalledWith({
    envelopeJson: 'old-a',
    freshAppPassphrase: 'fresh',
    expectedSignerPublicKey: 'Ga',
  });
  await expect(revealRecoveryMaterial(deps, { ...reveal(), signerId: 'b' })).rejects.toThrow();
  expect(sdk.reveal).toHaveBeenCalledTimes(1);
});
it('rejects late cancelled, changed-inventory and wrong-kind results', async () => {
  for (const mode of ['cancel', 'inventory', 'kind']) {
    const { deps, repository, sdk } = setup();
    const controller = new AbortController();
    sdk.reveal.mockImplementationOnce(async () => {
      if (mode === 'cancel') controller.abort();
      if (mode === 'inventory') repository.setSignerBackupState('a', 'pending', now);
      return { kind: mode === 'kind' ? 'secret' : 'mnemonic', mnemonic: 'words', index: 0 };
    });
    await expect(revealRecoveryMaterial(deps, { ...reveal(), signal: controller.signal })).rejects.toThrow();
  }
});
it('excludes pending backups and watch-only accounts', () => {
  const { repository } = setup();
  repository.setSignerBackupState('a', 'pending', now);
  expect(recoverySigners(repository, 'a')).toEqual([]);
  expect(recoverySigners(repository, 'missing')).toEqual([]);
});
it('stages all cross-network/hidden signers, verifies, retires legacy domain and atomically replaces', async () => {
  const { deps, repository, sdk } = setup();
  repository.attachSigner('b', 'a', now);
  const commit = jest.spyOn(repository, 'replaceProtection');
  await changeWalletPassphrase(deps, rotation());
  expect(sdk.reprotect).toHaveBeenCalledTimes(2);
  expect(sdk.verifyProtectedSignerPassphrase).toHaveBeenCalledTimes(2);
  expect(sdk.removeSystemAuthDomain).toHaveBeenCalledTimes(1);
  expect(commit).toHaveBeenCalledTimes(1);
  expect(repository.listSigners().map(s => s.envelopeJson)).toEqual(['new-Ga', 'new-Gb']);
  expect(repository.listSignersForAccount('b')).toHaveLength(2);
});
it.each(['stage', 'identity', 'verify', 'cancel', 'concurrent', 'cleanup', 'commit'])(
  'keeps all old envelopes on %s failure',
  async mode => {
    const { deps, repository, sdk } = setup();
    const before = repository.listSigners();
    const input = rotation();
    const controller = new AbortController();
    input.signal = controller.signal;
    if (mode === 'stage') sdk.reprotect.mockRejectedValueOnce(new Error('wrong-password'));
    if (mode === 'identity') sdk.reprotect.mockResolvedValueOnce({ signerPublicKey: 'GWRONG', envelopeJson: 'new' });
    if (mode === 'verify') sdk.verifyProtectedSignerPassphrase.mockResolvedValueOnce(false);
    if (mode === 'cleanup') sdk.removeSystemAuthDomain.mockResolvedValueOnce(false);
    if (mode === 'commit')
      jest.spyOn(repository, 'replaceProtection').mockImplementation(() => {
        throw new Error('disk-full');
      });
    if (mode === 'cancel' || mode === 'concurrent')
      sdk.verifyProtectedSignerPassphrase.mockImplementationOnce(async () => {
        if (mode === 'cancel') controller.abort();
        else repository.setSignerBackupState('a', 'not-required', now);
        return true;
      });
    await expect(changeWalletPassphrase(deps, input)).rejects.toThrow();
    expect(repository.listSigners().map(s => s.envelopeJson)).toEqual(before.map(s => s.envelopeJson));
  },
);
it('blocks pending submissions/backups, mismatch, weak and unchanged new passwords before any SDK write', async () => {
  for (const mode of ['submission', 'backup', 'confirmation', 'weak', 'same']) {
    const { deps, repository, sdk } = setup();
    const input = rotation();
    if (mode === 'submission') Object.assign(deps, { hasUnresolvedSubmission: () => true });
    if (mode === 'backup') repository.setSignerBackupState('a', 'pending', now);
    if (mode === 'confirmation') input.confirmation = 'different';
    if (mode === 'weak') input.newPassphrase = input.confirmation = 'short';
    if (mode === 'same') input.currentPassphrase = input.newPassphrase;
    await expect(changeWalletPassphrase(deps, input)).rejects.toThrow();
    expect(sdk.reprotect).not.toHaveBeenCalled();
  }
});
it('repository rejects a partial set and stale inventory without changing either envelope', () => {
  const { repository } = setup();
  const captured = repository.listSigners().map(s => ({ ...s }));
  expect(() =>
    repository.replaceProtection(
      captured,
      [{ id: 'a', protectedSigner: { signerPublicKey: 'Ga', envelopeJson: 'new' } }],
      now,
    ),
  ).toThrow();
  repository.setSignerBackupState('b', 'not-required', now);
  expect(() => repository.replaceProtection(captured, [], now)).toThrow();
  expect(repository.listSigners().map(s => s.envelopeJson)).toEqual(['old-a', 'old-b']);
});
