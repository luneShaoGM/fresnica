import { resolveLocalSigner } from '../resolveLocalSigner';
import type { StellarAccountAuthorization } from '../../accounts/types';

function account(
  overrides: Partial<StellarAccountAuthorization> = {},
): StellarAccountAuthorization {
  return {
    address: 'GACCOUNT',
    thresholds: { low: 1, medium: 1, high: 1 },
    signers: [{ publicKey: 'GSIGNER', weight: 1 }],
    ...overrides,
  };
}

describe('resolveLocalSigner', () => {
  it('selects one ledger-authorized local signer that meets the threshold', () => {
    expect(resolveLocalSigner(account(), ['GSIGNER'], 'medium')).toEqual({
      status: 'ready',
      signerPublicKey: 'GSIGNER',
      requiredWeight: 1,
      availableWeight: 1,
    });
  });

  it('reports watch-only when the account has no ledger-authorized local signer', () => {
    expect(resolveLocalSigner(account(), [], 'medium')).toEqual({
      status: 'watch-only',
      requiredWeight: 1,
      availableWeight: 0,
    });
  });

  it('reports insufficient weight when local authorized weight cannot reach the threshold', () => {
    expect(
      resolveLocalSigner(
        account({ thresholds: { low: 1, medium: 2, high: 2 } }),
        ['GSIGNER'],
        'medium',
      ),
    ).toEqual({
      status: 'insufficient-weight',
      requiredWeight: 2,
      availableWeight: 1,
    });
  });

  it('reports unsupported multisig when several local signers are needed to reach the threshold', () => {
    expect(
      resolveLocalSigner(
        account({
          thresholds: { low: 1, medium: 2, high: 2 },
          signers: [
            { publicKey: 'GSIGNER_A', weight: 1 },
            { publicKey: 'GSIGNER_B', weight: 1 },
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

  it('ignores a local signer whose current ledger weight is zero', () => {
    expect(
      resolveLocalSigner(
        account({ signers: [{ publicKey: 'GSIGNER', weight: 0 }] }),
        ['GSIGNER'],
        'low',
      ),
    ).toEqual({
      status: 'watch-only',
      requiredWeight: 1,
      availableWeight: 0,
    });
  });

  it('chooses a single sufficient signer even when other local signers are also present', () => {
    expect(
      resolveLocalSigner(
        account({
          thresholds: { low: 1, medium: 2, high: 3 },
          signers: [
            { publicKey: 'GLOW', weight: 1 },
            { publicKey: 'GHIGH', weight: 2 },
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
});
