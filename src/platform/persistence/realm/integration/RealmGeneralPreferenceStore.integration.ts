import Realm from 'realm';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openGeneralPreferences, RealmGeneralPreferenceStore } from '../RealmGeneralPreferenceStore';
import { DEFAULT_GENERAL_PREFERENCES } from '@capabilities/preferences/generalPreferences';
it('persists public preferences across closing/reopening without changing the wallet schema', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'general-settings-'));
  const path = join(directory, 'wallet.realm');
  let realm = await openGeneralPreferences(path);
  try {
    new RealmGeneralPreferenceStore(realm).save({
      ...DEFAULT_GENERAL_PREFERENCES,
      theme: 'image',
      imagePalette: { primary: '#113355', secondary: '#224466' },
      currency: 'EUR',
    });
    realm.close();
    realm = await openGeneralPreferences(path);
    expect(new RealmGeneralPreferenceStore(realm).load()).toMatchObject({ theme: 'image', currency: 'EUR' });
  } finally {
    realm.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
afterAll(() => Realm.shutdown());
