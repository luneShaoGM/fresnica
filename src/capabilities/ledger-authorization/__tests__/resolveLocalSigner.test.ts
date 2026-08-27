import { resolveLocalSigner } from '../resolveLocalSigner';
import type { ClassicLedgerAuthorization } from '../types';

function authorization(
  overrides: Partial<ClassicLedgerAuthorization> = {},
): ClassicLedgerAuthorization {
  return {
    address: 'GACCOUNT',
    thresholds: { low: 1, medium: 1, high: 1 },
    signers: [{ kind: 'ed25519', publicKey: 'GSIGNER', weight: 1 }],
    ...overrides,
  };
}

describe('resolveLocalSigner', () => {
  it('selects one ledger-authorized local Ed25519 signer that meets the threshold', () => {
    expect(resolveLocalSigner(authorization(), ['GSIGNER'], 'medium')).toEqual({
      status: 'ready',
      signerPublicKey: 'GSIGNER',
      requiredWeight: 1,
      availableWeight: 1,
    });
  });

  it('reports watch-only when the account has no ledger-authorized local signer', () => {
    expect(resolveLocalSigner(authorization(), [], 'medium')).toEqual({
      status: 'watch-only',
      requiredWeight: 1,
      availableWeight: 0,
    });
  });

  it('reports insufficient weight when local authorized weight cannot reach the threshold', () => {
    expect(
      resolveLocalSigner(
        authorization({ thresholds: { low: 1, medium: 2, high: 2 } }),
        ['GSIGNER'],
        'medium',
      ),
    ).toEqual({
      status: 'insufficient-weight',
      requiredWeight: 2,
      availableWeight: 1,
    });
  });

  it('reports unsupported multisig when several local Ed25519 signers are needed', () => {
    expect(
      resolveLocalSigner(
        authorization({
          thresholds: { low: 1, medium: 2, high: 2 },
          signers: [
            { kind: 'ed25519', publicKey: 'GSIGNER_A', weight: 1 },
            { kind: 'ed25519', publicKey: 'GSIGNER_B', weight: 1 },
          ],
        }),
        ['GSIGNER_A', 'GSIGNER_B'],
        'medium',
      ),
    ).toEqual({
      status: 'unsupported-multisig',
      requiredWeight: 2,
      availableWeight: 2,
      signerPublicKeys: ['GSIGNER_A', 'GSIGNER_B'],
    });
  });

  it('ignores a local Ed25519 signer whose current ledger weight is zero', () => {
    expect(
      resolveLocalSigner(
        authorization({
          signers: [{ kind: 'ed25519', publicKey: 'GSIGNER', weight: 0 }],
        }),
        ['GSIGNER'],
        'low',
      ),
    ).toEqual({
      status: 'watch-only',
      requiredWeight: 1,
      availableWeight: 0,
    });
  });

  it('chooses one sufficient signer even when other local Ed25519 signers are present', () => {
    expect(
      resolveLocalSigner(
        authorization({
          thresholds: { low: 1, medium: 2, high: 3 },
          signers: [
            { kind: 'ed25519', publicKey: 'GLOW', weight: 1 },
            { kind: 'ed25519', publicKey: 'GHIGH', weight: 2 },
          ],
        }),
        ['GLOW', 'GHIGH'],
        'medium',
      ),
    ).toEqual({
      status: 'ready',
      signerPublicKey: 'GHIGH',
      requiredWeight: 2,
      availableWeight: 3,
    });
  });

  it('never treats a pre-authorized transaction condition as a local Ed25519 signer', () => {
    expect(
      resolveLocalSigner(
        authorization({
          signers: [{ kind: 'preauth-tx', key: 'GLOCAL', weight: 1 }],
        }),
        ['GLOCAL'],
        'medium',
      ),
    ).toEqual({ status: 'watch-only', requiredWeight: 1, availableWeight: 0 });
  });

  it('never treats a Hash-X condition as a local Ed25519 signer', () => {
    expect(
      resolveLocalSigner(
        authorization({ signers: [{ kind: 'hash-x', key: 'GLOCAL', weight: 1 }] }),
        ['GLOCAL'],
        'medium',
      ),
    ).toEqual({ status: 'watch-only', requiredWeight: 1, availableWeight: 0 });
  });

  it('never treats a signed-payload condition as a local Ed25519 signer', () => {
    expect(
      resolveLocalSigner(
        authorization({
          signers: [{ kind: 'signed-payload', key: 'GLOCAL', weight: 1 }],
        }),
        ['GLOCAL'],
        'medium',
      ),
    ).toEqual({ status: 'watch-only', requiredWeight: 1, availableWeight: 0 });
  });
});
