import Realm from 'realm';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openWalletRealm } from '../openWalletRealm';
import { RealmAccountSignerRepository } from '../RealmAccountSignerRepository';
const now = new Date('2026-11-12T00:00:00Z');
it('atomically updates every protection, rejects stale/partial writes, and survives Realm reopen', async () => {
  const directory = mkdtempSync(join(tmpdir(), 's03-realm-'));
  const path = join(directory, 'wallet.realm');
  let realm = await openWalletRealm({ path });
  try {
    let repository = new RealmAccountSignerRepository(realm);
    for (const id of ['a', 'b'])
      repository.createSigner({
        id,
        publicKey: `G${id}`,
        kind: 'protected-software',
        recoveryKind: 'mnemonic',
        backupState: 'confirmed',
        envelopeJson: `old-${id}`,
        createdAt: now,
        updatedAt: now,
      });
    const before = repository.listSigners();
    const updates = before.map(s => ({
      id: s.id,
      protectedSigner: { signerPublicKey: s.publicKey, envelopeJson: `new-${s.id}` },
    }));
    expect(() => repository.replaceProtection(before, updates.slice(0, 1), now)).toThrow();
    expect(repository.listSigners().map(s => s.envelopeJson)).toEqual(['old-a', 'old-b']);
    repository.replaceProtection(before, updates, now);
    expect(() => repository.replaceProtection(before, updates, now)).toThrow();
    realm.close();
    realm = await openWalletRealm({ path });
    repository = new RealmAccountSignerRepository(realm);
    expect(repository.listSigners().map(s => s.envelopeJson)).toEqual(['new-a', 'new-b']);
    expect(repository.listSigners().every(s => s.recoveryKind === 'mnemonic' && s.backupState === 'confirmed')).toBe(
      true,
    );
  } finally {
    realm.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

afterAll(() => Realm.shutdown());
