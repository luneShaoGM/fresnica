import type { SignerRecord } from '../../signer/types';
import type { AccountSignerReference } from '../types';
import { findOrphanSignerIds, isWatchOnly } from '../walletInvariants';

const now = new Date('2026-08-26T00:00:00.000Z');

const signer = (id: string): SignerRecord => ({
  id,
  publicKey: `G${id}`,
  kind: 'protected-software',
  envelopeJson: '{}',
  envelopeRevision: 'rev-1',
  recoveryKind: 'secret',
  backupState: 'not-required',
  createdAt: now,
  updatedAt: now,
});

const reference = (
  accountId: string,
  signerId: string,
): AccountSignerReference => ({
  id: `${accountId}:${signerId}`,
  accountId,
  signerId,
  createdAt: now,
});

describe('account signer invariants', () => {
  it('derives watch-only from the absence of local signer references', () => {
    const references = [reference('account-a', 'signer-a')];

    expect(isWatchOnly('account-a', references)).toBe(false);
    expect(isWatchOnly('account-b', references)).toBe(true);
  });

  it('only reports signers with no account references as orphaned', () => {
    const signers = [signer('signer-a'), signer('signer-b')];
    const references = [
      reference('account-a', 'signer-a'),
      reference('account-b', 'signer-a'),
    ];

    expect(findOrphanSignerIds(signers, references)).toEqual(['signer-b']);
  });

  it('does not orphan a signer that remains shared by another account', () => {
    const signers = [signer('shared')];
    const remainingReferences = [reference('account-b', 'shared')];

    expect(findOrphanSignerIds(signers, remainingReferences)).toEqual([]);
  });
});
