import type {AccountSignerRepository} from '../../../capabilities/account/AccountSignerRepository';
import type {SignerRecord} from '../../../capabilities/signer/types';
import {resolveSendSigner} from '../resolveSendSigner';

function signer(id: string): SignerRecord {
  return {
    id,
    publicKey: `G${id}`,
    kind: 'protected-software',
    envelopeJson: '{opaque}',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function repository(signers: SignerRecord[]): AccountSignerRepository {
  return {
    listSignersForAccount: jest.fn().mockReturnValue(signers),
  } as unknown as AccountSignerRepository;
}

describe('resolveSendSigner', () => {
  it('returns the only attached signer', () => {
    const only = signer('one');
    expect(resolveSendSigner(repository([only]), 'account')).toBe(only);
  });

  it('fails closed for watch-only accounts', () => {
    expect(() => resolveSendSigner(repository([]), 'account')).toThrow(
      'send-watch-only-account',
    );
  });

  it('fails closed instead of silently choosing one signer for multisig', () => {
    expect(() =>
      resolveSendSigner(repository([signer('one'), signer('two')]), 'account'),
    ).toThrow('send-multisig-not-supported');
  });
});
