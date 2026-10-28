import type { FresnicaSdkPort } from '../../ports/FresnicaSdkPort';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import { authorizeSensitiveSetting } from '../authorizeSensitiveSetting';
function setup(withSigner = true) {
  const repository = new InMemoryAccountSignerRepository();
  if (withSigner)
    repository.createSigner({
      id: 's',
      publicKey: 'GS',
      kind: 'protected-software',
      envelopeJson: '{encrypted}',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  const verify = jest.fn(async () => true);
  const sdk = { verifyProtectedSignerPassphrase: verify } as unknown as FresnicaSdkPort;
  return { repository, verify, deps: { repository, sdk } };
}
describe('operation-scoped sensitive setting authorization', () => {
  it('uses only verification, rejects an incorrect credential and accepts a fresh retry', async () => {
    const s = setup();
    const signal = new AbortController().signal;
    s.verify.mockResolvedValueOnce(false);
    await expect(authorizeSensitiveSetting(s.deps, 'wrong', signal)).rejects.toThrow('invalid-passcode');
    await expect(authorizeSensitiveSetting(s.deps, 'fresh', signal)).resolves.toBeUndefined();
    expect(s.verify).toHaveBeenLastCalledWith({
      envelopeJson: '{encrypted}',
      appPassphrase: 'fresh',
      expectedSignerPublicKey: 'GS',
    });
  });
  it('does not authenticate a zero-signer wallet', async () => {
    const s = setup(false);
    await expect(authorizeSensitiveSetting(s.deps, 'anything', new AbortController().signal)).rejects.toThrow(
      'protected-signer-required',
    );
    expect(s.verify).not.toHaveBeenCalled();
  });
  it('rejects cancellation and a changed signer inventory after native verification', async () => {
    const s = setup();
    const controller = new AbortController();
    s.verify.mockImplementationOnce(async () => {
      controller.abort();
      return true;
    });
    await expect(authorizeSensitiveSetting(s.deps, 'fresh', controller.signal)).rejects.toThrow('operation-cancelled');
    s.verify.mockImplementationOnce(async () => {
      s.repository.createSigner({
        id: 'another',
        publicKey: 'GA',
        kind: 'protected-software',
        envelopeJson: '{other}',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return true;
    });
    await expect(authorizeSensitiveSetting(s.deps, 'fresh', new AbortController().signal)).rejects.toThrow(
      'authorization-context-changed',
    );
  });
});
