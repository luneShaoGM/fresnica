import type { SignerRecord } from '../signer/types';
import type { AccountSignerReference } from './types';

export function isWatchOnly(
  accountId: string,
  references: readonly AccountSignerReference[],
): boolean {
  return !references.some(reference => reference.accountId === accountId);
}

export function findOrphanSignerIds(
  signers: readonly SignerRecord[],
  references: readonly AccountSignerReference[],
): string[] {
  const referencedSignerIds = new Set(
    references.map(reference => reference.signerId),
  );

  return signers
    .filter(signer => !referencedSignerIds.has(signer.id))
    .map(signer => signer.id);
}
