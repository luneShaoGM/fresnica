import type {AccountSignerRepository} from '../account/AccountSignerRepository';
import type {SignerRecord} from '../signer/types';
import type {FresnicaSdk} from '../../platform/fresnica/FresnicaSdk';

export type ApplicationSecurityDependencies = Readonly<{
  sdk: FresnicaSdk;
  repository: AccountSignerRepository;
}>;

export type SystemAuthStatus = Readonly<{
  available: boolean;
  domainInitialized: boolean;
  protectedSignerCount: number;
  enrolledSignerCount: number;
}>;

export type EnableSystemAuthResult = Readonly<{
  status: SystemAuthStatus;
  failedSignerPublicKeys: readonly string[];
}>;

export async function getSystemAuthStatus(
  dependencies: ApplicationSecurityDependencies,
): Promise<SystemAuthStatus> {
  const protectedSigners = protectedSoftwareSigners(dependencies.repository.listSigners());
  const available = await dependencies.sdk.canUseSystemAuth();
  const domainInitialized = await dependencies.sdk.hasSystemAuthDomain();

  if (!domainInitialized || protectedSigners.length === 0) {
    return {
      available,
      domainInitialized,
      protectedSignerCount: protectedSigners.length,
      enrolledSignerCount: 0,
    };
  }

  const enrollment = await Promise.all(
    protectedSigners.map(signer =>
      dependencies.sdk.hasSignerSystemAuth(signer.publicKey),
    ),
  );

  return {
    available,
    domainInitialized,
    protectedSignerCount: protectedSigners.length,
    enrolledSignerCount: enrollment.filter(Boolean).length,
  };
}

export async function enableSystemAuth(
  dependencies: ApplicationSecurityDependencies,
  input: Readonly<{appPassphrase: string; reason: string}>,
): Promise<EnableSystemAuthResult> {
  const protectedSigners = protectedSoftwareSigners(dependencies.repository.listSigners());
  if (protectedSigners.length === 0) {
    throw new Error('protected-signer-required');
  }

  if (!(await dependencies.sdk.canUseSystemAuth())) {
    throw new Error('system-auth-unavailable');
  }

  if (!(await dependencies.sdk.hasSystemAuthDomain())) {
    await dependencies.sdk.initializeSystemAuth(input.reason);
  }

  const failedSignerPublicKeys: string[] = [];
  for (const signer of protectedSigners) {
    try {
      await dependencies.sdk.registerSignerSystemAuth({
        envelopeJson: signer.envelopeJson!,
        appPasscode: input.appPassphrase,
        expectedSignerPublicKey: signer.publicKey,
      });
    } catch {
      failedSignerPublicKeys.push(signer.publicKey);
    }
  }

  return {
    status: await getSystemAuthStatus(dependencies),
    failedSignerPublicKeys,
  };
}

export async function disableSystemAuth(
  dependencies: ApplicationSecurityDependencies,
): Promise<SystemAuthStatus> {
  if (await dependencies.sdk.hasSystemAuthDomain()) {
    await dependencies.sdk.removeSystemAuthDomain();
  }
  return getSystemAuthStatus(dependencies);
}

function protectedSoftwareSigners(signers: readonly SignerRecord[]): SignerRecord[] {
  return signers.filter(
    signer => signer.kind === 'protected-software' && Boolean(signer.envelopeJson),
  );
}
