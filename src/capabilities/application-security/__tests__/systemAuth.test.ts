import type {FresnicaSdk} from '../../../platform/fresnica/FresnicaSdk';
import {InMemoryAccountSignerRepository} from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type {SignerRecord} from '../../signer/types';
import {
  disableSystemAuth,
  enableSystemAuth,
  getSystemAuthStatus,
} from '../systemAuth';

const now = new Date('2026-08-31T00:00:00.000Z');

function protectedSigner(id: string): SignerRecord {
  return {
    id,
    publicKey: `G${id}`,
    kind: 'protected-software',
    envelopeJson: `{${id}-envelope}`,
    createdAt: now,
    updatedAt: now,
  };
}

function createDependencies(input?: {
  available?: boolean;
  domainInitialized?: boolean;
  enrolled?: readonly string[];
  registrationFailures?: readonly string[];
}) {
  const repository = new InMemoryAccountSignerRepository();
  const enrolled = new Set(input?.enrolled ?? []);
  let domainInitialized = input?.domainInitialized ?? false;
  const registrationFailures = new Set(input?.registrationFailures ?? []);

  const sdk = {
    canUseSystemAuth: jest.fn().mockResolvedValue(input?.available ?? true),
    hasSystemAuthDomain: jest.fn(async () => domainInitialized),
    initializeSystemAuth: jest.fn(async () => {
      domainInitialized = true;
      return true;
    }),
    hasSignerSystemAuth: jest.fn(async (publicKey: string) => enrolled.has(publicKey)),
    registerSignerSystemAuth: jest.fn(async ({expectedSignerPublicKey}: {expectedSignerPublicKey: string}) => {
      if (registrationFailures.has(expectedSignerPublicKey)) {
        throw new Error('invalid-passcode');
      }
      enrolled.add(expectedSignerPublicKey);
      return true;
    }),
    removeSystemAuthDomain: jest.fn(async () => {
      domainInitialized = false;
      enrolled.clear();
      return true;
    }),
  } as unknown as jest.Mocked<FresnicaSdk>;

  return {repository, sdk, dependencies: {repository, sdk}};
}

describe('application System Auth', () => {
  it('reports device/domain/signer enrollment status', async () => {
    const {repository, dependencies} = createDependencies({
      domainInitialized: true,
      enrolled: ['Gsigner-a'],
    });
    repository.createSigner(protectedSigner('signer-a'));
    repository.createSigner(protectedSigner('signer-b'));

    await expect(getSystemAuthStatus(dependencies)).resolves.toEqual({
      available: true,
      domainInitialized: true,
      protectedSignerCount: 2,
      enrolledSignerCount: 1,
    });
  });

  it('initializes the device domain once and registers every protected signer', async () => {
    const {repository, sdk, dependencies} = createDependencies();
    repository.createSigner(protectedSigner('signer-a'));
    repository.createSigner(protectedSigner('signer-b'));

    const result = await enableSystemAuth(dependencies, {
      appPassphrase: 'a strong app passphrase',
      reason: 'Enable Fresnica System Auth',
    });

    expect(sdk.initializeSystemAuth).toHaveBeenCalledTimes(1);
    expect(sdk.registerSignerSystemAuth).toHaveBeenCalledTimes(2);
    expect(result.failedSignerPublicKeys).toEqual([]);
    expect(result.status.enrolledSignerCount).toBe(2);
  });

  it('keeps partial registration failures visible and retryable', async () => {
    const {repository, dependencies} = createDependencies({
      domainInitialized: true,
      registrationFailures: ['Gsigner-b'],
    });
    repository.createSigner(protectedSigner('signer-a'));
    repository.createSigner(protectedSigner('signer-b'));

    const result = await enableSystemAuth(dependencies, {
      appPassphrase: 'a strong app passphrase',
      reason: 'Enable Fresnica System Auth',
    });

    expect(result.failedSignerPublicKeys).toEqual(['Gsigner-b']);
    expect(result.status.enrolledSignerCount).toBe(1);
  });

  it('fails closed when System Auth is unavailable', async () => {
    const {repository, sdk, dependencies} = createDependencies({available: false});
    repository.createSigner(protectedSigner('signer-a'));

    await expect(
      enableSystemAuth(dependencies, {
        appPassphrase: 'a strong app passphrase',
        reason: 'Enable Fresnica System Auth',
      }),
    ).rejects.toThrow('system-auth-unavailable');
    expect(sdk.initializeSystemAuth).not.toHaveBeenCalled();
  });

  it('removes the whole device domain when disabled', async () => {
    const {repository, sdk, dependencies} = createDependencies({
      domainInitialized: true,
      enrolled: ['Gsigner-a'],
    });
    repository.createSigner(protectedSigner('signer-a'));

    await expect(disableSystemAuth(dependencies)).resolves.toEqual({
      available: true,
      domainInitialized: false,
      protectedSignerCount: 1,
      enrolledSignerCount: 0,
    });
    expect(sdk.removeSystemAuthDomain).toHaveBeenCalledTimes(1);
  });
});
