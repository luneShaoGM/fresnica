import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import { InMemoryPendingSubmissionRepository } from '../../../platform/persistence/memory/InMemoryPendingSubmissionRepository';
import type { AccountRecord } from '../types';
import type { SignerRecord } from '../../signer/types';
import { canDowngradeLocalAccount, downgradeLocalAccount } from '../downgradeLocalAccount';
import { importSecretAccount } from '../provisionAccount';
import type { FresnicaSdkPort } from '../../ports/FresnicaSdkPort';

const now = new Date('2026-11-24T00:00:00.000Z');
const account: AccountRecord = {
  id: 'a',
  address: 'Ga',
  identityKind: 'classic',
  networkId: 'stellar-testnet',
  label: 'Keep',
  sortOrder: 7,
  hidden: false,
  createdAt: now,
  updatedAt: now,
};
const signer: SignerRecord = {
  id: 's',
  publicKey: 'Ga',
  kind: 'protected-software',
  envelopeJson: '{opaque}',
  envelopeRevision: 'rev-1',
  recoveryKind: 'secret',
  backupState: 'not-required',
  createdAt: now,
  updatedAt: now,
};

function fixture() {
  const repository = new InMemoryAccountSignerRepository();
  repository.createAccount(account);
  repository.createSigner(signer);
  repository.attachSigner(account.id, signer.id, now);
  const pendingSubmissions = new InMemoryPendingSubmissionRepository();
  const verifyProtectedSignerPassphrase = jest.fn(async () => true);
  const onDowngraded = jest.fn();
  const assertCurrent = jest.fn();
  return {
    repository,
    pendingSubmissions,
    verifyProtectedSignerPassphrase,
    onDowngraded,
    assertCurrent,
    deps: {
      repository,
      pendingSubmissions,
      sdk: { verifyProtectedSignerPassphrase },
      onDowngraded,
      assertCurrent,
      networkId: 'stellar-testnet',
    },
  };
}

it('verifies the exact signer, preserves public account data, and retires signing results', async () => {
  const f = fixture();
  await downgradeLocalAccount(f.deps, 'a', 'fresh', new AbortController().signal);
  expect(f.verifyProtectedSignerPassphrase).toHaveBeenCalledWith({
    envelopeJson: '{opaque}',
    appPassphrase: 'fresh',
    expectedSignerPublicKey: 'Ga',
  });
  expect(f.repository.getAccount('a')).toEqual(account);
  expect(f.repository.isWatchOnly('a')).toBe(true);
  expect(f.repository.getSigner('s')).toBeUndefined();
  expect(f.onDowngraded).toHaveBeenCalledTimes(1);
});

it.each(['wrong', 'cancel', 'stale'] as const)('fails closed on %s authorization', async kind => {
  const f = fixture();
  if (kind === 'wrong') f.verifyProtectedSignerPassphrase.mockResolvedValueOnce(false);
  if (kind === 'stale')
    f.verifyProtectedSignerPassphrase.mockImplementationOnce(async () => {
      f.repository.setAccountLabel('a', 'Changed', now);
      return true;
    });
  const controller = new AbortController();
  if (kind === 'cancel') controller.abort();
  await expect(downgradeLocalAccount(f.deps, 'a', 'fresh', controller.signal)).rejects.toThrow();
  expect(f.repository.isWatchOnly('a')).toBe(false);
  expect(f.onDowngraded).not.toHaveBeenCalled();
});

it('rejects a retired route/session after verification', async () => {
  const f = fixture();
  f.assertCurrent
    .mockImplementationOnce(() => undefined)
    .mockImplementationOnce(() => {
      throw new Error('account-context-changed');
    });
  await expect(downgradeLocalAccount(f.deps, 'a', 'fresh', new AbortController().signal)).rejects.toThrow(
    'account-context-changed',
  );
  expect(f.repository.isWatchOnly('a')).toBe(false);
});

