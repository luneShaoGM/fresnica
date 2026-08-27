import { resolveLocalSigner } from '../resolveLocalSigner';
import type { ClassicLedgerAuthorization } from '../types';

const authorization = (
  signers: ClassicLedgerAuthorization['signers'],
): ClassicLedgerAuthorization => ({
  address: 'GSOURCE',
  thresholds: { low: 1, medium: 1, high: 2 },
  signers,
});

describe('resolveLocalSigner typed ledger authorization', () => {
  it('accepts an available Ed25519 condition that individually satisfies the threshold', () => {
    expect(
      resolveLocalSigner(
        authorization([{ kind: 'ed25519', publicKey: 'GLOCAL', weight: 1 }]),
        ['GLOCAL'],
        'medium',
      ),
    ).toEqual({
      status: 'ready',
      signerPublicKey: 'GLOCAL',
      requiredWeight: 1,
      availableWeight: 1,
    });
  });

  it('never treats a pre-authorized transaction key as a local Ed25519 signer', () => {
    expect(
      resolveLocalSigner(
        authorization([{ kind: 'preauth-tx', key: 'GLOCAL', weight: 1 }]),
        ['GLOCAL'],
        'medium',
      ),
    ).toEqual({ status: 'watch-only', requiredWeight: 1, availableWeight: 0 });
  });

  it('never treats a Hash-X key as a local Ed25519 signer', () => {
    expect(
      resolveLocalSigner(
        authorization([{ kind: 'hash-x', key: 'GLOCAL', weight: 1 }]),
        ['GLOCAL'],
        'medium',
      ),
    ).toEqual({ status: 'watch-only', requiredWeight: 1, availableWeight: 0 });
  });
});
