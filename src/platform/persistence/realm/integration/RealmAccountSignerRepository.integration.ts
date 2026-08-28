import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AccountRecord} from '../../../../capabilities/account/types';
import type {SignerRecord} from '../../../../capabilities/signer/types';
import {RealmAccountSignerRepository} from '../RealmAccountSignerRepository';
import {openWalletRealm} from '../openWalletRealm';

const now = new Date('2026-08-28T00:00:00.000Z');

function account(id: string): AccountRecord {
  return {
    id,
    address: `G${id}`,
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: id,
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
}

function signer(id: string): SignerRecord {
  return {
    id,
    publicKey: `G${id}`,
    kind: 'protected-software',
    envelopeJson: '{opaque-envelope}',
    envelopeRevision: 'rev-1',
    recoveryKind: 'mnemonic',
    backupState: 'confirmed',
    createdAt: now,
    updatedAt: now,
  };
}

describe('RealmAccountSignerRepository integration', () => {
  it('persists relationships across close/reopen and preserves shared signer cleanup semantics', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-realm-'));
    const path = join(directory, 'wallet.realm');

    try {
      const firstRealm = await openWalletRealm({path});
      const firstRepository = new RealmAccountSignerRepository(firstRealm);
      firstRepository.createAccount(account('account-a'));
      firstRepository.createAccount(account('account-b'));
      firstRepository.createSigner(signer('shared'));
      firstRepository.attachSigner('account-a', 'shared', now);
      firstRepository.attachSigner('account-b', 'shared', now);
      firstRealm.close();

      const reopenedRealm = await openWalletRealm({path});
      const reopenedRepository = new RealmAccountSignerRepository(reopenedRealm);

      expect(reopenedRepository.getAccount('account-a')).toEqual(account('account-a'));
      expect(reopenedRepository.getAccount('account-b')).toEqual(account('account-b'));
      expect(reopenedRepository.getSigner('shared')).toEqual(signer('shared'));
      expect(reopenedRepository.isWatchOnly('account-a')).toBe(false);
      expect(reopenedRepository.isWatchOnly('account-b')).toBe(false);

      reopenedRepository.deleteAccount('account-a');
      expect(reopenedRepository.getSigner('shared')).toBeDefined();
      expect(reopenedRepository.isWatchOnly('account-b')).toBe(false);

      reopenedRepository.detachSigner('account-b', 'shared');
      expect(reopenedRepository.isWatchOnly('account-b')).toBe(true);
      expect(reopenedRepository.getSigner('shared')).toBeUndefined();
      reopenedRealm.close();
    } finally {
      rmSync(directory, {recursive: true, force: true});
    }
  });
});
