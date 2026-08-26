import type {
  StellarAccountAuthorization,
  StellarThresholdLevel,
} from '../accounts/types';

export type SignerResolution =
  | {
      status: 'ready';
      signerPublicKey: string;
      requiredWeight: number;
      availableWeight: number;
    }
  | {
      status: 'watch-only';
      requiredWeight: number;
      availableWeight: 0;
    }
  | {
      status: 'insufficient-weight';
      requiredWeight: number;
      availableWeight: number;
    }
  | {
      status: 'unsupported-multisig';
      requiredWeight: number;
      availableWeight: number;
      signerPublicKeys: string[];
    };

export function resolveLocalSigner(
  account: StellarAccountAuthorization,
  localSignerPublicKeys: readonly string[],
  thresholdLevel: StellarThresholdLevel,
): SignerResolution {
  const requiredWeight = account.thresholds[thresholdLevel];
  const localSignerSet = new Set(localSignerPublicKeys);
  const authorizedLocalSigners = account.signers.filter(
    signer => signer.weight > 0 && localSignerSet.has(signer.publicKey),
  );

  if (authorizedLocalSigners.length === 0) {
    return {
      status: 'watch-only',
      requiredWeight,
      availableWeight: 0,
    };
  }

  const availableWeight = authorizedLocalSigners.reduce(
    (total, signer) => total + signer.weight,
    0,
  );
  const independentlySufficient = authorizedLocalSigners
    .filter(signer => signer.weight >= requiredWeight)
    .sort(
      (left, right) =>
        right.weight - left.weight || left.publicKey.localeCompare(right.publicKey),
    );

  if (independentlySufficient.length > 0) {
    return {
      status: 'ready',
      signerPublicKey: independentlySufficient[0].publicKey,
      requiredWeight,
      availableWeight,
    };
  }

  if (availableWeight < requiredWeight) {
    return {
      status: 'insufficient-weight',
      requiredWeight,
      availableWeight,
    };
  }

  return {
    status: 'unsupported-multisig',
    requiredWeight,
    availableWeight,
    signerPublicKeys: authorizedLocalSigners.map(signer => signer.publicKey),
  };
}
