import type {AccountRecord, AccountSignerReference} from '../../../../capabilities/account/types';
import type {SignerRecord} from '../../../../capabilities/signer/types';
import {
  mapAccountFromRealm,
  mapAccountSignerReferenceFromRealm,
  mapSignerFromRealm,
} from '../mappers';

describe('Realm persistence mappers', () => {
  it('maps Account data to a detached plain object and copies Dates', () => {
    const createdAt = new Date('2026-08-28T00:00:00.000Z');
    const updatedAt = new Date('2026-08-28T01:00:00.000Z');
    const persisted = {
      id: 'account-1',
      address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      identityKind: 'classic',
      networkId: 'testnet',
      label: 'Primary',
      sortOrder: 1,
      hidden: false,
      createdAt,
      updatedAt,
    };

    const account: AccountRecord = mapAccountFromRealm(persisted);

    expect(account).toEqual(persisted);
    expect(account).not.toBe(persisted);
    expect(account.createdAt).not.toBe(createdAt);
    expect(account.updatedAt).not.toBe(updatedAt);
  });

  it('fails closed for an unknown persisted account identity kind', () => {
    expect(() =>
      mapAccountFromRealm({
        id: 'account-1',
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        identityKind: 'future-kind',
        networkId: 'testnet',
        label: 'Primary',
        sortOrder: 1,
        hidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toThrow('invalid-persisted-account');
  });

  it('maps Signer data without inspecting the opaque envelope', () => {
    const createdAt = new Date('2026-08-28T00:00:00.000Z');
    const updatedAt = new Date('2026-08-28T01:00:00.000Z');
    const persisted = {
      id: 'signer-1',
      publicKey: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      kind: 'protected-software',
      envelopeJson: '{not-json-on-purpose',
      envelopeRevision: 'rev-1',
      recoveryKind: 'mnemonic',
      backupState: 'confirmed',
      providerId: null,
      providerMetadataJson: null,
      createdAt,
      updatedAt,
    };

    const signer: SignerRecord = mapSignerFromRealm(persisted);

    expect(signer).toEqual({
      id: 'signer-1',
      publicKey: persisted.publicKey,
      kind: 'protected-software',
      envelopeJson: '{not-json-on-purpose',
      envelopeRevision: 'rev-1',
      recoveryKind: 'mnemonic',
      backupState: 'confirmed',
      createdAt,
      updatedAt,
    });
    expect(signer.createdAt).not.toBe(createdAt);
    expect(signer.updatedAt).not.toBe(updatedAt);
  });

  it.each([
    ['kind', 'future-signer'],
    ['recoveryKind', 'future-recovery'],
    ['backupState', 'future-backup'],
  ] as const)('fails closed for unknown persisted Signer %s values', (field, value) => {
    expect(() =>
      mapSignerFromRealm({
        id: 'signer-1',
        publicKey: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        kind: 'protected-software',
        envelopeJson: null,
        envelopeRevision: null,
        recoveryKind: null,
        backupState: null,
        providerId: null,
        providerMetadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        [field]: value,
      }),
    ).toThrow('invalid-persisted-signer');
  });

  it('maps relationship ids and copies the Date', () => {
    const createdAt = new Date('2026-08-28T00:00:00.000Z');
    const persisted = {
      id: 'account-1:signer-1',
      accountId: 'account-1',
      signerId: 'signer-1',
      createdAt,
    };

    const reference: AccountSignerReference =
      mapAccountSignerReferenceFromRealm(persisted);

    expect(reference).toEqual(persisted);
    expect(reference).not.toBe(persisted);
    expect(reference.createdAt).not.toBe(createdAt);
  });
});