it('rejects a passphrase rotation that changes the target envelope during verification', async () => {
  const f = fixture();
  f.verifyProtectedSignerPassphrase.mockImplementationOnce(async () => {
    f.repository.replaceProtection(
      [signer],
      [{ id: signer.id, protectedSigner: { signerPublicKey: signer.publicKey, envelopeJson: '{rotated}' } }],
      new Date(now.getTime() + 1),
    );
    return true;
  });
  await expect(downgradeLocalAccount(f.deps, 'a', 'fresh', new AbortController().signal)).rejects.toThrow(
    'account-context-changed',
  );
  expect(f.repository.isWatchOnly('a')).toBe(false);
});

it('blocks unresolved transactions and unfinished mnemonic backup', async () => {
  const f = fixture();
  f.pendingSubmissions.create({
    id: 'pending',
    networkId: 'stellar-testnet',
    accountId: 'a',
    sourceAddress: 'Ga',
    transactionHash: 'hash',
    intentKind: 'payment',
    intentKey: 'payment-a',
    state: 'uncertain',
    createdAt: now,
    updatedAt: now,
  });
  await expect(downgradeLocalAccount(f.deps, 'a', 'fresh', new AbortController().signal)).rejects.toThrow(
    'account-downgrade-pending-submission',
  );
  expect(f.verifyProtectedSignerPassphrase).not.toHaveBeenCalled();
  f.repository.setSignerBackupState('s', 'pending', now);
  expect(canDowngradeLocalAccount(f.repository, 'a')).toBe(false);
});

it('rechecks a transaction that becomes uncertain while native verification is in flight', async () => {
  const f = fixture();
  f.verifyProtectedSignerPassphrase.mockImplementationOnce(async () => {
    f.pendingSubmissions.create({
      id: 'pending',
      networkId: 'stellar-mainnet',
      accountId: 'another-row',
      sourceAddress: 'Ga',
      transactionHash: 'hash',
      intentKind: 'payment',
      intentKey: 'payment-a',
      state: 'submitting',
      createdAt: now,
      updatedAt: now,
    });
    return true;
  });
  await expect(downgradeLocalAccount(f.deps, 'a', 'fresh', new AbortController().signal)).rejects.toThrow(
    'account-downgrade-pending-submission',
  );
  expect(f.repository.isWatchOnly('a')).toBe(false);
});

it('retains a signer shared with another account', async () => {
  const f = fixture();
  f.repository.createAccount({ ...account, id: 'b', networkId: 'stellar-mainnet' });
  f.repository.attachSigner('b', 's', now);
  await downgradeLocalAccount(f.deps, 'a', 'fresh', new AbortController().signal);
  expect(f.repository.isWatchOnly('a')).toBe(true);
  expect(f.repository.isWatchOnly('b')).toBe(false);
  expect(f.repository.getSigner('s')).toEqual(signer);
});

it('blocks while another protected Create/Import/HD owner is in flight', async () => {
  const f = fixture();
  let failProvision!: (reason: Error) => void;
  const sdk = {
    protectSecret: () =>
      new Promise((_, reject) => {
        failProvision = reject;
      }),
  } as unknown as FresnicaSdkPort;
  const provision = importSecretAccount(
    {
      sdk,
      repository: f.repository,
      createId: () => 'new',
      now: () => now,
    },
    { secret: 'fixture', appPassphrase: 'fresh', networkId: 'stellar-testnet' },
  );
  await expect(downgradeLocalAccount(f.deps, 'a', 'fresh', new AbortController().signal)).rejects.toThrow(
    'account-downgrade-busy',
  );
  failProvision(new Error('fixture-stopped'));
  await expect(provision).rejects.toThrow('fixture-stopped');
});

it('rejects ambiguous signer context before requesting a passphrase', async () => {
  const f = fixture();
  f.repository.createSigner({ ...signer, id: 'other', publicKey: 'Gother' });
  f.repository.attachSigner('a', 'other', now);
  await expect(downgradeLocalAccount(f.deps, 'a', 'fresh', new AbortController().signal)).rejects.toThrow(
    'account-context-changed',
  );
  expect(f.verifyProtectedSignerPassphrase).not.toHaveBeenCalled();
});
